import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@emotion/react'
import App from './App'
import { GlobalStyles } from './GlobalStyles'
import { DynamicThemeProvider, useDynamicTheme } from './contexts/DynamicThemeContext'
import { getVSCodeTheme } from './styles/theme'
import { ensureVsCodeApi } from './vscodeApi'

console.log('[MTE][React] bootstrap start');

// VSCode API の型定義
declare global {
  interface Window {
    acquireVsCodeApi?: () => any;
    vscode?: any;
    __mteVscodeApi?: any;
  }
}

// VSCode webview環境の初期化
function initializeVSCodeEnvironment() {
  try {
    console.log('[MTE][React] initializeVSCodeEnvironment', {
      hasAcquire: typeof window.acquireVsCodeApi === 'function',
      hasCached: Boolean(window.vscode),
      hasCachedGlobal: Boolean(window.__mteVscodeApi)
    });
    const api = ensureVsCodeApi();
    if (api) {
      console.log('VSCode API initialized successfully');
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('VSCode API not yet available during initialization');
    }
  } catch (error) {
    console.warn('Failed to initialize VSCode API:', error);
  }
}

// RootApp コンポーネント: DynamicThemeContext から取得したテーマを ThemeProvider に渡す
function RootApp() {
  const { theme } = useDynamicTheme(); // DynamicThemeContextから現在のテーマを取得
  return (
    <React.StrictMode>
      <ThemeProvider theme={theme}> {/* DynamicThemeContextから取得したテーマを渡す */}
        <GlobalStyles theme={theme} />
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
}

// DOM読み込み完了後にアプリを初期化
function initializeApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  initializeVSCodeEnvironment();

  const theme = getVSCodeTheme()
  console.log('[MTE] Theme acquired:', {
    editorBackground: theme.editorBackground,
    editorForeground: theme.editorForeground,
    statusBarBackground: theme.statusBarBackground,
  })

  console.log('[MTE][React] rendering App');
  ReactDOM.createRoot(rootElement).render(
    <DynamicThemeProvider> {/* DynamicThemeContextを一番外側に配置 */}
      <RootApp />
    </DynamicThemeProvider>
  );
}

// DOM読み込み状態をチェック
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
