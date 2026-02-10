/**
 * i18n.test.ts
 * i18nモジュール（src/i18n.ts）のテスト
 *
 * i18n.ts はモジュール読み込み時に即座に実行される。
 * esModuleInterop なしの環境では `import i18n from 'i18next'` が
 * require('i18next').default (=undefined) になるため、
 * jest.mock で i18next に default export を追加してカバレッジを取る。
 */

// i18next を mock して default export を提供する
// i18next は CJS モジュールで default export がないため、
// ts-jest の `import x from 'module'` → `require('module').default` 変換で undefined になる
jest.mock('i18next', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const actual = jest.requireActual('i18next')
  // default を actual 自身に設定（i18next オブジェクト自体が i18n インスタンス）
  return {
    __esModule: true,
    default: actual,
    ...actual
  }
})

let originalLanguage: string

beforeEach(() => {
  originalLanguage = navigator.language
  jest.spyOn(console, 'log').mockImplementation()
  jest.spyOn(console, 'warn').mockImplementation()
})

afterEach(() => {
  jest.restoreAllMocks()
  Object.defineProperty(navigator, 'language', {
    value: originalLanguage,
    writable: true,
    configurable: true
  })
})

/**
 * i18n.ts を隔離ロードするヘルパー
 */
function loadI18nIsolated(): Promise<{ language: string; t: (key: string) => string; hasResourceBundle: (lng: string, ns: string) => boolean; options: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    jest.isolateModules(() => {
      try {
        // i18next mock は上の jest.mock で固定されている
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('../i18n')
        const inst = mod.default || mod
        resolve({
          language: inst.language,
          t: inst.t?.bind(inst),
          hasResourceBundle: inst.hasResourceBundle?.bind(inst),
          options: inst.options
        })
      } catch (e) {
        reject(e)
      }
    })
  })
}

describe('i18n モジュール', () => {
  describe('data-vscode-language 属性からの言語検出', () => {
    it('ja属性 → jaで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('ja')
      const result = await loadI18nIsolated()
      expect(result.language).toBe('ja')
    })

    it('en属性 → enで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('en')
      const result = await loadI18nIsolated()
      expect(result.language).toBe('en')
    })

    it('zh-cn属性 → zh-CNで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('zh-cn')
      const result = await loadI18nIsolated()
      expect(result.language).toBe('zh-CN')
    })

    it('zh_CN属性 → zh-CNで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('zh_CN')
      const result = await loadI18nIsolated()
      expect(result.language).toBe('zh-CN')
    })

    it('zh-TW (中国語バリアント) → zh-CNで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('zh-TW')
      const result = await loadI18nIsolated()
      expect(result.language).toBe('zh-CN')
    })

    it('ja-JP サブタグ → jaで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('ja-JP')
      const result = await loadI18nIsolated()
      expect(result.language).toBe('ja')
    })

    it('en-US サブタグ → enで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('en-US')
      const result = await loadI18nIsolated()
      expect(result.language).toBe('en')
    })
  })

  describe('navigator.language からの言語検出', () => {
    it('属性なし + navigator ja-JP → jaで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue(null)
      Object.defineProperty(navigator, 'language', {
        value: 'ja-JP', writable: true, configurable: true
      })
      const result = await loadI18nIsolated()
      expect(result.language).toBe('ja')
    })

    it('属性なし + navigator zh-CN → zh-CNで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue(null)
      Object.defineProperty(navigator, 'language', {
        value: 'zh-CN', writable: true, configurable: true
      })
      const result = await loadI18nIsolated()
      expect(result.language).toBe('zh-CN')
    })
  })

  describe('フォールバック', () => {
    it('未対応言語 → enで初期化', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue(null)
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR', writable: true, configurable: true
      })
      const result = await loadI18nIsolated()
      expect(result.language).toBe('en')
    })

    it('data-vscode-language が未対応 → navigator.language にフォールバック', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('ko')
      Object.defineProperty(navigator, 'language', {
        value: 'ja', writable: true, configurable: true
      })
      const result = await loadI18nIsolated()
      expect(result.language).toBe('ja')
    })
  })

  describe('development デバッグログ', () => {
    it('NODE_ENV=development でログが出る', async () => {
      const orig = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('en')

      await loadI18nIsolated()
      expect(console.log).toHaveBeenCalledWith('[i18n] Initializing with language:', 'en')
      expect(console.log).toHaveBeenCalledWith('[i18n] Document ready state:', expect.anything())

      process.env.NODE_ENV = orig
    })
  })

  describe('i18n インスタンスの確認', () => {
    it('翻訳関数 t が利用可能', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('ja')
      const result = await loadI18nIsolated()
      expect(typeof result.t).toBe('function')
    })

    it('i18nインスタンスが正しくエクスポートされている', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue('ja')
      const result = await loadI18nIsolated()
      // i18n.init() が呼ばれていること（language が設定されている）
      expect(result.language).toBeDefined()
      expect(result.options).toBeDefined()
    })
  })

  describe('エラーハンドリング', () => {
    it('getAttribute がエラー → navigator.language にフォールバック', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockImplementation(() => {
        throw new Error('getAttribute error')
      })
      Object.defineProperty(navigator, 'language', {
        value: 'ja', writable: true, configurable: true
      })

      const result = await loadI18nIsolated()
      expect(result.language).toBe('ja')
      expect(console.warn).toHaveBeenCalledWith(
        '[i18n] Failed to get VS Code language from attribute',
        expect.any(Error)
      )
    })

    it('navigator.language アクセスがエラー → en にフォールバック', async () => {
      jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue(null)
      Object.defineProperty(navigator, 'language', {
        get() { throw new Error('language error') },
        configurable: true
      })

      const result = await loadI18nIsolated()
      expect(result.language).toBe('en')
      expect(console.warn).toHaveBeenCalledWith(
        '[i18n] Failed to get browser language',
        expect.any(Error)
      )
    })
  })
})
