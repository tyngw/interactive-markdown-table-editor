/**
 * Git差分情報を取得するユーティリティ
 * VS CodeのGit APIを使用して、ファイルの差分情報を取得し、
 * テーブルの行ごとに差分情報をマッピングする
 */

import * as vscode from 'vscode';

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
    deletedIndex?: number;  // 複数の削除行を区別するためのインデックス
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
 * Git APIが初期化されるまで待機する
 * @param timeoutMs タイムアウト（ミリ秒）
 * @returns 初期化されたGit API。タイムアウトした場合はnull
 */
async function waitForGitApi(timeoutMs: number = 5000): Promise<any | null> {
    console.log('[GitDiffDebug] Starting waitForGitApi');
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            console.log('[GitDiffDebug] Git extension not found.');
            return null;
        }
        console.log(`[GitDiffDebug] Git extension found. isActive: ${gitExtension.isActive}`);

        // 拡張機能が有効でない場合は有効化
        if (!gitExtension.isActive) {
            console.log('[GitDiffDebug] Activating Git extension...');
            await gitExtension.activate();
            console.log('[GitDiffDebug] Git extension activated.');
        }

        const git = gitExtension.exports.getAPI(1);
        if (!git) {
            console.log('[GitDiffDebug] Git API not available');
            return null;
        }
        console.log(`[GitDiffDebug] Git API obtained. Initial state: ${git.state}`);

        // 既に初期化済み
        if (git.state === 'initialized') {
            console.log('[GitDiffDebug] Git API is already initialized.');
            return git;
        }

        // 初期化を待機（ポーリング）
        console.log('[GitDiffDebug] Waiting for Git API to initialize...');
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            if (git.state === 'initialized') {
                console.log('[GitDiffDebug] Git API has been initialized.');
                return git;
            }
            console.log(`[GitDiffDebug] Polling: git.state is ${git.state}`);
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms待機
        }

        console.warn(`[GitDiffDebug] Git API did not initialize within ${timeoutMs}ms.`);
        return null;
    } catch (error) {
        console.error('[GitDiffDebug] Error while waiting for Git API:', error);
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
            console.log('[GitDiffDebug] Exiting getGitDiffForTable because Git API is not available.');
            return []; // Git APIが利用できない場合は空の配列を返す
        }

        // ワークスペースフォルダを取得
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            console.log('[GitDiff] No workspace folder found');
            return [];
        }

        // リポジトリを取得
        const repository = git.getRepository(workspaceFolder.uri);
        if (!repository) {
            console.log('[GitDiff] No repository found');
            return [];
        }

        // ファイルの変更状態を取得
        const fileStatus = getFileStatus(repository, uri);
        if (!fileStatus) {
            console.log('[GitDiff] File not in git repository or no changes');
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
    } catch (error) {
        console.error('[GitDiff] Error getting git diff:', error);
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
            if (status === 1) return 'added';      // Status.INDEX_ADDED
            if (status === 2) return 'deleted';    // Status.DELETED
            if (status === 3) return 'modified';   // Status.MODIFIED
            return 'modified'; // デフォルト
        }

        // ステージングエリアの変更を確認
        const indexChange = repository.state.indexChanges.find(
            (change: any) => change.uri.toString() === uri.toString()
        );

        if (indexChange) {
            const status = indexChange.status;
            if (status === 1) return 'added';
            if (status === 2) return 'deleted';
            if (status === 3) return 'modified';
            return 'modified';
        }

        return null;
    } catch (error) {
        console.error('[GitDiff] Error getting file status:', error);
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
    deletedIndex?: number;  // 複数の削除行を区別するためのインデックス
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
                console.warn('[GitDiff] Git diff stderr:', stderr);
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
                console.warn('[GitDiff] Git command not found');
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
                        console.log('[GitDiff] No diff found (file may be new or unchanged)');
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
    } catch (error) {
        console.error('[GitDiff] Error executing git diff:', error);
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
 * 複数の連続した削除行は deletedIndex で区別される
 */
function parseGitDiff(
    diffOutput: string,
    tableStartLine: number,
    tableEndLine: number
): LineDiff[] {
    const lineDiffs: LineDiff[] = [];
    const lines = diffOutput.split('\n');
    
    let currentOldStart = 0;
    let currentNewStart = 0;
    let inHunk = false;
    let oldLineNumber = 0;
    let newLineNumber = 0;
    let deletedIndexCounter = 0;  // 削除行のインデックスカウンター

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // @@ -oldStart,oldCount +newStart,newCount @@ の形式を解析
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (hunkMatch) {
            inHunk = true;
            currentOldStart = parseInt(hunkMatch[1], 10);
            const oldCount = parseInt(hunkMatch[2] || '1', 10);
            currentNewStart = parseInt(hunkMatch[3], 10);
            const newCount = parseInt(hunkMatch[4] || '1', 10);

            oldLineNumber = currentOldStart;
            newLineNumber = currentNewStart;
            deletedIndexCounter = 0;  // hunk開始時にリセット
            
            continue;
        }

        if (!inHunk) {
            continue;
        }

        if (line.startsWith('\\') || line.trim() === '') {
            continue;
        }

        if (line.startsWith('-') && !line.startsWith('---')) {
            // 削除行を DELETED として記録。内容も保存
            const deletedContent = line.substring(1); // '-' を除いた内容
            console.log('[parseGitDiff] DELETED line:', { oldLineNumber, newLineNumber, deletedContent });
            lineDiffs.push({
                lineNumber: newLineNumber,  // 対応する ADDED 行と同じ新しい行番号（修正）
                status: GitDiffStatus.DELETED,
                oldLineNumber: oldLineNumber,
                oldContent: deletedContent,
                deletedIndex: deletedIndexCounter  // 削除行の順序をマーク
            });
            deletedIndexCounter++;  // 次の削除行のためにインクリメント
            oldLineNumber++;
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
            // 追加行を ADDED として記録
            console.log('[parseGitDiff] ADDED line:', { newLineNumber, content: line.substring(1) });
            lineDiffs.push({
                lineNumber: newLineNumber,
                status: GitDiffStatus.ADDED
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
 * 正確な行番号マッピングを行うため、完全一致のみを使用
 */
function mapTableRowsToGitDiff(
    lineDiffs: LineDiff[],
    tableStartLine: number,
    rowCount: number,
    tableContent?: string
): RowGitDiff[] {
    const rowDiffs: RowGitDiff[] = [];
    
    // lineDiffs の元の順序を保ち、そのまま処理する
    // これにより git diff の順序がそのまま表示される
    for (const diff of lineDiffs) {
        let tableRow: number;
        
        if (diff.status === GitDiffStatus.DELETED) {
            // 削除行：oldLineNumber から関連先行を計算
            // ファイル上での削除前の行番号を参照
            if (diff.oldLineNumber !== undefined) {
                tableRow = diff.oldLineNumber - 1 - (tableStartLine + 2);
            } else {
                tableRow = diff.lineNumber - 1 - (tableStartLine + 2);
            }
        } else {
            // 追加行/変更なし行：通常の行番号計算
            tableRow = diff.lineNumber - 1 - (tableStartLine + 2);
        }
        
        console.log('[mapTableRowsToGitDiff] BEFORE_CHECK:', {
            status: diff.status,
            lineNumber: diff.lineNumber,
            oldLineNumber: diff.oldLineNumber,
            tableStartLine,
            calculated_tableRow: tableRow,
            rowCount
        });
        
        if (tableRow >= -1 && tableRow < rowCount) {
            console.log('[mapTableRowsToGitDiff] ACCEPTED:', {
                row: tableRow,
                status: diff.status
            });
            
            if (diff.status === GitDiffStatus.DELETED) {
                rowDiffs.push({
                    row: tableRow,
                    status: GitDiffStatus.DELETED,
                    oldContent: diff.oldContent,
                    deletedIndex: diff.deletedIndex,
                    isDeletedRow: true
                });
            } else {
                rowDiffs.push({
                    row: tableRow,
                    status: diff.status,
                    oldContent: diff.oldContent,
                    deletedIndex: diff.deletedIndex
                });
            }
        }
    }
    
    // 重複をフィルタリング
    const uniqueDiffs = rowDiffs.reduce((acc, current) => {
        const existing = acc.find(item => {
            if (item.row !== current.row || item.status !== current.status) {
                return false;
            }
            // DELETED行の場合、deletedIndexで区別
            if (current.status === GitDiffStatus.DELETED) {
                return item.deletedIndex === current.deletedIndex;
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
    } catch (error) {
        console.error('[GitDiff] Error getting git theme colors:', error);
        return {};
    }
}

