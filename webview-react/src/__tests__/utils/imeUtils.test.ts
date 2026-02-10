/**
 * imeUtils のユニットテスト
 * IME 確定判定関連のユーティリティをテスト
 */
import { isImeComposing, isImeConfirmingEnter } from '../../utils/imeUtils'

describe('imeUtils', () => {
  describe('isImeComposing', () => {
    test('returns true when nativeEvent.isComposing is true', () => {
      const event = {
        nativeEvent: { isComposing: true }
      } as unknown as React.KeyboardEvent
      expect(isImeComposing(event)).toBe(true)
    })

    test('returns false when nativeEvent.isComposing is false', () => {
      const event = {
        nativeEvent: { isComposing: false }
      } as unknown as React.KeyboardEvent
      expect(isImeComposing(event)).toBe(false)
    })

    test('returns false when nativeEvent.isComposing is undefined', () => {
      const event = {
        nativeEvent: {}
      } as unknown as React.KeyboardEvent
      expect(isImeComposing(event)).toBe(false)
    })
  })

  describe('isImeConfirmingEnter', () => {
    test('returns true when Enter key and composing', () => {
      const event = {
        key: 'Enter',
        nativeEvent: { isComposing: true }
      } as unknown as React.KeyboardEvent
      expect(isImeConfirmingEnter(event)).toBe(true)
    })

    test('returns false when Enter key but not composing', () => {
      const event = {
        key: 'Enter',
        nativeEvent: { isComposing: false }
      } as unknown as React.KeyboardEvent
      expect(isImeConfirmingEnter(event)).toBe(false)
    })

    test('returns false when not Enter key even if composing', () => {
      const event = {
        key: 'a',
        nativeEvent: { isComposing: true }
      } as unknown as React.KeyboardEvent
      expect(isImeConfirmingEnter(event)).toBe(false)
    })
  })
})
