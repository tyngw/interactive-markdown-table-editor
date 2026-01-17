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
    // 列ヘッダ・行番号に使われる変数を含め、必要なテーマ変数を明示的に注入する
    const cssVars: Record<string, string> = {
      '--vscode-editor-background': theme.editorBackground || '#1e1e1e',
      '--vscode-editor-foreground': theme.editorForeground || '#d4d4d4',
      '--vscode-sideBar-background': theme.sideBarBackground || '#252526',
      '--vscode-sideBar-foreground': theme.sideBarForeground || '#cccccc',
      '--vscode-descriptionForeground': theme.descriptionForeground || '#a6a6a6',
      '--vscode-panel-border': theme.panelBorder || '#3e3e42',
      '--vscode-editorGroupHeader-tabsBackground': theme.editorGroupHeaderTabsBackground || theme.panelBackground || '#252526',
      '--vscode-focusBorder': theme.focusBorder || '#007acc',
      '--vscode-tab-activeForeground': (theme as any).tabActiveForeground || '#ffffff',
      '--vscode-tab-inactiveForeground': (theme as any).tabInactiveForeground || '#a6a6a6',
      '--vscode-button-background': theme.buttonBackground || '#0e639c',
      '--vscode-button-foreground': theme.buttonForeground || '#ffffff',
      '--vscode-input-background': theme.inputBackground || '#3c3c3c',
      '--vscode-input-foreground': theme.inputForeground || '#cccccc',
      '--vscode-list-hoverBackground': theme.listHoverBackground || '#2a2d2e',
      '--vscode-list-activeSelectionBackground': theme.listActiveSelectionBackground || '#094771',
      '--vscode-list-inactiveSelectionBackground': theme.listInactiveSelectionBackground || '#37373d',
      '--vscode-scrollbarSlider-background': theme.scrollbarSliderBackground || 'rgba(90, 93, 94, 0.31)',
      '--vscode-disabledForeground': theme.disabledForeground || '#656565',
      // Menu-related fallbacks retained
      '--vscode-menu-background': theme.menuBackground || '#252526',
      '--vscode-menu-foreground': theme.menuForeground || '#cccccc',
      '--vscode-menu-border': theme.menuBorder || '#454545',
      '--vscode-menu-selectionBackground': theme.menuSelectionBackground || '#094771',
      '--vscode-menu-selectionForeground': theme.menuSelectionForeground || '#ffffff',
      '--vscode-menu-separatorBackground': theme.menuSeparatorBackground || '#454545',
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
