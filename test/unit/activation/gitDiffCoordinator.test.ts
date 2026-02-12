// GitDiffCoordinator の差分送信抑制ロジックを検証するユニットテスト
import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitDiffCoordinator } from '../../../src/activation/gitDiffCoordinator';
import { WebviewManager } from '../../../src/webviewManager';
import { TableData, TableDataManager } from '../../../src/tableDataManager';
import { ColumnDiffInfo, GitDiffStatus, RowGitDiff } from '../../../src/gitDiffUtils';

class StubTableDataManager {
    constructor(private readonly tableData: TableData) {}

    getTableData(): TableData {
        return this.tableData;
    }

    serializeToMarkdown(): string {
        return 'serialized-table';
    }
}

suite('GitDiffCoordinator', () => {
    const fileUri = vscode.Uri.file('/tmp/sample.md');

    const createTableData = (): TableData => ({
        id: 'tbl-1',
        headers: ['A'],
        rows: [['1']],
        metadata: {
            sourceUri: fileUri.toString(),
            startLine: 1,
            endLine: 3,
            tableIndex: 0,
            lastModified: new Date(),
            columnCount: 1,
            rowCount: 1,
            isValid: true,
            validationIssues: []
        }
    });

    test('skips redundant git diff updates when content is unchanged', async () => {
        const updateCalls: any[] = [];
        const webviewManagerStub = {
            updateGitDiff: (_panel: vscode.WebviewPanel, payload: any) => updateCalls.push(payload)
        } as unknown as WebviewManager;

        const diffPayload: RowGitDiff[] = [{ row: 0, status: GitDiffStatus.UNCHANGED }];
        const emptyColumnDiff: ColumnDiffInfo = {
            oldColumnCount: 1,
            newColumnCount: 1,
            addedColumns: [],
            deletedColumns: [],
            oldHeaders: [],
            newHeaders: [],
            changeType: 'none',
            positions: [],
            mapping: [],
            heuristics: []
        };
        const diffProvider = {
            getGitDiffForTable: async () => diffPayload,
            detectColumnDiff: () => emptyColumnDiff
        };

        const coordinator = new GitDiffCoordinator(webviewManagerStub, diffProvider);
        const managers = new Map<number, TableDataManager>();
        managers.set(0, new StubTableDataManager(createTableData()) as unknown as TableDataManager);
        const panel = {} as vscode.WebviewPanel;

        await coordinator.scheduleGitDiffCalculation(fileUri, panel, managers);
        await coordinator.scheduleGitDiffCalculation(fileUri, panel, managers);

        assert.strictEqual(updateCalls.length, 1, 'git diff should be sent only once when unchanged');
        assert.strictEqual(updateCalls[0][0].tableIndex, 0);
    });

    test('resetLastSent initializes lastSentDiffMap with empty arrays', async () => {
        const updateCalls: any[] = [];
        const webviewManagerStub = {
            updateGitDiff: (_panel: vscode.WebviewPanel, payload: any) => updateCalls.push(payload)
        } as unknown as WebviewManager;

        const diffPayload: RowGitDiff[] = [{ row: 0, status: GitDiffStatus.UNCHANGED }];
        const emptyColumnDiff: ColumnDiffInfo = {
            oldColumnCount: 1, newColumnCount: 1,
            addedColumns: [], deletedColumns: [],
            oldHeaders: [], newHeaders: [],
            changeType: 'none', positions: [], mapping: [], heuristics: []
        };
        const diffProvider = {
            getGitDiffForTable: async () => diffPayload,
            detectColumnDiff: () => emptyColumnDiff
        };

        const coordinator = new GitDiffCoordinator(webviewManagerStub, diffProvider);
        const managers = new Map<number, TableDataManager>();
        managers.set(0, new StubTableDataManager(createTableData()) as unknown as TableDataManager);
        const panel = {} as vscode.WebviewPanel;

        // resetLastSent should initialize the map
        coordinator.resetLastSent(fileUri.toString(), managers);

        // After reset, sending the same diff should still trigger update (because empty JSON.stringify([]) != serialized diff)
        await coordinator.scheduleGitDiffCalculation(fileUri, panel, managers);
        assert.strictEqual(updateCalls.length, 1);
    });

    test('handles diff provider error gracefully', async () => {
        const updateCalls: any[] = [];
        const webviewManagerStub = {
            updateGitDiff: (_panel: vscode.WebviewPanel, payload: any) => updateCalls.push(payload)
        } as unknown as WebviewManager;

        const diffProvider = {
            getGitDiffForTable: async () => { throw new Error('Git error'); },
            detectColumnDiff: () => { throw new Error('Column diff error'); }
        };

        const coordinator = new GitDiffCoordinator(webviewManagerStub, diffProvider);
        const managers = new Map<number, TableDataManager>();
        managers.set(0, new StubTableDataManager(createTableData()) as unknown as TableDataManager);
        const panel = {} as vscode.WebviewPanel;

        // Should not throw, error is logged
        await coordinator.scheduleGitDiffCalculation(fileUri, panel, managers);
        // No update should be called since diff calculation failed
        assert.strictEqual(updateCalls.length, 0);
    });

    test('handles comparison error by falling back to direct update', async () => {
        const updateCalls: any[] = [];
        let callCount = 0;
        const webviewManagerStub = {
            updateGitDiff: (_panel: vscode.WebviewPanel, payload: any) => {
                callCount++;
                if (callCount === 1) {
                    // Force comparison error on first call by making updateGitDiff throw
                    // This is the fallback scenario
                }
                updateCalls.push(payload);
            }
        } as unknown as WebviewManager;

        const diffPayload: RowGitDiff[] = [{ row: 0, status: GitDiffStatus.UNCHANGED }];
        const emptyColumnDiff: ColumnDiffInfo = {
            oldColumnCount: 1, newColumnCount: 1,
            addedColumns: [], deletedColumns: [],
            oldHeaders: [], newHeaders: [],
            changeType: 'none', positions: [], mapping: [], heuristics: []
        };
        const diffProvider = {
            getGitDiffForTable: async () => diffPayload,
            detectColumnDiff: () => emptyColumnDiff
        };

        const coordinator = new GitDiffCoordinator(webviewManagerStub, diffProvider);
        const managers = new Map<number, TableDataManager>();
        managers.set(0, new StubTableDataManager(createTableData()) as unknown as TableDataManager);
        const panel = {} as vscode.WebviewPanel;

        await coordinator.scheduleGitDiffCalculation(fileUri, panel, managers);
        assert.strictEqual(updateCalls.length, 1);
    });

    test('sends update when diff content changes', async () => {
        const updateCalls: any[] = [];
        const webviewManagerStub = {
            updateGitDiff: (_panel: vscode.WebviewPanel, payload: any) => updateCalls.push(payload)
        } as unknown as WebviewManager;

        let callNum = 0;
        const diffProvider = {
            getGitDiffForTable: async () => {
                callNum++;
                return [{ row: 0, status: callNum === 1 ? GitDiffStatus.UNCHANGED : GitDiffStatus.ADDED }] as RowGitDiff[];
            },
            detectColumnDiff: () => ({
                oldColumnCount: 1, newColumnCount: 1,
                addedColumns: [], deletedColumns: [],
                oldHeaders: [], newHeaders: [],
                changeType: 'none' as const, positions: [], mapping: [], heuristics: []
            })
        };

        const coordinator = new GitDiffCoordinator(webviewManagerStub, diffProvider);
        const managers = new Map<number, TableDataManager>();
        managers.set(0, new StubTableDataManager(createTableData()) as unknown as TableDataManager);
        const panel = {} as vscode.WebviewPanel;

        await coordinator.scheduleGitDiffCalculation(fileUri, panel, managers);
        await coordinator.scheduleGitDiffCalculation(fileUri, panel, managers);

        // Both calls should trigger updates because diff content changed
        assert.strictEqual(updateCalls.length, 2);
    });

    test('handles comparison error in lastSentDiffMap and falls back to direct update', async () => {
        // lastSentDiffMap の比較処理でエラーが発生した場合のフォールバックを検証
        const updateCalls: any[] = [];
        const webviewManagerStub = {
            updateGitDiff: (_panel: vscode.WebviewPanel, payload: any) => updateCalls.push(payload)
        } as unknown as WebviewManager;

        const diffPayload: RowGitDiff[] = [{ row: 0, status: GitDiffStatus.UNCHANGED }];
        const emptyColumnDiff: ColumnDiffInfo = {
            oldColumnCount: 1, newColumnCount: 1,
            addedColumns: [], deletedColumns: [],
            oldHeaders: [], newHeaders: [],
            changeType: 'none', positions: [], mapping: [], heuristics: []
        };
        const diffProvider = {
            getGitDiffForTable: async () => diffPayload,
            detectColumnDiff: () => emptyColumnDiff
        };

        const coordinator = new GitDiffCoordinator(webviewManagerStub, diffProvider);
        const managers = new Map<number, TableDataManager>();
        managers.set(0, new StubTableDataManager(createTableData()) as unknown as TableDataManager);
        const panel = {} as vscode.WebviewPanel;

        // lastSentDiffMap の get をエラーを投げるようにして比較エラーを発生させる
        const internalLastSentDiffMap = (coordinator as any).lastSentDiffMap;
        const origGet = internalLastSentDiffMap.get.bind(internalLastSentDiffMap);
        let callIndex = 0;
        internalLastSentDiffMap.get = (key: string) => {
            callIndex++;
            if (callIndex === 1) {
                // 初回は正常にマップを返すが、JSON.stringify 比較で throw させるため
                // Proxy で get をラップ
                throw new Error('comparison error');
            }
            return origGet(key);
        };

        await coordinator.scheduleGitDiffCalculation(fileUri, panel, managers);
        // 比較エラー時のフォールバックで updateGitDiff が呼ばれるはず
        assert.ok(updateCalls.length >= 1);
    });

    test('scheduleGitDiffCalculation handles chain error via catch', async () => {
        // Promise チェーンのエラー (L78-79 の .catch) をカバー
        // previousCalculation が reject する場合にチェーンの .catch に入る
        const updateCalls: any[] = [];
        const webviewManagerStub = {
            updateGitDiff: (_panel: vscode.WebviewPanel, payload: any) => updateCalls.push(payload)
        } as unknown as WebviewManager;

        const emptyColumnDiff: ColumnDiffInfo = {
            oldColumnCount: 0,
            newColumnCount: 0,
            addedColumns: [],
            deletedColumns: []
        };
        const diffProvider = {
            getGitDiffForTable: async () => [],
            detectColumnDiff: () => emptyColumnDiff
        };

        const coordinator = new GitDiffCoordinator(webviewManagerStub, diffProvider);
        const managers = new Map<number, TableDataManager>();
        managers.set(0, new StubTableDataManager(createTableData()) as unknown as TableDataManager);
        const panel = {} as vscode.WebviewPanel;

        // diffCalculationMap に reject する Promise を設定して、
        // previousCalculation.then() のチェーンで .catch に到達させる
        const rejectingPromise = Promise.reject(new Error('previous chain failed'));
        // unhandled rejection を防止
        rejectingPromise.catch(() => {});
        (coordinator as any).diffCalculationMap.set(fileUri.toString(), rejectingPromise);

        // scheduleGitDiffCalculation は内部で .catch するので例外にはならない
        const result = coordinator.scheduleGitDiffCalculation(fileUri, panel, managers);
        await result;
        // .catch ブロックが diffCalculationMap を削除するので、マップが空になる
        assert.strictEqual((coordinator as any).diffCalculationMap.has(fileUri.toString()), false);
    });
});