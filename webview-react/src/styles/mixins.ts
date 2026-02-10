/**
 * mixins.ts
 * 再利用可能なスタイルヘルパー関数とmixins
 */

import { css, SerializedStyles } from '@emotion/react'
import { VSCodeTheme } from './theme'

/**
 * スクロールバーのスタイル
 */
export const scrollbarStyles = (theme: VSCodeTheme): SerializedStyles => css`
  scrollbar-width: thin;
  scrollbar-color: ${theme.scrollbarSliderBackground} ${theme.editorBackground};

  &::-webkit-scrollbar {
    width: 16px;
    height: 16px;
  }

  &::-webkit-scrollbar-track {
    background: ${theme.editorBackground};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.scrollbarSliderBackground};
    border-radius: 4px;
    border: 2px solid ${theme.editorBackground};
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${theme.scrollbarSliderHoverBackground};
  }

  &::-webkit-scrollbar-thumb:active {
    background: ${theme.scrollbarSliderActiveBackground};
  }

  &::-webkit-scrollbar-corner {
    background: ${theme.editorBackground};
  }
`

/**
 * フォーカス時の枠線スタイル
 */
export const focusBorderStyles = (theme: VSCodeTheme): SerializedStyles => css`
  &:focus {
    outline: none;
    border-color: ${theme.focusBorder};
  }
`

/**
 * ホバー時の背景色変更
 */
export const hoverBackgroundStyles = (theme: VSCodeTheme): SerializedStyles => css`
  transition: background-color 0.15s ease;

  &:hover {
    background-color: ${theme.listHoverBackground};
  }
`

/**
 * ボタンの基本スタイル
 */
export const buttonBaseStyles = (theme: VSCodeTheme, secondary: boolean = false): SerializedStyles => css`
  background-color: ${secondary ? theme.buttonSecondaryBackground : theme.buttonBackground};
  color: ${secondary ? theme.buttonSecondaryForeground : theme.buttonForeground};
  border: none;
  padding: 6px 12px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 13px;
  font-family: ${theme.fontFamily};
  transition: background-color 0.15s ease;

  &:hover:not(:disabled) {
    background-color: ${secondary ? theme.buttonSecondaryHoverBackground : theme.buttonHoverBackground};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

/**
 * 入力フィールドの基本スタイル
 */
export const inputBaseStyles = (theme: VSCodeTheme): SerializedStyles => css`
  background-color: ${theme.inputBackground};
  color: ${theme.inputForeground};
  border: 1px solid ${theme.inputBorder};
  padding: 4px 8px;
  font-family: ${theme.fontFamily};
  font-size: ${theme.fontSize};
  outline: none;

  &:focus {
    border-color: ${theme.focusBorder};
  }

  &::placeholder {
    color: ${theme.inputPlaceholderForeground};
  }
`

/**
 * セルの選択状態スタイル
 */
export const cellSelectionStyles = (
  theme: VSCodeTheme,
  isAnchor: boolean = false,
  isSingle: boolean = false
): SerializedStyles => {
  if (isSingle && isAnchor) {
    return css`
      background-color: transparent;
      box-shadow: inset 0 0 0 2px ${theme.focusBorder};
    `
  }

  if (isAnchor) {
    return css`
      background-color: rgba(120, 160, 255, 0.15);
      color: ${theme.editorForeground};
      box-shadow: inset 0 0 0 2px ${theme.focusBorder};
      position: relative;
      z-index: 20;
    `
  }

  return css`
    background-color: rgba(120, 160, 255, 0.3);
    color: ${theme.editorForeground};
    position: relative;
    z-index: 20;
  `
}

/**
 * 選択範囲の境界線スタイル
 */
export const selectionBorderStyles = (
  theme: VSCodeTheme,
  borders: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean }
): SerializedStyles => {
  const shadows: string[] = []
  
  if (borders.top) shadows.push(`inset 0 2px 0 0 ${theme.focusBorder}`)
  if (borders.bottom) shadows.push(`inset 0 -2px 0 0 ${theme.focusBorder}`)
  if (borders.left) shadows.push(`inset 2px 0 0 0 ${theme.focusBorder}`)
  if (borders.right) shadows.push(`inset -2px 0 0 0 ${theme.focusBorder}`)

  return css`
    box-shadow: ${shadows.join(', ')};
  `
}

/**
 * ドラッグ中のスタイル
 */
export const draggingStyles = (): SerializedStyles => css`
  opacity: 0.6;
  transform: rotate(1deg) scale(1.02);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 122, 204, 0.1);
  border: 2px solid rgba(0, 122, 204, 0.5);
`

/**
 * ドロップゾーンのスタイル
 */
export const dropZoneStyles = (theme: VSCodeTheme): SerializedStyles => css`
  background-color: ${theme.listFocusBackground};
  border: 2px dashed ${theme.focusBorder};
  transition: all 0.2s ease;
`

/**
 * Git差分アイコンのスタイル
 */
export const gitDiffIconStyles = (
  theme: VSCodeTheme,
  type: 'added' | 'modified' | 'deleted'
): SerializedStyles => {
  const colors = {
    added: theme.gitDecorationAddedForeground,
    modified: theme.gitDecorationModifiedForeground,
    deleted: theme.gitDecorationDeletedForeground,
  }

  return css`
    position: absolute;
    top: 2px;
    right: 4px;
    font-weight: 900;
    font-size: 14px;
    width: 12px;
    text-align: center;
    color: ${colors[type]};
  `
}

/**
 * テキストの省略表示
 */
export const textEllipsis = (): SerializedStyles => css`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

/**
 * ワードラップ
 */
export const wordWrap = (): SerializedStyles => css`
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
`

/**
 * フレックスセンタリング
 */
export const flexCenter = (): SerializedStyles => css`
  display: flex;
  align-items: center;
  justify-content: center;
`

/**
 * アニメーション: フェードイン
 */
export const fadeIn = (duration: string = '0.2s'): SerializedStyles => css`
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  animation: fadeIn ${duration} ease-in;
`

/**
 * アニメーション: スライドイン（上から）
 */
export const slideInFromTop = (duration: string = '0.2s'): SerializedStyles => css`
  @keyframes slideInFromTop {
    from {
      transform: translateY(-10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  animation: slideInFromTop ${duration} ease-out;
`

/**
 * シャドウエレベーション（マテリアルデザイン風）
 */
export const elevation = (level: 1 | 2 | 3 | 4 = 1): SerializedStyles => {
  const shadows = {
    1: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
    2: '0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)',
    3: '0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)',
    4: '0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22)',
  }

  return css`
    box-shadow: ${shadows[level]};
  `
}

/**
 * ヘッダー・行番号の基本スタイル
 */
export const baseHeaderRowStyles = (theme: VSCodeTheme): SerializedStyles => css`
  background-color: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-sideBar-background, var(--vscode-activityBar-background)));
  border: 1px solid var(--vscode-panel-border);
  color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
  box-sizing: border-box;
  user-select: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
`

/**
 * ヘッダー・行番号の選択状態スタイル
 */
export const selectedHeaderRowStyles = (theme: VSCodeTheme): SerializedStyles => css`
  background: rgb(192, 192, 255);
  color: ${theme.editorForeground};
  box-sizing: border-box;
  font-weight: 700;
`
