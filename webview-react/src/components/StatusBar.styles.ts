/**
 * StatusBar.styles.ts
 * StatusBarコンポーネントのEmotionスタイル
 */

import styled from '@emotion/styled'

export const StatusBarContainer = styled.div`
  position: static;
  height: 24px;
  background-color: var(--vscode-statusBar-background, #007acc);
  color: var(--vscode-statusBar-foreground, #ffffff);
  border-top: 1px solid var(--vscode-statusBar-border, rgba(0, 0, 0, 0.6));
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12px;
  z-index: 999;
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

export const StatusItem = styled.div`
  color: var(--vscode-statusBar-foreground, #ffffff);
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: visible;
  white-space: nowrap;
`

export const SaveIndicator = styled.span<{ status: 'saved' | 'saving' | 'error' | 'failed' }>`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  line-height: 18px;
  display: inline-flex;
  align-items: center;

  ${props => {
    const { status } = props
    switch (status) {
      case 'saved':
        return `
          color: var(--vscode-charts-green, #89d185);
          background-color: var(--vscode-editor-lineHighlightBackground, rgba(255, 255, 255, 0.04));
          box-shadow: inset 0 0 0 1px var(--vscode-charts-green, #89d185);
        `
      case 'saving':
        return `
          color: var(--vscode-charts-orange, #d18616);
          background-color: var(--vscode-editor-lineHighlightBackground, rgba(255, 255, 255, 0.04));
          box-shadow: inset 0 0 0 1px var(--vscode-charts-orange, #d18616);
        `
      case 'error':
      case 'failed':
        return `
          color: var(--vscode-charts-red, #f48771);
          background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
          box-shadow: inset 0 0 0 1px var(--vscode-inputValidation-errorBorder, #be1100);
        `
      default:
        return ''
    }
  }}
`

export const GitDiffButton = styled.button<{ active: boolean }>`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  line-height: 18px;
  display: inline-flex;
  align-items: center;
  border: none;
  background-color: var(--vscode-editor-lineHighlightBackground, rgba(255, 255, 255, 0.04));
  color: var(--vscode-charts-green, #89d185);
  box-shadow: inset 0 0 0 1px var(--vscode-charts-green, #89d185);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  white-space: nowrap;

  &:hover {
    opacity: 0.8;
  }

  ${props =>
    props.active &&
    `
    font-weight: 600;
  `}
`

export const StatusSelection = styled.span`
  color: var(--vscode-statusBarItem-prominentForeground, #ffffff);
  font-weight: 500;
`

export const StatusMessage = styled.span<{ messageType?: 'success' | 'error' | 'warning' | 'info' }>`
  color: var(--vscode-statusBar-foreground, #ffffff);
  font-weight: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;

  ${props => {
    const { messageType } = props
    switch (messageType) {
      case 'success':
        return `color: var(--vscode-statusBarItem-prominentForeground, #ffffff);`
      case 'error':
        return `color: var(--vscode-charts-red, #f48771);`
      case 'warning':
        return `color: var(--vscode-charts-orange, #d18616);`
      case 'info':
        return `color: var(--vscode-statusBarItem-prominentForeground, #ffffff);`
      default:
        return ''
    }
  }}
`
