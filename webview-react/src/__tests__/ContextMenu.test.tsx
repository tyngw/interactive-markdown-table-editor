import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ContextMenu from '../components/ContextMenu'

describe('ContextMenu', () => {
  const mockOnAddRow = jest.fn()
  const mockOnDeleteRow = jest.fn()
  const mockOnDeleteRows = jest.fn()
  const mockOnAddColumn = jest.fn()
  const mockOnDeleteColumn = jest.fn()
  const mockOnDeleteColumns = jest.fn()
  const mockOnClose = jest.fn()

  const mockTableData = {
    headers: ['Header1', 'Header2', 'Header3'],
    rows: [
      ['Row1Col1', 'Row1Col2', 'Row1Col3'],
      ['Row2Col1', 'Row2Col2', 'Row2Col3'],
      ['Row3Col1', 'Row3Col2', 'Row3Col3']
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('複数行選択時の行追加機能', () => {
    it('複数行が全選択された状態で"この上に行を追加"をクリックすると、選択行数分の行が追加される', async () => {
      const user = userEvent.setup()
      
      // 1行目と2行目を全選択したセル
      const selectedCells = new Set([
        '0-0', '0-1', '0-2',  // 1行目全選択
        '1-0', '1-1', '1-2'   // 2行目全選択
      ])

      const menuState = {
        type: 'row' as const,
        index: 1, // 2行目をクリック
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          selectedCells={selectedCells}
          tableData={mockTableData}
        />
      )

      // メニューの表示を確認
      expect(screen.getByText('この上に2行を追加')).toBeInTheDocument()

      // "この上に2行を追加" をクリック
      await user.click(screen.getByText('この上に2行を追加'))

      // onAddRowが選択行数（2回）呼び出されることを確認
      expect(mockOnAddRow).toHaveBeenCalledTimes(2)
      expect(mockOnAddRow).toHaveBeenNthCalledWith(1, 0) // 最初の選択行（0行目）の位置に追加
      expect(mockOnAddRow).toHaveBeenNthCalledWith(2, 0) // 同じ位置にもう1行追加

      // メニューが閉じられることを確認
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('複数行が全選択された状態で"この下に行を追加"をクリックすると、選択行数分の行が最後の選択行の後に追加される', async () => {
      const user = userEvent.setup()
      
      // 1行目と2行目を全選択したセル
      const selectedCells = new Set([
        '0-0', '0-1', '0-2',  // 1行目全選択
        '1-0', '1-1', '1-2'   // 2行目全選択
      ])

      const menuState = {
        type: 'row' as const,
        index: 1, // 2行目をクリック
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          selectedCells={selectedCells}
          tableData={mockTableData}
        />
      )

      // メニューの表示を確認
      expect(screen.getByText('この下に2行を追加')).toBeInTheDocument()

      // "この下に2行を追加" をクリック
      await user.click(screen.getByText('この下に2行を追加'))

      // onAddRowが選択行数（2回）呼び出されることを確認
      expect(mockOnAddRow).toHaveBeenCalledTimes(2)
      expect(mockOnAddRow).toHaveBeenNthCalledWith(1, 2) // 最後の選択行（1行目）の後（2の位置）に追加
      expect(mockOnAddRow).toHaveBeenNthCalledWith(2, 2) // 同じ位置にもう1行追加

      // メニューが閉じられることを確認
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('単一行のみ選択された状態では、従来通り1行だけ追加される', async () => {
      const user = userEvent.setup()
      
      // 1行目の一部のセルのみ選択
      const selectedCells = new Set(['0-0', '0-1']) // 1行目の最初の2セルのみ

      const menuState = {
        type: 'row' as const,
        index: 0,
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          selectedCells={selectedCells}
          tableData={mockTableData}
        />
      )

      // メニューの表示を確認（単一行のラベル）
      expect(screen.getByText('この上に行を追加')).toBeInTheDocument()
      expect(screen.getByText('この下に行を追加')).toBeInTheDocument()

      // "この上に行を追加" をクリック
      await user.click(screen.getByText('この上に行を追加'))

      // onAddRowが1回だけ呼び出されることを確認
      expect(mockOnAddRow).toHaveBeenCalledTimes(1)
      expect(mockOnAddRow).toHaveBeenCalledWith(0) // クリックした行の位置

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('3行全選択された状態で正しく動作する', async () => {
      const user = userEvent.setup()
      
      // 1行目、2行目、3行目を全選択
      const selectedCells = new Set([
        '0-0', '0-1', '0-2',  // 1行目全選択
        '1-0', '1-1', '1-2',  // 2行目全選択
        '2-0', '2-1', '2-2'   // 3行目全選択
      ])

      const menuState = {
        type: 'row' as const,
        index: 1, // 2行目をクリック（選択されている）
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          selectedCells={selectedCells}
          tableData={mockTableData}
        />
      )

      // メニューの表示を確認
      expect(screen.getByText('この下に3行を追加')).toBeInTheDocument()

      // "この下に3行を追加" をクリック
      await user.click(screen.getByText('この下に3行を追加'))

      // onAddRowが3回呼び出されることを確認
      expect(mockOnAddRow).toHaveBeenCalledTimes(3)
      expect(mockOnAddRow).toHaveBeenNthCalledWith(1, 3) // 最後の選択行（2行目）の後（3の位置）に追加
      expect(mockOnAddRow).toHaveBeenNthCalledWith(2, 3) // 同じ位置にもう1行追加
      expect(mockOnAddRow).toHaveBeenNthCalledWith(3, 3) // 同じ位置にもう1行追加

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('メニュー表示の動作', () => {
    it('行メニューが正しく表示される', () => {
      const menuState = {
        type: 'row' as const,
        index: 0,
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          selectedCells={new Set()}
          tableData={mockTableData}
        />
      )

      expect(screen.getByText('この上に行を追加')).toBeInTheDocument()
      expect(screen.getByText('この下に行を追加')).toBeInTheDocument()
      expect(screen.getByText('この行を削除')).toBeInTheDocument()
    })

    it('メニューが表示されない状態では何もレンダリングされない', () => {
      const menuState = {
        type: null,
        index: -1,
        position: { x: 100, y: 100 }
      }

      const { container } = render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          selectedCells={new Set()}
          tableData={mockTableData}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })
})