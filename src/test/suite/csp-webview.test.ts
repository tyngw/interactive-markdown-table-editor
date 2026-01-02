import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WebviewManager } from '../../webviewManager';

suite('CSP and Webview HTML Tests', () => {
    let webviewManager: WebviewManager;
    let context: vscode.ExtensionContext;

    setup(() => {
        // Mock extension context
        context = {
            extensionPath: path.join(__dirname, '../../../'),
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve()
            } as any,
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve()
            } as any,
            extensionUri: vscode.Uri.file(path.join(__dirname, '../../../'))
        } as unknown as vscode.ExtensionContext;

        webviewManager = WebviewManager.getInstance(context);
    });

    test('CSP meta tag should be inside head element', async () => {
        // React版のHTMLファイルを読み込み
        const reactBuildPath = path.join(__dirname, '../../../../out/webview');
        const htmlPath = path.join(reactBuildPath, 'index.html');
        
        assert.ok(fs.existsSync(htmlPath), 'React build HTML should exist at ' + htmlPath);
        
        const originalHtml = fs.readFileSync(htmlPath, 'utf8');
        
        // WebviewManagerのHTML処理をシミュレート
        const mockPanel = {
            webview: {
                cspSource: 'vscode-webview://123',
                asWebviewUri: (uri: vscode.Uri) => vscode.Uri.parse(`https://file+.vscode-resource.vscode-cdn.net${uri.path}`)
            }
        } as any;

        // CSP content generation
    const cspContent = `default-src 'none'; style-src 'unsafe-inline' ${mockPanel.webview.cspSource}; script-src 'unsafe-inline' 'unsafe-eval' ${mockPanel.webview.cspSource}; img-src ${mockPanel.webview.cspSource} https: data:; font-src ${mockPanel.webview.cspSource} https:`;
        
        let processedHtml = originalHtml;
        
        // Asset path replacement (simulate webviewManager logic)
        const assetsUri = mockPanel.webview.asWebviewUri(vscode.Uri.file(path.join(reactBuildPath, 'assets')));
        processedHtml = processedHtml.replace(/src="\.\/assets\//g, `src="${assetsUri.toString()}/`);
        processedHtml = processedHtml.replace(/href="\.\/assets\//g, `href="${assetsUri.toString()}/`);
        
        // CSP replacement (修正前のバグのある実装をテスト)
        if (processedHtml.includes('Content-Security-Policy')) {
            processedHtml = processedHtml.replace(
                /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/i,
                `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`
            );
        }

        // Parse HTML to validate structure
        const headStartIndex = processedHtml.indexOf('<head>');
        const headEndIndex = processedHtml.indexOf('</head>');
        const cspMetaIndex = processedHtml.indexOf('Content-Security-Policy');
        
        // 修正前は失敗、修正後は成功するべきテスト
        assert.ok(cspMetaIndex >= 0, 'CSP meta tag should exist');
        assert.ok(cspMetaIndex > headStartIndex, 'CSP meta tag should be after head start');
        assert.ok(cspMetaIndex < headEndIndex, 'CSP meta tag should be inside head element');
    });

    test('Asset URLs should be properly resolved', async () => {
        const reactBuildPath = path.join(__dirname, '../../../../out/webview');
        const htmlPath = path.join(reactBuildPath, 'index.html');
        
        assert.ok(fs.existsSync(htmlPath), 'React build HTML should exist at ' + htmlPath);
        
        const originalHtml = fs.readFileSync(htmlPath, 'utf8');
        
        const mockPanel = {
            webview: {
                cspSource: 'vscode-webview://123',
                asWebviewUri: (uri: vscode.Uri) => vscode.Uri.parse(`https://file+.vscode-resource.vscode-cdn.net${uri.path}`)
            }
        } as any;

        let processedHtml = originalHtml;
        
        // Asset path replacement
        const assetsUri = mockPanel.webview.asWebviewUri(vscode.Uri.file(path.join(reactBuildPath, 'assets')));
        processedHtml = processedHtml.replace(/src="\.\/assets\//g, `src="${assetsUri.toString()}/`);
        processedHtml = processedHtml.replace(/href="\.\/assets\//g, `href="${assetsUri.toString()}/`);
        
        // Verify that asset URLs are properly resolved
    assert.ok(/https?:\/\/.*vscode-resource\.vscode-cdn\.net\//.test(processedHtml), 'Asset URLs should be resolved to vscode-resource CDN scheme');
        assert.ok(!processedHtml.includes('./assets/'), 'Relative asset paths should be replaced');
    });

    test('HTML structure should be valid after processing', async () => {
        const reactBuildPath = path.join(__dirname, '../../../../out/webview');
        const htmlPath = path.join(reactBuildPath, 'index.html');
        
        assert.ok(fs.existsSync(htmlPath), 'React build HTML should exist at ' + htmlPath);
        
        const originalHtml = fs.readFileSync(htmlPath, 'utf8');
        
        // Basic HTML structure validation
        assert.ok(originalHtml.includes('<head>'), 'HTML should have head element');
        assert.ok(originalHtml.includes('</head>'), 'HTML should have closing head tag');
        assert.ok(originalHtml.includes('<body>'), 'HTML should have body element');
        assert.ok(originalHtml.includes('</body>'), 'HTML should have closing body tag');
        
        // Check that Vite-inserted tags are properly placed
        const headStartIndex = originalHtml.indexOf('<head>');
        const headEndIndex = originalHtml.indexOf('</head>');
        const headContent = originalHtml.substring(headStartIndex, headEndIndex);
        
        // Vite should insert script tags inside head
        assert.ok(headContent.includes('<script type="module"'), 'Script tag should be inside head');
        
        // CSS can be loaded either via link tag or dynamically via script
        // Check for either static link or dynamic CSS loading in script
        const hasCssLink = headContent.includes('<link rel="stylesheet"');
        const hasCssDynamic = originalHtml.includes('link.rel = \'stylesheet\'');
        assert.ok(hasCssLink || hasCssDynamic, 'CSS should be loaded either via link tag or dynamically');
    });
});