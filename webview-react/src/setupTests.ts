import '@testing-library/jest-dom'

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