import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../webview-dist',
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
    sourcemap: false
  },
  base: './',
  // VSCode webview環境用の設定
  define: {
    global: 'globalThis',
  }
})