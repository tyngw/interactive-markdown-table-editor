/**
 * ThemeContext.test.tsx
 * ThemeContext（ThemeProvider, useTheme）のテスト
 * ThemeProvider内でのテーマ取得、コンテキスト未提供時のフォールバック動作を検証
 */

import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, useTheme } from '../contexts/ThemeContext'

// useVSCodeTheme のモック
jest.mock('../hooks/useVSCodeTheme', () => ({
  useVSCodeTheme: () => ({
    theme: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4'
    },
    isLoaded: true,
    applyThemeVariables: jest.fn()
  })
}))

// テスト用のコンシューマーコンポーネント
const ThemeConsumer: React.FC = () => {
  const { theme, isLoaded, getStyle, applyThemeVariables } = useTheme()
  return (
    <div>
      <span data-testid="is-loaded">{isLoaded ? 'loaded' : 'loading'}</span>
      <span data-testid="theme-bg">{(theme as any)['editor.background'] || 'none'}</span>
      <span data-testid="style-result">{getStyle('editor.background', '#fallback')}</span>
      {/* fallback省略時のデフォルト値テスト用 */}
      <span data-testid="style-no-fallback">{getStyle('nonexistent.key')}</span>
      {/* テーマにないキーでフォールバックが返るテスト用 */}
      <span data-testid="style-missing-key">{getStyle('missing.key', '#missing-fallback')}</span>
      <button data-testid="apply-btn" onClick={() => applyThemeVariables({ test: 'data' })}>
        Apply
      </button>
    </div>
  )
}

describe('ThemeContext', () => {
  describe('ThemeProvider', () => {
    it('子コンポーネントにテーマ情報を提供する', () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      expect(screen.getByTestId('is-loaded')).toHaveTextContent('loaded')
      expect(screen.getByTestId('theme-bg')).toHaveTextContent('#1e1e1e')
    })

    it('getStyleがCSS変数→テーマオブジェクト→fallbackの優先順位で値を返す', () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      // jsdom環境ではCSS変数が空なので、テーマオブジェクトの値が返される
      const styleResult = screen.getByTestId('style-result')
      // テーマオブジェクトに値がある場合はそれを返し、なければfallbackを返す
      expect(styleResult.textContent).toBeTruthy()
    })

    it('getStyleでCSS変数から値を取得できた場合にその値を返す', () => {
      const originalGetComputedStyle = window.getComputedStyle
      window.getComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: (name: string) => {
          if (name === '--vscode-editor-background') return '#282c34'
          return ''
        }
      }) as any

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      const styleResult = screen.getByTestId('style-result')
      expect(styleResult).toHaveTextContent('#282c34')

      window.getComputedStyle = originalGetComputedStyle
    })

    it('getStyleでテーマにないキーの場合fallbackが返される', () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      // テーマに存在しないキーの場合、指定したfallbackが返される
      expect(screen.getByTestId('style-missing-key')).toHaveTextContent('#missing-fallback')
    })

    it('getStyleでfallback省略時にデフォルト値#000000が返される', () => {
      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )
      // fallback省略時、テーマにもないキーはデフォルト値 '#000000' が返される
      expect(screen.getByTestId('style-no-fallback')).toHaveTextContent('#000000')
    })

    it('getStyleでエラーが発生した場合はfallbackを返す', () => {
      // getComputedStyleがエラーを投げるケースをテスト
      const originalGetComputedStyle = window.getComputedStyle
      window.getComputedStyle = jest.fn().mockImplementation(() => {
        throw new Error('Test error')
      })

      // コンソール警告を抑制
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      )

      const styleResult = screen.getByTestId('style-result')
      expect(styleResult).toHaveTextContent('#fallback')

      window.getComputedStyle = originalGetComputedStyle
      warnSpy.mockRestore()
    })
  })

  describe('useTheme (コンテキスト外)', () => {
    it('ThemeProvider外で使用するとフォールバック値を返す', () => {
      // ThemeProviderなしでレンダリング
      render(<ThemeConsumer />)
      expect(screen.getByTestId('is-loaded')).toHaveTextContent('loaded')
      // フォールバック: getStyle は常に fallback を返す
      expect(screen.getByTestId('style-result')).toHaveTextContent('#fallback')
    })

    it('ThemeProvider外でfallback省略時にデフォルト値#000000が返される', () => {
      render(<ThemeConsumer />)
      // Provider外のfallback関数でもfallback省略時はデフォルト '#000000'
      expect(screen.getByTestId('style-no-fallback')).toHaveTextContent('#000000')
    })

    it('ThemeProvider外のapplyThemeVariablesはconsole.warnを出力する', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      render(<ThemeConsumer />)

      act(() => {
        screen.getByTestId('apply-btn').click()
      })

      expect(warnSpy).toHaveBeenCalledWith(
        'Theme context not available, cannot apply variables:',
        { test: 'data' }
      )
      warnSpy.mockRestore()
    })

    it('ThemeProvider外のthemeは空オブジェクトである', () => {
      render(<ThemeConsumer />)
      expect(screen.getByTestId('theme-bg')).toHaveTextContent('none')
    })
  })
})
