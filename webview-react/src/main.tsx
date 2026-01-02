import React, { useEffect } from 'react'
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
  const { theme, setTheme } = useDynamicTheme(); // setTheme も取得
  
  console.log('[RootApp] Rendering with theme from DynamicThemeContext:', {
    statusBarBackground: theme.statusBarBackground,
    statusBarForeground: theme.statusBarForeground,
    statusBarBorder: theme.statusBarBorder,
    chartsGreen: theme.chartsGreen,
    theme: theme
  });

  // theme が変更されるたびに root 要素の CSS 変数を更新
  useEffect(() => {
    const documentRoot = document.documentElement
    const mteRoot = document.getElementById('mte-root')
    const appRoot = document.getElementById('root')
    
    if (!documentRoot) return

    // theme オブジェクトから CSS 変数を生成して root に設定
    const cssVars: Record<string, string> = {
      '--vscode-menu-background': theme.menuBackground,
      '--vscode-menu-foreground': theme.menuForeground,
      '--vscode-menu-border': theme.menuBorder,
      '--vscode-menu-selectionBackground': theme.menuSelectionBackground,
      '--vscode-menu-selectionForeground': theme.menuSelectionForeground,
      '--vscode-menu-separatorBackground': theme.menuSeparatorBackground,
      '--vscode-disabledForeground': theme.disabledForeground,
    }

    // すべての要素にCSS変数を設定（#mte-root, #root, documentElementの全て）
    const elements = [mteRoot, appRoot, documentRoot].filter(Boolean) as HTMLElement[]
    elements.forEach(el => {
      Object.entries(cssVars).forEach(([name, value]) => {
        if (value) {
          el.style.setProperty(name, value)
          console.log(`[RootApp] Set CSS variable on ${el.id || 'documentElement'}: ${name}=${value}`)
        }
      })
    })

    console.log('[RootApp] Updated CSS variables for ContextMenu:', cssVars)
  }, [theme])
  
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
