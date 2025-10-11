import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import CellEditor from '../components/CellEditor'

describe('CellEditor clipboard operations', () => {
  const mockOnCommit = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const setup = (value = 'test content') => {
    return render(
      <CellEditor
        value={value}
        onCommit={mockOnCommit}
        onCancel={mockOnCancel}
      />
    )
  }

  test('Cmd+C should not be blocked by stopPropagation', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    // テキストを選択
    textarea.focus()
    textarea.setSelectionRange(0, 4) // "test"を選択

    // Cmd+Cイベントを発火
    const copyEvent = new KeyboardEvent('keydown', {
      key: 'c',
      metaKey: true,
      bubbles: true,
      cancelable: true
    })

    const preventDefaultSpy = jest.spyOn(copyEvent, 'preventDefault')
    const stopPropagationSpy = jest.spyOn(copyEvent, 'stopPropagation')

    textarea.dispatchEvent(copyEvent)

    // Cmd+Cはブロックされないこと
    expect(preventDefaultSpy).not.toHaveBeenCalled()
    expect(stopPropagationSpy).not.toHaveBeenCalled()
  })

  test('Cmd+V should not be blocked by stopPropagation', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    textarea.focus()

    // Cmd+Vイベントを発火
    const pasteEvent = new KeyboardEvent('keydown', {
      key: 'v',
      metaKey: true,
      bubbles: true,
      cancelable: true
    })

    const preventDefaultSpy = jest.spyOn(pasteEvent, 'preventDefault')
    const stopPropagationSpy = jest.spyOn(pasteEvent, 'stopPropagation')

    textarea.dispatchEvent(pasteEvent)

    // Cmd+Vはブロックされないこと
    expect(preventDefaultSpy).not.toHaveBeenCalled()
    expect(stopPropagationSpy).not.toHaveBeenCalled()
  })

  test('Cmd+X should not be blocked by stopPropagation', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    textarea.focus()
    textarea.setSelectionRange(0, 4)

    // Cmd+Xイベントを発火
    const cutEvent = new KeyboardEvent('keydown', {
      key: 'x',
      metaKey: true,
      bubbles: true,
      cancelable: true
    })

    const preventDefaultSpy = jest.spyOn(cutEvent, 'preventDefault')
    const stopPropagationSpy = jest.spyOn(cutEvent, 'stopPropagation')

    textarea.dispatchEvent(cutEvent)

    // Cmd+Xはブロックされないこと
    expect(preventDefaultSpy).not.toHaveBeenCalled()
    expect(stopPropagationSpy).not.toHaveBeenCalled()
  })

  test('Cmd+A should not be blocked by stopPropagation', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    textarea.focus()

    // Cmd+Aイベントを発火
    const selectAllEvent = new KeyboardEvent('keydown', {
      key: 'a',
      metaKey: true,
      bubbles: true,
      cancelable: true
    })

    const preventDefaultSpy = jest.spyOn(selectAllEvent, 'preventDefault')
    const stopPropagationSpy = jest.spyOn(selectAllEvent, 'stopPropagation')

    textarea.dispatchEvent(selectAllEvent)

    // Cmd+Aはブロックされないこと
    expect(preventDefaultSpy).not.toHaveBeenCalled()
    expect(stopPropagationSpy).not.toHaveBeenCalled()
  })

  test('Enter key should call stopPropagation', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    textarea.focus()

    // Enterイベントを発火
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    })

    const stopPropagationSpy = jest.spyOn(enterEvent, 'stopPropagation')

    textarea.dispatchEvent(enterEvent)

    // EnterはstopPropagationが呼ばれること
    expect(stopPropagationSpy).toHaveBeenCalled()
    expect(mockOnCommit).toHaveBeenCalled()
  })

  test('Tab key should call stopPropagation', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    textarea.focus()

    // Tabイベントを発火
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    })

    const stopPropagationSpy = jest.spyOn(tabEvent, 'stopPropagation')

    textarea.dispatchEvent(tabEvent)

    // Tabはstop Propagationが呼ばれること
    expect(stopPropagationSpy).toHaveBeenCalled()
    expect(mockOnCommit).toHaveBeenCalled()
  })

  test('Escape key should call stopPropagation', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    textarea.focus()

    // Escapeイベントを発火
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    })

    const stopPropagationSpy = jest.spyOn(escapeEvent, 'stopPropagation')

    textarea.dispatchEvent(escapeEvent)

    // Escapeはstop Propagationが呼ばれること
    expect(stopPropagationSpy).toHaveBeenCalled()
    expect(mockOnCancel).toHaveBeenCalled()
  })

  test('Cmd+Z (undo) should call stopPropagation', () => {
    setup()
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

    textarea.focus()

    // Cmd+Zイベントを発火
    const undoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      cancelable: true
    })

    const stopPropagationSpy = jest.spyOn(undoEvent, 'stopPropagation')

    textarea.dispatchEvent(undoEvent)

    // Cmd+Zはstop Propagationが呼ばれること（VSCodeのUndoを防ぐため）
    expect(stopPropagationSpy).toHaveBeenCalled()
  })
})
