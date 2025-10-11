// どこで: vscode の拡張サイドで webview を初期化する際に利用されるユーティリティ。
// 何を: React ビルド成果物へのパスを解決し、VS Code が要求する CSP を適用した HTML を生成する。
// なぜ: 既存実装は複雑化しており CSP や再読み込み時の不整合を招いていたため、単純で追跡しやすい生成処理に刷新する。

import * as vscode from 'vscode';

interface ResolvedAssetUris {
    readonly script: vscode.Uri;
    readonly style: vscode.Uri;
}

function buildCsp(panel: vscode.WebviewPanel): string {
    const cspSource = panel.webview.cspSource;
    const directives: string[] = [
        "default-src 'none'",
        `style-src 'unsafe-inline' ${cspSource}`,
        `script-src 'unsafe-inline' 'unsafe-eval' ${cspSource}`,
        `img-src ${cspSource} https: data:`,
        `font-src ${cspSource} https:`
    ];
    return directives.join('; ');
}

function buildBootstrapScript(): string {
    return `
    <script>
        (function(){
            const tag = '[MTE][WV bootstrap]';
            try {
                const acquire = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi : null;
                const existing = (typeof window !== 'undefined' && window.vscode) ? window.vscode : null;
                const api = existing || (acquire ? acquire() : null);
                if (api) {
                    window.vscode = api;
                    try { window.__mteVscodeApi = api; } catch (_) {}
                } else {
                    console.warn(tag, 'VS Code API unavailable at bootstrap');
                }
                const safePost = (payload) => {
                    try { api && api.postMessage(payload); } catch (_) {}
                };
                window.addEventListener('DOMContentLoaded', () => {
                    safePost({ command: 'diag', data: { event: 'DOMContentLoaded' } });
                });
                window.addEventListener('load', () => {
                    safePost({ command: 'diag', data: { event: 'load' } });
                });
                window.addEventListener('error', (event) => {
                    safePost({
                        command: 'webviewError',
                        data: {
                            message: event.message,
                            filename: event.filename,
                            lineno: event.lineno,
                            colno: event.colno,
                            stack: event.error && event.error.stack
                        }
                    });
                });
                window.addEventListener('unhandledrejection', (event) => {
                    const reason = event && event.reason ? event.reason : null;
                    safePost({
                        command: 'webviewUnhandledRejection',
                        data: {
                            message: reason && (reason.message || (reason.toString && reason.toString())),
                            stack: reason && reason.stack
                        }
                    });
                });
                safePost({ command: 'diag', data: { event: 'diag-installed' } });
            } catch (error) {
                console.warn(tag, 'Bootstrap failed', error);
            }
        })();
    </script>
    `;
}

function resolveAssetUris(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): ResolvedAssetUris {
    const base = vscode.Uri.joinPath(context.extensionUri, 'webview-dist', 'assets');
    const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(base, 'index.js'));
    const style = panel.webview.asWebviewUri(vscode.Uri.joinPath(base, 'index.css'));
    return { script, style };
}

export async function buildWebviewHtml(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): Promise<string> {
    const assets = resolveAssetUris(context, panel);

    const csp = buildCsp(panel);
    const bootstrapScript = buildBootstrapScript();

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>Markdown Table Editor</title>
    ${bootstrapScript}
    <link rel="stylesheet" href="${assets.style.toString()}">
</head>
<body>
    <div id="root">
        <noscript>テーブルエディタを利用するには JavaScript を有効にしてください。</noscript>
    </div>
    <script type="module" src="${assets.script.toString()}"></script>
</body>
</html>`;
}
