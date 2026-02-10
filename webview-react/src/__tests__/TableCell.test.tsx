/**
 * TableCell.test.tsx
 * TableCellコンポーネントのテスト
 * セルの表示、編集モード、キーボード操作、IME対応、blurによる編集完了を検証
 */

import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// ContentConverter のモック（contentConverter.ts は名前付き関数エクスポートだが、
// TableCell.tsx は { ContentConverter } としてクラス風にインポートしているためモックが必要）
jest.mock('../utils/contentConverter', () => ({
  ContentConverter: {
    processForEditing: (val: string) => val.replace(/<br\s*\/?>/gi, '\n'),
    processForStorage: (val: string) => val.replace(/\n/g, '<br/>'),
    brTagsToNewlines: (val: string) => val.replace(/<br\s*\/?>/gi, '\n'),
  }
}))

import TableCell from '../components/TableCell'

describe('TableCell', () => {
  const mockOnClick = jest.fn()
  const mockOnDoubleClick = jest.fn()
  const mockOnUpdate = jest.fn()
  const mockOnEditComplete = jest.fn()

  const defaultProps = {
    value: 'test value',
    row: 0,
    col: 0,
    isSelected: false,
    isEditing: false,
    onClick: mockOnClick,
    onDoubleClick: mockOnDoubleClick,
    onUpdate: mockOnUpdate,
    onEditComplete: mockOnEditComplete,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const renderInTable = (props = {}) => {
    return render(
      <table>
        <tbody>
          <tr>
            <TableCell {...defaultProps} {...props} />
          </tr>
        </tbody>
      </table>
    )
  }

  describe('表示モード', () => {
    it('セルの値が表示される', () => {
      renderInTable()
      expect(screen.getByText('test value')).toBeInTheDocument()
    })

    it('空の値の場合はNBSPが表示される', () => {
      const { container } = renderInTable({ value: '' })
      const cellContent = container.querySelector('.cell-content')
      // jsdom では \u00A0 が &nbsp; としてシリアライズされる
      expect(cellContent?.innerHTML).toMatch(/\u00A0|&nbsp;/)
    })

    it('クリックするとonClickが呼ばれる', async () => {
      const user = userEvent.setup()
      renderInTable()
      const cell = screen.getByText('test value').closest('td')!
      await user.click(cell)
      expect(mockOnClick).toHaveBeenCalledWith(0, 0, expect.any(Object))
    })

    it('ダブルクリックするとonDoubleClickが呼ばれる', () => {
      renderInTable()
      const cell = screen.getByText('test value').closest('td')!
      fireEvent.doubleClick(cell)
      expect(mockOnDoubleClick).toHaveBeenCalledWith(0, 0)
    })

    it('isSelected=trueの場合にselectedクラスが付く', () => {
      renderInTable({ isSelected: true })
      const cell = screen.getByText('test value').closest('td')!
      expect(cell.className).toContain('selected')
    })

    it('isSearchResult=trueの場合にsearch-resultクラスが付く', () => {
      renderInTable({ isSearchResult: true })
      const cell = screen.getByText('test value').closest('td')!
      expect(cell.className).toContain('search-result')
    })

    it('isCurrentSearchResult=trueの場合にcurrent-search-resultクラスが付く', () => {
      renderInTable({ isCurrentSearchResult: true })
      const cell = screen.getByText('test value').closest('td')!
      expect(cell.className).toContain('current-search-result')
    })

    it('columnWidthが指定されている場合はそれが適用される', () => {
      renderInTable({ columnWidth: 200 })
      const cell = screen.getByText('test value').closest('td')!
      expect(cell.style.width).toBe('200px')
    })

    it('columnWidthが指定されていない場合はデフォルト150pxが適用される', () => {
      renderInTable()
      const cell = screen.getByText('test value').closest('td')!
      expect(cell.style.width).toBe('150px')
    })

    it('正しいrow, colでonClickが呼ばれる', async () => {
      const user = userEvent.setup()
      renderInTable({ row: 2, col: 3 })
      const cell = screen.getByText('test value').closest('td')!
      await user.click(cell)
      expect(mockOnClick).toHaveBeenCalledWith(2, 3, expect.any(Object))
    })
  })

  describe('編集モード', () => {
    it('isEditing=trueの場合にtextareaが表示される', () => {
      renderInTable({ isEditing: true })
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
    })

    it('textareaに現在の値が設定される', () => {
      renderInTable({ isEditing: true })
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('test value')
    })

    it('Enterキーで編集が完了する', () => {
      renderInTable({ isEditing: true, value: 'original' })
      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'new value' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })
      expect(mockOnUpdate).toHaveBeenCalledWith(0, 0, 'new value')
      expect(mockOnEditComplete).toHaveBeenCalled()
    })

    it('Shift+Enterでは編集が完了しない（改行挿入）', () => {
      renderInTable({ isEditing: true })
      const textarea = screen.getByRole('textbox')
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
      expect(mockOnEditComplete).not.toHaveBeenCalled()
    })

    it('Escapeキーで編集がキャンセルされる', () => {
      renderInTable({ isEditing: true, value: 'original' })
      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'changed' } })
      fireEvent.keyDown(textarea, { key: 'Escape' })
      expect(mockOnUpdate).not.toHaveBeenCalled()
      expect(mockOnEditComplete).toHaveBeenCalled()
    })

    it('Tabキーで編集が完了する', () => {
      renderInTable({ isEditing: true, value: 'original' })
      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'tab value' } })
      fireEvent.keyDown(textarea, { key: 'Tab' })
      expect(mockOnUpdate).toHaveBeenCalledWith(0, 0, 'tab value')
      expect(mockOnEditComplete).toHaveBeenCalled()
    })

    it('blurで編集が完了する', () => {
      renderInTable({ isEditing: true, value: 'original' })
      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'blur value' } })
      fireEvent.blur(textarea)
      expect(mockOnUpdate).toHaveBeenCalledWith(0, 0, 'blur value')
      expect(mockOnEditComplete).toHaveBeenCalled()
    })

    it('値が変わっていない場合はonUpdateが呼ばれない', () => {
      renderInTable({ isEditing: true, value: 'same value' })
      const textarea = screen.getByRole('textbox')
      // 値を変更せずにEnterキーを押す
      fireEvent.keyDown(textarea, { key: 'Enter' })
      expect(mockOnUpdate).not.toHaveBeenCalled()
      expect(mockOnEditComplete).toHaveBeenCalled()
    })

    it('テキストエリアの内容が変更される', () => {
      renderInTable({ isEditing: true })
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'new text' } })
      expect(textarea.value).toBe('new text')
    })
  })

  describe('IME処理', () => {
    it('compositionStart中はキーボード入力が無視される', () => {
      renderInTable({ isEditing: true })
      const textarea = screen.getByRole('textbox')
      fireEvent.compositionStart(textarea)
      fireEvent.keyDown(textarea, { key: 'Enter' })
      expect(mockOnEditComplete).not.toHaveBeenCalled()
    })

    it('compositionEnd後はキーボード入力が処理される', () => {
      renderInTable({ isEditing: true, value: 'original' })
      const textarea = screen.getByRole('textbox')
      fireEvent.compositionStart(textarea)
      fireEvent.compositionEnd(textarea)
      fireEvent.change(textarea, { target: { value: 'ime value' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })
      expect(mockOnEditComplete).toHaveBeenCalled()
    })
  })

  describe('外部からの値変更', () => {
    it('isEditing=falseの状態で値が変更されると表示が更新される', () => {
      const { rerender } = render(
        <table>
          <tbody>
            <tr>
              <TableCell {...defaultProps} value="old value" />
            </tr>
          </tbody>
        </table>
      )
      expect(screen.getByText('old value')).toBeInTheDocument()

      rerender(
        <table>
          <tbody>
            <tr>
              <TableCell {...defaultProps} value="new value" />
            </tr>
          </tbody>
        </table>
      )
      expect(screen.getByText('new value')).toBeInTheDocument()
    })
  })
})
