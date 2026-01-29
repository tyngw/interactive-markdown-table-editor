/**
 * Git差分情報を取得するユーティリティ
 * VS CodeのGit APIを使用して、ファイルの差分情報を取得し、
 * テーブルの行ごとに差分情報をマッピングする
 */

import * as vscode from 'vscode';
import { debug, warn, error } from './logging';

/**
 * セルのGit差分状態
 * MODIFIED は廃止。変更は DELETED + ADDED で表現し、oldContent で変更前の内容を保持
 */
export enum GitDiffStatus {
    UNCHANGED = 'unchanged',
    ADDED = 'added',
    DELETED = 'deleted'
}


/**
 * 行のGit差分情報
 */
export interface RowGitDiff {
    row: number;
    status: GitDiffStatus;
    oldContent?: string;  // 削除された行の内容（変更前の行を表示するため）
    newContent?: string;  // 追加された行の内容（列差分検出用）
    isDeletedRow?: boolean;  // 削除行の表示用フラグ（実データ行ではない）
}

/**
 * テーブルのGit差分情報
 */
export interface TableGitDiff {
    tableIndex: number;
    rows: RowGitDiff[];
}

/**
 * Git関連の文脈をまとめて扱うためのコンテキスト
 */
interface GitContext {
    git: any;
    workspaceFolder: vscode.WorkspaceFolder;
    repository: any;
    fileStatus: 'added' | 'modified' | 'deleted';
}

/**
 * 列の位置変更情報
 * 中間列の追加・削除を検知した際の詳細情報
 */
export interface ColumnPositionChange {
    index: number;              // 変更位置（追加の場合は新しい列番号、削除の場合は旧列番号）
    type: 'added' | 'removed' | 'renamed';
    header?: string;            // ヘッダ名（わかる場合）
    confidence: number;         // 検出信頼度（0.0〜1.0）
    oldIndex?: number;          // renamed時の旧インデックス
    newIndex?: number;          // renamed時の新インデックス
}

/**
 * 列の差分情報
 * 変更前と変更後の列数を比較して、追加・削除された列を検出
 */
export interface ColumnDiffInfo {
    oldColumnCount: number;      // 変更前の列数
    newColumnCount: number;      // 変更後の列数
    addedColumns: number[];      // 追加された列のインデックス（変更後の列番号）
    deletedColumns: number[];    // 削除された列のインデックス（変更前の列番号）
    oldHeaders?: string[];       // 変更前のヘッダ（削除列表示用）
    newHeaders?: string[];       // 変更後のヘッダ
    changeType?: 'added' | 'removed' | 'mixed' | 'none';  // 変更種別
    positions?: ColumnPositionChange[];  // 各位置の変更詳細
    mapping?: number[];          // 旧インデックス→新インデックスのマッピング（-1は削除）
    heuristics?: string[];       // 適用した検出手法のメモ
}

/**
 * Git APIが初期化されるまで待機する
 * @param timeoutMs タイムアウト（ミリ秒）
 * @returns 初期化されたGit API。タイムアウトした場合はnull
 */
async function waitForGitApi(timeoutMs: number = 5000): Promise<any | null> {
    debug('[GitDiffDebug] Starting waitForGitApi');
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            debug('[GitDiffDebug] Git extension not found.');
            return null;
        }
        debug(`[GitDiffDebug] Git extension found. isActive: ${gitExtension.isActive}`);

        // 拡張機能が有効でない場合は有効化
        if (!gitExtension.isActive) {
            debug('[GitDiffDebug] Activating Git extension...');
            await gitExtension.activate();
            debug('[GitDiffDebug] Git extension activated.');
        }

        const git = gitExtension.exports.getAPI(1);
        if (!git) {
            debug('[GitDiffDebug] Git API not available');
            return null;
        }
        debug(`[GitDiffDebug] Git API obtained. Initial state: ${git.state}`);

        // 既に初期化済み
        if (git.state === 'initialized') {
            debug('[GitDiffDebug] Git API is already initialized.');
            return git;
        }

        // 初期化を待機（ポーリング）
        debug('[GitDiffDebug] Waiting for Git API to initialize...');
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            if (git.state === 'initialized') {
                debug('[GitDiffDebug] Git API has been initialized.');
                return git;
            }
            debug(`[GitDiffDebug] Polling: git.state is ${git.state}`);
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms待機
        }
        warn(`[GitDiffDebug] Git API did not initialize within ${timeoutMs}ms.`);
        return null;
    } catch (err) {
        error('[GitDiffDebug] Error while waiting for Git API:', err);
        return null;
    }
}

/**
 * Git差分情報を取得
 * @param uri ファイルのURI
 * @param tableStartLine テーブルの開始行（0ベース）
 * @param tableEndLine テーブルの終了行（0ベース）
 * @param rowCount テーブルの行数
 * @param tableContent テーブルの内容（行番号マッピング用）
 * @returns Git差分情報
 */
