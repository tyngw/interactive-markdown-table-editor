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

    test('normalizeUri handles falsy value', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const result = manager.normalizeUri(null);
        assert.strictEqual(result.uri, null);
        assert.strictEqual(result.uriString, '');
    });

    test('normalizeUri handles undefined', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const result = manager.normalizeUri(undefined);
        assert.strictEqual(result.uri, null);
        assert.strictEqual(result.uriString, '');
    });

    test('normalizeUri handles object with toString', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const customObj = { toString: () => 'file:///tmp/custom.md' };
        const result = manager.normalizeUri(customObj);
        assert.ok(result.uriString === 'file:///tmp/custom.md');
    });

    test('normalizeUri handles object with toString returning invalid URI', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const customObj = { toString: () => '::invalid::' };
        const result = manager.normalizeUri(customObj);
        assert.strictEqual(result.uri, null);
    });

    test('normalizeUri handles object without toString', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const noToString = Object.create(null);
        const result = manager.normalizeUri(noToString);
        assert.strictEqual(result.uri, null);
        assert.strictEqual(result.uriString, '');
    });

    test('resolvePanelContext resolves tableManagersMap from candidateKeys fallback', () => {
        const uriStr = 'file:///tmp/multi-key.md';
        const webviewManager = createWebviewManagerStub({});
        const sessionManager = new PanelSessionManager(webviewManager);

        const tableManagersMap = new Map<number, TableDataManager>();
        tableManagersMap.set(0, dummyManager);
        sessionManager.setManagers(uriStr, tableManagersMap);

        // panelId が未知の場合、uriString から tableManagersMap を解決する
        const result = sessionManager.resolvePanelContext(uriStr, 'unknown-panel');
        assert.ok(result.tableManagersMap);
        assert.strictEqual(result.tableManagersMap?.get(0), dummyManager);
    });

    test('getManagers returns undefined for unknown key', () => {
        const sessionManager = new PanelSessionManager(createWebviewManagerStub({}));
        assert.strictEqual(sessionManager.getManagers('unknown'), undefined);
    });

    test('getPanelAndManagers returns panel and managers', () => {
        const panelKey = 'panel-key';
        const webviewManager = createWebviewManagerStub({ [panelKey]: dummyPanel });
        const sessionManager = new PanelSessionManager(webviewManager);

        const managers = new Map<number, TableDataManager>();
        managers.set(0, dummyManager);
        sessionManager.setManagers(panelKey, managers);

        const result = sessionManager.getPanelAndManagers(panelKey);
        assert.strictEqual(result.panel, dummyPanel);
        assert.ok(result.managers);
    });

    test('clearAll clears all managers', () => {
        const sessionManager = new PanelSessionManager(createWebviewManagerStub({}));
        const managers = new Map<number, TableDataManager>();
        managers.set(0, dummyManager);
        sessionManager.setManagers('key1', managers);

        sessionManager.clearAll();
        assert.strictEqual(sessionManager.getManagers('key1'), undefined);
    });

    test('normalizeUri handles empty string', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        // 空文字列 → parse で scheme なしの URI → scheme チェックで null
        const result = manager.normalizeUri('');
        assert.strictEqual(result.uri, null);
    });

    test('normalizeUri handles string with double colons (:: check)', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const result = manager.normalizeUri('file:///path::to::file');
        assert.strictEqual(result.uri, null);
        assert.strictEqual(result.uriString, 'file:///path::to::file');
    });

    test('normalizeUri handles file URI with no path', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        // file scheme で path が空 → uri: null
        const result = manager.normalizeUri('file://');
        assert.strictEqual(result.uri, null);
    });

    test('normalizeUri string catch block when Uri.parse throws (L29)', () => {
        // Uri.parse が例外を投げた場合の catch ブロックをカバー
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const origParse = vscode.Uri.parse;
        (vscode.Uri as any).parse = () => { throw new Error('parse failed'); };
        try {
            const result = manager.normalizeUri('some-uri-string');
            assert.strictEqual(result.uri, null);
            assert.strictEqual(result.uriString, 'some-uri-string');
        } finally {
            (vscode.Uri as any).parse = origParse;
        }
    });

    test('normalizeUri toString catch block when Uri.parse throws (L50)', () => {
        // toString() ブランチで Uri.parse が例外を投げた場合の catch ブロックをカバー
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const origParse = vscode.Uri.parse;
        (vscode.Uri as any).parse = () => { throw new Error('parse failed'); };
        try {
            const badObj = { toString: () => 'valid-looking-string' };
            const result = manager.normalizeUri(badObj);
            assert.strictEqual(result.uri, null);
            assert.strictEqual(result.uriString, 'valid-looking-string');
        } finally {
            (vscode.Uri as any).parse = origParse;
        }
    });

    test('normalizeUri handles vscode.Uri instance with double colon toString', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        // vscode.Uri.parse で file scheme + :: を含む URI を作る
        const uri = vscode.Uri.parse('file:///test::path');
        const result = manager.normalizeUri(uri);
        assert.strictEqual(result.uri, null);
    });

    test('normalizeUri handles object with toString returning non-parsable URI', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        // toString() が不正な文字列を返すオブジェクト (L50 付近)
        const badObj = { toString: () => '::completely::invalid::' };
        const result = manager.normalizeUri(badObj);
        assert.strictEqual(result.uri, null);
        assert.strictEqual(result.uriString, '::completely::invalid::');
    });

    test('normalizeUri handles object with toString that produces valid URI', () => {
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const goodObj = { toString: () => 'file:///valid/path.md' };
        const result = manager.normalizeUri(goodObj);
        assert.ok(result.uri);
        assert.strictEqual(result.uriString, 'file:///valid/path.md');
    });

    test('normalizeUri string catch block - Uri.parse throws for string input (L29)', () => {
        // string 型の入力に対して vscode.Uri.parse が例外を投げた場合、
        // catch ブロックで { uri: null, uriString: value } が返されること
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const origParse = vscode.Uri.parse;
        (vscode.Uri as any).parse = () => { throw new TypeError('Mocked parse failure for string'); };
        try {
            const result = manager.normalizeUri('file:///some/valid-looking/path.md');
            assert.strictEqual(result.uri, null);
            assert.strictEqual(result.uriString, 'file:///some/valid-looking/path.md');
        } finally {
            (vscode.Uri as any).parse = origParse;
        }
    });

    test('normalizeUri toString object catch block - Uri.parse throws (L50)', () => {
        // toString() 可能なオブジェクトに対して vscode.Uri.parse が例外を投げた場合、
        // catch ブロックで { uri: null, uriString } が返されること
        const manager = new PanelSessionManager(createWebviewManagerStub({}));
        const origParse = vscode.Uri.parse;
        (vscode.Uri as any).parse = () => { throw new TypeError('Mocked parse failure for toString obj'); };
        try {
            const toStringObj = { toString: () => 'custom://resource/id' };
            const result = manager.normalizeUri(toStringObj);
            assert.strictEqual(result.uri, null);
            assert.strictEqual(result.uriString, 'custom://resource/id');
        } finally {
            (vscode.Uri as any).parse = origParse;
        }
    });
});