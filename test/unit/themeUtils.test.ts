/**
 * themeUtils のユニットテスト
 * テーマ一覧取得、テーマ検索、CSS変数構築、スタイルタグ生成をテスト
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
    getInstalledColorThemes,
    findThemeById,
    buildThemeVariablesCss,
    createThemeStyleTag,
    ThemeVariables,
    InstalledThemeInfo
} from '../../src/themeUtils';

/**
 * テスト用のモック拡張オブジェクトを生成するヘルパー
 */
function createMockExtension(id: string, themes: any[], extensionUriPath: string = '/ext') {
    return {
        id,
        extensionUri: vscode.Uri.file(extensionUriPath),
        packageJSON: {
            contributes: {
                themes
            }
        }
    };
}

/**
 * vscode.workspace.fs のモック用ヘルパー
 * VS Code v1.109+ では vscode.workspace.fs のメソッドが configurable: false のため、
 * 個々のメソッドを Object.defineProperty で差し替えることができない。
 * 代わりに vscode.workspace の fs プロパティ自体を差し替える。
 */
const originalFs = vscode.workspace.fs;
const originalFsDescriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'fs');

/**
 * readFile をモック関数に差し替えた fs オブジェクトを workspace にセットする
 * Proxy のターゲットを空オブジェクトにして non-configurable プロパティの
 * invariant check を回避し、readFile のみインターセプトし他はオリジナルに委譲する
 */
function mockReadFile(impl: (uri: vscode.Uri) => Promise<Uint8Array>): void {
    const fakeFs = new Proxy({} as typeof originalFs, {
        get(_target, prop, _receiver) {
            if (prop === 'readFile') {
                return impl;
            }
            return (originalFs as any)[prop];
        }
    });
    Object.defineProperty(vscode.workspace, 'fs', {
        value: fakeFs,
        writable: true,
        configurable: true
    });
}

/** モックした fs を元に戻す */
function restoreFs(): void {
    if (originalFsDescriptor) {
        Object.defineProperty(vscode.workspace, 'fs', originalFsDescriptor);
    } else {
        Object.defineProperty(vscode.workspace, 'fs', {
            value: originalFs,
            writable: true,
            configurable: true
        });
    }
}

