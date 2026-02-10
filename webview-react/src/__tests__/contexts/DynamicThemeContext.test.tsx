/**
 * DynamicThemeContext.test.tsx
 * DynamicThemeProvider / useDynamicTheme のテスト
 * Provider内でのテーマ取得・更新、Provider外でのエラースローを検証
 */

import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DynamicThemeProvider, useDynamicTheme } from '../../contexts/DynamicThemeContext'
import { getVSCodeTheme, VSCodeTheme } from '../../styles/theme'

// テスト用のコンシューマーコンポーネント
const ThemeConsumer: React.FC = () => {
  const { theme, setTheme } = useDynamicTheme()
  return (
    <div>
      <span data-testid="bg">{theme.editorBackground}</span>
      <span data-testid="fg">{theme.editorForeground}</span>
      <span data-testid="status-bg">{theme.statusBarBackground}</span>
      <button
        data-testid="update-btn"
        onClick={() =>
          setTheme({
            ...theme,
            editorBackground: '#000000',
            statusBarBackground: '#ff0000',
          })
        }
      >
        Update
      </button>
    </div>
  )
}

describe('DynamicThemeContext', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('DynamicThemeProvider', () => {
    it('子コンポーネントにテーマ情報を提供する', () => {
      render(
        <DynamicThemeProvider>
          <ThemeConsumer />
        </DynamicThemeProvider>
      )
      // getVSCodeTheme のデフォルトフォールバック値が使用される（jsdom環境ではCSS変数が空）
      const initialTheme = getVSCodeTheme()
      expect(screen.getByTestId('bg')).toHaveTextContent(initialTheme.editorBackground)
    })

    it('setThemeでテーマが更新される', () => {
      render(
        <DynamicThemeProvider>
          <ThemeConsumer />
        </DynamicThemeProvider>
      )

      act(() => {
        screen.getByTestId('update-btn').click()
      })

      expect(screen.getByTestId('bg')).toHaveTextContent('#000000')
      expect(screen.getByTestId('status-bg')).toHaveTextContent('#ff0000')
    })
  })

  describe('useDynamicTheme (コンテキスト外)', () => {
    it('DynamicThemeProvider外で使用するとエラーがスローされる', () => {
      // エラー出力を抑制
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      expect(() => {
        render(<ThemeConsumer />)
      }).toThrow('useDynamicTheme must be used within DynamicThemeProvider')

      errorSpy.mockRestore()
    })
  })
})
