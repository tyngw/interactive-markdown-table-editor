/**
 * GlobalStyles.tsx
 * Emotion を使用したグローバルスタイル定義
 * 
 * 責務：
 * - CSS リセット
 * - HTML/BODY の基本設定
 * - ルート要素のレイアウト
 * - テーブルエディター全体のスタイル（旧 index.css から移行）
 * 
 * コンポーネント固有のスタイルは各コンポーネントの .styles.ts ファイルで管理
 */

import { Global, css } from '@emotion/react'
import { VSCodeTheme } from './styles/theme'
import { selectedHeaderRowStyles, baseHeaderRowStyles } from './styles/mixins'

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

        /* ====== テーブルタブ ====== */
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

        /* ====== テーブルコンテナ ====== */
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
          scrollbar-width: thin;
          scrollbar-color: var(--vscode-scrollbarSlider-background, var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31))) var(--vscode-editor-background, transparent);
        }

        .table-container::-webkit-scrollbar {
          width: 16px;
          height: 16px;
        }

        .table-container::-webkit-scrollbar-track {
          background: var(--vscode-editor-background, transparent);
          border-radius: 4px;
        }

        .table-container::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-background, var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31)));
          border-radius: 4px;
          border: 2px solid var(--vscode-editor-background, transparent);
        }

        .table-container::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-hoverBackground, var(--vscode-button-secondaryHoverBackground, rgba(90, 93, 94, 0.50)));
        }

        .table-container::-webkit-scrollbar-thumb:active {
          background: var(--vscode-scrollbarSlider-activeBackground, var(--vscode-button-background, rgba(90, 93, 94, 0.80)));
        }

        .loading {
          text-align: center;
          padding: 20px;
          color: var(--vscode-descriptionForeground);
          font-style: italic;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          font-size: 16px;
        }

        .no-data {
          text-align: center;
          padding: 40px;
          color: var(--vscode-descriptionForeground);
          font-style: italic;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
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

        /* ====== テーブル基本構造 ====== */
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
          background-color: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-sideBar-background, var(--vscode-activityBar-background)));
          position: relative;
          z-index: 150;
        }

        .table-editor tr.striped-row td.data-cell,
        .table-editor tr.striped-row td.editable-cell {
          background-color: var(--vscode-editor-hoverHighlightBackground, var(--vscode-editor-selectionHighlightBackground, var(--vscode-editor-lineHighlightBackground)));
        }

        .table-editor th.column-header.highlighted,
        .table-editor td.row-number.highlighted {
          background-color: var(--vscode-list-hoverBackground);
          transition: background-color 0.15s ease;
        }

        /* ====== テーブルヘッダー ====== */
        table.table-editor thead th {
          ${baseHeaderRowStyles(theme)}
          
          padding: 10px 12px;
          text-align: left;
          position: sticky;
          top: 0;
          font-weight: 600;
          z-index: 50;
          opacity: 1;
          background-clip: padding-box;
          overflow: hidden;
        }

        table.table-editor thead th.column-header {
          width: 150px;
          min-width: 150px;
        }

        table.table-editor thead th.header-corner {
          z-index: 1000;
          transform: translateZ(0);
          will-change: transform;
          width: 60px;
          min-width: 60px;
          max-width: 60px;
          position: sticky;
          left: 0;
          top: 0;
          cursor: pointer;
          text-align: center;
          vertical-align: top;
          font-size: 16px;
          padding: 4px;
          opacity: 1;
        }

        .header-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          position: relative;
          width: 100%;
          height: 100%;
        }

        .column-letter {
          font-size: 10px;
          color: var(--vscode-descriptionForeground);
          font-weight: 400;
          line-height: 1;
          margin-bottom: 2px;
        }

        table.table-editor thead th.user-resized {
          min-width: 10px;
        }

        table.table-editor thead th:first-child {
          border-left: 1px solid var(--vscode-panel-border);
        }

        table.table-editor thead th:last-child {
          border-right: 1px solid var(--vscode-panel-border);
        }

        table.table-editor thead th.editing {
          background-color: var(--vscode-input-background);
          outline: 2px solid var(--vscode-inputOption-activeBorder);
          outline-offset: -1px;
        }

        table.table-editor thead th input.header-input {
          border: none;
          background: transparent;
          color: inherit;
          font-family: inherit;
          font-size: inherit;
          font-weight: inherit;
          padding: 0;
          margin: 0;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          text-align: left;
        }

        table.table-editor thead th input.header-input:focus {
          background: transparent;
          box-shadow: none;
        }

        .column-title {
          cursor: text;
          flex: 1;
          min-width: 0;
          word-wrap: break-word;
          font-size: 13px;
          font-weight: 600;
          color: var(--vscode-editor-foreground, var(--vscode-foreground, #333333));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          display: block;
          line-height: 1.2;
        }

        .header-rename-old {
          margin-left: 6px;
          color: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39);
          text-decoration: line-through;
          opacity: 0.9;
        }

        .header-rename-new {
          color: var(--vscode-editor-foreground, var(--vscode-foreground, #333333));
          font-weight: 700;
        }

        .header-text {
          font-size: 13px;
          font-weight: 600;
          color: var(--vscode-editor-foreground, var(--vscode-foreground, #333333));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        /* ====== 行番号セル ====== */
        table.table-editor tbody tr td.row-number {
          ${baseHeaderRowStyles(theme)}
          
          font-weight: 700;
          text-align: left;
          vertical-align: top;
          padding: 4px 8px;
          width: 60px;
          min-width: 60px;
          max-width: 60px;
          position: sticky;
          left: 0;
          z-index: 100;
          opacity: 1;
          background-clip: padding-box;
          transform: translateZ(0);
          will-change: transform;
        }

        table.table-editor tbody tr td.row-number.selected,
        table.table-editor thead th.column-header.selected {
          ${selectedHeaderRowStyles(theme)}
        }

        /* ====== データセル ====== */
        table.table-editor tbody tr td.data-cell,
        table.table-editor tbody tr td.editable-cell {
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          padding: 0;
          text-align: left;
          position: relative;
          width: 150px;
          min-width: 150px;
          cursor: cell;
          transition: background-color 0.15s ease;
          box-sizing: border-box;
          height: auto;
          overflow: hidden;
          white-space: normal;
          word-wrap: break-word;
          word-break: break-word;
          overflow-wrap: break-word;
          vertical-align: top;
        }

        table.table-editor tbody tr td.data-cell.user-resized,
        table.table-editor tbody tr td.editable-cell.user-resized {
          min-width: 10px;
        }

        .data-cell {
          position: relative;
          box-sizing: border-box;
        }

        /* ====== Git差分の視覚化 ====== */
        .git-diff-icon {
          position: absolute;
          top: 2px;
          right: 4px;
          font-weight: 900;
          font-size: 14px;
          width: 12px;
          text-align: center;
        }

        .git-diff-added {
          color: var(--vscode-gitDecoration-addedResourceForeground, #81b88b);
        }

        .git-diff-modified {
          color: var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d);
        }

        .git-diff-deleted {
          color: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39);
        }

        .git-diff-deleted-row {
          height: auto;
          background-color: transparent;
        }

        .git-diff-deleted-cell {
          padding: 4px 6px !important;
          text-align: left;
          vertical-align: top;
          border: 1px solid var(--vscode-editorGroup-border, #3e3e42);
          position: relative;
          background-color: rgba(199, 78, 57, 0.05);
          color: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39);
        }

        .git-diff-deleted-row.striped-row .git-diff-deleted-cell {
          background-color: var(--vscode-editor-hoverHighlightBackground, var(--vscode-editor-selectionHighlightBackground, var(--vscode-editor-lineHighlightBackground)));
        }

        .git-diff-deleted-cell .git-diff-icon {
          position: static;
          margin-right: 8px;
          font-weight: 900;
        }

        .git-diff-deleted-cell .git-diff-deleted-content {
          opacity: 0.7;
        }

        .git-diff-deleted-cell.git-diff-same-content {
          color: var(--vscode-editor-foreground, #d4d4d4);
          background-color: rgba(212, 212, 212, 0.03);
        }

        .git-diff-deleted-cell.git-diff-same-content .git-diff-deleted-content {
          opacity: 1;
        }

        .git-diff-column-not-exist {
          position: relative;
          background-color: transparent !important;
        }

        .git-diff-column-not-exist::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(128, 128, 128, 0.5) 2px, rgba(128, 128, 128, 0.5) 4px);
          pointer-events: none;
          z-index: 1;
        }

        .git-diff-deleted-row .git-diff-column-not-exist {
          border: 1px solid var(--vscode-editorGroup-border, #3e3e42) !important;
        }

        .git-diff-deleted-row .git-diff-column-not-exist::before {
          background: repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(199, 78, 57, 0.6) 2px, rgba(199, 78, 57, 0.6) 4px);
        }

        tr:not(.git-diff-deleted-row) td.git-diff-column-not-exist {
          background-color: rgba(129, 184, 139, 0.12);
          border: 1px dashed var(--vscode-gitDecoration-addedResourceForeground, #81b88b);
        }

        tr:not(.git-diff-deleted-row) td.git-diff-column-not-exist::before {
          background: repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(129, 184, 139, 0.6) 1px, rgba(129, 184, 139, 0.6) 4px);
        }

        th.git-diff-column-not-exist {
          background-color: var(--vscode-editorGroupHeader-tabsBackground, #1e1e1e) !important;
          border: 1px dashed var(--vscode-gitDecoration-addedResourceForeground, #81b88b);
          position: relative;
          /* ヘッダは上揃えにする（他のヘッダと一致させる） */
          vertical-align: top;
          padding: 10px 12px;
          box-sizing: border-box;
        }

        th.git-diff-column-not-exist::before {
          content: none;
        }

        table.table-editor tbody tr td .cell-content {
          word-wrap: break-word;
          word-break: break-all;
          overflow-wrap: break-word;
          white-space: pre-wrap;
          overflow: hidden;
          line-height: 1.2;
          display: block;
          max-width: 100%;
          box-sizing: border-box;
          text-align: left;
          height: auto;
          min-height: 1.2em;
          margin: 0;
          padding: 4px 6px;
          width: 100%;
          color: var(--vscode-editor-foreground, var(--vscode-foreground, #333333));
        }

        td[data-temp-empty="true"] .cell-content {
          visibility: hidden;
        }

        .empty-cell {
          color: var(--vscode-descriptionForeground);
          font-style: italic;
        }

        .empty-cell .cell-content:empty::before {
          content: "";
          opacity: 0.5;
        }

        .empty-cell-placeholder {
          display: inline-block;
          height: 1.2em;
          line-height: 1.2;
          width: 1px;
          opacity: 0;
        }

        /* ====== セル編集 ====== */
        .table-editor td:not(.editing) {
          user-select: none;
          -webkit-user-select: none;
          -ms-user-select: none;
        }

        .table-editor td.editing,
        .table-editor td.editing textarea {
          user-select: text;
          -webkit-user-select: text;
          -ms-user-select: text;
        }

        table.table-editor tbody tr td.data-cell.selected,
        table.table-editor tbody tr td.editable-cell.selected {
          border-color: transparent;
        }

        table.table-editor tbody tr td.data-cell.selected.anchor,
        table.table-editor tbody tr td.editable-cell.selected.anchor {
          background-color: rgba(120, 160, 255, 0.15);
          color: var(--vscode-editor-foreground);
          box-shadow: inset 0 0 0 2px var(--vscode-focusBorder);
          box-sizing: border-box;
          min-height: 32px;
          height: auto;
          position: relative;
          z-index: 20;
          overflow: visible;
        }

        table.table-editor tbody tr td.data-cell.selected:not(.anchor),
        table.table-editor tbody tr td.editable-cell.selected:not(.anchor) {
          background-color: rgba(120, 160, 255, 0.3);
          color: var(--vscode-editor-foreground);
          box-shadow: none;
          border-color: var(--vscode-panel-border);
          box-sizing: border-box;
          min-height: 32px;
          height: auto;
          position: relative;
          z-index: 20;
          overflow: visible;
        }

        table.table-editor tbody tr td.data-cell.selected.anchor.single-selection,
        table.table-editor tbody tr td.editable-cell.selected.anchor.single-selection {
          background-color: transparent;
        }

        table.table-editor tbody tr td.data-cell.selected:not(.anchor).single-selection,
        table.table-editor tbody tr td.editable-cell.selected:not(.anchor).single-selection {
          background-color: transparent;
        }

        table.table-editor tbody tr td.data-cell.selected.border-top,
        table.table-editor tbody tr td.editable-cell.selected.border-top {
          box-shadow: inset 0 2px 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-bottom,
        table.table-editor tbody tr td.editable-cell.selected.border-bottom {
          box-shadow: inset 0 -2px 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-left,
        table.table-editor tbody tr td.editable-cell.selected.border-left {
          box-shadow: inset 2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-right,
        table.table-editor tbody tr td.editable-cell.selected.border-right {
          box-shadow: inset -2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-top.border-right,
        table.table-editor tbody tr td.editable-cell.selected.border-top.border-right {
          box-shadow: inset 0 2px 0 0 var(--vscode-focusBorder), inset -2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-top.border-left,
        table.table-editor tbody tr td.editable-cell.selected.border-top.border-left {
          box-shadow: inset 0 2px 0 0 var(--vscode-focusBorder), inset 2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-bottom.border-right,
        table.table-editor tbody tr td.editable-cell.selected.border-bottom.border-right {
          box-shadow: inset 0 -2px 0 0 var(--vscode-focusBorder), inset -2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-bottom.border-left,
        table.table-editor tbody tr td.editable-cell.selected.border-bottom.border-left {
          box-shadow: inset 0 -2px 0 0 var(--vscode-focusBorder), inset 2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-top.border-bottom,
        table.table-editor tbody tr td.editable-cell.selected.border-top.border-bottom {
          box-shadow: inset 0 2px 0 0 var(--vscode-focusBorder), inset 0 -2px 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-left.border-right,
        table.table-editor tbody tr td.editable-cell.selected.border-left.border-right {
          box-shadow: inset 2px 0 0 0 var(--vscode-focusBorder), inset -2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-top.border-bottom.border-left.border-right,
        table.table-editor tbody tr td.editable-cell.selected.border-top.border-bottom.border-left.border-right {
          box-shadow: inset 0 2px 0 0 var(--vscode-focusBorder), inset 0 -2px 0 0 var(--vscode-focusBorder), inset 2px 0 0 0 var(--vscode-focusBorder), inset -2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-top.border-left.border-right,
        table.table-editor tbody tr td.editable-cell.selected.border-top.border-left.border-right {
          box-shadow: inset 0 2px 0 0 var(--vscode-focusBorder), inset 2px 0 0 0 var(--vscode-focusBorder), inset -2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-bottom.border-left.border-right,
        table.table-editor tbody tr td.editable-cell.selected.border-bottom.border-left.border-right {
          box-shadow: inset 0 -2px 0 0 var(--vscode-focusBorder), inset 2px 0 0 0 var(--vscode-focusBorder), inset -2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-top.border-bottom.border-left,
        table.table-editor tbody tr td.editable-cell.selected.border-top.border-bottom.border-left {
          box-shadow: inset 0 2px 0 0 var(--vscode-focusBorder), inset 0 -2px 0 0 var(--vscode-focusBorder), inset 2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.selected.border-top.border-bottom.border-right,
        table.table-editor tbody tr td.editable-cell.selected.border-top.border-bottom.border-right {
          box-shadow: inset 0 2px 0 0 var(--vscode-focusBorder), inset 0 -2px 0 0 var(--vscode-focusBorder), inset -2px 0 0 0 var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.cell-multi-selected,
        table.table-editor tbody tr td.editable-cell.cell-multi-selected {
          background-color: var(--vscode-list-inactiveSelectionBackground);
          box-shadow: 0 0 0 1px var(--vscode-list-activeSelectionForeground);
          box-sizing: border-box;
          min-height: 32px;
          height: auto;
          position: relative;
          z-index: 10;
        }

        table.table-editor tbody tr td.data-cell.editing,
        table.table-editor tbody tr td.editable-cell.editing {
          padding: 0;
          background-color: var(--vscode-input-background);
          outline: none;
          box-shadow: none;
          box-sizing: border-box;
          height: auto;
          position: relative;
          vertical-align: top;
          text-align: left;
        }

        table.table-editor tbody tr td textarea.cell-input {
          border: none;
          background-color: var(--vscode-input-background);
          color: var(--vscode-foreground);
          padding: 4px 6px;
          font-family: inherit;
          font-size: inherit;
          outline: none;
          resize: none;
          box-sizing: border-box;
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          word-break: break-word;
          overflow-wrap: break-word;
          overflow: hidden;
          line-height: 1.2;
          vertical-align: top;
          text-align: left;
        }

        .cell-input:focus {
          background-color: var(--vscode-input-background);
          box-shadow: inset 0 0 0 1px var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.data-cell.editing textarea.cell-input,
        table.table-editor tbody tr td.editable-cell.editing textarea.cell-input {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 5;
          box-sizing: border-box;
          padding: 4px 6px;
          line-height: 1.2;
          white-space: pre-wrap;
          word-wrap: break-word;
          word-break: break-word;
          overflow-wrap: break-word;
          vertical-align: top;
          text-align: left;
          resize: none;
          overflow: hidden;
        }

        textarea.cell-input[data-multiline="true"] {
          overflow-y: auto;
          resize: none;
        }

        table.table-editor tbody tr td.cell-editing-focus {
          box-shadow: 0 0 0 2px var(--vscode-focusBorder);
          z-index: 10;
        }

        table.table-editor tbody tr td.data-cell.column-selected {
          background-color: var(--vscode-list-activeSelectionBackground);
        }

        table.table-editor tbody tr td.editable-cell.column-selected {
          background-color: var(--vscode-list-activeSelectionBackground);
        }

        table.table-editor tbody tr td.data-cell.row-selected {
          background-color: var(--vscode-list-activeSelectionBackground);
        }

        table.table-editor tbody tr td.editable-cell.row-selected {
          background-color: var(--vscode-list-activeSelectionBackground);
        }

        /* ====== リサイズ機能 ====== */
        .resize-handle {
          position: absolute;
          top: 0;
          right: -4.5px;
          width: 8px;
          height: 100%;
          cursor: col-resize;
          background-color: transparent;
          z-index: 10;
          border-radius: 2px;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .resize-handle:hover {
          background-color: var(--vscode-focusBorder);
          opacity: 0.7;
        }

        .resize-handle:active {
          background-color: var(--vscode-focusBorder);
          opacity: 0.9;
        }

        /* ====== ドラッグ&ドロップ ====== */
        table.table-editor thead th.dragging,
        table.table-editor tbody tr td.dragging {
          opacity: 0.6;
          transform: rotate(1deg) scale(1.02);
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          z-index: 1000;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 122, 204, 0.1);
          border: 2px solid rgba(0, 122, 204, 0.5);
        }

        table.table-editor thead th.drag-over,
        table.table-editor tbody tr td.drag-over {
          background-color: var(--vscode-list-dropBackground);
          border: 2px solid var(--vscode-focusBorder);
          transition: all 0.2s ease;
        }

        table.table-editor thead th.drop-zone,
        table.table-editor tbody tr td.drop-zone {
          background-color: var(--vscode-list-focusBackground);
          border: 2px dashed var(--vscode-focusBorder);
        }

        table.table-editor tbody tr td.drag-selecting {
          background-color: var(--vscode-list-inactiveSelectionBackground);
        }

        .drop-indicator {
          position: absolute;
          background-color: #007ACC;
          z-index: 1000;
          pointer-events: none;
          opacity: 0.95;
          transition: all 0.15s ease;
          box-shadow: 0 0 12px rgba(0, 122, 204, 0.8), 0 0 4px rgba(0, 122, 204, 1);
          border-radius: 3px;
          animation: dropIndicatorPulse 1.2s infinite ease-in-out;
        }

        @keyframes dropIndicatorPulse {
          0% { opacity: 0.7; transform: scale(1); box-shadow: 0 0 8px rgba(0, 122, 204, 0.6); }
          50% { opacity: 1; transform: scale(1.05); box-shadow: 0 0 16px rgba(0, 122, 204, 0.9), 0 0 6px rgba(0, 122, 204, 1); }
          100% { opacity: 0.7; transform: scale(1); box-shadow: 0 0 8px rgba(0, 122, 204, 0.6); }
        }

        .drop-indicator.column {
          top: 0;
          bottom: 0;
          width: 6px;
          background: linear-gradient(to bottom, rgba(0, 122, 204, 0.9), rgba(0, 122, 204, 1), rgba(0, 122, 204, 0.9));
          border-left: 1px solid rgba(255, 255, 255, 0.3);
          border-right: 1px solid rgba(255, 255, 255, 0.3);
        }

        .drop-indicator.row {
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(to right, rgba(0, 122, 204, 0.9), rgba(0, 122, 204, 1), rgba(0, 122, 204, 0.9));
          border-top: 1px solid rgba(255, 255, 255, 0.3);
          border-bottom: 1px solid rgba(255, 255, 255, 0.3);
        }

        .row-number[draggable="true"]:hover {
          cursor: grab;
        }

        .row-number[draggable="true"]:active {
          cursor: grabbing;
        }

        .column-header[draggable="true"]:hover {
          cursor: grab;
        }

        .column-header[draggable="true"]:active {
          cursor: grabbing;
        }

        .table-editor.drag-active {
          user-select: none;
        }

        .table-editor.drag-active .row-number:not(.dragging) {
          border: 2px dashed var(--vscode-panel-border);
        }

        .table-editor.drag-active .column-header:not(.dragging) {
          border: 2px dashed var(--vscode-panel-border);
        }

        /* ====== コンテキストメニュー ====== */
        .context-menu {
          position: fixed;
          background-color: var(--vscode-menu-background);
          border: 1px solid var(--vscode-menu-border);
          border-radius: 4px;
          box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.2));
          min-width: 180px;
          padding: 4px 0;
          z-index: 1000;
          font-size: var(--vscode-font-size);
          display: block;
        }

        .context-menu-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 999;
          background: transparent;
        }

        .context-menu-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background-color: var(--vscode-menu-background);
          color: var(--vscode-menu-foreground);
          cursor: pointer;
          user-select: none;
          font-size: 13px;
          width: 100%;
          border: none;
          text-align: left;
        }

        .context-menu-item:hover:not(.disabled) {
          background-color: var(--vscode-menu-selectionBackground);
          color: var(--vscode-menu-selectionForeground);
          opacity: 1;
        }

        .context-menu-item.disabled {
          color: var(--vscode-disabledForeground);
          cursor: default;
          opacity: 0.6;
        }

        .context-menu-icon {
          width: 16px;
          margin-right: 8px;
          text-align: center;
        }

        .context-menu-label {
          flex: 1;
        }

        .context-menu-shortcut {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          margin-left: 12px;
        }

        .context-menu-separator {
          height: 1px;
          background-color: var(--vscode-menu-separatorBackground);
          margin: 4px 0;
        }

        /* ====== ツールバー ====== */
        .toolbar {
          margin-bottom: 16px;
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 8px;
          background-color: var(--vscode-editor-lineHighlightBackground);
          border-radius: 4px;
          border: 1px solid var(--vscode-panel-border);
        }

        .toolbar-group {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .toolbar-separator {
          width: 1px;
          height: 20px;
          background-color: var(--vscode-panel-border);
          margin: 0 8px;
        }

        .btn {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 6px 12px;
          border-radius: 2px;
          cursor: pointer;
          font-size: 13px;
        }

        .btn:hover {
          background-color: var(--vscode-button-hoverBackground);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ====== ステータスバー ====== */
        .status-bar {
          position: static;
          height: 24px;
          background-color: var(--vscode-statusBar-background);
          color: var(--vscode-statusBar-foreground);
          border-top: 1px solid var(--vscode-statusBar-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          font-size: 12px;
          z-index: 999;
        }

        .status-left,
        .status-center,
        .status-right {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          overflow: visible;
        }

        .status-left {
          flex: 1;
          min-width: 0;
          overflow: visible;
        }

        .status-center {
          flex: 2;
          min-width: 0;
          justify-content: center;
        }

        .status-right {
          flex: 1;
          min-width: 0;
          justify-content: flex-end;
        }

        .status-item {
          color: var(--vscode-statusBar-foreground);
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          overflow: visible;
          white-space: nowrap;
        }

        .git-diff-indicator {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 500;
          line-height: 18px;
          display: inline-flex;
          align-items: center;
          border: none;
          background-color: var(--vscode-editor-lineHighlightBackground);
          color: var(--vscode-charts-green);
          box-shadow: inset 0 0 0 1px var(--vscode-charts-green);
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .git-diff-indicator:hover {
          opacity: 0.8;
        }

        .git-diff-indicator.active {
          color: var(--vscode-charts-green);
          box-shadow: inset 0 0 0 1px var(--vscode-charts-green);
        }

        .git-diff-indicator.inactive {
          color: var(--vscode-charts-green);
          box-shadow: inset 0 0 0 1px var(--vscode-charts-green);
        }

        .status-info {
          display: flex;
          gap: 16px;
        }

        .status-selection {
          color: var(--vscode-statusBar-prominentForeground);
          font-weight: 500;
        }

        .status-message {
          color: var(--vscode-statusBar-foreground);
          font-weight: normal;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .status-message.success {
          color: var(--vscode-statusBarItem-prominentForeground);
        }

        .status-message.error {
          color: var(--vscode-statusBarItem-errorForeground);
        }

        .status-message.warning {
          color: var(--vscode-statusBarItem-warningForeground);
        }

        .status-message.info {
          color: var(--vscode-statusBarItem-prominentForeground);
        }

        .save-indicator {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 500;
          line-height: 18px;
          display: inline-flex;
          align-items: center;
        }

        .save-indicator.saved {
          color: var(--vscode-charts-green);
          background-color: var(--vscode-editor-lineHighlightBackground);
          box-shadow: inset 0 0 0 1px var(--vscode-charts-green);
        }

        .save-indicator.saving {
          color: var(--vscode-charts-orange);
          background-color: var(--vscode-editor-lineHighlightBackground);
          box-shadow: inset 0 0 0 1px var(--vscode-charts-orange);
        }

        .save-indicator.error {
          color: var(--vscode-charts-red);
          background-color: var(--vscode-inputValidation-errorBackground);
          box-shadow: inset 0 0 0 1px var(--vscode-inputValidation-errorBorder);
        }

        .save-indicator.failed {
          color: var(--vscode-charts-red);
          background-color: var(--vscode-inputValidation-errorBackground);
          box-shadow: inset 0 0 0 1px var(--vscode-inputValidation-errorBorder);
        }

        /* ====== オートフィル機能 ====== */
        .fill-handle {
          position: absolute;
          bottom: -3px;
          right: -3px;
          width: 8px;
          height: 8px;
          background-color: var(--vscode-focusBorder, #007ACC);
          border: 1px solid var(--vscode-editor-background, #fff);
          cursor: crosshair;
          z-index: 250;
          border-radius: 50%;
          box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
        }

        .fill-handle:hover {
          background-color: var(--vscode-button-hoverBackground, #005A9E);
          transform: scale(1.2);
          transition: transform 0.1s ease;
        }

        table.table-editor tbody tr td.data-cell.fill-range {
          background-color: transparent;
          border: 1px dotted var(--vscode-focusBorder);
        }

        /* ====== 検索バー ====== */
        .search-bar {
          background-color: var(--vscode-editorWidget-background, var(--vscode-editor-background));
          border-bottom: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .search-row,
        .replace-row,
        .advanced-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .search-input-container {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 6px;
          position: relative;
        }

        .search-icon {
          font-size: 14px;
          opacity: 0.7;
        }

        .search-input {
          flex: 1;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border, transparent);
          padding: 4px 60px 4px 8px;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size, 13px);
          outline: none;
        }

        .search-input:focus {
          border-color: var(--vscode-focusBorder, #007ACC);
        }

        .search-result-count {
          position: absolute;
          right: 8px;
          font-size: 11px;
          color: var(--vscode-input-placeholderForeground);
          pointer-events: none;
        }

        .search-actions {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .search-nav-button,
        .search-option-button,
        .search-advanced-button,
        .search-close-button,
        .replace-button,
        .replace-all-button {
          background-color: transparent;
          border: 1px solid transparent;
          color: var(--vscode-icon-foreground, var(--vscode-foreground));
          padding: 4px 8px;
          cursor: pointer;
          font-size: 13px;
          font-family: var(--vscode-font-family);
          border-radius: 2px;
          transition: background-color 0.1s ease;
        }

        .search-nav-button:hover,
        .search-option-button:hover,
        .search-advanced-button:hover,
        .search-close-button:hover,
        .replace-button:hover,
        .replace-all-button:hover {
          background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
        }

        .search-nav-button:disabled,
        .replace-button:disabled,
        .replace-all-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .search-option-button.active,
        .search-advanced-button.active {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }

        .scope-label {
          font-size: 12px;
          color: var(--vscode-foreground);
          margin-right: 4px;
        }

        .scope-select {
          background-color: var(--vscode-dropdown-background);
          color: var(--vscode-dropdown-foreground);
          border: 1px solid var(--vscode-dropdown-border, transparent);
          padding: 4px 8px;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size, 13px);
          cursor: pointer;
          outline: none;
        }

        .scope-select:focus {
          border-color: var(--vscode-focusBorder, #007ACC);
        }

        /* ====== 検索結果ハイライト ====== */
        table.table-editor tbody tr td.data-cell.search-result {
          background-color: rgba(150, 255, 150, 0.2);
          box-shadow: 0 0 0 1px rgba(100, 200, 100, 0.4);
          position: relative;
          z-index: 10;
        }

        table.table-editor tbody tr td.data-cell.current-search-result {
          background-color: rgba(150, 255, 150, 0.3);
          box-shadow: 0 0 0 2px rgba(100, 200, 100, 0.6);
          position: relative;
          z-index: 10;
        }

        table.table-editor tbody tr td.data-cell.selected.search-result {
          background-color: var(--vscode-list-activeSelectionBackground);
          box-shadow: 0 0 0 1px rgba(100, 200, 100, 0.5);
          position: relative;
          z-index: 10;
        }

        table.table-editor tbody tr td.data-cell.selected.current-search-result {
          background-color: var(--vscode-list-activeSelectionBackground);
          box-shadow: 0 0 0 2px rgba(100, 200, 100, 0.7);
          position: relative;
          z-index: 10;
        }

        @media (max-width: 768px) {
          .status-bar {
            font-size: 11px;
            padding: 0 8px;
          }
          .status-left,
          .status-right {
            gap: 8px;
          }
          .context-menu {
            min-width: 150px;
          }
          .context-menu-item {
            padding: 6px 10px;
            font-size: 12px;
          }
        }

        /* 一部コンポーネントが期待するユーティリティクラス */
        .visually-hidden {
          border: 0;
          clip: rect(0 0 0 0);
          height: 1px;
          margin: -1px;
          overflow: hidden;
          padding: 0;
          position: absolute;
          width: 1px;
        }
      `}
    />
  )
}
