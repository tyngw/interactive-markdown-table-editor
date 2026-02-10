/**
 * vscodeApi.test.ts
 * vscodeApi（ensureVsCodeApi, getVsCodeApi）のテスト
 * VS Code APIの取得、キャッシュ、エラーハンドリングを検証
 */

import { ensureVsCodeApi, getVsCodeApi } from '../vscodeApi'

describe('vscodeApi', () => {
  let originalWindow: any

  beforeEach(() => {
    // テストごとにウィンドウオブジェクトの状態をクリーンアップ
    originalWindow = { ...window }
    delete (window as any).__mteVscodeApi
    delete (window as any).vscode
    // console.log/warn をモック
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete (window as any).__mteVscodeApi
    delete (window as any).vscode
  })

  describe('ensureVsCodeApi', () => {
    it('window.vscodeが存在する場合はそれを返す', () => {
      const mockApi = { postMessage: jest.fn() }
      const win = {
        vscode: mockApi,
        acquireVsCodeApi: undefined
      } as any
      const result = ensureVsCodeApi(win)
      expect(result).toBe(mockApi)
    })

    it('__mteVscodeApiキャッシュが存在する場合はそれを返す', () => {
      const mockApi = { postMessage: jest.fn() }
      const win = {
        __mteVscodeApi: mockApi,
        acquireVsCodeApi: undefined
      } as any
      const result = ensureVsCodeApi(win)
      expect(result).toBe(mockApi)
    })

    it('acquireVsCodeApiが存在しない場合はnullを返す', () => {
      const win = {} as any
      const result = ensureVsCodeApi(win)
      expect(result).toBeNull()
    })

    it('acquireVsCodeApiで新しいインスタンスを取得できる', () => {
      const mockApi = { postMessage: jest.fn() }
      const win = {
        acquireVsCodeApi: jest.fn().mockReturnValue(mockApi)
      } as any
      const result = ensureVsCodeApi(win)
      expect(result).toBe(mockApi)
      expect(win.acquireVsCodeApi).toHaveBeenCalledTimes(1)
    })

    it('取得したAPIがwindow.vscodeと__mteVscodeApiにキャッシュされる', () => {
      const mockApi = { postMessage: jest.fn() }
      const win = {
        acquireVsCodeApi: jest.fn().mockReturnValue(mockApi)
      } as any
      ensureVsCodeApi(win)
      expect(win.vscode).toBe(mockApi)
      expect(win.__mteVscodeApi).toBe(mockApi)
    })

    it('already-acquiredエラー発生時にキャッシュから取得する', () => {
      const mockApi = { postMessage: jest.fn() }
      const win = {
        acquireVsCodeApi: jest.fn().mockImplementation(() => {
          // acquireVsCodeApi呼び出し時に副作用でキャッシュが設定されるケースをシミュレート
          win.vscode = mockApi
          throw new Error('An instance of the VS Code API has already been acquired')
        })
      } as any

      const result = ensureVsCodeApi(win)
      // 最初のreadCachedApiではキャッシュがないが、エラー後のreadCachedApiでwindow.vscodeが見つかる
      expect(result).toBe(mockApi)
    })

    it('already-acquiredエラー発生時にキャッシュもない場合はnullを返す', () => {
      const win = {
        acquireVsCodeApi: jest.fn().mockImplementation(() => {
          throw new Error('An instance of the VS Code API has already been acquired')
        })
      } as any

      const result = ensureVsCodeApi(win)
      expect(result).toBeNull()
    })

    it('予期しないエラー発生時はnullを返す', () => {
      const win = {
        acquireVsCodeApi: jest.fn().mockImplementation(() => {
          throw new Error('Unexpected error')
        })
      } as any

      const result = ensureVsCodeApi(win)
      expect(result).toBeNull()
    })

    it('外側のtry-catchでエラーが捕捉される', () => {
      // ensureVsCodeApi の最初の try ブロックでエラーが発生するケース
      const win = null as any
      const result = ensureVsCodeApi(win)
      expect(result).toBeNull()
    })

    it('acquireVsCodeApiの戻り値がnullの場合はnullを返す', () => {
      const win = {
        acquireVsCodeApi: jest.fn().mockReturnValue(null)
      } as any
      const result = ensureVsCodeApi(win)
      expect(result).toBeNull()
      // storeCachedApiの !api パスが通ることを確認
      expect(win.__mteVscodeApi).toBeUndefined()
      expect(win.vscode).toBeUndefined()
    })

    it('acquireVsCodeApiの戻り値がundefinedの場合はnullを返す', () => {
      const win = {
        acquireVsCodeApi: jest.fn().mockReturnValue(undefined)
      } as any
      const result = ensureVsCodeApi(win)
      expect(result).toBeNull()
    })

    it('ensureVsCodeApi のデフォルト引数テスト', () => {
      // デフォルト引数 (window) でも動作する
      ;(window as any).vscode = { postMessage: jest.fn() }
      const result = ensureVsCodeApi()
      expect(result).toBe((window as any).vscode)
    })

    it('window.vscodeが優先される（__mteVscodeApiよりも先にチェック）', () => {
      const mockApi1 = { id: 'vscode' }
      const mockApi2 = { id: 'cached' }
      const win = {
        vscode: mockApi1,
        __mteVscodeApi: mockApi2,
        acquireVsCodeApi: jest.fn()
      } as any

      const result = ensureVsCodeApi(win)
      expect(result).toBe(mockApi1)
      expect(win.acquireVsCodeApi).not.toHaveBeenCalled()
    })
  })

  describe('getVsCodeApi', () => {
    it('ensureVsCodeApiと同じ結果を返す', () => {
      const mockApi = { postMessage: jest.fn() }
      const win = {
        vscode: mockApi
      } as any
      const result = getVsCodeApi(win)
      expect(result).toBe(mockApi)
    })

    it('デフォルト引数としてwindowを使用する', () => {
      // windowにモックAPIを設定
      ;(window as any).vscode = { postMessage: jest.fn() }
      const result = getVsCodeApi()
      expect(result).toBe((window as any).vscode)
    })
  })
})
