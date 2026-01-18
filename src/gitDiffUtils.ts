/**
 * Git差分情報を取得するユーティリティ
 * VS CodeのGit APIを使用して、ファイルの差分情報を取得し、
 * テーブルの行ごとに差分情報をマッピングする
 */

import * as vscode from 'vscode';
import { debug, info, warn, error } from './logging';

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
 * Git diffキャッシュ
 * 同じファイルの同じ範囲に対するdiff結果をキャッシュして、パフォーマンスを向上
 */
interface DiffCacheEntry {
    uri: string;
    timestamp: number;
    lineDiffs: LineDiff[];
}

const diffCache = new Map<string, DiffCacheEntry>();
const CACHE_TTL = 5000; // 5秒間キャッシュを保持

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
 * 列の差分情報
 * 変更前と変更後の列数を比較して、追加・削除された列を検出
 */
export interface ColumnDiffInfo {
    oldColumnCount: number;      // 変更前の列数
    newColumnCount: number;      // 変更後の列数
    addedColumns: number[];      // 追加された列のインデックス（変更後の列番号）
    deletedColumns: number[];    // 削除された列のインデックス（変更前の列番号）
    oldHeaders?: string[];       // 変更前のヘッダ（削除列表示用）
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
        // Git APIが利用可能になるまで待機
        const git = await waitForGitApi();
        if (!git) {
            warn('[GitDiffDebug] Exiting getGitDiffForTable because Git API is not available.');
            return []; // Git APIが利用できない場合は空の配列を返す
        }

