/**
 * StatusBar.styles.ts
 * StatusBarコンポーネントのEmotionスタイル
 * 色はコンポーネント側で inline style で直接適用するため、ここでは基本的なレイアウトスタイルのみ定義
 */

import styled from '@emotion/styled'

export const StatusBarContainer = styled.div<{}>`
  position: static;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12px;
  z-index: 999;
  border-top: 1px solid var(--vscode-statusBar-border, var(--vscode-panel-border, #3e3e42));
  /* 色は inline style で設定される */
`;

export const StatusSection = styled.div<{ align?: 'left' | 'center' | 'right' }>`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  overflow: visible;
  flex: ${props => (props.align === 'center' ? 2 : 1)};
  justify-content: ${props => {
    switch (props.align) {
      case 'center':
        return 'center'
      case 'right':
        return 'flex-end'
      default:
        return 'flex-start'
    }
  }};
`

export const StatusItem = styled.div<{}>`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: visible;
  white-space: nowrap;
  /* 色は親コンポーネントで設定される */
`

export const GitDiffButton = styled.button<{ active: boolean; disabled?: boolean }>`
  font-size: 12px;
  padding: 0;
  border-radius: 2px;
  font-weight: 400;
  line-height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  white-space: nowrap;
  background-color: transparent !important;
  padding: 0 8px;
  /* 色は親コンポーネントで inline style で設定される */
  height: 24px;

  &:hover:not(:disabled) {
    background-color: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.1)) !important;
  }

  &:active:not(:disabled) {
    background-color: var(--vscode-toolbar-activeBackground, rgba(255, 255, 255, 0.15)) !important;
  }

  &:focus {
    outline: none;
  }

  ${props =>
    props.active &&
    `
    background-color: var(--vscode-toolbar-activeBackground, rgba(255, 255, 255, 0.15)) !important;
  `}

  ${props =>
    props.disabled &&
    `
    opacity: 0.5;
    cursor: not-allowed;
    &:hover {
      background-color: transparent !important;
    }
  `}
`;

export const GitDiffIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
`;

export const GitDiffLabel = styled.span`
  display: inline-block;
  white-space: nowrap;
`;

export const StatusSelection = styled.span<{}>`
  font-weight: 500;
  /* 色は親コンポーネントで設定される */
`

export const StatusMessage = styled.span<{ messageType?: 'success' | 'error' | 'warning' | 'info' }>`
  font-weight: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  /* 色は親コンポーネントで設定される */
`;
