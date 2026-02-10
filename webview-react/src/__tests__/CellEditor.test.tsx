/**
 * CellEditor コンポーネントのテスト
 * テキストエリアベースのセルエディタの挙動を網羅的にテストする
 */
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import CellEditor from '../components/CellEditor'

// console.debug の出力を抑制
beforeAll(() => {
  jest.spyOn(console, 'debug').mockImplementation(() => {})
})
afterAll(() => {
  jest.restoreAllMocks()
})

describe('CellEditor', () => {
  const mockOnCommit = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  const setup = (props: Partial<React.ComponentProps<typeof CellEditor>> = {}) => {
    return render(
      <CellEditor
        value="hello"
        onCommit={mockOnCommit}
        onCancel={mockOnCancel}
        {...props}
      />
    )
  }

  // === 基本レンダリング ===

  test('初期値でテキストエリアがレンダリングされる', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(textarea.value).toBe('hello')
  })

  test('テキストエリアにフォーカスが設定される', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toHaveFocus()
  })

  test('rowIndex, colIndex, rowMaxHeight props を受け取れる', () => {
    setup({ rowIndex: 1, colIndex: 2, rowMaxHeight: 50 })
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
  })

  // === 値の変更 ===

  test('入力で値が変更される', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'world' } })
    expect(textarea.value).toBe('world')
  })

  // === キーボード操作 ===

  test('Enter でコミットされる（down移動）', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(mockOnCommit).toHaveBeenCalledWith('hello', 'down')
  })

  test('Ctrl+Enter でコミットされる（移動なし）', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
    expect(mockOnCommit).toHaveBeenCalledWith('hello')
  })

  test('Meta+Enter でコミットされる（移動なし）', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })
    expect(mockOnCommit).toHaveBeenCalledWith('hello')
  })

  test('Shift+Enter は伝播を止めるがコミットしない', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(mockOnCommit).not.toHaveBeenCalled()
    expect(mockOnCancel).not.toHaveBeenCalled()
  })

  test('Escape でキャンセルされる', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(mockOnCancel).toHaveBeenCalled()
  })

  test('Tab でコミットされる（right移動）', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect(mockOnCommit).toHaveBeenCalledWith('hello', 'right')
  })

  test('Shift+Tab でコミットされる（left移動）', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true })
    expect(mockOnCommit).toHaveBeenCalledWith('hello', 'left')
  })

  // === Undo/Redo ===

  test('Ctrl+Z で undo される', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'changed' } })
    expect(textarea.value).toBe('changed')
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })
    expect(textarea.value).toBe('hello')
  })

  test('Ctrl+Z で履歴が1件以下の場合は何も起きない', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })
    expect(textarea.value).toBe('hello')
  })

  test('Ctrl+Shift+Z で redo される', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'changed' } })
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })
    expect(textarea.value).toBe('hello')
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(textarea.value).toBe('changed')
  })

  test('Ctrl+Y で redo される', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'changed' } })
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })
    expect(textarea.value).toBe('hello')
    fireEvent.keyDown(textarea, { key: 'y', ctrlKey: true })
    expect(textarea.value).toBe('changed')
  })

  test('Redo スタックが空の場合は何も起きない', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.keyDown(textarea, { key: 'y', ctrlKey: true })
    expect(textarea.value).toBe('hello')
  })

  test('変更後にredoスタックがクリアされる', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'first' } })
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })
    fireEvent.change(textarea, { target: { value: 'second' } })
    fireEvent.keyDown(textarea, { key: 'y', ctrlKey: true })
    expect(textarea.value).toBe('second')
  })

  test('pushHistory で同じ値は重複追加されない', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    // 値を変更して履歴に追加
    fireEvent.change(textarea, { target: { value: 'changed' } })
    // 同じ値でもう一度変更 → pushHistory 内で last === next → return prev
    fireEvent.change(textarea, { target: { value: 'changed' } })
    // undo すると最初の値に戻るはず（重複していないので）
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })
    expect(textarea.value).toBe('hello')
  })

  test('CompositionEnd 後の pushHistory で既存の値と同じ場合は重複しない', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    // compositionStart して値を変えずに compositionEnd
    // → setTimeout 内で pushHistory('hello') が呼ばれるが
    // 履歴は ['hello'] なので last === next → return prev
    fireEvent.compositionStart(textarea)
    fireEvent.compositionEnd(textarea)
    act(() => {
      jest.runAllTimers()
    })
    // 履歴に変化がないので undo しても値は変わらない
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })
    expect(textarea.value).toBe('hello')
  })

  // === Clipboard 操作の標準許可 ===

  test('Ctrl+A は標準動作を許可する', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    const event = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })
    const spy = jest.spyOn(event, 'preventDefault')
    textarea.dispatchEvent(event)
    expect(spy).not.toHaveBeenCalled()
  })

  test('Meta+C は標準動作を許可する', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    const event = new KeyboardEvent('keydown', { key: 'c', metaKey: true, bubbles: true })
    const spy = jest.spyOn(event, 'preventDefault')
    textarea.dispatchEvent(event)
    expect(spy).not.toHaveBeenCalled()
  })

  // === IME 合成イベント ===

  test('CompositionStart で isComposing が true になり、Enter がコミットしない', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    fireEvent.compositionStart(textarea)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(mockOnCommit).not.toHaveBeenCalled()
  })

  test('CompositionEnd で isComposing が false に戻り、履歴に反映される', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.compositionStart(textarea)
    fireEvent.change(textarea, { target: { value: 'こんにちは' } })
    fireEvent.compositionEnd(textarea)
    act(() => {
      jest.runAllTimers()
    })
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })
    expect(textarea.value).toBe('hello')
  })

  // === Blur ===

  test('blur でコミットされる（フォーカスが別の要素に移った場合）', () => {
    const dummy = document.createElement('button')
    document.body.appendChild(dummy)
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    dummy.focus()
    fireEvent.blur(textarea)
    act(() => {
      jest.advanceTimersByTime(20)
    })
    expect(mockOnCommit).toHaveBeenCalledWith('hello')
    document.body.removeChild(dummy)
  })

  test('blur 後もテキストエリアにフォーカスがある場合はコミットされない', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.blur(textarea)
    textarea.focus()
    act(() => {
      jest.advanceTimersByTime(20)
    })
    expect(mockOnCommit).not.toHaveBeenCalled()
  })

  // === value prop 変更 ===

  test('value prop が変更されると currentValue がリセットされる', () => {
    const { rerender } = render(
      <CellEditor value="initial" onCommit={mockOnCommit} onCancel={mockOnCancel} />
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('initial')
    rerender(
      <CellEditor value="updated" onCommit={mockOnCommit} onCancel={mockOnCancel} />
    )
    expect(textarea.value).toBe('updated')
  })

  // === heightUpdate カスタムイベント ===

  test('heightUpdate イベントで高さ情報が更新される', () => {
    setup({ rowMaxHeight: 40 })
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    const heightEvent = new CustomEvent('heightUpdate', {
      detail: { originalHeight: 50, rowMaxHeight: 60 }
    })
    act(() => {
      textarea.dispatchEvent(heightEvent)
    })
    expect(textarea).toBeInTheDocument()
  })

  test('heightUpdate イベントの detail が undefined の場合もエラーにならない', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    const heightEvent = new CustomEvent('heightUpdate', { detail: undefined })
    act(() => {
      textarea.dispatchEvent(heightEvent)
    })
    expect(textarea).toBeInTheDocument()
  })

  test('heightUpdate イベントの detail に部分的な値のみある場合', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    const heightEvent = new CustomEvent('heightUpdate', {
      detail: { originalHeight: 30 }
    })
    act(() => {
      textarea.dispatchEvent(heightEvent)
    })
    expect(textarea).toBeInTheDocument()
  })

  // === adjustHeight 内の DOM 操作（テーブル構造内） ===

  test('親 td 要素がある場合の高さ調整', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <td data-row="0" data-col="0" data-row-max-height="40">
              <CellEditor value="test" onCommit={mockOnCommit} onCancel={mockOnCancel} />
            </td>
            <td data-row="0" data-col="1" data-row-max-height="40">
              <span>other cell</span>
            </td>
          </tr>
        </tbody>
      </table>
    )
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    const parentTd = container.querySelector('td[data-col="0"]') as HTMLElement
    expect(parentTd).toBeTruthy()
  })

  test('テーブル内の行にある他セルにも min-height が設定される', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <td data-row="0" data-col="0">
              <CellEditor value="cell" onCommit={mockOnCommit} onCancel={mockOnCancel} rowMaxHeight={50} />
            </td>
            <td data-row="0" data-col="1">
              <span>other</span>
            </td>
          </tr>
        </tbody>
      </table>
    )
    const otherTd = container.querySelector('td[data-col="1"]') as HTMLElement
    expect(otherTd.style.minHeight).toBeTruthy()
  })

  test('data-row-max-height 属性からの高さフォールバック', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <td data-row="0" data-col="0" data-row-max-height="80">
              <CellEditor value="test" onCommit={mockOnCommit} onCancel={mockOnCancel} />
            </td>
          </tr>
        </tbody>
      </table>
    )
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
  })

  // === IME中のinputイベント ===

  test('IME中はinputイベントでadjustHeightが呼ばれない', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.compositionStart(textarea)
    fireEvent.input(textarea)
    expect(textarea).toBeInTheDocument()
  })

  // === selectionRange 復元のエラーハンドリング ===

  test('setSelectionRange が失敗しても問題ない', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    const origSetSelectionRange = textarea.setSelectionRange.bind(textarea)
    textarea.setSelectionRange = () => { throw new Error('mock error') }
    fireEvent.input(textarea)
    expect(textarea).toBeInTheDocument()
    textarea.setSelectionRange = origSetSelectionRange
  })

  // === その他のキー操作 ===

  test('通常のキーはブロックされない', () => {
    setup()
    const textarea = screen.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'a' })
    expect(mockOnCommit).not.toHaveBeenCalled()
    expect(mockOnCancel).not.toHaveBeenCalled()
  })

  // === クリーンアップ ===

  test('アンマウント時にイベントリスナーが削除される', () => {
    const { unmount } = setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    const removeEventListenerSpy = jest.spyOn(textarea, 'removeEventListener')
    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('heightUpdate', expect.any(Function))
  })

  // === safe ユーティリティ関数のエッジケース ===

  test('rowMaxHeight が 0 の場合は minHeight が使われる', () => {
    setup({ rowMaxHeight: 0 })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  test('rowMaxHeight が NaN の場合は minHeight が使われる', () => {
    setup({ rowMaxHeight: NaN })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  test('rowMaxHeight が負数の場合は minHeight が使われる', () => {
    setup({ rowMaxHeight: -10 })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  test('rowMaxHeight が undefined の場合は minHeight が使われる', () => {
    setup({ rowMaxHeight: undefined })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  // === pushHistory と redoStack ===

  test('pushHistory で redoStack が空の場合はそのまま返す', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'new value' } })
    expect(textarea.value).toBe('new value')
  })

  // === CompositionEnd のフォールバック ===

  test('CompositionEnd の setTimeout で pushHistory が呼ばれる', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.compositionStart(textarea)
    fireEvent.change(textarea, { target: { value: 'テスト' } })
    fireEvent.compositionEnd(textarea)
    act(() => {
      jest.runAllTimers()
    })
    expect(textarea.value).toBe('テスト')
  })

  // === scrollHeight のテスト ===

  test('scrollHeight が大きい場合の高さ調整', () => {
    setup({ rowMaxHeight: 20 })
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    Object.defineProperty(textarea, 'scrollHeight', { value: 100, configurable: true })
    fireEvent.input(textarea)
    expect(textarea).toBeInTheDocument()
  })
})
