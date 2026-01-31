// このモジュールは Git 差分計算の順序付けと送信制御を担当する。
// ファイル単位の並行計算を抑制し、不要な再送を避けるためのキャッシュも管理する。
// VS Code Git APIのrepository.status()を使用して最新の状態を取得するため、遅延は不要。
import * as vscode from 'vscode';
import { TableDataManager, TableData } from '../tableDataManager';
import { WebviewManager } from '../webviewManager';
import { getGitDiffForTable, detectColumnDiff } from '../gitDiffUtils';
import { debug, warn } from '../logging';

interface DiffProvider {
    getGitDiffForTable: typeof getGitDiffForTable;
    detectColumnDiff: typeof detectColumnDiff;
}

export class GitDiffCoordinator {
    private readonly diffCalculationMap = new Map<string, Promise<any> | null>();
    private readonly lastSentDiffMap = new Map<string, Map<number, string>>();

    constructor(
        private readonly webviewManager: WebviewManager,
        private readonly diffProvider: DiffProvider = {
            getGitDiffForTable,
            detectColumnDiff
        }
    ) {}

    public resetLastSent(uriString: string, tableManagersMap: Map<number, TableDataManager>): void {
        const empty = new Map<number, string>();
        Array.from(tableManagersMap.keys()).forEach(idx => empty.set(idx, JSON.stringify([])));
        this.lastSentDiffMap.set(uriString, empty);
    }

    public scheduleGitDiffCalculation(
        fileUri: vscode.Uri,
        panel: vscode.WebviewPanel,
        tableManagersMap: Map<number, TableDataManager>
    ): Promise<void> {
        const uriString = fileUri.toString();
        const previousCalculation = this.diffCalculationMap.get(uriString) || Promise.resolve();

        const newCalculation = previousCalculation
            .then(async () => {
                try {
                    const allTableData: TableData[] = [];
                    tableManagersMap.forEach((manager, idx) => {
                        allTableData[idx] = manager.getTableData();
                    });

                    const tablesWithGitDiff = await Promise.all(
                        allTableData.map(async (tbl, idx) => {
                            const manager = tableManagersMap.get(idx);
                            const tableMarkdown = manager ? manager.serializeToMarkdown() : undefined;
                            const gitDiff = await this.diffProvider.getGitDiffForTable(
                                fileUri,
                                tbl.metadata.startLine,
                                tbl.metadata.endLine,
                                tbl.rows.length,
                                tableMarkdown
                            );
                            const columnDiff = this.diffProvider.detectColumnDiff(gitDiff, tbl.headers.length, tbl.headers);
                            return {
                                tableIndex: idx,
                                gitDiff,
                                columnDiff
                            };
                        })
                    );

                    try {
                        const uriKey = uriString;
                        let lastMap = this.lastSentDiffMap.get(uriKey);
                        if (!lastMap) {
                            lastMap = new Map<number, string>();
                            this.lastSentDiffMap.set(uriKey, lastMap);
                        }

                        let changed = false;
                        for (const tbl of tablesWithGitDiff) {
                            const idx = (tbl as any).tableIndex as number;
                            const serialized = JSON.stringify(tbl.gitDiff || []);
                            const prev = lastMap.get(idx);
                            if (prev !== serialized) {
                                changed = true;
                                lastMap.set(idx, serialized);
                            }
                        }

                        if (changed) {
                            this.webviewManager.updateGitDiff(panel, tablesWithGitDiff);
                        } else {
                            debug('[GitDiffCoordinator] No git diff changes detected');
                        }
                    } catch (comparisonError) {
                        this.webviewManager.updateGitDiff(panel, tablesWithGitDiff);
                    }
                } catch (diffError) {
                    warn('[GitDiffCoordinator] Failed to calculate git diff:', diffError);
                } finally {
                    this.diffCalculationMap.delete(uriString);
                }
            })
            .catch(err => {
                warn('[GitDiffCoordinator] Diff calculation chain error:', err);
                this.diffCalculationMap.delete(uriString);
            });

        this.diffCalculationMap.set(uriString, newCalculation);
        return newCalculation;
    }
}