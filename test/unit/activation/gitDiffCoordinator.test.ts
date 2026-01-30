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
});