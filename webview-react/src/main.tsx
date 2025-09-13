import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// VSCode API の型定義
declare global {
  interface Window {
    acquireVsCodeApi?: () => any;
    vscode?: any;
  }
}

// VSCode webview環境の初期化
function initializeVSCodeEnvironment() {
  try {
    if (window.acquireVsCodeApi && !window.vscode) {
      window.vscode = window.acquireVsCodeApi();
      console.log('VSCode API initialized successfully');
    }
  } catch (error) {
    console.warn('Failed to initialize VSCode API:', error);
  }
}

// DOM読み込み完了後にアプリを初期化
function initializeApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  initializeVSCodeEnvironment();

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// DOM読み込み状態をチェック
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}