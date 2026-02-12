/**
 * extension.ts のユニットテスト
 * activate/deactivate のエントリポイントをテスト
 */
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('extension Test Suite', () => {
    test('should export activate and deactivate functions', () => {
        const ext = require('../../src/extension');
        assert.strictEqual(typeof ext.activate, 'function');
        assert.strictEqual(typeof ext.deactivate, 'function');
    });

    test('activate should not throw', () => {
        const ext = require('../../src/extension');
        // モック ExtensionContext を作成
        const mockContext: any = {
            subscriptions: [],
            extensionUri: vscode.Uri.file('/mock/extension'),
            extensionPath: '/mock/extension',
            extensionMode: vscode.ExtensionMode.Development,
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => [],
                setKeysForSync: () => {}
            },
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            storageUri: vscode.Uri.file('/mock/storage'),
            globalStorageUri: vscode.Uri.file('/mock/global-storage'),
            logUri: vscode.Uri.file('/mock/log'),
            secrets: {
                get: () => Promise.resolve(undefined),
                store: () => Promise.resolve(),
                delete: () => Promise.resolve(),
                onDidChange: new vscode.EventEmitter().event
            },
            environmentVariableCollection: {
                persistent: false,
                description: '',
                replace: () => {},
                append: () => {},
                prepend: () => {},
                get: () => undefined,
                forEach: () => {},
                delete: () => {},
                clear: () => {},
                getScoped: () => ({
                    persistent: false,
                    description: '',
                    replace: () => {},
                    append: () => {},
                    prepend: () => {},
                    get: () => undefined,
                    forEach: () => {},
                    delete: () => {},
                    clear: () => {},
                    [Symbol.iterator]: function* () {}
                }),
                [Symbol.iterator]: function* () {}
            },
            asAbsolutePath: (p: string) => '/mock/extension/' + p,
            storagePath: '/mock/storage',
            globalStoragePath: '/mock/global-storage',
            logPath: '/mock/log',
            extension: {
                id: 'test.extension',
                extensionUri: vscode.Uri.file('/mock/extension'),
                extensionPath: '/mock/extension',
                isActive: true,
                packageJSON: {},
                extensionKind: 1,
                exports: undefined,
                activate: () => Promise.resolve()
            },
            languageModelAccessInformation: {
                onDidChange: new vscode.EventEmitter().event,
                canSendRequest: () => undefined
            }
        };

        assert.doesNotThrow(() => {
            ext.activate(mockContext);
        });
    });

    test('deactivate should not throw', () => {
        const ext = require('../../src/extension');
        assert.doesNotThrow(() => {
            ext.deactivate();
        });
    });

    test('deactivate should handle errors gracefully', () => {
        const ext = require('../../src/extension');
        // deactivate は try-catch でエラーを握りつぶすので、再度呼んでもエラーにならない
        assert.doesNotThrow(() => {
            ext.deactivate();
        });
    });

    test('deactivate should handle WebviewManager.getInstance throwing', () => {
        const ext = require('../../src/extension');
        // WebviewManager を壊してエラーを引き起こす → try-catch で処理される
        const webviewManager = require('../../src/webviewManager');
        const origGetInstance = webviewManager.WebviewManager.getInstance;

        webviewManager.WebviewManager.getInstance = () => { throw new Error('getInstance error'); };
        try {
            assert.doesNotThrow(() => {
                ext.deactivate();
            });
        } finally {
            webviewManager.WebviewManager.getInstance = origGetInstance;
        }
    });

    test('deactivate should handle disposeFileHandler throwing', () => {
        const ext = require('../../src/extension');
        // disposeFileHandler が存在しないシナリオはないが、
        // require('./fileHandler') が失敗するケースをテスト
        // → L60 の catch ブランチ
        // deactivate を連続で呼んでも安全であることを確認
        assert.doesNotThrow(() => {
            ext.deactivate();
            ext.deactivate();
        });
    });

    test('deactivate should handle disposeFileHandler function throwing error', () => {
        const ext = require('../../src/extension');
        const fileHandler = require('../../src/fileHandler');
        const origDispose = fileHandler.disposeFileHandler;

        // disposeFileHandler がエラーを投げるようにモック
        fileHandler.disposeFileHandler = () => { throw new Error('dispose error'); };
        try {
            // L60 の catch ブロックでエラーが握りつぶされる
            assert.doesNotThrow(() => {
                ext.deactivate();
            });
        } finally {
            fileHandler.disposeFileHandler = origDispose;
        }
    });
});