suite('themeUtils Test Suite', () => {
    // Note: vscode.extensions.all and vscode.workspace.fs are read-only
    // properties and cannot be mocked via assignment in teardown.
    // Instead, we pass mock extension lists directly to the functions.

    teardown(() => {
        restoreFs();
    });

    suite('getInstalledColorThemes', () => {
        test('should return an array', () => {
            const themes = getInstalledColorThemes();
            assert.ok(Array.isArray(themes));
        });

        test('should return themes with required properties when extensions have themes', () => {
            const mockExtensions = [
                createMockExtension('publisher.my-theme', [
                    { label: 'My Dark Theme', path: 'themes/dark.json', uiTheme: 'vs-dark' },
                    { label: 'My Light Theme', path: 'themes/light.json', uiTheme: 'vs' }
                ])
            ] as any;
            const themes = getInstalledColorThemes(mockExtensions);
            assert.strictEqual(themes.length, 2);
            assert.strictEqual(themes[0].id, 'publisher.my-theme:themes/dark.json');
            assert.strictEqual(themes[0].label, 'My Dark Theme');
            assert.strictEqual(themes[0].uiTheme, 'vs-dark');
            assert.strictEqual(themes[0].extensionId, 'publisher.my-theme');
            assert.ok(themes[0].themePath instanceof vscode.Uri);
        });

        test('should deduplicate themes by id', () => {
            const mockExtensions = [
                createMockExtension('pub.ext', [
                    { label: 'Theme A', path: 'themes/a.json' }
                ]),
                createMockExtension('pub.ext', [
                    { label: 'Theme A duplicate', path: 'themes/a.json' }
                ])
            ] as any;
            const themes = getInstalledColorThemes(mockExtensions);
            assert.strictEqual(themes.length, 1);
        });

        test('should skip extensions without contributes', () => {
            const mockExtensions = [
                { id: 'no-contributes', extensionUri: vscode.Uri.file('/ext'), packageJSON: {} }
            ] as any;
            const themes = getInstalledColorThemes(mockExtensions);
            assert.strictEqual(themes.length, 0);
        });

        test('should skip extensions with non-array themes', () => {
            const mockExtensions = [
                { id: 'bad-themes', extensionUri: vscode.Uri.file('/ext'), packageJSON: { contributes: { themes: 'not-an-array' } } }
            ] as any;
            const themes = getInstalledColorThemes(mockExtensions);
            assert.strictEqual(themes.length, 0);
        });

        test('should skip theme entries without path', () => {
            const mockExtensions = [
                createMockExtension('pub.ext', [
                    { label: 'No Path Theme' }
                ])
            ] as any;
            const themes = getInstalledColorThemes(mockExtensions);
            assert.strictEqual(themes.length, 0);
        });

        test('should use fallback labels (id, name, Unnamed Theme)', () => {
            const mockExtensions = [
                createMockExtension('pub.ext', [
                    { id: 'id-label', path: 'themes/a.json' },
                    { name: 'name-label', path: 'themes/b.json' },
                    { path: 'themes/c.json' }
                ])
            ] as any;
            const themes = getInstalledColorThemes(mockExtensions);
            assert.strictEqual(themes.length, 3);
            assert.strictEqual(themes[0].label, 'id-label');
            assert.strictEqual(themes[1].label, 'name-label');
            assert.strictEqual(themes[2].label, 'Unnamed Theme');
        });

        test('should handle extension with null packageJSON', () => {
            const mockExtensions = [
                { id: 'null-pkg', extensionUri: vscode.Uri.file('/ext'), packageJSON: null }
            ] as any;
            const themes = getInstalledColorThemes(mockExtensions);
            assert.strictEqual(themes.length, 0);
        });
    });

    suite('findThemeById', () => {
        test('should return undefined for non-existent theme', () => {
            const result = findThemeById('non-existent:theme');
            assert.strictEqual(result, undefined);
        });

        test('should return undefined for empty string', () => {
            const result = findThemeById('');
            assert.strictEqual(result, undefined);
        });

        test('should find theme by id when extension exists', () => {
            const mockExtensions = [
                createMockExtension('publisher.mytheme', [
                    { label: 'Dark Pro', path: 'themes/dark.json', uiTheme: 'vs-dark' }
                ])
            ] as any;
            const result = findThemeById('publisher.mytheme:themes/dark.json', mockExtensions);
            assert.ok(result);
            assert.strictEqual(result!.id, 'publisher.mytheme:themes/dark.json');
            assert.strictEqual(result!.label, 'Dark Pro');
            assert.strictEqual(result!.uiTheme, 'vs-dark');
            assert.strictEqual(result!.extensionId, 'publisher.mytheme');
        });

        test('should return undefined when extension id does not match', () => {
            const mockExtensions = [
                createMockExtension('other.ext', [
                    { label: 'Other Theme', path: 'themes/other.json' }
                ])
            ] as any;
            const result = findThemeById('publisher.mytheme:themes/dark.json', mockExtensions);
            assert.strictEqual(result, undefined);
        });

        test('should return undefined when path does not match', () => {
            const mockExtensions = [
                createMockExtension('publisher.mytheme', [
                    { label: 'Different', path: 'themes/other.json' }
                ])
            ] as any;
            const result = findThemeById('publisher.mytheme:themes/dark.json', mockExtensions);
            assert.strictEqual(result, undefined);
        });

        test('should handle theme id with colons in path', () => {
            const mockExtensions = [
                createMockExtension('publisher.ext', [
                    { label: 'Colon Theme', path: 'themes:special/dark.json' }
                ])
            ] as any;
            const result = findThemeById('publisher.ext:themes:special/dark.json', mockExtensions);
            assert.ok(result);
            assert.strictEqual(result!.label, 'Colon Theme');
        });

        test('should use fallback labels for findThemeById', () => {
            const mockExtensions = [
                createMockExtension('pub.ext', [
                    { path: 'themes/noname.json' }
                ])
            ] as any;
            const result = findThemeById('pub.ext:themes/noname.json', mockExtensions);
            assert.ok(result);
            assert.strictEqual(result!.label, 'Unnamed Theme');
        });

        test('should skip extension with non-array themes in findThemeById', () => {
            const mockExtensions = [
                { id: 'pub.ext', extensionUri: vscode.Uri.file('/ext'), packageJSON: { contributes: { themes: null } } }
            ] as any;
            const result = findThemeById('pub.ext:themes/a.json', mockExtensions);
            assert.strictEqual(result, undefined);
        });
    });

    suite('buildThemeVariablesCss', () => {
        test('should return empty cssText for inherit theme', async () => {
            const result = await buildThemeVariablesCss('inherit');
            assert.strictEqual(result.cssText, '');
        });

        test('should return empty cssText for undefined theme', async () => {
            const result = await buildThemeVariablesCss(undefined);
            assert.strictEqual(result.cssText, '');
        });

        test('should return empty cssText for non-existent theme id', async () => {
            const result = await buildThemeVariablesCss('nonexistent:theme');
            assert.strictEqual(result.cssText, '');
        });

        test('should return ThemeVariables object', async () => {
            const result = await buildThemeVariablesCss('inherit');
            assert.ok('cssText' in result);
            assert.ok(typeof result.cssText === 'string');
        });

        test('should build CSS from theme colors when theme file exists', async () => {
            // モック拡張を追加
            const mockExtensions = [
                createMockExtension('pub.darktheme', [
                    { label: 'Test Dark', path: 'themes/dark.json', uiTheme: 'vs-dark' }
                ], '/testext')
            ] as any;

            // workspace.fs.readFile をスタブして JSON を返す
            const themeJson = {
                colors: {
                    'editor.background': '#1e1e1e',
                    'foreground': '#d4d4d4',
                    'focusBorder': '#007acc'
                }
            };
            mockReadFile(async (_uri: vscode.Uri) => {
                return new Uint8Array(Buffer.from(JSON.stringify(themeJson), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.darktheme:themes/dark.json', mockExtensions);
            assert.ok(result.cssText.length > 0);
            assert.ok(result.cssText.includes('--vscode-editor-background'));
            assert.ok(result.cssText.includes('#1e1e1e'));
            assert.ok(result.cssText.includes('--vscode-foreground'));
            assert.ok(result.cssText.includes('#d4d4d4'));
        });

        test('should build CSS with ensure overrides for missing tab colors', async () => {
            const mockExtensions = [
                createMockExtension('pub.minimal', [
                    { label: 'Minimal Theme', path: 'themes/min.json', uiTheme: 'vs-dark' }
                ], '/testmin')
            ] as any;

            const themeJson = {
                colors: {
                    'editor.background': '#282828',
                    'foreground': '#ebdbb2'
                }
            };
            mockReadFile(async () => {
                return new Uint8Array(Buffer.from(JSON.stringify(themeJson), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.minimal:themes/min.json', mockExtensions);
            assert.ok(result.cssText.length > 0);
            // Should include ensure overrides for tab colors
            assert.ok(result.cssText.includes('--vscode-tab-activeBackground'));
            assert.ok(result.cssText.includes('--vscode-tab-activeForeground'));
        });

        test('should use dark fallback when theme file reading fails', async () => {
            const mockExtensions = [
                createMockExtension('pub.failtheme', [
                    { label: 'Fail Dark Theme', path: 'themes/fail.json', uiTheme: 'vs-dark' }
                ], '/testfail')
            ] as any;

            // readFile がエラーを投げるようにする
            mockReadFile(async () => {
                throw new Error('File not found');
            });

            const result = await buildThemeVariablesCss('pub.failtheme:themes/fail.json', mockExtensions);
            // フォールバックが使用される（Dark テーマのフォールバック値）
            assert.ok(result.cssText.includes('--vscode-editor-background:#1e1e1e'));
            assert.ok(result.cssText.includes(':root'));
        });

        test('should use light fallback when light theme file reading fails', async () => {
            const mockExtensions = [
                createMockExtension('pub.lightfail', [
                    { label: 'Fail Light Theme', path: 'themes/light-fail.json', uiTheme: 'vs' }
                ], '/testlightfail')
            ] as any;

            mockReadFile(async () => {
                throw new Error('File not found');
            });

            const result = await buildThemeVariablesCss('pub.lightfail:themes/light-fail.json', mockExtensions);
            // ライトテーマのフォールバック値
            assert.ok(result.cssText.includes('--vscode-editor-background:#ffffff'));
        });

        test('should handle theme JSON with no colors property', async () => {
            const mockExtensions = [
                createMockExtension('pub.nocolors', [
                    { label: 'No Colors Dark', path: 'themes/nocolors.json', uiTheme: 'vs-dark' }
                ], '/testnocolors')
            ] as any;

            mockReadFile(async () => {
                return new Uint8Array(Buffer.from(JSON.stringify({ tokenColors: [] }), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.nocolors:themes/nocolors.json', mockExtensions);
            // No colors but buildEnsureOverrides generates defaults, so CSS is not empty
            assert.ok(result.cssText.length > 0);
            // Should contain override defaults
            assert.ok(result.cssText.includes('--vscode-tab-activeBackground'));
        });

        test('should handle theme JSON with empty colors object', async () => {
            const mockExtensions = [
                createMockExtension('pub.emptycolors', [
                    { label: 'Empty Colors Light', path: 'themes/empty.json', uiTheme: 'vs' }
                ], '/testempty')
            ] as any;

            mockReadFile(async () => {
                return new Uint8Array(Buffer.from(JSON.stringify({ colors: {} }), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.emptycolors:themes/empty.json', mockExtensions);
            // Empty colors but buildEnsureOverrides generates defaults
            assert.ok(result.cssText.length > 0);
            assert.ok(result.cssText.includes('--vscode-tab-activeBackground'));
        });

        test('should handle theme with include directive', async () => {
            const mockExtensions = [
                createMockExtension('pub.inctheme', [
                    { label: 'Include Theme', path: 'themes/child.json', uiTheme: 'vs-dark' }
                ], '/testinc')
            ] as any;

            const childJson = {
                include: './parent.json',
                colors: {
                    'foreground': '#ffffff'
                }
            };
            const parentJson = {
                colors: {
                    'editor.background': '#000000',
                    'foreground': '#cccccc'
                }
            };

            let readCallCount = 0;
            mockReadFile(async (uri: vscode.Uri) => {
                readCallCount++;
                // First call is the child theme, second is the included parent
                if (readCallCount === 1) {
                    return new Uint8Array(Buffer.from(JSON.stringify(childJson), 'utf8'));
                }
                return new Uint8Array(Buffer.from(JSON.stringify(parentJson), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.inctheme:themes/child.json', mockExtensions);
            assert.ok(result.cssText.includes('--vscode-editor-background'));
            assert.ok(result.cssText.includes('#000000'));
            // Child theme's foreground overrides parent
            assert.ok(result.cssText.includes('#ffffff'));
        });

        test('should handle include directive failure gracefully', async () => {
            const mockExtensions = [
                createMockExtension('pub.incfail', [
                    { label: 'Include Fail Theme', path: 'themes/child2.json', uiTheme: 'vs-dark' }
                ], '/testincfail')
            ] as any;

            const childJson = {
                include: './missing-parent.json',
                colors: {
                    'editor.background': '#222222',
                    'foreground': '#aaaaaa'
                }
            };

            mockReadFile(async (uri: vscode.Uri) => {
                const uriStr = uri.toString();
                if (uriStr.includes('child2.json')) {
                    return new Uint8Array(Buffer.from(JSON.stringify(childJson), 'utf8'));
                }
                throw new Error('Include file not found');
            });

            const result = await buildThemeVariablesCss('pub.incfail:themes/child2.json', mockExtensions);
            assert.ok(result.cssText.includes('#222222'));
        });

        test('should skip non-string color values', async () => {
            const mockExtensions = [
                createMockExtension('pub.mixcolors', [
                    { label: 'Mixed Colors', path: 'themes/mix.json', uiTheme: 'vs-dark' }
                ], '/testmix')
            ] as any;

            mockReadFile(async () => {
                return new Uint8Array(Buffer.from(JSON.stringify({
                    colors: {
                        'editor.background': '#1e1e1e',
                        'bad.color': 123,
                        'another.bad': null,
                        'foreground': '#d4d4d4'
                    }
                }), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.mixcolors:themes/mix.json', mockExtensions);
            assert.ok(result.cssText.includes('--vscode-editor-background'));
            assert.ok(result.cssText.includes('--vscode-foreground'));
            // non-string values should be skipped
            assert.ok(!result.cssText.includes('--vscode-bad-color'));
        });

        test('should build ensure overrides with all tab-related fallbacks', async () => {
            const mockExtensions = [
                createMockExtension('pub.fulltabs', [
                    { label: 'Full Tabs', path: 'themes/full.json', uiTheme: 'vs-dark' }
                ], '/testfull')
            ] as any;

            mockReadFile(async () => {
                return new Uint8Array(Buffer.from(JSON.stringify({
                    colors: {
                        'editor.background': '#1a1a1a',
                        'foreground': '#e0e0e0',
                        'focusBorder': '#0078d4',
                        'list.hoverBackground': '#2d2d2d',
                        'editorGroupHeader.tabsBackground': '#252525',
                        'panelSectionHeader.background': '#333333',
                        'tab.activeBackground': '#1a1a1a',
                        'tab.activeForeground': '#ffffff',
                        'tab.inactiveBackground': '#252525',
                        'tab.inactiveForeground': '#888888',
                        'tab.hoverBackground': '#303030',
                        'tab.activeBorderTop': '#0078d4',
                        'editorWidget.background': '#1a1a1a'
                    }
                }), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.fulltabs:themes/full.json', mockExtensions);
            assert.ok(result.cssText.includes('--vscode-tab-activeBackground'));
            assert.ok(result.cssText.includes('--vscode-editorGroupHeader-tabsBackground'));
            assert.ok(result.cssText.includes('--vscode-panelSectionHeader-background'));
            assert.ok(result.cssText.includes('--vscode-editorWidget-background'));
        });

        test('should handle semanticTokenColors in theme JSON (no colors)', async () => {
            const mockExtensions = [
                createMockExtension('pub.semantic', [
                    { label: 'Semantic Only Dark', path: 'themes/semantic.json', uiTheme: 'vs-dark' }
                ], '/testsem')
            ] as any;

            mockReadFile(async () => {
                return new Uint8Array(Buffer.from(JSON.stringify({
                    semanticTokenColors: { 'variable': '#aabbcc' }
                }), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.semantic:themes/semantic.json', mockExtensions);
            // No colors but overrides are generated with defaults
            assert.ok(result.cssText.length > 0);
            assert.ok(result.cssText.includes('--vscode-tab-activeBackground'));
        });

        test('should apply tab.activeBorder as fallback for tab.activeBorderTop', async () => {
            const mockExtensions = [
                createMockExtension('pub.border', [
                    { label: 'Border Theme', path: 'themes/border.json', uiTheme: 'vs-dark' }
                ], '/testborder')
            ] as any;

            mockReadFile(async () => {
                return new Uint8Array(Buffer.from(JSON.stringify({
                    colors: {
                        'editor.background': '#1e1e1e',
                        'foreground': '#cccccc',
                        'tab.activeBorder': '#ff0000'
                    }
                }), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.border:themes/border.json', mockExtensions);
            // tab.activeBorderTop should fall back to tab.activeBorder
            assert.ok(result.cssText.includes('--vscode-tab-activeBorderTop'));
        });
    });

    suite('createThemeStyleTag', () => {
        test('should return empty string for empty cssText', () => {
            const result = createThemeStyleTag({ cssText: '' });
            assert.strictEqual(result, '');
        });

        test('should generate style tag with CSS content', () => {
            const result = createThemeStyleTag({ cssText: ':root{--vscode-foreground:#333}' });
            assert.ok(result.includes('<style'));
            assert.ok(result.includes('</style>'));
            assert.ok(result.includes(':root{--vscode-foreground:#333}'));
        });

        test('should include mte-theme-override id', () => {
            const result = createThemeStyleTag({ cssText: 'body{color:red}' });
            assert.ok(result.includes('id="mte-theme-override"'));
        });

        test('should include data-scope attribute', () => {
            const result = createThemeStyleTag({ cssText: 'body{color:red}' });
            assert.ok(result.includes('data-scope="#mte-root"'));
        });

        test('should include nonce', () => {
            const result = createThemeStyleTag({ cssText: 'body{color:red}' });
            assert.ok(result.includes('nonce='));
        });
    });

    suite('buildThemeVariablesCss - additional coverage', () => {
        test('should return dark fallback CSS when theme has empty string cssText', async () => {
            // テーマファイルが存在するcolorsがまったく空でCSS生成結果が空の場合のフォールバック
            const mockExtensions = [
                createMockExtension('pub.emptycss', [
                    { label: 'Empty CSS Dark Theme', path: 'themes/empty-css.json', uiTheme: 'vs-dark' }
                ], '/testemptycss')
            ] as any;

            // colors も semanticTokenColors もない → CSS生成が空になる
            // しかし buildEnsureOverrides がデフォルト値を生成するので実際にはCSS空にはならない
            // フォールバックに落とすためには buildCssFromThemeColors自体がエラーを投げる必要がある
            let readCount = 0;
            mockReadFile(async () => {
                readCount++;
                throw new Error('Cannot read theme');
            });

            const result = await buildThemeVariablesCss('pub.emptycss:themes/empty-css.json', mockExtensions);
            // Dark テーマのフォールバック
            assert.ok(result.cssText.includes('--vscode-editor-background:#1e1e1e'));
            assert.ok(result.cssText.includes('#mte-root'));
        });

        test('should return light fallback CSS when light theme CSS generation fails', async () => {
            const mockExtensions = [
                createMockExtension('pub.lightfallback', [
                    { label: 'My Light Fail Theme', path: 'themes/light-fail2.json', uiTheme: 'vs' }
                ], '/testlightfb')
            ] as any;

            mockReadFile(async () => {
                throw new Error('Read error');
            });

            const result = await buildThemeVariablesCss('pub.lightfallback:themes/light-fail2.json', mockExtensions);
            assert.ok(result.cssText.includes('--vscode-editor-background:#ffffff'));
        });

        test('should handle buildEnsureOverrides with all falsy values (continue branch)', async () => {
            // colors に主要キーが一切ない場合、buildEnsureOverrides 内の ensure[k] が空文字になり
            // if (!v) { continue; } が実行されるパスをカバーする
            const mockExtensions = [
                createMockExtension('pub.allfalsy', [
                    { label: 'All Falsy', path: 'themes/falsy.json', uiTheme: 'vs-dark' }
                ], '/testfalsy')
            ] as any;

            // colors を空にしてフォールバック値も空になるようにする
            mockReadFile(async () => {
                return new Uint8Array(Buffer.from(JSON.stringify({
                    colors: {}
                }), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.allfalsy:themes/falsy.json', mockExtensions);
            // CSS は生成される（デフォルト値のフォールバック）が ensure の中に空文字キーは含まれない
            assert.ok(result.cssText.length > 0);
        });

        test('should handle theme include read failure (catch branch in loadThemeJson)', async () => {
            // include ファイル読み込み失敗時の catch ブロック (L89 JS) をカバー
            const mockExtensions = [
                createMockExtension('pub.incatchtest', [
                    { label: 'Inc Catch Test', path: 'themes/inc-catch.json', uiTheme: 'vs-dark' }
                ], '/testinccatch')
            ] as any;

            const childJson = {
                include: './nonexistent-include.json',
                colors: {
                    'editor.background': '#333333'
                }
            };

            let readCount = 0;
            mockReadFile(async (uri: vscode.Uri) => {
                readCount++;
                if (readCount === 1) {
                    return new Uint8Array(Buffer.from(JSON.stringify(childJson), 'utf8'));
                }
                // include ファイルの読み込みでエラーを投げる
                throw new Error('Include file not found');
            });

            const result = await buildThemeVariablesCss('pub.incatchtest:themes/inc-catch.json', mockExtensions);
            // include が失敗しても子テーマの colors は使われる
            assert.ok(result.cssText.includes('#333333'));
        });

        test('should handle theme include with successful merge', async () => {
            const mockExtensions = [
                createMockExtension('pub.mergetest', [
                    { label: 'Merge Test', path: 'themes/merge.json', uiTheme: 'vs-dark' }
                ], '/testmerge')
            ] as any;

            const childJson = {
                include: './base.json',
                colors: {
                    'foreground': '#eeeeee'
                }
            };
            const baseJson = {
                colors: {
                    'editor.background': '#111111',
                    'foreground': '#aaaaaa'
                }
            };

            let callCount = 0;
            mockReadFile(async () => {
                callCount++;
                if (callCount === 1) {
                    return new Uint8Array(Buffer.from(JSON.stringify(childJson), 'utf8'));
                }
                return new Uint8Array(Buffer.from(JSON.stringify(baseJson), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.mergetest:themes/merge.json', mockExtensions);
            assert.ok(result.cssText.includes('#111111')); // base の editor.background
            assert.ok(result.cssText.includes('#eeeeee')); // child の foreground が優先
        });

        test('should handle loadThemeJson include read failure - catch branch (L89)', async () => {
            // include ディレクティブのファイルが存在しない場合、catch ブロックに入り
            // include なしの状態で正常にテーマが返ること
            const mockExtensions = [
                createMockExtension('pub.incfailcatch', [
                    { label: 'Include Fail Catch', path: 'themes/inc-fail-catch.json', uiTheme: 'vs-dark' }
                ], '/testincfailcatch')
            ] as any;

            const childJson = {
                include: './nonexistent-base.json',
                colors: {
                    'editor.background': '#abcdef',
                    'foreground': '#fedcba'
                }
            };

            mockReadFile(async (uri: vscode.Uri) => {
                const uriStr = uri.toString();
                if (uriStr.includes('inc-fail-catch.json')) {
                    return new Uint8Array(Buffer.from(JSON.stringify(childJson), 'utf8'));
                }
                // include ファイルの読み込みで例外を投げる → catch ブロック (L89)
                throw new Error('Include file does not exist');
            });

            const result = await buildThemeVariablesCss('pub.incfailcatch:themes/inc-fail-catch.json', mockExtensions);
            // include が失敗しても子テーマの colors は使われる
            assert.ok(result.cssText.includes('#abcdef'));
            assert.ok(result.cssText.includes('#fedcba'));
        });

        test('should skip falsy values in buildEnsureOverrides - continue branch (L221)', async () => {
            // colors が完全に空の場合、buildEnsureOverrides 内の val() が全て空文字を返し、
            // ensure[k] が falsy（空文字）になって if (!v) { continue; } が実行される
            const mockExtensions = [
                createMockExtension('pub.ensurefalsy', [
                    { label: 'Ensure Falsy', path: 'themes/ensure-falsy.json', uiTheme: 'vs-dark' }
                ], '/testensurefalsy')
            ] as any;

            // colors を完全に空にすると、editor.background/foreground/focusBorder 等の
            // デフォルト値が使われるため、本当に falsy になるキーは限定的。
            // ただし ensure オブジェクトの各値のフォールバックチェーンが全て空になれば continue に入る
            mockReadFile(async () => {
                return new Uint8Array(Buffer.from(JSON.stringify({
                    colors: {}
                }), 'utf8'));
            });

            const result = await buildThemeVariablesCss('pub.ensurefalsy:themes/ensure-falsy.json', mockExtensions);
            // CSS が生成されること（デフォルトフォールバック値による）
            assert.ok(result.cssText.length > 0);
            // 空文字キーは出力されないこと（:; のような不正なエントリがないこと）
            assert.ok(!result.cssText.includes(':;'));
        });
    });
});
