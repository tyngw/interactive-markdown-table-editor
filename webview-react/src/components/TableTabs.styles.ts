/**
 * TableTabs.styles.ts
 * TableTabsコンポーネントのEmotionスタイル
 */

import styled from '@emotion/styled'

export const TabsContainer = styled.div`
  display: flex;
  border-top: 1px solid var(--vscode-panel-border, #3e3e42);
  border-bottom: 1px solid var(--vscode-panel-border, #3e3e42);
  background-color: var(--vscode-editorGroupHeader-tabsBackground, #252526);
  margin: 0;
  padding: 4px 0;
  overflow-x: auto;
  background-clip: padding-box;

  /* スクロールバーのスタイル */
  scrollbar-width: thin;
  scrollbar-color: var(--vscode-scrollbarSlider-background, rgba(90, 93, 94, 0.31)) transparent;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--vscode-scrollbarSlider-background, rgba(90, 93, 94, 0.31));
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-hoverBackground, rgba(90, 93, 94, 0.50));
  }
`

export const TabButton = styled.button<{ active: boolean }>`
  background: ${props =>
    props.active ? 'var(--vscode-tab-activeBackground, #1e1e1e)' : 'var(--vscode-tab-inactiveBackground, transparent)'};
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  color: ${props =>
    props.active ? 'var(--vscode-tab-activeForeground, #ffffff)' : 'var(--vscode-tab-inactiveForeground, #a6a6a6)'};
  border-bottom: 2px solid ${props =>
    props.active ? 'var(--vscode-tab-activeBorderTop, #007acc)' : 'transparent'};
  font-size: var(--vscode-font-size, 14px);
  font-family: var(--vscode-font-family, 'Consolas', 'Monaco', 'Courier New', monospace);
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--vscode-tab-hoverBackground, #2a2d2e);
  }

  &:focus {
    outline: 1px solid var(--vscode-focusBorder, #007acc);
    outline-offset: -1px;
  }
`

export const BottomChrome = styled.div`
  margin-top: auto;
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-top: 1px solid var(--vscode-panel-border, #3e3e42);
`