export async function getGitDiffForTable(
    uri: vscode.Uri,
    tableStartLine: number,
    tableEndLine: number,
    rowCount: number,
    tableContent?: string
): Promise<RowGitDiff[]> {
    try {
        const context = await resolveGitContext(uri);
        if (!context) {
            return [];
        }

        const { workspaceFolder, fileStatus } = context;

        // 詳細な行ごとの差分情報を取得（毎回新規に取得する）
        const lineDiffs = await getLineByLineDiff(uri, workspaceFolder.uri.fsPath, tableStartLine, tableEndLine);
        
        if (!lineDiffs || lineDiffs.length === 0) {
            // 差分情報が取得できない場合、ファイル全体の状態を使用
            if (fileStatus === 'added') {
                return buildAddedRowDiffs(rowCount);
            }
            return [];
        }

        // テーブルの行とGit diffの行をマッピング
        // テーブル内容が提供されている場合は、より正確なマッピングを行う
        return mapTableRowsToGitDiff(lineDiffs, tableStartLine, rowCount, tableContent);
    } catch (err) {
        error('[GitDiff] Error getting git diff:', err);
        return [];
    }
}

/**
 * ファイルのGit変更状態を取得
 */
function getFileStatus(
    repository: any,
    uri: vscode.Uri
): 'added' | 'modified' | 'deleted' | null {
    try {
        // 作業ツリーの変更を確認
        const workingTreeChange = repository.state.workingTreeChanges.find(
            (change: any) => change.uri.toString() === uri.toString()
        );

        if (workingTreeChange) {
            // ステータスを判定
            const status = workingTreeChange.status;
            if (status === 1) {return 'added';}      // Status.INDEX_ADDED
            if (status === 2) {return 'deleted';}    // Status.DELETED
            if (status === 3) {return 'modified';}   // Status.MODIFIED
            return 'modified'; // デフォルト
        }

        // ステージングエリアの変更を確認
        const indexChange = repository.state.indexChanges.find(
            (change: any) => change.uri.toString() === uri.toString()
        );

        if (indexChange) {
            const status = indexChange.status;
            if (status === 1) {return 'added';}
            if (status === 2) {return 'deleted';}
            if (status === 3) {return 'modified';}
            return 'modified';
        }

        return null;
    } catch (err) {
        error('[GitDiff] Error getting file status:', err);
        return null;
    }
}

/**
 * Gitコンテキストを解決するためのヘルパー
 */
async function resolveGitContext(uri: vscode.Uri): Promise<GitContext | null> {
    // Git APIが利用可能になるまで待機
    const git = await waitForGitApi();
    if (!git) {
        warn('[GitDiffDebug] Exiting getGitDiffForTable because Git API is not available.');
        return null;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        debug('[GitDiff] No workspace folder found');
        return null;
    }

    const repository = git.getRepository(workspaceFolder.uri);
    if (!repository) {
        debug('[GitDiff] No repository found');
        return null;
    }

    const fileStatus = getFileStatus(repository, uri);
    if (!fileStatus) {
        debug('[GitDiff] File not in git repository or no changes');
        return null;
    }

    return { git, workspaceFolder, repository, fileStatus };
}

/**
 * 新規ファイルの場合にテーブル全行を追加扱いで返す
 */
function buildAddedRowDiffs(rowCount: number): RowGitDiff[] {
    const rowDiffs: RowGitDiff[] = [];
    for (let i = 0; i < rowCount; i++) {
        rowDiffs.push({
            row: i,
            status: GitDiffStatus.ADDED
        });
    }
    return rowDiffs;
}

/**
 * 行ごとのGit差分情報
 */
interface LineDiff {
    lineNumber: number;  // 現在のファイルでの行番号（1ベース）
    status: GitDiffStatus;
    oldLineNumber?: number;  // 変更前のファイルでの行番号（削除された行の場合）
    oldContent?: string;  // 削除された行の元々の内容
    newContent?: string;  // 追加された行の内容
    hunkId?: number;  // hunk の識別子（同じ hunk 内の削除行と追加行をペアリングするため）
}

/**
 * Git diffコマンドを実行して行ごとの差分を取得
 */
async function getLineByLineDiff(
    uri: vscode.Uri,
    workspaceRoot: string,
    tableStartLine: number,
    tableEndLine: number
): Promise<LineDiff[] | null> {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const path = require('path');

        // ファイルの相対パスを取得
        const relativePath = path.relative(workspaceRoot, uri.fsPath).replace(/\\/g, '/');

        // git diffコマンドを実行（unified形式、行番号付き）
        // --unified=0 でコンテキスト行なし、--no-color で色なし
        const command = `git diff --unified=0 --no-color HEAD -- "${relativePath}"`;
        
        let diffOutput: string;
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: workspaceRoot,
                maxBuffer: 10 * 1024 * 1024, // 10MB
                encoding: 'utf8',
                timeout: 10000 // 10秒のタイムアウト
            });
            
            if (stderr && !stderr.includes('warning')) {
                    warn('[GitDiff] Git diff stderr:', stderr);
            }
            
            diffOutput = stdout;
        } catch (error: any) {
            // ファイルが新規追加の場合、git diffでは表示されない
            // git diff --cached でステージングエリアの変更を確認
            if (error.code === 1 && error.stdout) {
                // コード1は差分があることを意味する（エラーではない）
                diffOutput = error.stdout;
            } else if (error.code === 'ENOENT') {
                // gitコマンドが見つからない
                    warn('[GitDiff] Git command not found');
                return null;
            } else {
                // ステージングエリアの変更を確認
                try {
                    const { stdout } = await execAsync(`git diff --cached --unified=0 --no-color -- "${relativePath}"`, {
                        cwd: workspaceRoot,
                        maxBuffer: 10 * 1024 * 1024,
                        encoding: 'utf8',
                        timeout: 10000
                    });
                    diffOutput = stdout;
                } catch (cachedError: any) {
                    if (cachedError.code === 1 && cachedError.stdout) {
                        diffOutput = cachedError.stdout;
                    } else {
                        debug('[GitDiff] No diff found (file may be new or unchanged)');
                        return null;
                    }
                }
            }
        }

        if (!diffOutput || diffOutput.trim().length === 0) {
            return null;
        }

        // 差分を解析
        return parseGitDiff(diffOutput, tableStartLine, tableEndLine);
    } catch (err) {
        error('[GitDiff] Error executing git diff:', err);
        return null;
    }
}

