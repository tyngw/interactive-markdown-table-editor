/**
 * StatusBar.styles.ts
 * StatusBarコンポーネントのEmotionスタイル
 * 色はコンポーネント側で inline style で直接適用するため、ここでは基本的なレイアウトスタイルのみ定義
 */

import styled from '@emotion/styled'
import { VSCodeTheme } from '../styles/theme'

export const StatusBarContainer = styled.div<{}>`
  position: static;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12px;
  z-index: 999;
  border-top: 1px solid !important;
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

export const SaveIndicator = styled.span<{ status: 'saved' | 'saving' | 'error' | 'failed'; isLoading?: boolean }>`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  line-height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  min-height: 20px;
  height: 20px;
  flex-shrink: 0;
  white-space: nowrap;
  /* 色は親コンポーネントで inline style で設定される */
  /* isLoading が true の場合のみ表示、それ以外も領域は常に確保（min-height で確保） */
  opacity: ${props => props.isLoading ? '1' : '0'};
  visibility: ${props => props.isLoading ? 'visible' : 'hidden'};
  transition: opacity 0.2s ease;
`;

export const GitDiffButton = styled.button<{ active: boolean }>`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  line-height: 18px;
  display: inline-flex;
  align-items: center;
  border: none;
  outline: 1px solid currentColor;
  outline-offset: -1px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  white-space: nowrap;
  background-color: transparent !important;
  /* 色は親コンポーネントで inline style で設定される */

  &:hover {
    opacity: 0.8;
  }

  &:focus {
    outline: 1px solid currentColor;
    outline-offset: -1px;
  }

  ${props =>
    props.active &&
    `
    font-weight: 600;
  `}
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
