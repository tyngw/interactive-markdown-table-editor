/**
 * GlobalStyles.tsx
 * Emotion を使用したグローバルスタイル定義
 * VSCode CSS変数を使用しつつ、Emotionのthemeも統合
 */

import { Global, css } from '@emotion/react'
import { VSCodeTheme } from './styles/theme'

interface GlobalStylesProps {
  theme: VSCodeTheme
}

export const GlobalStyles: React.FC<GlobalStylesProps> = ({ theme }) => {
  // デバッグ用ログ
  if (typeof window !== 'undefined') {
    console.log('[MTE] GlobalStyles mounted with theme:', {
      editorBackground: theme.editorBackground,
      editorForeground: theme.editorForeground,
      focusBorder: theme.focusBorder,
    })
  }

  // styles/globalStyles.css の内容をそのままインライン化
  // CSS変数（--vscode-*）は VSCode が自動的に提供するため、そのまま使用可能
  return (
    <Global
      styles={css`
        /* ====== リセット CSS ====== */
        *,
        *::before,
        *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* ====== 基本設定 ====== */
        html,
        body {
          height: 100vh;
          overflow: hidden;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: var(--mte-font-family, var(--vscode-editor-font-family, var(--vscode-font-family, 'Consolas', 'Monaco', 'Courier New', monospace)));
          font-size: var(--mte-font-size, var(--vscode-editor-font-size, var(--vscode-font-size, 14px)));
          color: var(--vscode-editor-foreground, var(--vscode-foreground, #333333));
          background-color: var(--vscode-editor-background);
          padding: 0;
          display: flex;
          flex-direction: column;
        }

        /* ====== スクロールバー ====== */
        * {
          scrollbar-width: thin;
          scrollbar-color: var(--vscode-scrollbarSlider-background, 
                                var(--vscode-button-secondaryBackground, 
                                    rgba(90, 93, 94, 0.31))) 
                           var(--vscode-editor-background, transparent);
        }

        *::-webkit-scrollbar {
          width: 16px;
          height: 16px;
        }

        *::-webkit-scrollbar-track {
          background: var(--vscode-editor-background, transparent);
          border-radius: 4px;
        }

        *::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-background, 
                      var(--vscode-button-secondaryBackground, 
                          rgba(90, 93, 94, 0.31)));
          border-radius: 4px;
          border: 2px solid var(--vscode-editor-background, transparent);
        }

        *::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-hoverBackground, 
                      var(--vscode-button-secondaryHoverBackground, 
                          rgba(90, 93, 94, 0.50)));
        }

        *::-webkit-scrollbar-thumb:active {
          background: var(--vscode-scrollbarSlider-activeBackground, 
                      var(--vscode-button-background, 
                          rgba(90, 93, 94, 0.80)));
        }

        *::-webkit-scrollbar-corner {
          background: var(--vscode-editor-background, transparent);
        }

        /* ====== ルート要素 ====== */
        #root {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 40px);
        }

        #app {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          height: 100vh;
        }

        #table-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: var(--vscode-editor-background);
          min-height: 0;
        }

        .table-editor-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
          margin-bottom: 0;
        }

        /* ====== テーブルコンテナ ====== */
        .table-container {
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          background-color: var(--vscode-editor-background);
          box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.1));
          flex: 1;
          position: relative;
          overflow: auto;
          min-height: 300px;
          max-height: none;
          padding-bottom: 0;
          scroll-behavior: auto;
          isolation: isolate;
        }

        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          font-size: 16px;
          text-align: center;
          padding: 20px;
          color: var(--vscode-descriptionForeground);
          font-style: italic;
        }

        .no-data {
          text-align: center;
          padding: 40px;
          color: var(--vscode-descriptionForeground);
          font-style: italic;
        }

        .error {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          font-size: 16px;
          color: var(--vscode-errorForeground);
          padding: 20px;
          text-align: center;
        }

        /* ====== 2. テーブルタブ ====== */
        .bottom-chrome {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          background-color: var(--vscode-editor-background);
          border-top: 1px solid var(--vscode-panel-border);
        }

        .table-tabs {
          display: flex;
          border-top: 1px solid var(--vscode-panel-border);
          border-bottom: 1px solid var(--vscode-panel-border);
          background-color: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-panelSectionHeader-background, var(--vscode-editor-background)));
          margin: 0;
          padding: 4px 0;
          overflow-x: auto;
          background-clip: padding-box;
        }

        .tab-button {
          background: var(--vscode-tab-inactiveBackground, transparent);
          border: none;
          padding: 8px 16px;
          cursor: pointer;
          color: var(--vscode-tab-inactiveForeground, var(--vscode-foreground));
          border-bottom: 2px solid transparent;
          font-size: var(--vscode-font-size);
          font-family: var(--vscode-font-family);
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .tab-button:hover {
          background-color: var(--vscode-tab-hoverBackground, var(--vscode-list-hoverBackground));
        }

        .tab-button.active {
          color: var(--vscode-tab-activeForeground, var(--vscode-foreground));
          border-bottom-color: var(--vscode-tab-activeBorderTop, var(--vscode-focusBorder));
          background-color: var(--vscode-tab-activeBackground, var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-editor-background)));
        }

        /* ====== 3. テーブル基本構造（必要最小限） ====== */
        .table-editor {
          border-collapse: separate;
          border-spacing: 0;
          width: auto;
          font-family: var(--mte-font-family, var(--vscode-editor-font-family, var(--vscode-font-family, 'Consolas', 'Monaco', 'Courier New', monospace)));
          font-size: var(--mte-font-size, var(--vscode-editor-font-size, var(--vscode-font-size, 14px)));
          color: var(--vscode-editor-foreground, var(--vscode-foreground, #333333));
          table-layout: auto;
          display: table;
          position: relative;
          z-index: 1;
        }

        table.table-editor thead {
          background-color: var(--vscode-sideBar-background, var(--vscode-activityBar-background));
          position: relative;
          z-index: 150;
        }

        /* その他のテーブル関連スタイルは、コンポーネント側で定義するか、
           必要に応じてこの後に追加 */
      `}
    />
  )
}