// キャッシュ機構を無効化したため、clearDiffCache は不要になりました。

/**
 * Git diffの出力を解析して行ごとの差分情報を抽出
 * ADDED / DELETED のみを使用。削除行の内容を oldContent で保持する
 * 削除行は対応する追加行の直前に表示されるよう、newLineNumber を正しく割り当てる
 */
function parseGitDiff(
    diffOutput: string,
    _tableStartLine: number,
    _tableEndLine: number
): LineDiff[] {
    const lineDiffs: LineDiff[] = [];
    const lines = diffOutput.split('\n');
    
    let inHunk = false;
    let oldLineNumber = 0;
    let newLineNumber = 0;
    let hunkId = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // @@ -oldStart,oldCount +newStart,newCount @@ の形式を解析
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (hunkMatch) {
            inHunk = true;
            oldLineNumber = parseInt(hunkMatch[1], 10);
            newLineNumber = parseInt(hunkMatch[3], 10);
            hunkId++;  // 新しい hunk が始まるたびにインクリメント
            
            continue;
        }

        if (!inHunk) {
            continue;
        }

        if (line.startsWith('\\') || line.trim() === '') {
            continue;
        }

        if (line.startsWith('-') && !line.startsWith('---')) {
            // 削除行を DELETED として記録
            // 削除行は oldLineNumber を使用して位置を特定
            const deletedContent = line.substring(1);
            debug('[parseGitDiff] DELETED line:', { oldLineNumber, newLineNumber, deletedContent });
            lineDiffs.push({
                lineNumber: oldLineNumber,  // 削除行は元の行番号を使用
                status: GitDiffStatus.DELETED,
                oldLineNumber: oldLineNumber,
                oldContent: deletedContent,
                hunkId: hunkId
            });
            oldLineNumber++;
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
            // 追加行を ADDED として記録
            const addedContent = line.substring(1);
            debug('[parseGitDiff] ADDED line:', { newLineNumber, content: addedContent });
            lineDiffs.push({
                lineNumber: newLineNumber,
                status: GitDiffStatus.ADDED,
                newContent: addedContent,
                hunkId: hunkId
            });
            newLineNumber++;
        } else {
            // Unchanged line
            oldLineNumber++;
            newLineNumber++;
        }
    }

    return lineDiffs;
}

/**
 * テーブルの行とGit diffの行をマッピング
 * Markdownテーブルの構造:
 * - 行0: ヘッダー行（例: | Header1 | Header2 |）
 * - 行1: 区切り行（例: | --- | --- |）
 * - 行2以降: データ行（例: | Data1 | Data2 |）
 * 
 * 削除行は対応する追加行の直前に表示される
 * 同じ hunk 内の削除行と追加行をペアリング
 */
function mapTableRowsToGitDiff(
    lineDiffs: LineDiff[],
    tableStartLine: number,
    rowCount: number,
    _tableContent?: string
): RowGitDiff[] {
    debug('[mapTableRowsToGitDiff] Input:', {
        tableStartLine,
        rowCount,
        lineDiffsLength: lineDiffs.length
    });

    const groupedByHunk = groupLineDiffsByHunk(lineDiffs, tableStartLine, rowCount);
    const result: RowGitDiff[] = [];

    for (const [, hunk] of groupedByHunk.entries()) {
        appendHunkDiffs(result, hunk.deleted, hunk.added, tableStartLine, rowCount);
    }

    return dedupeRowDiffs(result);
}

function groupLineDiffsByHunk(
    lineDiffs: LineDiff[],
    tableStartLine: number,
    rowCount: number
): Map<number, { deleted: LineDiff[]; added: LineDiff[] }> {
    const hunkMap = new Map<number, { deleted: LineDiff[]; added: LineDiff[] }>();

    for (const diff of lineDiffs) {
        const hunkId = diff.hunkId ?? 0;
        if (!hunkMap.has(hunkId)) {
            hunkMap.set(hunkId, { deleted: [], added: [] });
        }
        const hunk = hunkMap.get(hunkId)!;

        if (diff.status === GitDiffStatus.DELETED) {
            hunk.deleted.push(diff);
        } else {
            hunk.added.push(diff);
        }

        debug('[mapTableRowsToGitDiff] Processing:', {
            status: diff.status,
            oldLineNumber: diff.oldLineNumber,
            lineNumber: diff.lineNumber,
            calculated_tableRow: toTableRow(diff, tableStartLine),
            hunkId: hunkId,
            rowCount
        });
    }

    return hunkMap;
}

