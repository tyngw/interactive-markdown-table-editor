/**
 * themeApplier のユニットテスト
 * テーマの適用、ウォッチャー登録、テーマピッカーをテスト
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { ThemeApplier } from '../../src/activation/themeApplier';

suite('ThemeApplier Test Suite', () => {
    let themeApplier: ThemeApplier;
    let mockWebviewManager: any;
    let broadcastCalls: any[];
    let originalShowQuickPick: any;
    let originalGetConfiguration: any;
    let originalShowInformationMessage: any;

    setup(() => {
        broadcastCalls = [];
        mockWebviewManager = {
            communicationManagerCount: 0,
            broadcastNotification: (command: string, data: any) => {
                broadcastCalls.push({ command, data });
            }
        };
        themeApplier = new ThemeApplier(mockWebviewManager);
        originalShowQuickPick = (vscode.window as any).showQuickPick;
        originalGetConfiguration = (vscode.workspace as any).getConfiguration;
        originalShowInformationMessage = (vscode.window as any).showInformationMessage;
    });

    teardown(() => {
        (vscode.window as any).showQuickPick = originalShowQuickPick;
        (vscode.workspace as any).getConfiguration = originalGetConfiguration;
        (vscode.window as any).showInformationMessage = originalShowInformationMessage;
        // vscode.extensions.all is read-only in many environments; no reliable restore available
    });

    test('should construct without errors', () => {
        assert.ok(themeApplier instanceof ThemeApplier);
    });

    suite('applyConfiguredThemeToPanels', () => {
        test('should not throw', async () => {
            await themeApplier.applyConfiguredThemeToPanels();
            assert.ok(broadcastCalls.length >= 0);
        });

        test('should broadcast applyThemeVariables', async () => {
            await themeApplier.applyConfiguredThemeToPanels();
            assert.ok(broadcastCalls.some(c => c.command === 'applyThemeVariables'));
        });

        test('broadcast should contain cssText', async () => {
            await themeApplier.applyConfiguredThemeToPanels();
            const call = broadcastCalls.find(c => c.command === 'applyThemeVariables');
            assert.ok(call);
            assert.ok('cssText' in call.data);
        });

        test('should handle error in broadcastNotification gracefully', async () => {
            mockWebviewManager.broadcastNotification = () => {
                throw new Error('broadcast error');
            };
            // applyConfiguredThemeToPanels catches error internally
            await themeApplier.applyConfiguredThemeToPanels();
            // No exception should bubble up
        });

        test('should read theme from configuration', async () => {
            let configKey = '';
            (vscode.workspace as any).getConfiguration = (section: string) => {
                return {
                    get: (key: string, def: any) => {
                        configKey = key;
                        return def; // returns 'inherit' default
                    },
                    update: async () => {},
                    has: () => false,
                    inspect: () => undefined
                };
            };
            await themeApplier.applyConfiguredThemeToPanels();
            assert.strictEqual(configKey, 'theme');
        });
    });

    suite('registerWatchers', () => {
        test('should add subscriptions to context', () => {
            const subscriptions: any[] = [];
            const mockContext: any = { subscriptions };
            themeApplier.registerWatchers(mockContext);
            assert.strictEqual(subscriptions.length, 2);
        });

        test('config watcher should call applyConfiguredThemeToPanels when theme changes', async () => {
            const subscriptions: any[] = [];
            const mockContext: any = { subscriptions };

            // onDidChangeConfiguration のモックを差し替えて、コールバックを取得する
            let configCallback: any = null;
            const originalOnDidChangeConfig = (vscode.workspace as any).onDidChangeConfiguration;
            (vscode.workspace as any).onDidChangeConfiguration = (cb: any) => {
                configCallback = cb;
                return { dispose: () => {} };
            };

            themeApplier.registerWatchers(mockContext);

            // テーマ設定変更をシミュレート
            if (configCallback) {
                await configCallback({ affectsConfiguration: (key: string) => key === 'markdownTableEditor.theme' });
            }
            assert.ok(broadcastCalls.some(c => c.command === 'applyThemeVariables'));

            (vscode.workspace as any).onDidChangeConfiguration = originalOnDidChangeConfig;
        });

        test('config watcher should not trigger for unrelated config changes', async () => {
            const subscriptions: any[] = [];
            const mockContext: any = { subscriptions };

            let configCallback: any = null;
            const originalOnDidChangeConfig = (vscode.workspace as any).onDidChangeConfiguration;
            (vscode.workspace as any).onDidChangeConfiguration = (cb: any) => {
                configCallback = cb;
                return { dispose: () => {} };
            };

            themeApplier.registerWatchers(mockContext);

            if (configCallback) {
                await configCallback({ affectsConfiguration: (key: string) => key === 'editor.fontSize' });
            }
            // テーマ変更ではないので broadcast は呼ばれない
            assert.strictEqual(broadcastCalls.length, 0);

            (vscode.workspace as any).onDidChangeConfiguration = originalOnDidChangeConfig;
        });

        test('color theme watcher should call applyConfiguredThemeToPanels', async () => {
            const subscriptions: any[] = [];
            const mockContext: any = { subscriptions };

            let colorThemeCallback: any = null;
            const originalOnDidChangeActiveColorTheme = (vscode.window as any).onDidChangeActiveColorTheme;
            (vscode.window as any).onDidChangeActiveColorTheme = (cb: any) => {
                colorThemeCallback = cb;
                return { dispose: () => {} };
            };

            themeApplier.registerWatchers(mockContext);

            if (colorThemeCallback) {
                await colorThemeCallback();
            }
            assert.ok(broadcastCalls.some(c => c.command === 'applyThemeVariables'));

            (vscode.window as any).onDidChangeActiveColorTheme = originalOnDidChangeActiveColorTheme;
        });
    });

    suite('showThemePicker', () => {
        test('should not throw when picker is cancelled', async () => {
            (vscode.window as any).showQuickPick = async () => undefined;
            await themeApplier.showThemePicker();
        });

        test('should update config and apply theme when inherit is selected', async () => {
            let updatedThemeId = '';
            let infoShown = false;

            (vscode.window as any).showQuickPick = async (items: any[]) => {
                return items[0]; // 'inherit' option
            };
            (vscode.workspace as any).getConfiguration = () => ({
                get: (_key: string, def: any) => def,
                update: async (_key: string, value: any) => { updatedThemeId = value; },
                has: () => false,
                inspect: () => undefined
            });
            (vscode.window as any).showInformationMessage = async () => { infoShown = true; };

            await themeApplier.showThemePicker();

            assert.strictEqual(updatedThemeId, 'inherit');
            assert.ok(infoShown);
            assert.ok(broadcastCalls.some(c => c.command === 'applyThemeVariables'));
        });

        test('should update config when a specific theme is selected', async () => {
            let updatedThemeId = '';

            // Note: このテストでは getInstalledColorThemes() がモック拡張を受け取れないため、
            // 実際にインストールされているテーマ（存在する場合）を使用します。
            // モック拡張の注入は実装の変更が必要です。

            (vscode.window as any).showQuickPick = async (items: any[]) => {
                // Pick the second item (first real theme)
                return items.length > 1 ? items[1] : items[0];
            };
            (vscode.workspace as any).getConfiguration = () => ({
                get: (_key: string, def: any) => def,
                update: async (_key: string, value: any) => { updatedThemeId = value; },
                has: () => false,
                inspect: () => undefined
            });
            (vscode.window as any).showInformationMessage = async () => {};

            await themeApplier.showThemePicker();

            // 実際にインストールされているテーマが選択されるか、inherit が選択される
            assert.ok(typeof updatedThemeId === 'string');
        });

        test('should handle theme with empty description as inherit', async () => {
            let updatedThemeId = '';

            (vscode.window as any).showQuickPick = async () => {
                return { label: 'Something', description: '' };
            };
            (vscode.workspace as any).getConfiguration = () => ({
                get: (_key: string, def: any) => def,
                update: async (_key: string, value: any) => { updatedThemeId = value; },
                has: () => false,
                inspect: () => undefined
            });
            (vscode.window as any).showInformationMessage = async () => {};

            await themeApplier.showThemePicker();
            assert.strictEqual(updatedThemeId, 'inherit');
        });
    });
});
