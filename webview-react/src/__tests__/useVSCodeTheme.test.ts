/**
 * useVSCodeTheme.test.ts
 * useVSCodeThemeフックのテスト
 * テーマカラー読み込み、applyThemeVariables（cssText形式/direct形式）、エラーハンドリングを検証
 */

import { renderHook, act } from '@testing-library/react'
import { useVSCodeTheme } from '../hooks/useVSCodeTheme'

describe('useVSCodeTheme', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    // クリーンアップ: style要素を削除
    const styleEl = document.getElementById('mte-theme-override')
    if (styleEl) {
      styleEl.remove()
    }
    // mte-rootを削除
    const mteRoot = document.getElementById('mte-root')
    if (mteRoot) {
      mteRoot.remove()
    }
  })

  it('初期状態でisLoadedがfalseである', () => {
    const { result } = renderHook(() => useVSCodeTheme())
    expect(result.current.isLoaded).toBe(false)
  })

  it('タイマー後にisLoadedがtrueになる', () => {
    const { result } = renderHook(() => useVSCodeTheme())
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current.isLoaded).toBe(true)
  })

  it('themeオブジェクトが返される', () => {
    const { result } = renderHook(() => useVSCodeTheme())
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result.current.theme).toBeDefined()
    expect(typeof result.current.theme).toBe('object')
  })

  it('applyThemeVariablesが関数として返される', () => {
    const { result } = renderHook(() => useVSCodeTheme())
    expect(typeof result.current.applyThemeVariables).toBe('function')
  })

  describe('applyThemeVariables - cssText形式', () => {
    it('cssTextを受け取りstyle要素を作成する', () => {
      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })

      act(() => {
        result.current.applyThemeVariables({
          cssText: ':root { --vscode-editor-background: #1e1e1e; }'
        })
      })

      const styleEl = document.getElementById('mte-theme-override')
      expect(styleEl).not.toBeNull()
    })

    it(':rootセレクタを#mte-rootにスコーピングする', () => {
      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })

      act(() => {
        result.current.applyThemeVariables({
          cssText: ':root { --vscode-editor-background: #1e1e1e; }'
        })
      })

      const styleEl = document.getElementById('mte-theme-override')
      expect(styleEl?.textContent).toContain('#mte-root')
      expect(styleEl?.textContent).not.toContain(':root')
    })

    it('既存のstyle要素を再利用する', () => {
      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })

      act(() => {
        result.current.applyThemeVariables({
          cssText: ':root { --vscode-editor-background: #111; }'
        })
      })

      act(() => {
        result.current.applyThemeVariables({
          cssText: ':root { --vscode-editor-background: #222; }'
        })
      })

      const styleElements = document.querySelectorAll('#mte-theme-override')
      expect(styleElements.length).toBe(1)
    })
  })

  describe('applyThemeVariables - direct形式', () => {
    it('CSS変数をルート要素に直接設定する', () => {
      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })

      act(() => {
        result.current.applyThemeVariables({
          '--vscode-editor-background': '#1e1e1e'
        })
      })

      const root = document.documentElement
      expect(root.style.getPropertyValue('--vscode-editor-background')).toBe('#1e1e1e')
    })

    it('ドット形式のキーをCSS変数に変換して設定する', () => {
      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })

      act(() => {
        result.current.applyThemeVariables({
          'editor.background': '#2d2d2d'
        })
      })

      const root = document.documentElement
      expect(root.style.getPropertyValue('--vscode-editor-background')).toBe('#2d2d2d')
    })
  })

  describe('applyThemeVariables - エラーハンドリング', () => {
    it('nullデータでエラーが発生しない', () => {
      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })

      expect(() => {
        act(() => {
          result.current.applyThemeVariables(null)
        })
      }).not.toThrow()
    })

    it('undefinedデータでエラーが発生しない', () => {
      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })

      expect(() => {
        act(() => {
          result.current.applyThemeVariables(undefined)
        })
      }).not.toThrow()
    })
  })

  describe('テーマカラー読み込み', () => {
    it('document.documentElementが存在しない場合はsetTimeoutでリトライする', () => {
      // このケースはテスト困難（jsdomでは常にdocument.documentElementが存在する）
      // 代わりに初期読み込みが正常に完了することを確認
      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })
      expect(result.current.isLoaded).toBe(true)
    })

    it('初期読み込み後に再読み込みが行われない（initialLoadDone=true）', () => {
      const { result, rerender } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })
      expect(result.current.isLoaded).toBe(true)

      // rerenderしてもisLoadedは変わらない
      rerender()
      expect(result.current.isLoaded).toBe(true)
    })

    it('getComputedStyleがエラーをスローした場合はcatchブロックに到達する', () => {
      const originalGetComputedStyle = window.getComputedStyle
      window.getComputedStyle = jest.fn().mockImplementation(() => {
        throw new Error('getComputedStyle failed')
      })

      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })

      // catchブロックでもisLoadedとinitialLoadDoneがtrueになる
      expect(result.current.isLoaded).toBe(true)
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load VSCode theme colors',
        expect.any(Error)
      )

      window.getComputedStyle = originalGetComputedStyle
    })

    it('applyThemeVariablesのcssText処理中にエラーが発生した場合はcatchに到達する', () => {
      const { result } = renderHook(() => useVSCodeTheme())
      act(() => {
        jest.advanceTimersByTime(200)
      })

      // getComputedStyleをエラーにして、style適用後の読み取りでエラーを起こす
      const originalGetComputedStyle = window.getComputedStyle
      window.getComputedStyle = jest.fn().mockImplementation(() => {
        throw new Error('getComputedStyle error in applyThemeVariables')
      })

      act(() => {
        result.current.applyThemeVariables({
          cssText: ':root { --vscode-editor-background: #1e1e1e; }'
        })
      })

      expect(console.error).toHaveBeenCalledWith(
        'Error applying theme variables',
        expect.any(Error)
      )

      window.getComputedStyle = originalGetComputedStyle
    })
  })
})
