import '@testing-library/jest-dom'

// import.meta のポリフィル（Vite の import.meta.env を Jest で使えるようにする）
// ts-jest は import.meta をサポートしないため、グローバルに定義する
if (typeof (global as any).importMeta === 'undefined') {
  Object.defineProperty(global, 'importMeta', {
    value: { env: {} },
    writable: true,
    configurable: true
  })
}

// テスト環境用 i18n 初期化（日本語をデフォルトにする）
// esModuleInterop が無効なため、require を使用
/* eslint-disable @typescript-eslint/no-var-requires */
const i18n = require('i18next') as typeof import('i18next')
const { initReactI18next } = require('react-i18next')
const en = require('./locales/en.json')
const ja = require('./locales/ja.json')
const zhCN = require('./locales/zh-cn.json')
/* eslint-enable @typescript-eslint/no-var-requires */

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ja: { translation: ja },
    'zh-cn': { translation: zhCN }
  },
  lng: 'ja',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

// VSCode API のグローバルモック
Object.defineProperty(window, 'acquireVsCodeApi', {
  value: () => ({
    postMessage: jest.fn(),
    setState: jest.fn(),
    getState: jest.fn()
  }),
  writable: true
})

// ResizeObserver のモック
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// matchMedia のモック
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
})

// カスタムイベントのモック
global.CustomEvent = class CustomEvent<T = any> extends Event {
  detail: T
  
  constructor(type: string, options?: CustomEventInit<T>) {
    super(type, options)
    this.detail = options?.detail as T
  }
  
  initCustomEvent(_type: string, _bubbles?: boolean, _cancelable?: boolean, _detail?: T): void {
    // Legacy method - not used in modern browsers but required by TypeScript
  }
} as any