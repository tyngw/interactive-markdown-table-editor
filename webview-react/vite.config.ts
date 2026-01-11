import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CSP meta tagをhead内の適切な位置に修正するプラグイン
function cspFixPlugin() {
  return {
    name: 'csp-fix',
    generateBundle(options, bundle) {
      const indexHtml = bundle['index.html'];
      if (indexHtml && indexHtml.type === 'asset' && typeof indexHtml.source === 'string') {
        let html = indexHtml.source;
        
        // 全てのCSPメタタグを一旦削除
        html = html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/gi, '');
        
        // <head>の直後（charsetの後、viewportの前）に配置
        html = html.replace(
          /(<head[^>]*>\s*<meta\s+charset[^>]*>)/i,
          '$1\n    <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\' vscode-resource: https:; script-src \'unsafe-inline\' vscode-resource:;">'
        );
        
        console.log('CSP fix plugin: Fixed CSP meta tag placement in head');
        indexHtml.source = html;
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  // 環境変数でconsole出力の削除を切り替え（デフォルトは削除）
  const keepConsole = process.env.MTE_KEEP_CONSOLE === '1' || process.env.MTE_KEEP_CONSOLE === 'true'

  return {
    plugins: [react(), cspFixPlugin()],
    server: {
      // 開発サーバーの設定
      host: 'localhost',
      port: 5173,
      // HMR（Hot Module Replacement）設定
      hmr: {
        host: 'localhost',
        port: 5173,
        protocol: 'http'
      }
    },
    build: {
      outDir: '../out/webview',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      },
      // VSCode webview用の最適化
      target: 'es2020',
      minify: 'terser',
      sourcemap: false,
      terserOptions: {
        compress: {
          drop_console: !keepConsole,
        },
      },
    },
    base: './',
    // VSCode webview環境用の設定
    define: {
      global: 'globalThis',
    }
  }
})