        // ワークスペースフォルダを取得
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            debug('[GitDiff] No workspace folder found');
            return [];
        }

        // リポジトリを取得
        const repository = git.getRepository(workspaceFolder.uri);
        if (!repository) {
            debug('[GitDiff] No repository found');
            return [];
        }

        // ファイルの変更状態を取得
        const fileStatus = getFileStatus(repository, uri);
        if (!fileStatus) {
            debug('[GitDiff] File not in git repository or no changes');
            return [];
        }

        // 詳細な行ごとの差分情報を取得（キャッシュを使用）
        const cacheKey = `${uri.toString()}:${tableStartLine}:${tableEndLine}`;
        const cached = diffCache.get(cacheKey);
        const now = Date.now();
        
        let lineDiffs: LineDiff[] | null = null;
        
        // キャッシュをチェック
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
            lineDiffs = cached.lineDiffs;
            console.log('[GitDiff] Using cached diff result');
        } else {
            // キャッシュが無効または存在しない場合、新しいdiffを取得
            lineDiffs = await getLineByLineDiff(uri, workspaceFolder.uri.fsPath, tableStartLine, tableEndLine);
            
            // キャッシュを更新
            if (lineDiffs) {
                diffCache.set(cacheKey, {
                    uri: uri.toString(),
                    timestamp: now,
                    lineDiffs: lineDiffs
                });
            }
        }
        
        if (!lineDiffs || lineDiffs.length === 0) {
            // 差分情報が取得できない場合、ファイル全体の状態を使用
            if (fileStatus === 'added') {
                const rowDiffs: RowGitDiff[] = [];
                for (let i = 0; i < rowCount; i++) {
                    rowDiffs.push({
                        row: i,
                        status: GitDiffStatus.ADDED
                    });
                }
                return rowDiffs;
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

/**
 * キャッシュをクリア（ファイルが変更された場合など）
 */
export function clearDiffCache(uri?: vscode.Uri): void {
    if (uri) {
        // 特定のファイルのキャッシュをクリア
        const keysToDelete: string[] = [];
        for (const [key, entry] of diffCache.entries()) {
            if (entry.uri === uri.toString()) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => diffCache.delete(key));
    } else {
        // すべてのキャッシュをクリア
        diffCache.clear();
    }
}

/**
 * Git diffの出力を解析して行ごとの差分情報を抽出
 * ADDED / DELETED のみを使用。削除行の内容を oldContent で保持する
 * 削除行は対応する追加行の直前に表示されるよう、newLineNumber を正しく割り当てる
 */
function parseGitDiff(
    diffOutput: string,
    tableStartLine: number,
    tableEndLine: number
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
    tableContent?: string
): RowGitDiff[] {
    const result: RowGitDiff[] = [];
    
    debug('[mapTableRowsToGitDiff] Input:', {
        tableStartLine,
        rowCount,
        lineDiffsLength: lineDiffs.length
    });
    
    // hunk ごとに削除行と追加行をグループ化
    const hunkMap = new Map<number, { deleted: LineDiff[], added: LineDiff[] }>();
    
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
        
        const tableRow = diff.status === GitDiffStatus.DELETED
            ? (diff.oldLineNumber ?? diff.lineNumber) - tableStartLine - 1 - 2
            : diff.lineNumber - tableStartLine - 1 - 2;
        
        debug('[mapTableRowsToGitDiff] Processing:', {
            status: diff.status,
            oldLineNumber: diff.oldLineNumber,
            lineNumber: diff.lineNumber,
            calculated_tableRow: tableRow,
            hunkId: hunkId,
            rowCount
        });
    }
    
    // 各 hunk を処理
    for (const [hunkId, hunk] of hunkMap.entries()) {
        const { deleted, added } = hunk;
        
        // 削除行と追加行をペアリング
        // 削除行数と追加行数の小さい方がペア数
        const pairCount = Math.min(deleted.length, added.length);
        
        // 追加行のうち、最初の pairCount 個が変更後の行（削除行と対応）
        // 最後の (added.length - pairCount) 個が純粋な新規追加行
        const pureAddedCount = added.length - pairCount;
        
        // 1. 削除行と対応する追加行をペアで出力（削除行が先）
        for (let i = 0; i < pairCount; i++) {
            const deletedDiff = deleted[i];
            const addedDiff = added[i];  // 最初の pairCount 個が対応する追加行
            const tableRow = addedDiff.lineNumber - tableStartLine - 1 - 2;
            
            // 削除行を先に出力
            // ヘッダ行(row=-2)も含めてGit差分として扱う
            if (tableRow >= -2 && tableRow < rowCount) {
                result.push({
                    row: tableRow,
                    status: GitDiffStatus.DELETED,
                    oldContent: deletedDiff.oldContent,
                    isDeletedRow: true
                });
            }
            
            // 追加行を出力
            if (tableRow >= -2 && tableRow < rowCount) {
                result.push({
                    row: tableRow,
                    status: GitDiffStatus.ADDED,
                    newContent: addedDiff.newContent
                });
            }
        }
        
        // 2. 純粋な新規追加行を出力（最後の pureAddedCount 個）
        for (let i = pairCount; i < added.length; i++) {
            const addedDiff = added[i];
            const tableRow = addedDiff.lineNumber - tableStartLine - 1 - 2;
            if (tableRow >= -2 && tableRow < rowCount) {
                result.push({
                    row: tableRow,
                    status: GitDiffStatus.ADDED,
                    newContent: addedDiff.newContent
                });
            }
        }
        
        // 3. 残りの削除行（対応する追加行がないもの）を出力
        for (let i = pairCount; i < deleted.length; i++) {
            const deletedDiff = deleted[i];
            const tableRow = (deletedDiff.oldLineNumber ?? deletedDiff.lineNumber) - tableStartLine - 1 - 2;
            if (tableRow >= -2 && tableRow < rowCount) {
                result.push({
                    row: tableRow,
                    status: GitDiffStatus.DELETED,
                    oldContent: deletedDiff.oldContent,
                    isDeletedRow: true
                });
            }
        }
    }
    
    // 重複をフィルタリング
    const uniqueDiffs = result.reduce((acc, current) => {
        const existing = acc.find(item => {
            if (item.row !== current.row || item.status !== current.status) {
                return false;
            }
            // DELETED行の場合、oldContentで区別
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

    return uniqueDiffs;
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
 * マークダウンテーブル行からセル数を取得
 * 例: "| a | b | c |" -> 3
 */
function countTableCells(rowContent: string): number {
    if (!rowContent || !rowContent.includes('|')) {
        return 0;
    }
    // 先頭と末尾の | を削除し、| で分割
    const trimmed = rowContent.trim();
    const withoutLeadingPipe = trimmed.startsWith('|') ? trimmed.substring(1) : trimmed;
    const withoutTrailingPipe = withoutLeadingPipe.endsWith('|') 
        ? withoutLeadingPipe.substring(0, withoutLeadingPipe.length - 1) 
        : withoutLeadingPipe;
    return withoutTrailingPipe.split('|').length;
}

/**
 * マークダウンテーブル行から列の値を抽出
 * 例: "| a | b | c |" -> ['a', 'b', 'c']
 */
function parseTableRowCells(rowContent: string): string[] {
    if (!rowContent || !rowContent.includes('|')) {
        return [];
    }
    const trimmed = rowContent.trim();
    const withoutLeadingPipe = trimmed.startsWith('|') ? trimmed.substring(1) : trimmed;
    const withoutTrailingPipe = withoutLeadingPipe.endsWith('|') 
        ? withoutLeadingPipe.substring(0, withoutLeadingPipe.length - 1) 
        : withoutLeadingPipe;
    return withoutTrailingPipe.split('|').map(cell => cell.trim());
}

/**
 * Git差分から列の追加・削除情報を検出
 * 削除行と追加行の列数を比較して、列の変化を検出する
 * 
 * @param gitDiff 行のGit差分情報
 * @param currentColumnCount 現在のテーブルの列数
 * @returns 列の差分情報
 */
export function detectColumnDiff(
    gitDiff: RowGitDiff[],
    currentColumnCount: number
): ColumnDiffInfo {
    const result: ColumnDiffInfo = {
        oldColumnCount: currentColumnCount,
        newColumnCount: currentColumnCount,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: []
    };

    // デバッグビルド時のみログを出力するユーティリティ
    const isDebug = (process && process.env && (
        process.env.NODE_ENV === 'development' ||
        process.env.MTE_KEEP_CONSOLE === '1' ||
        process.env.DEBUG === 'true'
    ));
    const debugLog = (...args: any[]) => { if (isDebug) { console.log(...args); } };
    if (!gitDiff || gitDiff.length === 0) {
        debugLog('[detectColumnDiff] No gitDiff provided');
        return result;
    }

    // 削除行と追加行を分類
    // status フィールドで判定
    const deletedRows = gitDiff.filter(d => d.status === GitDiffStatus.DELETED && d.oldContent);
    const addedRows = gitDiff.filter(d => d.status === GitDiffStatus.ADDED);

    debugLog('[detectColumnDiff] Found deletedRows:', deletedRows.length, 'addedRows:', addedRows.length);
    debugLog('[detectColumnDiff] First few deletedRows:', deletedRows.slice(0, 3).map(r => ({ row: r.row, content: r.oldContent?.substring(0, 30) })));

    // 削除前のヘッダを取得
    // row = -2 がヘッダ行、row = -1 がセパレータ行
    // ヘッダ行（row = -2）を探し、セパレータ行ではなく実際のテキストを含む行を選ぶ
    const headerDeletedRow = deletedRows.find(d => d.row === -2);
    if (headerDeletedRow && headerDeletedRow.oldContent) {
        // セパレータ行（すべてのセルが --- または空白）ではなく、実際のヘッダテキストを確認
        const cells = parseTableRowCells(headerDeletedRow.oldContent);
        const isSeparatorRow = cells.every(cell => cell.match(/^[\s\-]*$/) !== null);
        
        if (!isSeparatorRow) {
            result.oldHeaders = cells;
            debugLog('[detectColumnDiff] oldHeaders extracted from row -2:', result.oldHeaders);
        } else {
            // row = -2 がセパレータの場合、最初の削除行から探す
            const actualHeaderRow = deletedRows.find(d => {
                if (!d.oldContent) {return false;}
                const headerCells = parseTableRowCells(d.oldContent);
                return !headerCells.every(cell => cell.match(/^[\s\-]*$/) !== null);
            });
            if (actualHeaderRow && actualHeaderRow.oldContent) {
                result.oldHeaders = parseTableRowCells(actualHeaderRow.oldContent);
                debugLog('[detectColumnDiff] oldHeaders extracted from actual header row:', result.oldHeaders);
            }
        }
    }

    // 削除行から変更前の列数を取得
    // 複数の削除行がある場合は、最初のデータ行削除行を使用（同じテーブル内は同じ列数）
    let oldColumnCount = currentColumnCount;
    const firstDataDeletedRow = deletedRows.find(d => d.row >= 0);
    if (firstDataDeletedRow && firstDataDeletedRow.oldContent) {
        oldColumnCount = countTableCells(firstDataDeletedRow.oldContent);
        debugLog('[detectColumnDiff] oldColumnCount from deleted row:', oldColumnCount, 'oldContent:', firstDataDeletedRow.oldContent?.substring(0, 50));
    } else {
        debugLog('[detectColumnDiff] No deleted rows found, oldColumnCount = currentColumnCount =', currentColumnCount);
    }

    // 追加行から変更後の列数を取得
    // 追加行は常に現在のテーブルの列数を持つ
    const newColumnCount = currentColumnCount;

    result.oldColumnCount = oldColumnCount;
    result.newColumnCount = newColumnCount;

    // 列数の差分を計算
    const columnDiff = newColumnCount - oldColumnCount;

    debugLog('[detectColumnDiff] oldColumnCount:', oldColumnCount, 'newColumnCount:', newColumnCount, 'diff:', columnDiff);

    if (columnDiff > 0) {
        // 列が追加された場合
        // 追加された列は末尾に追加されたと仮定
        for (let i = oldColumnCount; i < newColumnCount; i++) {
            result.addedColumns.push(i);
        }
    } else if (columnDiff < 0) {
        // 列が削除された場合
        // 削除前後のヘッダ名を比較して、実際に削除された列インデックスを特定
        if (result.oldHeaders && result.oldHeaders.length > 0) {
            // 追加行から変更後のヘッダを取得
            const newHeaderAddedRow = addedRows.find(d => d.row === -2);
            if (newHeaderAddedRow && newHeaderAddedRow.newContent) {
                const newHeaders = parseTableRowCells(newHeaderAddedRow.newContent);
                
                // 両方のヘッダが存在する場合、削除された列を特定
                debugLog('[detectColumnDiff] Comparing headers - old:', result.oldHeaders, 'new:', newHeaders);
                
                // 削除前のヘッダで、削除後に存在しない列を見つける
                for (let oldIdx = 0; oldIdx < result.oldHeaders.length; oldIdx++) {
                    const oldHeaderName = result.oldHeaders[oldIdx];
                    
                    // このヘッダが新しいヘッダ列に存在するか確認
                    const foundInNew = newHeaders.some(newHeader => newHeader === oldHeaderName);
                    
                    if (!foundInNew) {
                        result.deletedColumns.push(oldIdx);
                        debugLog(`[detectColumnDiff] Column ${oldIdx} (${oldHeaderName}) detected as deleted`);
                    }
                }
            }
        }
        
        // フォールバック：ヘッダが利用できない場合は末尾から削除されたと仮定
        if (result.deletedColumns.length === 0) {
            for (let i = newColumnCount; i < oldColumnCount; i++) {
                result.deletedColumns.push(i);
            }
            debugLog('[detectColumnDiff] Using fallback: assumed columns deleted from end');
        }
        
        // デバッグログ：削除された列を詳細に出力
        debugLog('[detectColumnDiff] Column deletion detected:', {
            oldColumnCount,
            newColumnCount,
            deletedCount: oldColumnCount - newColumnCount,
            deletedColumns: result.deletedColumns,
            oldHeaders: result.oldHeaders
        });
    }

    debugLog('[detectColumnDiff] Final result:', result);
    return result;
}

