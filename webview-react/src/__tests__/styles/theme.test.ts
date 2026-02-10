/**
 * theme.test.ts
 * styles/theme.ts のgetVSCodeTheme関数のテスト
 * CSS変数から値が取得できる場合とフォールバック値の動作を検証
 */

import { getVSCodeTheme } from '../../styles/theme'

describe('theme.ts', () => {
  describe('getVSCodeTheme', () => {
    it('テーマオブジェクトを返す', () => {
      const theme = getVSCodeTheme()
      expect(theme).toBeDefined()
      expect(theme.editorBackground).toBeDefined()
      expect(theme.editorForeground).toBeDefined()
    })

    it('jsdom環境ではフォールバック値が返される', () => {
      const theme = getVSCodeTheme()
      // jsdomではCSS変数が未設定なのでフォールバック値が使われる
      expect(theme.editorBackground).toBe('#1e1e1e')
      expect(theme.editorForeground).toBe('#d4d4d4')
    })

    it('CSS変数が設定されている場合はその値が返される', () => {
      // getComputedStyleをモックしてCSS変数を返す
      const originalGetComputedStyle = window.getComputedStyle
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (name: string) => {
          if (name === '--vscode-editor-background') return '#282c34'
          if (name === '--vscode-editor-foreground') return '#abb2bf'
          return ''
        }
      })

      const theme = getVSCodeTheme()
      expect(theme.editorBackground).toBe('#282c34')
      expect(theme.editorForeground).toBe('#abb2bf')

      window.getComputedStyle = originalGetComputedStyle
    })

    it('mte-rootエレメントがあればそこからスタイルを取得する', () => {
      const el = document.createElement('div')
      el.id = 'mte-root'
      document.body.appendChild(el)

      const theme = getVSCodeTheme()
      expect(theme).toBeDefined()

      document.body.removeChild(el)
    })

    it('rootエレメントがあればそこからスタイルを取得する（mte-rootがない場合）', () => {
      const el = document.createElement('div')
      el.id = 'root'
      document.body.appendChild(el)

      const theme = getVSCodeTheme()
      expect(theme).toBeDefined()

      document.body.removeChild(el)
    })
  })
})
