/**
 * tableEditRunner のユニットテスト
 * run メソッドのフロー（Undo保存 → mutate → 保存 → diff → 成功通知）をテスト
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { TableEditRunner, TableEditOptions } from '../../src/activation/tableEditRunner';
import { TableDataManager } from '../../src/tableDataManager';

suite('TableEditRunner Test Suite', () => {
    let runner: TableEditRunner;
    let mockPanelSessionManager: any;
    let mockUndoRedoManager: any;
    let mockFileHandler: any;
    let mockWebviewManager: any;
    let mockGitDiffCoordinator: any;
    let sendSuccessCalls: any[];
    let sendErrorCalls: any[];
    let operationSuccessCalls: any[];

    setup(() => {
        sendSuccessCalls = [];
        sendErrorCalls = [];
        operationSuccessCalls = [];

        mockPanelSessionManager = {
            resolvePanelContext: (rawUri: any, panelId: any) => ({
                uri: rawUri ? vscode.Uri.parse(rawUri) : undefined,
                uriString: rawUri || undefined,
                panel: { webview: { postMessage: () => {} } },
                tableManagersMap: undefined as any
            })
        };

        mockUndoRedoManager = {
            saveState: async () => {}
        };

        mockFileHandler = {
            updateTableByIndex: async () => true
        };

        mockWebviewManager = {
            sendSuccess: (panel: any, message: string) => { sendSuccessCalls.push({ panel, message }); },
            sendError: (panel: any, message: string) => { sendErrorCalls.push({ panel, message }); },
            sendOperationSuccess: (panel: any, type: string, data: any) => { operationSuccessCalls.push({ panel, type, data }); },
            isAutoSaveEnabled: () => true,
            setDirtyState: () => {}
        };

        mockGitDiffCoordinator = {
            scheduleGitDiffCalculation: async () => {}
        };

        runner = new TableEditRunner({
            panelSessionManager: mockPanelSessionManager,
            undoRedoManager: mockUndoRedoManager,
            fileHandler: mockFileHandler,
            webviewManager: mockWebviewManager,
            gitDiffCoordinator: mockGitDiffCoordinator
        });
    });

    test('should construct without errors', () => {
        assert.ok(runner instanceof TableEditRunner);
    });

    test('run should return early when uri is undefined', async () => {
        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: undefined,
            uriString: undefined,
            panel: null,
            tableManagersMap: null
        });

        await runner.run({}, {
            operationName: 'Test',
            mutate: () => {}
        });

        assert.strictEqual(sendErrorCalls.length, 0);
    });

    test('run should return early when panel is null', async () => {
        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: null,
            tableManagersMap: null
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => {}
        });

        assert.strictEqual(sendErrorCalls.length, 0);
    });

    test('run should send error when tableManagersMap is null', async () => {
        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: null
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => {}
        });

        assert.strictEqual(sendErrorCalls.length, 1);
        assert.ok(sendErrorCalls[0].message.includes('Table managers not found'));
    });

    test('run should send error when tableDataManager is not found', async () => {
        const managersMap = new Map();
        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md', tableIndex: 999 }, {
            operationName: 'Test',
            mutate: () => {}
        });

        assert.strictEqual(sendErrorCalls.length, 1);
        assert.ok(sendErrorCalls[0].message.includes('Table manager not found'));
    });

    test('run should execute mutate and send success with auto save enabled', async () => {
        let mutateCalled = false;
        const tableData = {
            headers: ['A'],
            rows: [['1']],
            metadata: { tableIndex: 0 }
        };
        const mockManager: any = {
            serializeToMarkdown: () => '| A |\n|---|\n| 1 |',
            getTableData: () => tableData
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test Operation',
            mutate: () => { mutateCalled = true; },
            getSuccessMessage: () => 'Success!'
        });

        assert.strictEqual(mutateCalled, true);
        assert.ok(sendSuccessCalls.some(c => c.message === 'Success!'));
    });

    test('run should set dirty state when auto save is disabled', async () => {
        let dirtyStateCalls: any[] = [];
        mockWebviewManager.isAutoSaveEnabled = () => false;
        mockWebviewManager.setDirtyState = (panelId: string, dirty: boolean) => {
            dirtyStateCalls.push({ panelId, dirty });
        };

        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => {}
        });

        assert.ok(dirtyStateCalls.some(c => c.dirty === true));
    });

    test('run should send error when mutate throws', async () => {
        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => { throw new Error('Mutate failed'); },
            getErrorMessage: (error: unknown) => `Custom error: ${error instanceof Error ? error.message : 'unknown'}`
        });

        assert.strictEqual(sendErrorCalls.length, 1);
        assert.ok(sendErrorCalls[0].message.includes('Custom error: Mutate failed'));
    });

    test('run should use default error message when getErrorMessage is not provided', async () => {
        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test Operation',
            mutate: () => { throw new Error('Failure'); }
        });

        assert.strictEqual(sendErrorCalls.length, 1);
        assert.ok(sendErrorCalls[0].message.includes('Failed to test operation'));
    });

    test('run should use default success message when getSuccessMessage is not provided', async () => {
        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test Operation',
            mutate: () => {}
        });

        assert.ok(sendSuccessCalls.some(c => c.message === 'Test Operation completed'));
    });

    test('run should use custom undo description when provided', async () => {
        let savedDescription = '';
        mockUndoRedoManager.saveState = async (_uri: any, desc: string) => {
            savedDescription = desc;
        };

        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test Operation',
            getUndoDescription: () => 'Custom undo description',
            mutate: () => {}
        });

        assert.strictEqual(savedDescription, 'Custom undo description');
    });

    test('run should handle null successMessage (no message sent)', async () => {
        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => {},
            getSuccessMessage: () => undefined
        });

        // successMessage が undefined なら sendSuccess は呼ばれない
        // ただし空文字列でも呼ばれないことも(falsy check)
    });

    test('run should handle non-Error throw correctly', async () => {
        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => { throw 'string error'; } // eslint-disable-line no-throw-literal
        });

        assert.strictEqual(sendErrorCalls.length, 1);
        assert.ok(sendErrorCalls[0].message.includes('Unknown error'));
    });

    test('run should silently catch sendOperationSuccess (save-started) error', async () => {
        let callCount = 0;
        mockWebviewManager.sendOperationSuccess = () => {
            callCount++;
            if (callCount === 1) {
                throw new Error('save-started failed');
            }
        };

        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => {}
        });

        // エラーが握りつぶされ、処理が続行されること
        assert.ok(sendErrorCalls.length === 0);
    });

    test('run should handle applied === false path', async () => {
        mockFileHandler.updateTableByIndex = async () => false;

        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => {}
        });

        // save-skipped の operationSuccess が送られる
        assert.ok(operationSuccessCalls.some(c => c.type === 'save-skipped'));
    });

    test('run should silently catch sendOperationSuccess (save-completed) error', async () => {
        let callCount = 0;
        mockWebviewManager.sendOperationSuccess = () => {
            callCount++;
            if (callCount === 2) {
                throw new Error('save-completed failed');
            }
        };

        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => {}
        });

        assert.ok(sendErrorCalls.length === 0);
    });

    test('run should silently catch sendOperationSuccess error when auto save is OFF', async () => {
        mockWebviewManager.isAutoSaveEnabled = () => false;
        mockWebviewManager.setDirtyState = () => {};
        mockWebviewManager.sendOperationSuccess = () => {
            throw new Error('sendOperationSuccess failed in auto-save off path');
        };

        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => {}
        });

        assert.ok(sendErrorCalls.length === 0);
    });

    test('run should use panelId for actualPanelId when provided', async () => {
        let receivedPanelId = '';
        mockWebviewManager.isAutoSaveEnabled = (pid: string) => {
            receivedPanelId = pid;
            return true;
        };

        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md', panelId: 'my-panel-id' }, {
            operationName: 'Test',
            mutate: () => {}
        });

        assert.strictEqual(receivedPanelId, 'my-panel-id');
    });

    test('run should handle gitDiffCoordinator.scheduleGitDiffCalculation rejection silently', async () => {
        mockGitDiffCoordinator.scheduleGitDiffCalculation = async () => {
            throw new Error('Git diff failed');
        };

        const mockManager: any = {
            serializeToMarkdown: () => '| A |',
            getTableData: () => ({ headers: ['A'], rows: [], metadata: { tableIndex: 0 } })
        };
        const managersMap = new Map([[0, mockManager]]);

        mockPanelSessionManager.resolvePanelContext = () => ({
            uri: vscode.Uri.file('/test.md'),
            uriString: 'file:///test.md',
            panel: { webview: { postMessage: () => {} } },
            tableManagersMap: managersMap
        });

        await runner.run({ uri: 'file:///test.md' }, {
            operationName: 'Test',
            mutate: () => {}
        });

        // エラーが握りつぶされ、処理は成功すること
        assert.ok(sendErrorCalls.length === 0);
    });
});