function appendHunkDiffs(
    accumulator: RowGitDiff[],
    deleted: LineDiff[],
    added: LineDiff[],
    tableStartLine: number,
    rowCount: number
): void {
    const pairCount = Math.min(deleted.length, added.length);

    // 1. 削除行と対応する追加行をペアで出力（削除行が先）
    for (let i = 0; i < pairCount; i++) {
        const deletedDiff = deleted[i];
        const addedDiff = added[i];
        const tableRow = toTableRow(addedDiff, tableStartLine);

        pushDeletedRow(accumulator, tableRow, rowCount, deletedDiff);
        pushAddedRow(accumulator, tableRow, rowCount, addedDiff);
    }

    // 2. 純粋な新規追加行を出力
    for (let i = pairCount; i < added.length; i++) {
        const addedDiff = added[i];
        const tableRow = toTableRow(addedDiff, tableStartLine);
        pushAddedRow(accumulator, tableRow, rowCount, addedDiff);
    }

    // 3. 残りの削除行（対応する追加行がないもの）を出力
    for (let i = pairCount; i < deleted.length; i++) {
        const deletedDiff = deleted[i];
        const tableRow = toTableRow(deletedDiff, tableStartLine);
        pushDeletedRow(accumulator, tableRow, rowCount, deletedDiff);
    }
}

function toTableRow(diff: LineDiff, tableStartLine: number): number {
    const baseLine = diff.status === GitDiffStatus.DELETED
        ? (diff.oldLineNumber ?? diff.lineNumber)
        : diff.lineNumber;
    return baseLine - tableStartLine - 3; // 1行目:ヘッダ、2行目:セパレータ、以降:データ
}

function shouldIncludeRow(tableRow: number, rowCount: number): boolean {
    return tableRow >= -2 && tableRow < rowCount;
}

function pushDeletedRow(
    accumulator: RowGitDiff[],
    tableRow: number,
    rowCount: number,
    diff: LineDiff
): void {
    if (!shouldIncludeRow(tableRow, rowCount)) {
        return;
    }

    accumulator.push({
        row: tableRow,
        status: GitDiffStatus.DELETED,
        oldContent: diff.oldContent,
        isDeletedRow: true
    });
}

function pushAddedRow(
    accumulator: RowGitDiff[],
    tableRow: number,
    rowCount: number,
    diff: LineDiff
): void {
    if (!shouldIncludeRow(tableRow, rowCount)) {
        return;
    }

    accumulator.push({
        row: tableRow,
        status: GitDiffStatus.ADDED,
        newContent: diff.newContent
    });
}

function dedupeRowDiffs(diffs: RowGitDiff[]): RowGitDiff[] {
    return diffs.reduce((acc, current) => {
        const existing = acc.find(item => {
            if (item.row !== current.row || item.status !== current.status) {
                return false;
            }
            if (current.status === GitDiffStatus.DELETED) {
                return item.oldContent === current.oldContent;
            }
            return true;
        });

        if (!existing) {
            acc.push(current);
        }
        return acc;
    }, [] as RowGitDiff[]);
}

// ============================================================
// 中間列検知の強化ロジック
// ============================================================

/**
 * マークダウンテーブル行をセルに分割（エスケープ/コードスパン対応）
 * エスケープされた | (\|) やコードスパン内の | は区切りとして扱わない
 * 
 * @param row テーブル行の文字列
 * @returns セルの配列
 */
export function tokenizeRow(row: string): string[] {
    if (!row || typeof row !== 'string') {
        return [];
    }
    
    const cells: string[] = [];
    let current = '';
    let escaped = false;
    let inCodeSpan = false;
    let backtickCount = 0;
    
    // 先頭・末尾の空白をトリム
    const trimmed = row.trim();
    
    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        
        // エスケープ処理
        if (char === '\\' && !escaped) {
            escaped = true;
            current += char;
            continue;
        }
        
        // バッククォート（コードスパン）処理
        if (char === '`' && !escaped) {
            if (!inCodeSpan) {
                // コードスパン開始を検出
                let count = 1;
                while (i + count < trimmed.length && trimmed[i + count] === '`') {
                    count++;
                }
                backtickCount = count;
                inCodeSpan = true;
                current += trimmed.substring(i, i + count);
                i += count - 1;
                continue;
            } else {
                // コードスパン終了を検出
                let count = 1;
                while (i + count < trimmed.length && trimmed[i + count] === '`') {
                    count++;
                }
                if (count === backtickCount) {
                    inCodeSpan = false;
                    current += trimmed.substring(i, i + count);
                    i += count - 1;
                    continue;
                }
                current += char;
                continue;
            }
        }
        
        // パイプ文字（セル区切り）処理
        if (char === '|' && !escaped && !inCodeSpan) {
            cells.push(current.trim());
            current = '';
            escaped = false;
            continue;
        }
        
        current += char;
        escaped = false;
    }
    
    // 最後のセルを追加
    if (current.trim() !== '' || cells.length > 0) {
        cells.push(current.trim());
    }
    
    // 先頭・末尾の空セルを除去（| a | b | のような形式対応）
    while (cells.length > 0 && cells[0] === '') {
        cells.shift();
    }
    while (cells.length > 0 && cells[cells.length - 1] === '') {
        cells.pop();
    }
    
    return cells;
}

