/**
 * Git差分情報を取得するユーティリティ
 * VS CodeのGit APIを使用して、ファイルの差分情報を取得し、
 * テーブルの行ごとに差分情報をマッピングする
 */

import * as vscode from 'vscode';

/**
 * セルのGit差分状態
 */
export enum GitDiffStatus {
    UNCHANGED = 'unchanged',
    ADDED = 'added',
    MODIFIED = 'modified',
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
}

/**
 * テーブルのGit差分情報
 */
export interface TableGitDiff {
    tableIndex: number;
    rows: RowGitDiff[];
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
        // Git拡張機能が利用可能かチェック
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension || !gitExtension.isActive) {
            console.log('[GitDiff] Git extension not available');
            return [];
        }

        // リポジトリ情報を取得
        const git = gitExtension.exports.getAPI(1);
        if (!git) {
            console.log('[GitDiff] Git API not available');
            return [];
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
 * より正確に行番号を計算し、コンテキスト行を正しく処理
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

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // @@ -oldStart,oldCount +newStart,newCount @@ の形式を解析
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (hunkMatch) {
            inHunk = true;
            currentOldStart = parseInt(hunkMatch[1], 10);
            currentNewStart = parseInt(hunkMatch[3], 10);
            oldLineNumber = currentOldStart;
            newLineNumber = currentNewStart;
            continue;
        }

        if (!inHunk) {
            continue;
        }

        // 空行や特殊な行をスキップ
        if (line.startsWith('\\') || line.startsWith('---') || line.startsWith('+++')) {
            continue;
        }

        // テーブル範囲外の場合はスキップ（ただし行番号は進める）
        if (newLineNumber < tableStartLine + 1 || newLineNumber > tableEndLine + 1) {
            if (line.startsWith('-') && !line.startsWith('---')) {
                // 削除された行（新しいファイルには存在しない）
                oldLineNumber++;
            } else if (line.startsWith('+') && !line.startsWith('+++')) {
                // 追加された行
                newLineNumber++;
            } else {
                // コンテキスト行（変更なし）
                oldLineNumber++;
                newLineNumber++;
            }
            continue;
        }

        // 行の種類を判定
        if (line.startsWith('-') && !line.startsWith('---')) {
            // 削除された行
            // 次の行が追加かどうかを確認して、変更か削除かを判定
            const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
            if (nextLine && nextLine.startsWith('+') && !nextLine.startsWith('+++')) {
                // 削除の直後に追加がある場合、これは変更
                lineDiffs.push({
                    lineNumber: newLineNumber,  // 新しいファイルでの行番号（追加された行の位置）
                    status: GitDiffStatus.MODIFIED,
                    oldLineNumber: oldLineNumber
                });
                // 次の行（追加）をスキップ
                i++;
                newLineNumber++;
            } else {
                // 削除のみ（新しいファイルには存在しない）
                lineDiffs.push({
                    lineNumber: oldLineNumber,  // 削除された行の元の位置
                    status: GitDiffStatus.DELETED,
                    oldLineNumber: oldLineNumber
                });
            }
            oldLineNumber++;
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
            // 追加された行（前の行が削除でない場合のみ）
            const prevDiff = lineDiffs[lineDiffs.length - 1];
            if (!prevDiff || prevDiff.status !== GitDiffStatus.MODIFIED) {
                // 前の行が変更でない場合のみ追加として記録
                lineDiffs.push({
                    lineNumber: newLineNumber,
                    status: GitDiffStatus.ADDED
                });
            }
            newLineNumber++;
        } else {
            // コンテキスト行（変更なし）- 記録しない
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
    
    // テーブルの各行について、対応するGit diffを検索
    for (let tableRow = 0; tableRow < rowCount; tableRow++) {
        // Markdownテーブルの構造を考慮:
        // - tableStartLine (0ベース) = ヘッダー行
        // - tableStartLine + 1 = 区切り行
        // - tableStartLine + 2 + tableRow = データ行（tableRowは0ベース）
        // Git diffの行番号は1ベースなので、+1する必要がある
        const markdownLineNumber = tableStartLine + 2 + tableRow + 1;  // 1ベースの行番号
        
        // この行に対応するGit diffを検索（完全一致のみ）
        const diff = lineDiffs.find(d => d.lineNumber === markdownLineNumber);
        
        if (diff) {
            rowDiffs.push({
                row: tableRow,
                status: diff.status
            });
        }
    }
    
    return rowDiffs;
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

