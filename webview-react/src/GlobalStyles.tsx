/**
 * GlobalStyles.tsx
 * Emotion を使用したグローバルスタイル定義
 * 
 * 責務：
 * - CSS リセット
 * - HTML/BODY の基本設定
 * - ルート要素のレイアウト
 * 
 * コンポーネント固有のスタイルは各コンポーネントの .styles.ts ファイルで管理
 * 従来の CSS スタイル（index.css）は別途インポート
 */

import { Global, css } from '@emotion/react'
import { VSCodeTheme } from './styles/theme'

interface GlobalStylesProps {
  theme: VSCodeTheme
}

export const GlobalStyles: React.FC<GlobalStylesProps> = ({ theme }) => {
  // デバッグ用ログ
  if (typeof window !== 'undefined') {
    console.log('[MTE] GlobalStyles mounted');
  }

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

        /* ====== ローディングスピナー ====== */
        @keyframes mte-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .mte-loading-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid currentColor;
          border-radius: 50%;
          border-top-color: transparent;
          animation: mte-spin 0.6s linear infinite;
        }
      `}
    />
  )
}