/**
 * ヘッダセル文字列を正規化
 * 連続空白を単一スペースに、先頭末尾の空白除去、小文字化
 * 
 * @param s ヘッダセル文字列
 * @returns 正規化された文字列
 */
export function normalizeHeader(s: string): string {
    if (!s || typeof s !== 'string') {
        return '';
    }
    return s
        .trim()
        .replace(/\s+/g, ' ')  // 連続空白を単一スペースに
        .toLowerCase();         // 小文字化
}

/**
 * 2つの配列の最長共通部分列(LCS)を計算
 * 
 * @param arr1 配列1
 * @param arr2 配列2
 * @returns LCSの要素インデックスペア [{i1, i2}, ...]
 */
export function computeLCS(arr1: string[], arr2: string[]): Array<{i1: number, i2: number}> {
    const n = arr1.length;
    const m = arr2.length;
    
    if (n === 0 || m === 0) {
        return [];
    }
    
    // DP テーブル
    const dp: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));
    
    // LCS長を計算
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (arr1[i - 1] === arr2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    // バックトラックしてLCSを構築
    const result: Array<{i1: number, i2: number}> = [];
    let i = n, j = m;
    
    while (i > 0 && j > 0) {
        if (arr1[i - 1] === arr2[j - 1]) {
            result.unshift({ i1: i - 1, i2: j - 1 });
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }
    
    return result;
}

/**
 * レーベンシュタイン距離に基づく類似度を計算
 * 
 * @param s1 文字列1
 * @param s2 文字列2
 * @returns 類似度（0.0〜1.0）
 */
export function calculateSimilarity(s1: string, s2: string): number {
    if (s1 === s2) {
        return 1.0;
    }
    if (s1.length === 0 || s2.length === 0) {
        return 0.0;
    }
    
    const n = s1.length;
    const m = s2.length;
    
    // レーベンシュタイン距離を計算
    const dp: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));
    
    for (let i = 0; i <= n; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= m; j++) {
        dp[0][j] = j;
    }
    
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // 削除
                dp[i][j - 1] + 1,      // 挿入
                dp[i - 1][j - 1] + cost // 置換
            );
        }
    }
    
    const distance = dp[n][m];
    const maxLen = Math.max(n, m);
    return 1.0 - (distance / maxLen);
}

/**
 * 列データのサンプルを均等抽出して正規化済みセル値の配列として返す
 * データを列マッチングに活用するための前処理
 */
function buildColumnSamples(
    dataRows: string[][] | undefined,
    columnCount: number,
    maxSamplesPerTable = 8,
    maxSamplesPerColumn = 12
): { samples: string[][]; sampledRowCount: number } {
    const samples: string[][] = Array.from({ length: columnCount }, () => []);
    if (!dataRows || dataRows.length === 0 || columnCount === 0) {
        return { samples, sampledRowCount: 0 };
    }

    const rowCount = dataRows.length;
    const k = Math.min(maxSamplesPerTable, rowCount);
    const sampleIndices: number[] = [];

    for (let i = 0; i < k; i++) {
        sampleIndices.push(Math.floor((i * rowCount) / k));
    }

    const seenPerColumn: Array<Set<string>> = Array.from({ length: columnCount }, () => new Set<string>());

    for (const sampleIdx of sampleIndices) {
        const row = dataRows[sampleIdx] || [];
        for (let col = 0; col < columnCount; col++) {
            const cell = normalizeHeader(row[col] || '');
            const seen = seenPerColumn[col];
            if (cell && seen.size < maxSamplesPerColumn && !seen.has(cell)) {
                seen.add(cell);
                samples[col].push(cell);
            }
        }
    }

    return { samples, sampledRowCount: k };
}

/**
 * 2列のサンプル集合の類似度（Jaccard）を計算
 */
