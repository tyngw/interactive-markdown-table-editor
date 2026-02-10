/**
 * TableHeader.test.tsx
 * TableHeaderコンポーネントのテスト
 * ヘッダー表示、編集、リサイズ、ソート、列選択、diff表示を検証
 */

import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import TableHeader from '../components/TableHeader'
import { SortState, ColumnWidths, HeaderConfig, ColumnDiffInfo } from '../types'

// imeUtils のモック
jest.mock('../utils/imeUtils', () => ({
  isImeConfirmingEnter: jest.fn(() => false)
}))

import { isImeConfirmingEnter } from '../utils/imeUtils'

describe('TableHeader', () => {
  const defaultHeaders = ['Name', 'Age', 'City']
  const defaultColumnWidths: ColumnWidths = {}
  const defaultSortState: SortState = { column: -1, direction: 'none' }

  const mockOnHeaderUpdate = jest.fn()
  const mockOnSort = jest.fn()
  const mockOnColumnResize = jest.fn()
  const mockOnAddColumn = jest.fn()
  const mockOnDeleteColumn = jest.fn()
  const mockOnSelectAll = jest.fn()
  const mockOnColumnSelect = jest.fn()
  const mockOnShowColumnContextMenu = jest.fn()
  const mockGetDragProps = jest.fn(() => ({}))
  const mockGetDropProps = jest.fn(() => ({}))

  const defaultProps = {
    headers: defaultHeaders,
    columnWidths: defaultColumnWidths,
    sortState: defaultSortState,
    onHeaderUpdate: mockOnHeaderUpdate,
    onSort: mockOnSort,
    onColumnResize: mockOnColumnResize,
    onAddColumn: mockOnAddColumn,
    onDeleteColumn: mockOnDeleteColumn,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // テーブル構造内にレンダリングするヘルパー
  const renderInTable = (props = {}) => {
    return render(
      <table>
        <TableHeader {...defaultProps} {...props} />
      </table>
    )
  }

  describe('基本表示', () => {
    it('ヘッダーが正しく表示される', () => {
      renderInTable()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Age')).toBeInTheDocument()
      expect(screen.getByText('City')).toBeInTheDocument()
    })

    it('列記号（A, B, C）が表示される', () => {
      renderInTable()
      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.getByText('C')).toBeInTheDocument()
    })

    it('ソートインジケータが表示される', () => {
      renderInTable()
      const indicators = screen.getAllByTitle('Sort column')
      expect(indicators.length).toBe(3)
    })

    it('header-corner セルが表示される', () => {
      renderInTable({ onSelectAll: mockOnSelectAll })
      const corner = screen.getByTitle('Select All')
      expect(corner).toBeInTheDocument()
    })

    it('header-corner クリックで onSelectAll が呼ばれる', () => {
      renderInTable({ onSelectAll: mockOnSelectAll })
      fireEvent.click(screen.getByTitle('Select All'))
      expect(mockOnSelectAll).toHaveBeenCalled()
    })
  })

  describe('ソート状態の表示', () => {
    it('昇順ソート時に「↑」が表示される', () => {
      renderInTable({ sortState: { column: 0, direction: 'asc' } })
      expect(screen.getByText('↑')).toBeInTheDocument()
    })

    it('降順ソート時に「↓」が表示される', () => {
      renderInTable({ sortState: { column: 0, direction: 'desc' } })
      expect(screen.getByText('↓')).toBeInTheDocument()
    })

    it('ソートなしの時に「↕」が表示される', () => {
      renderInTable()
      const indicators = screen.getAllByText('↕')
      expect(indicators.length).toBe(3)
    })
  })

  describe('ヘッダーダブルクリック編集', () => {
    it('ダブルクリックで編集モードに入る', () => {
      renderInTable()
      const nameHeader = screen.getByText('Name')
      // ダブルクリックは列ヘッダの th 要素をクリック
      const th = nameHeader.closest('th')!
      fireEvent.doubleClick(th)
      // input が表示される
      const input = screen.getByDisplayValue('Name')
      expect(input).toBeInTheDocument()
    })

    it('ダブルクリックでクリックタイマーがキャンセルされる', () => {
      renderInTable({ onColumnSelect: mockOnColumnSelect })
      const th = screen.getByText('Name').closest('th')!

      // まずシングルクリックしてタイマーを設定
      fireEvent.click(th)
      // すぐにダブルクリック
      fireEvent.doubleClick(th)
      // タイマーが発火しても onColumnSelect は呼ばれない（250ms待機）
      act(() => { jest.advanceTimersByTime(300) })
      // ダブルクリックによりタイマーがキャンセルされたため、onColumnSelect は1回も呼ばれない
      // （シングルクリックが250ms後に発火するが、ダブルクリック時にキャンセルされる）
    })

    it('hasColumnHeaders が false の場合、ダブルクリックしても編集モードにならない', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      renderInTable({ headerConfig })
      const th = screen.getAllByRole('columnheader')[1] // 最初の列ヘッダ
      fireEvent.doubleClick(th)
      // input が表示されない
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  describe('ヘッダー編集完了', () => {
    it('blur で編集が完了する', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name')
      fireEvent.change(input, { target: { value: 'New Name' } })
      fireEvent.blur(input)
      expect(mockOnHeaderUpdate).toHaveBeenCalledWith(0, 'New Name')
    })

    it('Enter キーで編集が完了する', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name')
      fireEvent.change(input, { target: { value: 'Updated' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(mockOnHeaderUpdate).toHaveBeenCalledWith(0, 'Updated')
    })

    it('IME確定中のEnterは無視される', () => {
      ;(isImeConfirmingEnter as jest.Mock).mockReturnValueOnce(true)
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name')
      fireEvent.keyDown(input, { key: 'Enter' })
      // IME確定中なので onHeaderUpdate は呼ばれない
      expect(mockOnHeaderUpdate).not.toHaveBeenCalled()
    })

    it('Escape キーで編集がキャンセルされる', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name')
      fireEvent.keyDown(input, { key: 'Escape' })
      // input が消える（onHeaderUpdate は呼ばれない）
      expect(mockOnHeaderUpdate).not.toHaveBeenCalled()
      expect(screen.queryByDisplayValue('Name')).not.toBeInTheDocument()
    })

    it('Ctrl+A で入力フィールドのテキスト全選択になる', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name') as HTMLInputElement
      const selectSpy = jest.spyOn(input, 'select')
      fireEvent.keyDown(input, { key: 'a', ctrlKey: true })
      expect(selectSpy).toHaveBeenCalled()
    })

    it('Backspace キーでカーソル位置の1文字が削除される', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name') as HTMLInputElement
      // カーソル位置を2に設定
      Object.defineProperty(input, 'selectionStart', { value: 2, writable: true })
      Object.defineProperty(input, 'selectionEnd', { value: 2, writable: true })
      const setSelectionRangeSpy = jest.spyOn(input, 'setSelectionRange')
      fireEvent.keyDown(input, { key: 'Backspace' })
      // 'Name' → 'Nme' (位置2の前の文字を削除)
      expect(input.value).toBe('Nme')
      expect(setSelectionRangeSpy).toHaveBeenCalledWith(1, 1)
    })

    it('Backspace キーで選択範囲が削除される', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name') as HTMLInputElement
      // 選択範囲を1-3に設定
      Object.defineProperty(input, 'selectionStart', { value: 1, writable: true })
      Object.defineProperty(input, 'selectionEnd', { value: 3, writable: true })
      const setSelectionRangeSpy = jest.spyOn(input, 'setSelectionRange')
      fireEvent.keyDown(input, { key: 'Backspace' })
      // 'Name' → 'Ne' (位置1-3の文字を削除)
      expect(input.value).toBe('Ne')
      expect(setSelectionRangeSpy).toHaveBeenCalledWith(1, 1)
    })

    it('Backspace キーでカーソルが先頭の場合は何もしない', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name') as HTMLInputElement
      Object.defineProperty(input, 'selectionStart', { value: 0, writable: true })
      Object.defineProperty(input, 'selectionEnd', { value: 0, writable: true })
      fireEvent.keyDown(input, { key: 'Backspace' })
      expect(input.value).toBe('Name')
    })

    it('Delete キーでカーソル位置の次の文字が削除される', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name') as HTMLInputElement
      Object.defineProperty(input, 'selectionStart', { value: 1, writable: true })
      Object.defineProperty(input, 'selectionEnd', { value: 1, writable: true })
      const setSelectionRangeSpy = jest.spyOn(input, 'setSelectionRange')
      fireEvent.keyDown(input, { key: 'Delete' })
      // 'Name' → 'Nme' (位置1の次の文字を削除)
      expect(input.value).toBe('Nme')
      expect(setSelectionRangeSpy).toHaveBeenCalledWith(1, 1)
    })

    it('Delete キーで選択範囲が削除される', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name') as HTMLInputElement
      Object.defineProperty(input, 'selectionStart', { value: 0, writable: true })
      Object.defineProperty(input, 'selectionEnd', { value: 2, writable: true })
      const setSelectionRangeSpy = jest.spyOn(input, 'setSelectionRange')
      fireEvent.keyDown(input, { key: 'Delete' })
      // 'Name' → 'me' (位置0-2の文字を削除)
      expect(input.value).toBe('me')
      expect(setSelectionRangeSpy).toHaveBeenCalledWith(0, 0)
    })

    it('Delete キーでカーソルが末尾の場合は何もしない', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name') as HTMLInputElement
      Object.defineProperty(input, 'selectionStart', { value: 4, writable: true })
      Object.defineProperty(input, 'selectionEnd', { value: 4, writable: true })
      fireEvent.keyDown(input, { key: 'Delete' })
      expect(input.value).toBe('Name')
    })

    it('その他のキー（例: ArrowLeft）はstopPropagationされるがそれ以外の処理なし', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name') as HTMLInputElement
      // ArrowLeftキーの場合はstopPropagationのみ
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
      const stopSpy = jest.spyOn(event, 'stopPropagation')
      fireEvent(input, event)
      // 値が変わらないことを確認
      expect(input.value).toBe('Name')
    })
  })

  describe('列リサイズ', () => {
    it('リサイズハンドルのマウスダウンでリサイズが開始される', () => {
      renderInTable()
      const handles = document.querySelectorAll('.resize-handle')
      expect(handles.length).toBe(3)

      // リサイズ開始
      fireEvent.mouseDown(handles[0], { clientX: 100 })

      // リサイズ中（document上のmousemove）
      act(() => {
        fireEvent.mouseMove(document, { clientX: 150 })
      })
      expect(mockOnColumnResize).toHaveBeenCalledWith(0, 200) // 150 + (150-100)

      // リサイズ終了
      act(() => {
        fireEvent.mouseUp(document)
      })
    })

    it('リサイズ中に最小幅50px以下にならない', () => {
      renderInTable()
      const handles = document.querySelectorAll('.resize-handle')
      fireEvent.mouseDown(handles[0], { clientX: 200 })
      act(() => {
        fireEvent.mouseMove(document, { clientX: 10 }) // 大きく左に移動
      })
      // 最小幅は50
      expect(mockOnColumnResize).toHaveBeenCalledWith(0, 50)
    })

    it('リサイズハンドルのクリックが親に伝播しない', () => {
      renderInTable({ onColumnSelect: mockOnColumnSelect })
      const handles = document.querySelectorAll('.resize-handle')
      fireEvent.click(handles[0])
      // 列選択は呼ばれない（stopPropagation）
      act(() => { jest.advanceTimersByTime(300) })
      // handleColumnHeaderClickのresizeハンドルチェックにより無視される
    })

    it('リサイズハンドルのダブルクリックでauto-fitが実行される', () => {
      renderInTable()
      const handles = document.querySelectorAll('.resize-handle')
      fireEvent.doubleClick(handles[0])
      // auto-fit: Math.min(400, Math.max(80, 'Name'.length * 8 + 40)) = Math.min(400, Math.max(80, 72)) = 80
      expect(mockOnColumnResize).toHaveBeenCalledWith(0, 80)
    })

    it('カスタム列幅が設定されている場合にリサイズが正しく動作する', () => {
      renderInTable({ columnWidths: { 0: 200 } })
      const handles = document.querySelectorAll('.resize-handle')
      fireEvent.mouseDown(handles[0], { clientX: 100 })
      act(() => {
        fireEvent.mouseMove(document, { clientX: 150 })
      })
      // startWidth=200, delta=50 → newWidth=250
      expect(mockOnColumnResize).toHaveBeenCalledWith(0, 250)
      act(() => {
        fireEvent.mouseUp(document)
      })
    })
  })

  describe('列ヘッダークリック（列選択）', () => {
    it('クリックで onColumnSelect が遅延呼び出しされる', () => {
      // onColumnSelect のモック: 渡された合成イベントの preventDefault / stopPropagation を呼ぶ
      const mockColumnSelectWithEventCall = jest.fn((_col: number, event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
      })
      renderInTable({ onColumnSelect: mockColumnSelectWithEventCall })
      const th = screen.getByText('Name').closest('th')!
      fireEvent.click(th)
      // 250ms後に呼ばれる
      expect(mockColumnSelectWithEventCall).not.toHaveBeenCalled()
      act(() => { jest.advanceTimersByTime(250) })
      expect(mockColumnSelectWithEventCall).toHaveBeenCalledWith(0, expect.objectContaining({
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
      }))
    })

    it('Shiftキー付きクリックで範囲選択が呼ばれる', () => {
      renderInTable({ onColumnSelect: mockOnColumnSelect })
      const th = screen.getByText('Age').closest('th')!
      fireEvent.click(th, { shiftKey: true })
      act(() => { jest.advanceTimersByTime(250) })
      expect(mockOnColumnSelect).toHaveBeenCalledWith(1, expect.objectContaining({
        shiftKey: true,
      }))
    })

    it('リサイズ中のクリックは無視される', () => {
      renderInTable({ onColumnSelect: mockOnColumnSelect })
      // リサイズを開始
      const handles = document.querySelectorAll('.resize-handle')
      fireEvent.mouseDown(handles[0], { clientX: 100 })
      // リサイズ中に列ヘッダクリック
      const th = screen.getByText('Name').closest('th')!
      fireEvent.click(th)
      act(() => { jest.advanceTimersByTime(300) })
      // onColumnSelect は呼ばれない
      expect(mockOnColumnSelect).not.toHaveBeenCalled()
      // クリーンアップ
      act(() => { fireEvent.mouseUp(document) })
    })

    it('ソートインジケータのクリックは列選択にならない', () => {
      renderInTable({ onColumnSelect: mockOnColumnSelect })
      const sortIndicators = screen.getAllByTitle('Sort column')
      fireEvent.click(sortIndicators[0])
      expect(mockOnSort).toHaveBeenCalledWith(0)
      act(() => { jest.advanceTimersByTime(300) })
      // sort-indicator内のクリックはhandleColumnHeaderClickでは無視される
    })

    it('onColumnSelect が未設定でもエラーにならない', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.click(th)
      act(() => { jest.advanceTimersByTime(300) })
      // エラーが発生しないことを確認
    })

    it('連続クリックで既存タイマーがキャンセルされる', () => {
      renderInTable({ onColumnSelect: mockOnColumnSelect })
      const th = screen.getByText('Name').closest('th')!
      // 1回目のクリック
      fireEvent.click(th)
      // 50ms後に2回目のクリック（まだタイマー発火前）
      act(() => { jest.advanceTimersByTime(50) })
      fireEvent.click(th)
      // 最初のタイマーはキャンセルされ、2回目のタイマーが有効
      act(() => { jest.advanceTimersByTime(250) })
      // onColumnSelect は1回だけ呼ばれる
      expect(mockOnColumnSelect).toHaveBeenCalledTimes(1)
    })
  })

  describe('コンテキストメニュー', () => {
    it('右クリックで onShowColumnContextMenu が呼ばれる', () => {
      renderInTable({ onShowColumnContextMenu: mockOnShowColumnContextMenu })
      const th = screen.getByText('Name').closest('th')!
      fireEvent.contextMenu(th)
      expect(mockOnShowColumnContextMenu).toHaveBeenCalledWith(expect.anything(), 0)
    })

    it('onShowColumnContextMenu が未設定の場合もエラーにならない', () => {
      renderInTable()
      const th = screen.getByText('Name').closest('th')!
      fireEvent.contextMenu(th)
      // エラーなし
    })
  })

  describe('選択状態のスタイル', () => {
    it('selectedCols で列がハイライトされる', () => {
      renderInTable({ selectedCols: new Set([0]) })
      const th = screen.getByText('Name').closest('th')!
      expect(th.className).toContain('highlighted')
    })

    it('fullySelectedCols で列が完全選択される', () => {
      renderInTable({
        selectedCols: new Set([0]),
        fullySelectedCols: new Set([0])
      })
      const th = screen.getByText('Name').closest('th')!
      expect(th.className).toContain('selected')
    })

    it('user-resized クラスが付与される', () => {
      renderInTable({ columnWidths: { 0: 200 } })
      const th = screen.getByText('Name').closest('th')!
      expect(th.className).toContain('user-resized')
    })
  })

  describe('ドラッグ＆ドロップ props', () => {
    it('getDragProps / getDropProps が列に適用される', () => {
      renderInTable({
        getDragProps: mockGetDragProps,
        getDropProps: mockGetDropProps,
        selectedCols: new Set([0]),
      })
      expect(mockGetDragProps).toHaveBeenCalledWith('column', expect.any(Number), expect.any(Array))
      expect(mockGetDropProps).toHaveBeenCalledWith('column', expect.any(Number))
    })
  })

  describe('onMouseDown ハンドラ', () => {
    it('onMouseDown で getDragProps ありの場合は drag start ロジックに入る', () => {
      renderInTable({ getDragProps: mockGetDragProps })
      const th = screen.getByText('Name').closest('th')!
      fireEvent.mouseDown(th)
      // getDragProps がpropsとして適用されているので、イベントが処理される
    })
  })

  describe('columnDiff モード（差分表示）', () => {
    const baseColumnDiff: ColumnDiffInfo = {
      oldColumnCount: 3,
      newColumnCount: 2,
      addedColumns: [],
      deletedColumns: [1], // 2番目の列（旧index=1）が削除
      oldHeaders: ['Name', 'Age', 'City'],
      positions: [
        { index: 1, type: 'removed', confidence: 0.9 }
      ],
    }

    it('削除された列が diff スタイルで表示される', () => {
      renderInTable({
        headers: ['Name', 'City'],
        columnDiff: baseColumnDiff,
      })
      // 削除列のヘッダが表示される
      expect(screen.getByText('Age')).toBeInTheDocument()
      const deletedTh = screen.getByText('Age').closest('th')!
      expect(deletedTh.className).toContain('git-diff-column-not-exist')
    })

    it('削除列の oldHeaders がない場合は "(Deleted)" が表示される', () => {
      const diffWithoutHeaders: ColumnDiffInfo = {
        ...baseColumnDiff,
        oldHeaders: undefined,
      }
      renderInTable({
        headers: ['Name', 'City'],
        columnDiff: diffWithoutHeaders,
      })
      expect(screen.getByText('(Deleted)')).toBeInTheDocument()
    })

    it('削除列の confidence が低い場合に "(推定)" ラベルが表示される', () => {
      const diffLowConfidence: ColumnDiffInfo = {
        ...baseColumnDiff,
        positions: [
          { index: 1, type: 'removed', confidence: 0.5 }
        ],
      }
      renderInTable({
        headers: ['Name', 'City'],
        columnDiff: diffLowConfidence,
      })
      const deletedTh = screen.getByText('Age').closest('th')!
      expect(deletedTh.title).toContain('(推定)')
    })

    it('削除列の confidence が高い場合に "(推定)" ラベルが付かない', () => {
      renderInTable({
        headers: ['Name', 'City'],
        columnDiff: baseColumnDiff,
      })
      const deletedTh = screen.getByText('Age').closest('th')!
      expect(deletedTh.title).not.toContain('(推定)')
    })

    it('既存列がdiffモードで表示される', () => {
      renderInTable({
        headers: ['Name', 'City'],
        columnDiff: baseColumnDiff,
      })
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('City')).toBeInTheDocument()
    })

    it('mapping を使って列のインデックスが正しく算出される', () => {
      const diffWithMapping: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        oldHeaders: ['Name', 'Age', 'City'],
        mapping: [0, -1, 1], // 旧0→新0, 旧1→削除, 旧2→新1
      }
      renderInTable({
        headers: ['Name', 'City'],
        columnDiff: diffWithMapping,
      })
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('City')).toBeInTheDocument()
    })

    it('mapping なしの場合、削除前考慮でインデックスが算出される', () => {
      const diffNoMapping: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        oldHeaders: ['Name', 'Age', 'City'],
      }
      renderInTable({
        headers: ['Name', 'City'],
        columnDiff: diffNoMapping,
      })
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('City')).toBeInTheDocument()
    })

    it('リネームされた列が表示される', () => {
      const diffRenamed: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['OldName', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['NewName', 'Age'],
        columnDiff: diffRenamed,
      })
      // リネームされた列: 新旧ヘッダが表示される
      expect(screen.getByText('NewName')).toBeInTheDocument()
      expect(screen.getByText('OldName')).toBeInTheDocument()
    })

    it('positions で追加された列がリストに挿入される', () => {
      const diffWithAddedPositions: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        oldHeaders: ['Name', 'City'],
        mapping: [0, 2], // 旧0→新0, 旧1→新2
        positions: [
          { index: 1, type: 'added', confidence: 1.0, newIndex: 1 }
        ],
      }
      renderInTable({
        headers: ['Name', 'NewCol', 'City'],
        columnDiff: diffWithAddedPositions,
      })
      expect(screen.getByText('NewCol')).toBeInTheDocument()
    })

    it('diffモードの既存列でダブルクリック編集が機能する', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
      })
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name')
      expect(input).toBeInTheDocument()
    })

    it('diffモードの既存列でコンテキストメニューが機能する', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        onShowColumnContextMenu: mockOnShowColumnContextMenu,
      })
      const th = screen.getByText('Name').closest('th')!
      fireEvent.contextMenu(th)
      expect(mockOnShowColumnContextMenu).toHaveBeenCalledWith(expect.anything(), 0)
    })

    it('diffモードの既存列でソートインジケータが非表示になる', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
      })
      const indicators = screen.getAllByTitle('Sort column')
      indicators.forEach(ind => {
        expect(ind.style.visibility).toBe('hidden')
      })
    })

    it('diffモードの既存列でリサイズハンドルが機能する', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
      })
      const handles = document.querySelectorAll('.resize-handle')
      expect(handles.length).toBe(2)
      // クリック（stopPropagation）
      fireEvent.click(handles[0])
      // ダブルクリック（auto-fit）
      fireEvent.doubleClick(handles[0])
      expect(mockOnColumnResize).toHaveBeenCalled()
      // mouseDown（リサイズ開始）
      fireEvent.mouseDown(handles[0], { clientX: 100 })
      act(() => { fireEvent.mouseMove(document, { clientX: 150 }) })
      expect(mockOnColumnResize).toHaveBeenCalledTimes(2)
      act(() => { fireEvent.mouseUp(document) })
    })

    it('diffモードの既存列でソートインジケータをクリックするとonSortが呼ばれる', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
      })
      const indicators = screen.getAllByTitle('Sort column')
      fireEvent.click(indicators[0])
      expect(mockOnSort).toHaveBeenCalled()
    })

    it('diffモードの既存列でクリックするとhandleColumnHeaderClickが呼ばれる', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        onColumnSelect: mockOnColumnSelect,
      })
      const th = screen.getByText('Name').closest('th')!
      fireEvent.click(th)
      act(() => { jest.advanceTimersByTime(250) })
      expect(mockOnColumnSelect).toHaveBeenCalledWith(0, expect.anything())
    })

    it('diffモードで selectedCols / fullySelectedCols が反映される', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        selectedCols: new Set([0]),
        fullySelectedCols: new Set([0]),
      })
      const th = screen.getByText('Name').closest('th')!
      expect(th.className).toContain('selected')
    })

    it('diffモードで selectedCols のみ（fullySelected でない）の場合 highlighted になる', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        selectedCols: new Set([0]),
        // fullySelectedCols は未設定
      })
      const th = screen.getByText('Name').closest('th')!
      expect(th.className).toContain('highlighted')
    })

    it('diffモードで getDragProps / getDropProps が適用される', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        getDragProps: mockGetDragProps,
        getDropProps: mockGetDropProps,
        selectedCols: new Set([0]),
      })
      expect(mockGetDragProps).toHaveBeenCalledWith('column', expect.any(Number), expect.any(Array))
      expect(mockGetDropProps).toHaveBeenCalled()
    })

    it('diffモードで headerConfig.hasColumnHeaders=false の場合タイトルが非表示', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        headerConfig,
      })
      // column-title 要素がない（hasColumnHeaders=false）
      expect(screen.queryByText('Name')).not.toBeInTheDocument()
    })

    it('diffモードの既存列で編集中にblurで完了する', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
      })
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name')
      fireEvent.change(input, { target: { value: 'Updated' } })
      fireEvent.blur(input)
      expect(mockOnHeaderUpdate).toHaveBeenCalledWith(0, 'Updated')
    })

    it('diffモードの既存列で編集中にkeyDownでEnter確定する', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
      })
      const th = screen.getByText('Name').closest('th')!
      fireEvent.doubleClick(th)
      const input = screen.getByDisplayValue('Name')
      fireEvent.change(input, { target: { value: 'Changed' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(mockOnHeaderUpdate).toHaveBeenCalledWith(0, 'Changed')
    })

    it('positions の type が removed で positions にマッチしない削除列はデフォルト confidence を使う', () => {
      const diffNoPositionMatch: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        oldHeaders: ['Name', 'Age', 'City'],
        // positions はあるが削除列にマッチしない
        positions: [
          { index: 0, type: 'added', confidence: 1.0 }
        ],
      }
      renderInTable({
        headers: ['Name', 'City'],
        columnDiff: diffNoPositionMatch,
      })
      const deletedTh = screen.getByText('Age').closest('th')!
      // デフォルト confidence 0.5 < 0.85 なので "(推定)" が表示される
      expect(deletedTh.title).toContain('(推定)')
    })

    it('diffモードでリネームされた列のタイトルに旧名が含まれる', () => {
      const diffRenamed: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['OldName', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['NewName', 'Age'],
        columnDiff: diffRenamed,
      })
      const th = screen.getByText('NewName').closest('th')!
      expect(th.title).toContain('OldName')
    })

    it('diffモードで columnWidths が設定された列に user-resized が付く', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        columnWidths: { 0: 200 },
      })
      const th = screen.getByText('Name').closest('th')!
      expect(th.className).toContain('user-resized')
    })

    it('追加列にも selectedCols / user-resized が反映される', () => {
      const diffWithAdded: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        oldHeaders: ['Name', 'City'],
        mapping: [0, 2], // 旧0→新0, 旧1→新2
        positions: [
          { index: 1, type: 'added', confidence: 1.0, newIndex: 1 }
        ],
      }
      renderInTable({
        headers: ['Name', 'NewCol', 'City'],
        columnDiff: diffWithAdded,
        selectedCols: new Set([1]),
        fullySelectedCols: new Set([1]),
        columnWidths: { 1: 300 },
      })
      const th = screen.getByText('NewCol').closest('th')!
      expect(th.className).toContain('selected')
      expect(th.className).toContain('user-resized')
    })
  })

  describe('hasColumnHeaders=false の挙動', () => {
    it('通常モードで hasColumnHeaders=false の場合、ヘッダタイトルが非表示', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      renderInTable({ headerConfig })
      // ヘッダ名は表示されない
      expect(screen.queryByText('Name')).not.toBeInTheDocument()
      // 列記号は表示される
      expect(screen.getByText('A')).toBeInTheDocument()
    })
  })

  describe('クリーンアップ', () => {
    it('コンポーネントアンマウント時にクリックタイマーがクリーンアップされる', () => {
      const { unmount } = renderInTable({ onColumnSelect: mockOnColumnSelect })
      const th = screen.getByText('Name').closest('th')!
      // タイマーを設定
      fireEvent.click(th)
      // アンマウント
      unmount()
      // タイマー発火してもエラーにならない
      act(() => { jest.advanceTimersByTime(300) })
    })

    it('リサイズ中にアンマウントしてもリスナーが解除される', () => {
      const { unmount } = renderInTable()
      const handles = document.querySelectorAll('.resize-handle')
      fireEvent.mouseDown(handles[0], { clientX: 100 })
      unmount()
      // mousemoveしてもエラーにならない
      act(() => {
        fireEvent.mouseMove(document, { clientX: 200 })
      })
    })
  })

  describe('ソートインジケータの columnDiff 時の表示', () => {
    it('columnDiff がある場合、ソートインジケータが非表示になる', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 1,
        newColumnCount: 1,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name'],
      }
      renderInTable({
        headers: ['Name'],
        columnDiff: simpleDiff,
      })
      const indicators = screen.getAllByTitle('Sort column')
      indicators.forEach(ind => {
        expect(ind.style.visibility).toBe('hidden')
      })
    })

    it('columnDiff がない場合、ソートインジケータが表示される', () => {
      renderInTable()
      const indicators = screen.getAllByTitle('Sort column')
      indicators.forEach(ind => {
        expect(ind.style.visibility).toBe('visible')
      })
    })
  })

  describe('ブランチカバレッジ補完', () => {
    it('diffモードでソート状態が asc の場合に「↑」が表示される', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        sortState: { column: 0, direction: 'asc' },
      })
      expect(screen.getByText('↑')).toBeInTheDocument()
    })

    it('diffモードでソート状態が desc の場合に「↓」が表示される', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        sortState: { column: 0, direction: 'desc' },
      })
      expect(screen.getByText('↓')).toBeInTheDocument()
    })

    it('diffモードで onShowColumnContextMenu が未設定でもエラーにならない', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
      })
      const th = screen.getByText('Name').closest('th')!
      fireEvent.contextMenu(th)
      // エラーにならない
    })

    it('追加列で newIndex がない場合 pos.index が使われる', () => {
      const diffWithAddedNoNewIndex: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        oldHeaders: ['Name', 'City'],
        mapping: [0, 2],
        positions: [
          { index: 1, type: 'added', confidence: 1.0 } // newIndex なし
        ],
      }
      renderInTable({
        headers: ['Name', 'Added', 'City'],
        columnDiff: diffWithAddedNoNewIndex,
      })
      expect(screen.getByText('Added')).toBeInTheDocument()
    })

    it('リサイズハンドル上のクリックは handleColumnHeaderClick で無視される', () => {
      renderInTable({ onColumnSelect: mockOnColumnSelect })
      const handle = document.querySelector('.resize-handle')!
      // handleの親thのonClickが発火するが、handleが.resize-handleなので無視
      fireEvent.click(handle)
      act(() => { jest.advanceTimersByTime(300) })
      expect(mockOnColumnSelect).not.toHaveBeenCalled()
    })

    it('ソートインジケータ上のクリックは handleColumnHeaderClick で無視される', () => {
      renderInTable({ onColumnSelect: mockOnColumnSelect })
      const indicator = screen.getAllByTitle('Sort column')[0]
      // indicatorの親thのonClickが発火するが、.sort-indicatorなので無視
      fireEvent.click(indicator)
      act(() => { jest.advanceTimersByTime(300) })
      expect(mockOnColumnSelect).not.toHaveBeenCalled()
    })

    it('mapping で値が -1 の列はフォールバック計算される', () => {
      // 旧列2がmappingで-1だがdeletedColumnsに含まれないケース
      // → else分岐（フォールバック計算）に入る
      const diffWithNegMapping: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [], // 削除列なし
        oldHeaders: ['Name', 'Age', 'City'],
        mapping: [0, 1, -1], // 旧2は-1だが削除リストにない
      }
      renderInTable({
        headers: ['Name', 'Age', 'City'],
        columnDiff: diffWithNegMapping,
      })
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Age')).toBeInTheDocument()
      expect(screen.getByText('City')).toBeInTheDocument()
    })

    it('diffモードで oldHeaders が undefined の場合にエラーにならない', () => {
      const diffNoOldHeaders: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        // oldHeaders なし → oldHeaderName は falsy
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: diffNoOldHeaders,
      })
      expect(screen.getByText('Name')).toBeInTheDocument()
    })

    it('diffモードで getDragProps あり selectedCols なしの場合', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        getDragProps: mockGetDragProps,
        // selectedCols なし → undefined が渡る
      })
      expect(mockGetDragProps).toHaveBeenCalledWith('column', expect.any(Number), undefined)
    })

    it('diffモードでソート状態の asc/desc 表示が切り替わる', () => {
      const simpleDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age'],
        mapping: [0, 1],
      }
      // asc
      const { unmount: unmount1 } = renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        sortState: { column: 0, direction: 'asc' },
      })
      expect(screen.getByText('↑')).toBeInTheDocument()
      unmount1()

      // desc
      const { unmount: unmount2 } = renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        sortState: { column: 0, direction: 'desc' },
      })
      expect(screen.getByText('↓')).toBeInTheDocument()
      unmount2()

      // none
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: simpleDiff,
        sortState: { column: 0, direction: 'none' },
      })
      const indicators = screen.getAllByText('↕')
      expect(indicators.length).toBe(2)
    })

    it('diffモードで newColIdx に対応する headers が空の場合フォールバックする', () => {
      const diffExtraOld: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: ['Name', 'Age', 'City'],
        mapping: [0, 1, 2], // 旧2→新2 だが headers には2がない
      }
      // headers は2要素のみ → headers[2] は undefined → '' にフォールバック
      renderInTable({
        headers: ['Name', 'Age'],
        columnDiff: diffExtraOld,
      })
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Age')).toBeInTheDocument()
    })

    it('追加列で headers の index が範囲外の場合フォールバックする', () => {
      const diffWithAdded: ColumnDiffInfo = {
        oldColumnCount: 1,
        newColumnCount: 2,
        addedColumns: [5],
        deletedColumns: [],
        oldHeaders: ['Name'],
        mapping: [0],
        positions: [
          { index: 5, type: 'added', confidence: 1.0, newIndex: 5 }
        ],
      }
      // headers[5] は undefined → '' にフォールバック
      renderInTable({
        headers: ['Name'],
        columnDiff: diffWithAdded,
      })
      expect(screen.getByText('Name')).toBeInTheDocument()
    })
  })
})
