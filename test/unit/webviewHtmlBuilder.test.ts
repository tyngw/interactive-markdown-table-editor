/**
 * webviewHtmlBuilder のユニットテスト
 * WebView HTML の生成と CSP、ブートストラップスクリプトをテスト
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildWebviewHtml } from '../../src/webviewHtmlBuilder';

suite('webviewHtmlBuilder Test Suite', () => {
    let mockContext: any;
    let mockPanel: any;

    setup(() => {
        mockContext = {
            extensionUri: vscode.Uri.file('/mock/extension'),
            extensionPath: '/mock/extension'
        };

        mockPanel = {
            webview: {
                cspSource: 'https://mock.csp.source',
                asWebviewUri: (uri: vscode.Uri) => {
                    // asWebviewUri のモック: scheme を vscode-webview に変換
                    return uri.with({ scheme: 'vscode-webview' });
                }
            }
        };
    });

    test('should generate valid HTML with DOCTYPE', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.startsWith('<!DOCTYPE html>'));
    });

    test('should include Content-Security-Policy meta tag', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('Content-Security-Policy'));
        assert.ok(html.includes('https://mock.csp.source'));
    });

    test('should include bootstrap script', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('<script>'));
        assert.ok(html.includes('acquireVsCodeApi'));
        assert.ok(html.includes('DOMContentLoaded'));
    });

    test('should include root div for React app', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('<div id="root">'));
    });

    test('should include noscript fallback', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('<noscript>'));
    });

    test('should include script module reference', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('type="module"'));
        assert.ok(html.includes('index.js'));
    });

    test('should include CSS stylesheet link', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('index.css'));
        assert.ok(html.includes('rel="stylesheet"'));
    });

    test('should include CSP directives for style, script, img, font', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes("style-src"));
        assert.ok(html.includes("script-src"));
        assert.ok(html.includes("img-src"));
        assert.ok(html.includes("font-src"));
        assert.ok(html.includes("default-src 'none'"));
    });

    test('should include language attribute from vscode.env.language', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        // vscode.env.language のモック値に依存
        assert.ok(html.includes('lang='));
        assert.ok(html.includes('data-vscode-language='));
    });

    test('should include error and unhandledrejection handlers in bootstrap', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('webviewError'));
        assert.ok(html.includes('unhandledrejection'));
        assert.ok(html.includes('webviewUnhandledRejection'));
    });

    test('should include viewport meta tag', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('viewport'));
        assert.ok(html.includes('width=device-width'));
    });

    test('should include charset meta tag', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('charset="UTF-8"'));
    });

    test('should include diag-installed event in bootstrap', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('diag-installed'));
    });

    test('should include title tag', async () => {
        const html = await buildWebviewHtml(mockContext, mockPanel);
        assert.ok(html.includes('<title>Markdown Table Editor</title>'));
    });
});
