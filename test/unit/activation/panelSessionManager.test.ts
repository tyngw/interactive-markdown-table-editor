// PanelSessionManager の URI 解決とパネル解決の挙動を確認するユニットテスト
import * as assert from 'assert';
import * as vscode from 'vscode';
import { PanelSessionManager } from '../../../src/activation/panelSessionManager';
import { WebviewManager } from '../../../src/webviewManager';
import { TableDataManager } from '../../../src/tableDataManager';

suite('PanelSessionManager', () => {
    const dummyPanel = {} as vscode.WebviewPanel;
    const dummyManager = {} as TableDataManager;

    const createWebviewManagerStub = (panels: Record<string, vscode.WebviewPanel | null>): WebviewManager => {
        return {
            getPanel: (key: string) => panels[key] ?? null
        } as unknown as WebviewManager;
    };

    test('normalizes various URI inputs', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const uri = vscode.Uri.parse('file:///tmp/sample.md');

        const parsed = manager.normalizeUri(uri);
        assert.strictEqual(parsed.uri?.toString(), uri.toString());
        assert.strictEqual(parsed.uriString, uri.toString());

        const stringInput = manager.normalizeUri(uri.toString());
        assert.strictEqual(stringInput.uriString, uri.toString());
        assert.strictEqual(stringInput.uri?.toString(), uri.toString());

        const invalid = manager.normalizeUri('::invalid-uri::');
        assert.strictEqual(invalid.uri, null);
        assert.strictEqual(invalid.uriString, '::invalid-uri::');
    });

    test('resolves panel and managers by panelId preference', () => {
        const panelId = 'panel-1';
        const webviewManager = createWebviewManagerStub({
            [panelId]: dummyPanel
        });
        const sessionManager = new PanelSessionManager(webviewManager);

        const tableManagersMap = new Map<number, TableDataManager>();
        tableManagersMap.set(0, dummyManager);
        sessionManager.setManagers(panelId, tableManagersMap);

        const result = sessionManager.resolvePanelContext('file:///tmp/sample.md', panelId);

        assert.strictEqual(result.panel, dummyPanel);
        assert.strictEqual(result.panelKey, panelId);
        assert.ok(result.tableManagersMap);
        assert.strictEqual(result.tableManagersMap?.get(0), dummyManager);
    });

    test('falls back to uri when panel is not tracked yet', () => {
        const uriString = 'file:///tmp/sample.md';
        const webviewManager = createWebviewManagerStub({});
        const sessionManager = new PanelSessionManager(webviewManager);

        const tableManagersMap = new Map<number, TableDataManager>();
        tableManagersMap.set(0, dummyManager);
        sessionManager.setManagers(uriString, tableManagersMap);

        const result = sessionManager.resolvePanelContext(uriString);
        assert.strictEqual(result.panel, null);
        assert.strictEqual(result.panelKey, uriString);
        assert.ok(result.tableManagersMap);
    });
});