function calculateDataOverlap(a: string[], b: string[]): number {
    if (!a.length || !b.length) {
        return 0;
    }

    const setA = new Set(a);
    const setB = new Set(b);
    let intersection = 0;

    for (const v of setA) {
        if (setB.has(v)) {
            intersection++;
        }
    }

    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * ヘッダ類似度とデータ重複率を合成した列マッチスコアを算出
 */
function calculateColumnMatchScore(
    oldHeaderNormalized: string,
    newHeaderNormalized: string,
    oldSamples: string[],
    newSamples: string[]
): { combined: number; headerScore: number; dataScore: number } {
    const HEADER_WEIGHT = 0.55;
    const DATA_WEIGHT = 0.45;

    const headerScore = calculateSimilarity(oldHeaderNormalized, newHeaderNormalized);
    const dataScore = calculateDataOverlap(oldSamples, newSamples);
    const combined = headerScore * HEADER_WEIGHT + dataScore * DATA_WEIGHT;

    return { combined, headerScore, dataScore };
}

/**
 * サンプリング+マッチ数最小列を使った中間列検知
 * ドキュメントで推奨されたアルゴリズム
 * 
 * @param oldHeaders 変更前のヘッダ配列
 * @param newHeaders 変更後のヘッダ配列
 * @param oldDataRows 変更前のデータ行配列（オプション）
 * @param newDataRows 変更後のデータ行配列（オプション）
 * @returns 列差分情報
 */
export function detectColumnDiffWithPositions(
    oldHeaders: string[],
    newHeaders: string[],
    oldDataRows?: string[][],
    newDataRows?: string[][]
): ColumnDiffInfo {
    const heuristics: string[] = [];
    const oldN = oldHeaders.length;
    const newN = newHeaders.length;
    
    const result: ColumnDiffInfo = {
        oldColumnCount: oldN,
        newColumnCount: newN,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: [...oldHeaders],
        newHeaders: [...newHeaders],
        changeType: 'none',
        positions: [],
        mapping: new Array(oldN).fill(-1),
        heuristics
    };
    
    // 列数が同じで変更がない場合
    if (oldN === newN && oldHeaders.every((h, i) => normalizeHeader(h) === normalizeHeader(newHeaders[i]))) {
        result.mapping = Array.from({ length: oldN }, (_, i) => i);
        heuristics.push('exact_match_all');
        return result;
    }
    
    // 正規化したヘッダを作成
    const normalizedOld = oldHeaders.map(normalizeHeader);
    const normalizedNew = newHeaders.map(normalizeHeader);
    
    // 1. 直接マッチングパス（完全一致）
    const mapping = new Array(oldN).fill(-1);
    const usedNewIndices = new Set<number>();
    
    for (let i = 0; i < oldN; i++) {
        for (let j = 0; j < newN; j++) {
            if (!usedNewIndices.has(j) && normalizedOld[i] === normalizedNew[j]) {
                mapping[i] = j;
                usedNewIndices.add(j);
                heuristics.push(`exact_match:${i}->${j}`);
                break;
            }
        }
    }
    
    // 2. LCS による差分境界検出
    const unmatchedOld = normalizedOld.map((h, i) => ({ header: h, index: i })).filter(x => mapping[x.index] === -1);
    const unmatchedNew = normalizedNew.map((h, j) => ({ header: h, index: j })).filter(x => !usedNewIndices.has(x.index));
    
    if (unmatchedOld.length > 0 && unmatchedNew.length > 0) {
        const lcs = computeLCS(
            unmatchedOld.map(x => x.header),
            unmatchedNew.map(x => x.header)
        );
        
        for (const pair of lcs) {
            const oldIdx = unmatchedOld[pair.i1].index;
            const newIdx = unmatchedNew[pair.i2].index;
            if (mapping[oldIdx] === -1 && !usedNewIndices.has(newIdx)) {
                mapping[oldIdx] = newIdx;
                usedNewIndices.add(newIdx);
                heuristics.push(`lcs_match:${oldIdx}->${newIdx}`);
            }
        }
    }
    
    // 3. データサンプルを使ったマッチング（ヘッダ変更をデータで補正）
    const { samples: oldSamples, sampledRowCount: sampledOldRows } = buildColumnSamples(oldDataRows, oldN);
    const { samples: newSamples, sampledRowCount: sampledNewRows } = buildColumnSamples(newDataRows, newN);
    const samplingK = Math.min(sampledOldRows, sampledNewRows);
    if (samplingK > 0) {
        heuristics.push(`sampling:K=${samplingK}`);
    }

    const DATA_MATCH_THRESHOLD = 0.55;
    if (samplingK > 0) {
        const dataUnmatchedOld = normalizedOld.map((h, i) => ({ header: h, index: i })).filter(x => mapping[x.index] === -1);
        const dataUnmatchedNew = normalizedNew.map((h, j) => ({ header: h, index: j })).filter(x => !usedNewIndices.has(x.index));

        for (const oldItem of dataUnmatchedOld) {
            let bestMatch: { index: number; combined: number; headerScore: number; dataScore: number } | null = null;

            for (const newItem of dataUnmatchedNew) {
                if (usedNewIndices.has(newItem.index)) {
                    continue;
                }

                const scores = calculateColumnMatchScore(
                    oldItem.header,
                    newItem.header,
                    oldSamples[oldItem.index] || [],
                    newSamples[newItem.index] || []
                );

                if (scores.combined >= DATA_MATCH_THRESHOLD && (!bestMatch || scores.combined > bestMatch.combined)) {
                    bestMatch = { index: newItem.index, ...scores };
                }
            }

            if (bestMatch) {
                mapping[oldItem.index] = bestMatch.index;
                usedNewIndices.add(bestMatch.index);
                heuristics.push(`data_match:${oldItem.index}->${bestMatch.index}(h=${bestMatch.headerScore.toFixed(2)},d=${bestMatch.dataScore.toFixed(2)},s=${bestMatch.combined.toFixed(2)})`);

                // renamed として positions に追加
                result.positions!.push({
                    index: oldItem.index,
                    type: 'renamed',
                    header: oldHeaders[oldItem.index],
                    confidence: bestMatch.combined,
                    oldIndex: oldItem.index,
                    newIndex: bestMatch.index
                });
            }
        }
    }

    // 4. ファジーマッチ（残りの未マッチ要素）
    const FUZZY_THRESHOLD = 0.6;
    const stillUnmatchedOld = normalizedOld.map((h, i) => ({ header: h, index: i })).filter(x => mapping[x.index] === -1);
    const stillUnmatchedNew = normalizedNew.map((h, j) => ({ header: h, index: j })).filter(x => !usedNewIndices.has(x.index));
    
    for (const oldItem of stillUnmatchedOld) {
        let bestMatch: { index: number; similarity: number } | null = null;
        
        for (const newItem of stillUnmatchedNew) {
            if (usedNewIndices.has(newItem.index)) {
                continue;
            }
            
            const similarity = calculateSimilarity(oldItem.header, newItem.header);
            if (similarity >= FUZZY_THRESHOLD && (!bestMatch || similarity > bestMatch.similarity)) {
                bestMatch = { index: newItem.index, similarity };
            }
        }
        
        if (bestMatch) {
            mapping[oldItem.index] = bestMatch.index;
            usedNewIndices.add(bestMatch.index);
            heuristics.push(`fuzzy_match:${oldItem.index}->${bestMatch.index}(${bestMatch.similarity.toFixed(2)})`);
            
            // renamed として positions に追加
            result.positions!.push({
                index: oldItem.index,
                type: 'renamed',
                header: oldHeaders[oldItem.index],
                confidence: bestMatch.similarity,
                oldIndex: oldItem.index,
                newIndex: bestMatch.index
            });
        }
    }
    
    // 5. 最終的な追加・削除列の決定
    // mapping が -1 の列は削除された列
    for (let i = 0; i < oldN; i++) {
        if (mapping[i] === -1) {
            result.deletedColumns.push(i);
            result.positions!.push({
                index: i,
                type: 'removed',
                header: oldHeaders[i],
                confidence: 0.85
            });
        }
    }
    
    // usedNewIndices に含まれない新しい列は追加された列
    for (let j = 0; j < newN; j++) {
        if (!usedNewIndices.has(j)) {
            result.addedColumns.push(j);
            result.positions!.push({
                index: j,
                type: 'added',
                header: newHeaders[j],
                confidence: 0.85
            });
        }
    }
    
    // changeType を決定
    if (result.addedColumns.length > 0 && result.deletedColumns.length > 0) {
        result.changeType = 'mixed';
    } else if (result.addedColumns.length > 0) {
        result.changeType = 'added';
    } else if (result.deletedColumns.length > 0) {
        result.changeType = 'removed';
    } else {
        result.changeType = 'none';
    }
    
    result.mapping = mapping;
    
    return result;
}

/**
 * Gitのテーマ色を取得
 * VS CodeのテーマからGit関連の色を取得
 */
export function getGitThemeColors(): {
    addedBackground?: string;
    modifiedBackground?: string;
    deletedBackground?: string;
} {
    try {
        // VS Codeのテーマ色を取得
        // Git関連のCSS変数を使用
        return {
            addedBackground: 'var(--vscode-gitDecoration-addedResourceForeground, #81b88b)',
            modifiedBackground: 'var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)',
            deletedBackground: 'var(--vscode-gitDecoration-deletedResourceForeground, #c74e39)'
        };
    } catch (err) {
        error('[GitDiff] Error getting git theme colors:', err);
        return {};
    }
}

/**
 * Git差分から列の追加・削除情報を検出
 * 削除行と追加行の列数を比較して、列の変化を検出する
 * 中間列の追加・削除も検知可能な強化版
 * 
 * @param gitDiff 行のGit差分情報
 * @param currentColumnCount 現在のテーブルの列数
 * @param currentHeaders 現在のヘッダ配列（オプション、中間列検知精度向上用）
 * @returns 列の差分情報
 */
export function detectColumnDiff(
    gitDiff: RowGitDiff[],
    currentColumnCount: number,
    currentHeaders?: string[]
): ColumnDiffInfo {
    const result: ColumnDiffInfo = {
        oldColumnCount: currentColumnCount,
        newColumnCount: currentColumnCount,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: [],
        newHeaders: currentHeaders || [],
        changeType: 'none',
        positions: [],
        mapping: [],
        heuristics: []
    };

    // デバッグビルド時のみログを出力するユーティリティ
    const isDebug = (process && process.env && (
        process.env.NODE_ENV === 'development' ||
        process.env.MTE_KEEP_CONSOLE === '1' ||
        process.env.DEBUG === 'true'
    ));
    const debugLog = (...args: any[]) => {
        if (isDebug) {
            console.log(...args);
        }
    };
    
    if (!gitDiff || gitDiff.length === 0) {
        debugLog('[detectColumnDiff] No gitDiff provided');
        result.mapping = Array.from({ length: currentColumnCount }, (_, i) => i);
        return result;
    }

    // 削除行と追加行を分類
    const deletedRows = gitDiff.filter(d => d.status === GitDiffStatus.DELETED && d.oldContent);
    const addedRows = gitDiff.filter(d => d.status === GitDiffStatus.ADDED && d.newContent);

    debugLog('[detectColumnDiff] Found deletedRows:', deletedRows.length, 'addedRows:', addedRows.length);

    // 削除前のヘッダを取得（row = -2 がヘッダ行）
    let oldHeaders: string[] = [];
    const headerDeletedRow = deletedRows.find(d => d.row === -2);
    if (headerDeletedRow && headerDeletedRow.oldContent) {
        const cells = tokenizeRow(headerDeletedRow.oldContent);
        const isSeparatorRow = cells.every(cell => cell.match(/^[\s\-:]*$/) !== null);
        
        if (!isSeparatorRow) {
            oldHeaders = cells;
            debugLog('[detectColumnDiff] oldHeaders extracted from row -2:', oldHeaders);
        } else {
            // セパレータの場合は最初の非セパレータ削除行から探す
            const actualHeaderRow = deletedRows.find(d => {
                if (!d.oldContent) {
                    return false;
                }
                const headerCells = tokenizeRow(d.oldContent);
                return !headerCells.every(cell => cell.match(/^[\s\-:]*$/) !== null);
            });
            if (actualHeaderRow && actualHeaderRow.oldContent) {
                oldHeaders = tokenizeRow(actualHeaderRow.oldContent);
                debugLog('[detectColumnDiff] oldHeaders extracted from actual header row:', oldHeaders);
            }
        }
    }
    
    // 変更後のヘッダを取得
    let newHeaders: string[] = currentHeaders || [];
    const headerAddedRow = addedRows.find(d => d.row === -2);
    if (headerAddedRow && headerAddedRow.newContent) {
        const cells = tokenizeRow(headerAddedRow.newContent);
        const isSeparatorRow = cells.every(cell => cell.match(/^[\s\-:]*$/) !== null);
        if (!isSeparatorRow) {
            newHeaders = cells;
        }
    }
    
    // データ行を抽出（中間列検知のサンプリング用）
    const oldDataRows: string[][] = [];
    const newDataRows: string[][] = [];
    
    for (const d of deletedRows) {
        if (d.row >= 0 && d.oldContent) {
            const cells = tokenizeRow(d.oldContent);
            if (!cells.every(c => c.match(/^[\s\-:]*$/) !== null)) {
                oldDataRows.push(cells);
            }
        }
    }
    
    for (const d of addedRows) {
        if (d.row >= 0 && d.newContent) {
            const cells = tokenizeRow(d.newContent);
            if (!cells.every(c => c.match(/^[\s\-:]*$/) !== null)) {
                newDataRows.push(cells);
            }
        }
    }
    
    // oldHeaders/newHeaders の両方がある場合は強化版アルゴリズムを使用
    if (oldHeaders.length > 0 && newHeaders.length > 0) {
        debugLog('[detectColumnDiff] Using enhanced column diff detection');
        const enhancedResult = detectColumnDiffWithPositions(
            oldHeaders,
            newHeaders,
            oldDataRows.length > 0 ? oldDataRows : undefined,
            newDataRows.length > 0 ? newDataRows : undefined
        );
        
        // 結果をマージ
        result.oldColumnCount = enhancedResult.oldColumnCount;
        result.newColumnCount = enhancedResult.newColumnCount;
        result.addedColumns = enhancedResult.addedColumns;
        result.deletedColumns = enhancedResult.deletedColumns;
        result.oldHeaders = enhancedResult.oldHeaders;
        result.newHeaders = enhancedResult.newHeaders;
        result.changeType = enhancedResult.changeType;
        result.positions = enhancedResult.positions;
        result.mapping = enhancedResult.mapping;
        result.heuristics = enhancedResult.heuristics;
        
        debugLog('[detectColumnDiff] Enhanced result:', result);
        return result;
    }
    
    // フォールバック：従来のシンプルなロジック
    debugLog('[detectColumnDiff] Using fallback simple logic');
    result.oldHeaders = oldHeaders;
    result.newHeaders = newHeaders;
    result.heuristics = ['fallback_simple'];
    
    // 削除行から変更前の列数を取得
    let oldColumnCount = currentColumnCount;
    const firstDataDeletedRow = deletedRows.find(d => d.row >= 0 && d.oldContent);
    if (firstDataDeletedRow && firstDataDeletedRow.oldContent) {
        oldColumnCount = tokenizeRow(firstDataDeletedRow.oldContent).length;
    } else if (oldHeaders.length > 0) {
        oldColumnCount = oldHeaders.length;
    }

    const newColumnCount = currentColumnCount;

    result.oldColumnCount = oldColumnCount;
    result.newColumnCount = newColumnCount;

    const columnDiff = newColumnCount - oldColumnCount;

    debugLog('[detectColumnDiff] oldColumnCount:', oldColumnCount, 'newColumnCount:', newColumnCount, 'diff:', columnDiff);

    if (columnDiff > 0) {
        // 列が追加された（末尾に追加と仮定）
        for (let i = oldColumnCount; i < newColumnCount; i++) {
            result.addedColumns.push(i);
            result.positions!.push({
                index: i,
                type: 'added',
                header: newHeaders[i] || '',
                confidence: 0.5
            });
        }
        result.changeType = 'added';
    } else if (columnDiff < 0) {
        // 列が削除された（末尾から削除と仮定）
        for (let i = newColumnCount; i < oldColumnCount; i++) {
            result.deletedColumns.push(i);
            result.positions!.push({
                index: i,
                type: 'removed',
                header: oldHeaders[i] || '',
                confidence: 0.5
            });
        }
        result.changeType = 'removed';
    }
    
    // mapping を生成（シンプルな1:1マッピング）
    result.mapping = Array.from({ length: oldColumnCount }, (_, i) => 
        i < newColumnCount ? i : -1
    );

    debugLog('[detectColumnDiff] Final result:', result);
    return result;
}

// テスト専用のエクスポート（本番コードからは参照しない）
export const __test__ = {
    parseGitDiff,
    mapTableRowsToGitDiff
};

