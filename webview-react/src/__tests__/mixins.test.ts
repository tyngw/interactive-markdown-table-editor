/**
 * mixins.test.ts
 * スタイルヘルパー関数（mixins）のテスト
 * 各mixinが正しいSerializedStylesを返すことを検証
 */

import {
  scrollbarStyles,
  focusBorderStyles,
  hoverBackgroundStyles,
  buttonBaseStyles,
  inputBaseStyles,
  cellSelectionStyles,
  selectionBorderStyles,
  draggingStyles,
  dropZoneStyles,
  gitDiffIconStyles,
  textEllipsis,
  wordWrap,
  flexCenter,
  fadeIn,
  slideInFromTop,
  elevation,
  baseHeaderRowStyles,
  selectedHeaderRowStyles,
} from '../styles/mixins'
import { getVSCodeTheme } from '../styles/theme'

describe('mixins', () => {
  // テスト用のテーマオブジェクト
  const theme = getVSCodeTheme()

  describe('scrollbarStyles', () => {
    it('SerializedStylesを返す', () => {
      const result = scrollbarStyles(theme)
      expect(result).toBeDefined()
      expect(result.styles).toBeDefined()
      expect(typeof result.styles).toBe('string')
    })

    it('スクロールバーのスタイルが含まれる', () => {
      const result = scrollbarStyles(theme)
      expect(result.styles).toContain('scrollbar-width')
    })
  })

  describe('focusBorderStyles', () => {
    it('SerializedStylesを返す', () => {
      const result = focusBorderStyles(theme)
      expect(result).toBeDefined()
      expect(result.styles).toContain('border-color')
    })
  })

  describe('hoverBackgroundStyles', () => {
    it('SerializedStylesを返す', () => {
      const result = hoverBackgroundStyles(theme)
      expect(result).toBeDefined()
      expect(result.styles).toContain('background-color')
    })
  })

  describe('buttonBaseStyles', () => {
    it('primaryボタンのスタイルを返す', () => {
      const result = buttonBaseStyles(theme, false)
      expect(result).toBeDefined()
      expect(result.styles).toContain(theme.buttonBackground)
    })

    it('secondaryボタンのスタイルを返す', () => {
      const result = buttonBaseStyles(theme, true)
      expect(result).toBeDefined()
      expect(result.styles).toContain(theme.buttonSecondaryBackground)
    })

    it('デフォルトではprimaryスタイルを返す', () => {
      const result = buttonBaseStyles(theme)
      expect(result.styles).toContain(theme.buttonBackground)
    })
  })

  describe('inputBaseStyles', () => {
    it('入力フィールドのスタイルを返す', () => {
      const result = inputBaseStyles(theme)
      expect(result).toBeDefined()
      expect(result.styles).toContain(theme.inputBackground)
      expect(result.styles).toContain(theme.inputForeground)
    })
  })

  describe('cellSelectionStyles', () => {
    it('単一セル選択のアンカースタイルを返す', () => {
      const result = cellSelectionStyles(theme, true, true)
      expect(result.styles).toContain('transparent')
      expect(result.styles).toContain('box-shadow')
    })

    it('複数セル選択のアンカースタイルを返す', () => {
      const result = cellSelectionStyles(theme, true, false)
      expect(result.styles).toContain('rgba(120, 160, 255, 0.15)')
    })

    it('非アンカーの選択セルスタイルを返す', () => {
      const result = cellSelectionStyles(theme, false, false)
      expect(result.styles).toContain('rgba(120, 160, 255, 0.3)')
    })

    it('デフォルト引数で非アンカースタイルを返す', () => {
      const result = cellSelectionStyles(theme)
      expect(result.styles).toContain('rgba(120, 160, 255, 0.3)')
    })
  })

  describe('selectionBorderStyles', () => {
    it('上部境界線のスタイルを返す', () => {
      const result = selectionBorderStyles(theme, { top: true })
      expect(result.styles).toContain('inset 0 2px 0 0')
    })

    it('下部境界線のスタイルを返す', () => {
      const result = selectionBorderStyles(theme, { bottom: true })
      expect(result.styles).toContain('inset 0 -2px 0 0')
    })

    it('左部境界線のスタイルを返す', () => {
      const result = selectionBorderStyles(theme, { left: true })
      expect(result.styles).toContain('inset 2px 0 0 0')
    })

    it('右部境界線のスタイルを返す', () => {
      const result = selectionBorderStyles(theme, { right: true })
      expect(result.styles).toContain('inset -2px 0 0 0')
    })

    it('複数の境界線を組み合わせられる', () => {
      const result = selectionBorderStyles(theme, { top: true, bottom: true, left: true, right: true })
      expect(result.styles).toContain('inset 0 2px 0 0')
      expect(result.styles).toContain('inset 0 -2px 0 0')
      expect(result.styles).toContain('inset 2px 0 0 0')
      expect(result.styles).toContain('inset -2px 0 0 0')
    })

    it('空のオブジェクトでも動作する', () => {
      const result = selectionBorderStyles(theme, {})
      expect(result).toBeDefined()
    })
  })

  describe('draggingStyles', () => {
    it('ドラッグ中のスタイルを返す（テーマ不要）', () => {
      const result = draggingStyles()
      expect(result.styles).toContain('opacity: 0.6')
      expect(result.styles).toContain('z-index: 1000')
    })
  })

  describe('dropZoneStyles', () => {
    it('ドロップゾーンのスタイルを返す', () => {
      const result = dropZoneStyles(theme)
      expect(result.styles).toContain('dashed')
    })
  })

  describe('gitDiffIconStyles', () => {
    it('added用のスタイルを返す', () => {
      const result = gitDiffIconStyles(theme, 'added')
      expect(result.styles).toContain(theme.gitDecorationAddedForeground)
    })

    it('modified用のスタイルを返す', () => {
      const result = gitDiffIconStyles(theme, 'modified')
      expect(result.styles).toContain(theme.gitDecorationModifiedForeground)
    })

    it('deleted用のスタイルを返す', () => {
      const result = gitDiffIconStyles(theme, 'deleted')
      expect(result.styles).toContain(theme.gitDecorationDeletedForeground)
    })
  })

  describe('textEllipsis', () => {
    it('省略表示スタイルを返す', () => {
      const result = textEllipsis()
      expect(result.styles).toContain('text-overflow: ellipsis')
      expect(result.styles).toContain('white-space: nowrap')
    })
  })

  describe('wordWrap', () => {
    it('ワードラップスタイルを返す', () => {
      const result = wordWrap()
      expect(result.styles).toContain('word-wrap: break-word')
      expect(result.styles).toContain('white-space: pre-wrap')
    })
  })

  describe('flexCenter', () => {
    it('フレックスセンタリングスタイルを返す', () => {
      const result = flexCenter()
      expect(result.styles).toContain('display: flex')
      expect(result.styles).toContain('align-items: center')
      expect(result.styles).toContain('justify-content: center')
    })
  })

  describe('fadeIn', () => {
    it('デフォルト時間でフェードインアニメーションを返す', () => {
      const result = fadeIn()
      expect(result.styles).toContain('fadeIn')
      expect(result.styles).toContain('0.2s')
    })

    it('カスタム時間でフェードインアニメーションを返す', () => {
      const result = fadeIn('0.5s')
      expect(result.styles).toContain('0.5s')
    })
  })

  describe('slideInFromTop', () => {
    it('デフォルト時間でスライドインアニメーションを返す', () => {
      const result = slideInFromTop()
      expect(result.styles).toContain('slideInFromTop')
      expect(result.styles).toContain('0.2s')
    })

    it('カスタム時間でスライドインアニメーションを返す', () => {
      const result = slideInFromTop('0.3s')
      expect(result.styles).toContain('0.3s')
    })
  })

  describe('elevation', () => {
    it('レベル1のシャドウを返す', () => {
      const result = elevation(1)
      expect(result.styles).toContain('box-shadow')
    })

    it('レベル2のシャドウを返す', () => {
      const result = elevation(2)
      expect(result.styles).toContain('box-shadow')
    })

    it('レベル3のシャドウを返す', () => {
      const result = elevation(3)
      expect(result.styles).toContain('box-shadow')
    })

    it('レベル4のシャドウを返す', () => {
      const result = elevation(4)
      expect(result.styles).toContain('box-shadow')
    })

    it('デフォルトはレベル1', () => {
      const result = elevation()
      const result1 = elevation(1)
      expect(result.styles).toBe(result1.styles)
    })
  })

  describe('baseHeaderRowStyles', () => {
    it('ヘッダー/行番号の基本スタイルを返す', () => {
      const result = baseHeaderRowStyles(theme)
      expect(result.styles).toContain('user-select: none')
      expect(result.styles).toContain('cursor: pointer')
    })
  })

  describe('selectedHeaderRowStyles', () => {
    it('選択状態のヘッダースタイルを返す', () => {
      const result = selectedHeaderRowStyles(theme)
      expect(result.styles).toContain('font-weight: 700')
    })
  })
})
