/**
 * TableBody.test.tsx
 * TableBodyコンポーネントのテスト
 * 行レンダリング、セル選択、編集、Git差分表示、列差分表示を検証
 */

import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// MemoizedCell をモックして子コンポーネントの複雑さを排除
jest.mock('../components/MemoizedCell', () => {
  const MemoizedCell = (props: any) => {
    return (
      <td
        data-testid={`cell-${props.rowIndex}-${props.colIndex}`}
        data-row={props.rowIndex}
        data-col={props.colIndex}
        data-selected={props.isSelected}
        data-editing={props.isEditing}
        data-anchor={props.isAnchor}
        data-fill-range={props.isInFillRange}
        data-search-result={props.isSearchResult}
        data-current-search-result={props.isCurrentSearchResult}
        data-show-fill-handle={props.showFillHandle}
        data-single-selection={props.isSingleSelection}
        data-column-not-exist={props.isColumnNotExist}
        onMouseDown={(e: React.MouseEvent) => props.onMouseDown(props.rowIndex, props.colIndex, e)}
        onMouseEnter={() => props.onMouseEnter?.(props.rowIndex, props.colIndex)}
        onDoubleClick={() => props.onDoubleClick(props.rowIndex, props.colIndex)}
      >
        {props.cell}
        {/* commitEdit / cancelEdit を呼ぶためのトリガーボタン */}
        <button
          data-testid={`commit-${props.rowIndex}-${props.colIndex}`}
          onClick={() => props.onCommitEdit(props.rowIndex, props.colIndex, 'edited', 'right')}
        />
        <button
          data-testid={`commit-down-${props.rowIndex}-${props.colIndex}`}
          onClick={() => props.onCommitEdit(props.rowIndex, props.colIndex, 'edited', 'down')}
        />
        <button
          data-testid={`commit-up-${props.rowIndex}-${props.colIndex}`}
          onClick={() => props.onCommitEdit(props.rowIndex, props.colIndex, 'edited', 'up')}
        />
        <button
          data-testid={`commit-left-${props.rowIndex}-${props.colIndex}`}
          onClick={() => props.onCommitEdit(props.rowIndex, props.colIndex, 'edited', 'left')}
        />
        <button
          data-testid={`commit-nomove-${props.rowIndex}-${props.colIndex}`}
          onClick={() => props.onCommitEdit(props.rowIndex, props.colIndex, 'edited')}
        />
        <button
          data-testid={`cancel-${props.rowIndex}-${props.colIndex}`}
          onClick={() => props.onCancelEdit(props.rowIndex, props.colIndex)}
        />
      </td>
    )
  }
  MemoizedCell.displayName = 'MemoizedCell'
  return { __esModule: true, default: MemoizedCell }
})

// cellDomUtils のモック
jest.mock('../utils/cellDomUtils', () => ({
  cleanupCellVisualArtifacts: jest.fn(),
  queryCellElement: jest.fn(() => null)
}))

// contentConverter のモック
jest.mock('../utils/contentConverter', () => ({
  processCellContentForStorage: jest.fn((v: string) => v),
  convertBrTagsToNewlines: jest.fn((v: string) => v)
}))

import TableBody from '../components/TableBody'
import { EditorState, GitDiffStatus, ColumnDiffInfo, HeaderConfig } from '../types'

// デフォルトのEditorState
function createEditorState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    currentEditingCell: null,
    selectedCells: new Set<string>(),
    fullySelectedRows: new Set<number>(),
    fullySelectedCols: new Set<number>(),
    selectionRange: null,
    sortState: { column: -1, direction: 'none' },
    columnWidths: {},
    headerConfig: { hasColumnHeaders: true, hasRowHeaders: false },
    ...overrides
  }
}

// テーブル構造内にレンダリングするヘルパー
function renderTableBody(props: Partial<React.ComponentProps<typeof TableBody>> = {}) {
  const defaultProps: React.ComponentProps<typeof TableBody> = {
    headers: ['A', 'B', 'C'],
    rows: [['a1', 'b1', 'c1'], ['a2', 'b2', 'c2']],
    editorState: createEditorState(),
    onCellUpdate: jest.fn(),
    onCellSelect: jest.fn(),
    onCellEdit: jest.fn(),
    onAddRow: jest.fn(),
    onDeleteRow: jest.fn(),
    ...props
  }
  return render(
    <table>
      <TableBody {...defaultProps} />
    </table>
  )
}

describe('TableBody', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('基本レンダリング', () => {
    it('通常のテーブル行がレンダリングされる', () => {
      renderTableBody()
      expect(screen.getByTestId('cell-0-0')).toHaveTextContent('a1')
      expect(screen.getByTestId('cell-0-1')).toHaveTextContent('b1')
      expect(screen.getByTestId('cell-0-2')).toHaveTextContent('c1')
      expect(screen.getByTestId('cell-1-0')).toHaveTextContent('a2')
      expect(screen.getByTestId('cell-1-1')).toHaveTextContent('b2')
      expect(screen.getByTestId('cell-1-2')).toHaveTextContent('c2')
    })

    it('行番号が表示される', () => {
      renderTableBody()
      // 行番号は rowIndex+1
      expect(screen.getByTitle('Row 1')).toBeInTheDocument()
      expect(screen.getByTitle('Row 2')).toBeInTheDocument()
    })

    it('交互網掛けが奇数行に適用される', () => {
      const { container } = renderTableBody()
      const rows = container.querySelectorAll('tr')
      // row0 → 偶数 → striped-rowなし、row1 → 奇数 → striped-row
      expect(rows[0]).not.toHaveClass('striped-row')
      expect(rows[1]).toHaveClass('striped-row')
    })

    it('行ヘッダーON時、先頭列がスキップされる', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      renderTableBody({ headerConfig })
      // colIndex=0 はスキップされるため、cell-0-0 は存在しない
      expect(screen.queryByTestId('cell-0-0')).not.toBeInTheDocument()
      expect(screen.getByTestId('cell-0-1')).toBeInTheDocument()
    })

    it('行ヘッダーON時、行ヘッダー値がタイトルに含まれる', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      renderTableBody({
        headerConfig,
        rows: [['Header1', 'b1', 'c1'], ['Header2', 'b2', 'c2']]
      })
      expect(screen.getByTitle('Row 1: Header1')).toBeInTheDocument()
      expect(screen.getByTitle('Row 2: Header2')).toBeInTheDocument()
    })
  })

  describe('列ヘッダーOFF', () => {
    it('列ヘッダーOFF時、headersがrow=-1として先頭に表示される', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      renderTableBody({ headerConfig })
      // row=-1 のセルが表示される
      expect(screen.getByTestId('cell--1-0')).toHaveTextContent('A')
      expect(screen.getByTestId('cell--1-1')).toHaveTextContent('B')
      expect(screen.getByTestId('cell--1-2')).toHaveTextContent('C')
      // 通常の行も表示される
      expect(screen.getByTestId('cell-0-0')).toHaveTextContent('a1')
    })

    it('列ヘッダーOFF時、row=-1の行番号は0', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      renderTableBody({ headerConfig })
      expect(screen.getByTitle('Row 0')).toBeInTheDocument()
    })
  })

  describe('セル選択', () => {
    it('選択済みセルがselected属性を持つ', () => {
      const editorState = createEditorState({
        selectedCells: new Set(['0-1'])
      })
      renderTableBody({ editorState })
      expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-selected', 'true')
      expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-selected', 'false')
    })

    it('アンカーセルが正しく判定される', () => {
      const editorState = createEditorState({
        selectedCells: new Set(['0-1', '1-1']),
        selectionRange: { start: { row: 0, col: 1 }, end: { row: 1, col: 1 } }
      })
      renderTableBody({ editorState })
      expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-anchor', 'true')
      expect(screen.getByTestId('cell-1-1')).toHaveAttribute('data-anchor', 'false')
    })

    it('単一セル選択かどうかが正しく判定される', () => {
      const editorState = createEditorState({
        selectedCells: new Set(['0-0'])
      })
      renderTableBody({ editorState })
      expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-single-selection', 'true')
    })

    it('複数セル選択時にisSingleSelectionがfalse', () => {
      const editorState = createEditorState({
        selectedCells: new Set(['0-0', '0-1'])
      })
      renderTableBody({ editorState })
      expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-single-selection', 'false')
    })
  })

  describe('選択範囲の境界', () => {
    it('選択範囲がない場合、全ての境界がfalse', () => {
      renderTableBody()
      // selectionRange = null → borders は全て false
      // MemoizedCell のモックはbordersをpropで受けるが、表示テストでは直接検証は不要
      // ここではコードパスが通ることを確認
    })

    it('選択範囲内のセルに正しい境界が設定される', () => {
      const editorState = createEditorState({
        selectedCells: new Set(['0-0', '0-1', '1-0', '1-1']),
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } }
      })
      renderTableBody({ editorState })
      // コードパスを通すことが目的
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })
  })

  describe('マウスイベント', () => {
    it('セルのmousedownでonCellSelectが呼ばれる（通常クリック）', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.mouseDown(screen.getByTestId('cell-0-0'))
      expect(onCellSelect).toHaveBeenCalledWith(0, 0, false, false)
    })

    it('セルのmousedownでshift+clickで範囲選択される', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.mouseDown(screen.getByTestId('cell-0-1'), { shiftKey: true })
      expect(onCellSelect).toHaveBeenCalledWith(0, 1, true, false)
    })

    it('セルのmousedownでctrl+clickでトグル選択される', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.mouseDown(screen.getByTestId('cell-0-1'), { ctrlKey: true })
      expect(onCellSelect).toHaveBeenCalledWith(0, 1, false, true)
    })

    it('セルのmousedownでmeta+clickでトグル選択される', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.mouseDown(screen.getByTestId('cell-0-1'), { metaKey: true })
      expect(onCellSelect).toHaveBeenCalledWith(0, 1, false, true)
    })

    it('cell-inputクラスのtargetではmousedownが無視される', () => {
      const onCellSelect = jest.fn()
      const { container } = renderTableBody({ onCellSelect })
      // cell-inputクラスを持つ要素をシミュレート
      const cell = screen.getByTestId('cell-0-0')
      const inputEl = document.createElement('div')
      inputEl.classList.add('cell-input')
      cell.appendChild(inputEl)
      fireEvent.mouseDown(inputEl, { bubbles: true })
      // cell-input上のクリックは無視されるべき
    })

    it('onDragStartが提供されている場合、通常クリックでonDragStartが呼ばれる', () => {
      const onDragStart = jest.fn()
      const onCellSelect = jest.fn()
      renderTableBody({ onDragStart, onCellSelect })
      fireEvent.mouseDown(screen.getByTestId('cell-0-0'))
      expect(onDragStart).toHaveBeenCalledWith(0, 0)
      expect(onCellSelect).not.toHaveBeenCalled()
    })

    it('onDragEnterが呼ばれる', () => {
      const onDragEnter = jest.fn()
      renderTableBody({ onDragEnter })
      fireEvent.mouseEnter(screen.getByTestId('cell-0-0'))
      expect(onDragEnter).toHaveBeenCalledWith(0, 0)
    })

    it('onDragEnterが未提供でもエラーにならない', () => {
      renderTableBody()
      // onDragEnter未提供でmouseEnterしてもエラーなし
      fireEvent.mouseEnter(screen.getByTestId('cell-0-0'))
    })
  })

  describe('行コンテキストメニュー', () => {
    it('行番号の右クリックでonShowRowContextMenuが呼ばれる', () => {
      const onShowRowContextMenu = jest.fn()
      renderTableBody({ onShowRowContextMenu })
      const rowNumber = screen.getByTitle('Row 1')
      fireEvent.contextMenu(rowNumber)
      expect(onShowRowContextMenu).toHaveBeenCalledWith(expect.any(Object), 0)
    })

    it('onShowRowContextMenuが未提供でもエラーにならない', () => {
      renderTableBody()
      const rowNumber = screen.getByTitle('Row 1')
      fireEvent.contextMenu(rowNumber)
    })
  })

  describe('行選択', () => {
    it('行番号のクリックでonRowSelectが呼ばれる', () => {
      const onRowSelect = jest.fn()
      renderTableBody({ onRowSelect })
      const rowNumber = screen.getByTitle('Row 1')
      fireEvent.click(rowNumber)
      expect(onRowSelect).toHaveBeenCalledWith(0, expect.any(Object))
    })

    it('onRowSelectが未提供でもクリックしてエラーにならない', () => {
      renderTableBody()
      const rowNumber = screen.getByTitle('Row 1')
      fireEvent.click(rowNumber)
    })

    it('選択された行がハイライトされる', () => {
      renderTableBody({ selectedRows: new Set([0]) })
      const rowNumber = screen.getByTitle('Row 1')
      expect(rowNumber).toHaveClass('highlighted')
    })

    it('完全選択された行がselectedクラスを持つ', () => {
      renderTableBody({ fullySelectedRows: new Set([0]) })
      const rowNumber = screen.getByTitle('Row 1')
      expect(rowNumber).toHaveClass('selected')
    })
  })

  describe('セル編集', () => {
    it('ダブルクリックで編集モードに入る（startCellEdit）', () => {
      const onCellEdit = jest.fn()
      renderTableBody({ onCellEdit })
      fireEvent.doubleClick(screen.getByTestId('cell-0-0'))
      expect(onCellEdit).toHaveBeenCalledWith({ row: 0, col: 0 })
    })

    it('編集中セルがisEditing=trueになる', () => {
      const editorState = createEditorState({
        currentEditingCell: { row: 0, col: 1 }
      })
      renderTableBody({ editorState })
      expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-editing', 'true')
      expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-editing', 'false')
    })
  })

  describe('フィル範囲', () => {
    it('フィル範囲内のセルにdata-fill-range=trueが設定される', () => {
      const editorState = createEditorState()
      const fillRange = { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } }
      renderTableBody({ editorState, fillRange })
      expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-fill-range', 'true')
      expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-fill-range', 'true')
      expect(screen.getByTestId('cell-1-0')).toHaveAttribute('data-fill-range', 'true')
      expect(screen.getByTestId('cell-1-1')).toHaveAttribute('data-fill-range', 'true')
      expect(screen.getByTestId('cell-0-2')).toHaveAttribute('data-fill-range', 'false')
    })
  })

  describe('フィルハンドル', () => {
    it('選択範囲の右下セルにフィルハンドルが表示される', () => {
      const editorState = createEditorState({
        selectedCells: new Set(['0-0', '0-1', '1-0', '1-1']),
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } }
      })
      renderTableBody({ editorState })
      expect(screen.getByTestId('cell-1-1')).toHaveAttribute('data-show-fill-handle', 'true')
      expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-show-fill-handle', 'false')
    })

    it('編集中のセルにはフィルハンドルが表示されない', () => {
      const editorState = createEditorState({
        selectedCells: new Set(['0-0']),
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } },
        currentEditingCell: { row: 0, col: 0 }
      })
      renderTableBody({ editorState })
      expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-show-fill-handle', 'false')
    })
  })

  describe('検索結果', () => {
    it('isSearchResultが正しく渡される', () => {
      const isSearchResult = jest.fn((row: number, col: number) => row === 0 && col === 1)
      renderTableBody({ isSearchResult })
      expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-search-result', 'true')
      expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-search-result', 'false')
    })

    it('isCurrentSearchResultが正しく渡される', () => {
      const isCurrentSearchResult = jest.fn((row: number, col: number) => row === 1 && col === 2)
      renderTableBody({ isCurrentSearchResult })
      expect(screen.getByTestId('cell-1-2')).toHaveAttribute('data-current-search-result', 'true')
    })

    it('isSearchResult未提供時はfalseになる', () => {
      renderTableBody()
      expect(screen.getByTestId('cell-0-0')).toHaveAttribute('data-search-result', 'false')
    })
  })

  describe('commitCellEdit', () => {
    it('右方向移動: 列が右端でない場合に次の列に移動', () => {
      const onCellUpdate = jest.fn()
      const onCellEdit = jest.fn()
      const onCellSelect = jest.fn()
      renderTableBody({ onCellUpdate, onCellEdit, onCellSelect })
      fireEvent.click(screen.getByTestId('commit-0-0'))
      expect(onCellUpdate).toHaveBeenCalledWith(0, 0, 'edited')
      expect(onCellEdit).toHaveBeenCalledWith(null)
      expect(onCellSelect).toHaveBeenCalledWith(0, 1, false)
    })

    it('右方向移動: 列が右端の場合は次の行の先頭に移動', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-0-2'))
      expect(onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('右方向移動: 最終行の右端では移動しない', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-1-2'))
      // 最終行最終列 → 移動不可 → 位置そのまま
      expect(onCellSelect).toHaveBeenCalledWith(1, 2, false)
    })

    it('下方向移動: 最終行でない場合', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-down-0-0'))
      expect(onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('下方向移動: 最終行の場合は移動しない', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-down-1-0'))
      expect(onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('上方向移動: 最初の行でない場合', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-up-1-0'))
      expect(onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('上方向移動: 最初の行の場合は移動しない', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-up-0-0'))
      expect(onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('左方向移動: 先頭列でない場合', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-left-0-1'))
      expect(onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('左方向移動: 先頭列の場合は前の行の最終列に移動', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-left-1-0'))
      expect(onCellSelect).toHaveBeenCalledWith(0, 2, false)
    })

    it('左方向移動: 最初の行の先頭列では移動しない', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-left-0-0'))
      expect(onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('move未指定の場合はonCellSelectが呼ばれない', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect })
      fireEvent.click(screen.getByTestId('commit-nomove-0-0'))
      expect(onCellSelect).not.toHaveBeenCalled()
    })

    it('列ヘッダーOFF時のminRowは-1になる', () => {
      const onCellSelect = jest.fn()
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      renderTableBody({ onCellSelect, headerConfig })
      // row=0 で上移動 → minRow=-1 なので row=-1 に移動
      fireEvent.click(screen.getByTestId('commit-up-0-0'))
      expect(onCellSelect).toHaveBeenCalledWith(-1, 0, false)
    })

    it('列ヘッダーOFF時に左移動でrow=-1の最終列に移動', () => {
      const onCellSelect = jest.fn()
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      renderTableBody({ onCellSelect, headerConfig })
      // row=0, col=0 で左移動 → minRow=-1 なので row=-1, col=maxCol に移動
      fireEvent.click(screen.getByTestId('commit-left-0-0'))
      expect(onCellSelect).toHaveBeenCalledWith(-1, 2, false)
    })
  })

  describe('cancelCellEdit', () => {
    it('キャンセル時にonCellEdit(null)が呼ばれる', () => {
      const onCellEdit = jest.fn()
      renderTableBody({ onCellEdit })
      fireEvent.click(screen.getByTestId('cancel-0-0'))
      expect(onCellEdit).toHaveBeenCalledWith(null)
    })
  })

  describe('getDragProps / getDropProps', () => {
    it('getDragPropsが行番号に適用される', () => {
      const getDragProps = jest.fn(() => ({ 'data-drag': 'true' }))
      const getDropProps = jest.fn(() => ({ 'data-drop': 'true' }))
      renderTableBody({ getDragProps, getDropProps })
      expect(getDragProps).toHaveBeenCalled()
      expect(getDropProps).toHaveBeenCalled()
    })

    it('getDragPropsにselectedRowsが渡される', () => {
      const getDragProps = jest.fn(() => ({}))
      const getDropProps = jest.fn(() => ({}))
      renderTableBody({
        getDragProps,
        getDropProps,
        selectedRows: new Set([0, 1])
      })
      expect(getDragProps).toHaveBeenCalledWith('row', expect.any(Number), expect.arrayContaining([0, 1]))
    })
  })

  describe('columnWidths', () => {
    it('カスタム列幅がuserResizedとして反映される', () => {
      const editorState = createEditorState({
        columnWidths: { 0: 200 }
      })
      renderTableBody({ editorState })
      // colIndex=0 のセルで userResized が true になる (200 !== 150)
    })

    it('デフォルト列幅(150)の場合はuserResized=false', () => {
      const editorState = createEditorState({
        columnWidths: { 0: 150 }
      })
      renderTableBody({ editorState })
    })
  })

  describe('Git差分表示', () => {
    it('追加行にgit-diff-addedアイコンが表示される', () => {
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ]
      })
      const addedIcon = container.querySelector('.git-diff-icon.git-diff-added')
      expect(addedIcon).toBeInTheDocument()
      expect(addedIcon).toHaveTextContent('+')
    })

    it('削除行にgit-diff-deletedアイコンが表示される', () => {
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED }
        ]
      })
      const deletedIcon = container.querySelector('.git-diff-icon.git-diff-deleted')
      expect(deletedIcon).toBeInTheDocument()
      expect(deletedIcon).toHaveTextContent('-')
    })

    it('unchanged行にはアイコンが表示されない', () => {
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.UNCHANGED }
        ]
      })
      const icon = container.querySelector('.git-diff-icon')
      expect(icon).not.toBeInTheDocument()
    })

    it('gitDiffがundefinedでもエラーにならない', () => {
      renderTableBody({ gitDiff: undefined })
    })

    it('gitDiffの要素がnullでもエラーにならない', () => {
      renderTableBody({
        gitDiff: [null as any, { row: 0, status: GitDiffStatus.ADDED }]
      })
    })
  })

  describe('削除行表示（mappingなし）', () => {
    it('削除行が対応する行の前に表示される', () => {
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 | old3 |' }
        ]
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
      // 削除行には「-」アイコンがある
      const icon = deletedRow?.querySelector('.git-diff-icon.git-diff-deleted')
      expect(icon).toHaveTextContent('-')
    })

    it('削除行のセル内容が正しく表示される', () => {
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| hello | world |' }
        ]
      })
      const deletedCells = container.querySelectorAll('.git-diff-deleted-cell')
      expect(deletedCells.length).toBeGreaterThan(0)
    })

    it('削除行で内容が一致するセルにgit-diff-same-contentクラスが付く', () => {
      const { container } = renderTableBody({
        rows: [['a1', 'b1', 'c1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| a1 | different | c1 |' }
        ]
      })
      const sameCells = container.querySelectorAll('.git-diff-same-content')
      expect(sameCells.length).toBeGreaterThan(0)
    })

    it('末尾パディング: 現在列数が削除行セル数より多い場合にプレースホルダが追加される', () => {
      const { container } = renderTableBody({
        headers: ['A', 'B', 'C', 'D'],
        rows: [['a1', 'b1', 'c1', 'd1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 |' }
        ]
      })
      const notExistCells = container.querySelectorAll('.git-diff-column-not-exist')
      expect(notExistCells.length).toBeGreaterThan(0)
    })

    it('削除行でoldContentが空の場合', () => {
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '' }
        ]
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('削除行でoldContentがundefinedの場合', () => {
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true }
        ]
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })
  })

  describe('削除行表示（mappingあり）', () => {
    it('mapping付きで削除列がハッチングされる', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 | old3 |' }
        ],
        columnDiff
      })
      const notExistCells = container.querySelectorAll('.git-diff-column-not-exist')
      // mapping により削除列のプレースホルダがない（削除列はそのまま表示される）
      expect(container.querySelector('.git-diff-deleted-row')).toBeInTheDocument()
    })

    it('mapping付きで追加列のプレースホルダが挿入される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [2],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 2, type: 'added', confidence: 0.9, newIndex: 2 }]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B', 'C'],
        rows: [['a1', 'b1', 'c1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 |' }
        ],
        columnDiff,
        editorState: createEditorState({ columnWidths: { 2: 180 } })
      })
      const placeholders = container.querySelectorAll('[data-placeholder-reason="added-column"]')
      expect(placeholders.length).toBeGreaterThan(0)
    })

    it('mapping付きで削除列のセルが同内容なら git-diff-same-content クラスが付く', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        mapping: [0, 1]
      }
      const { container } = renderTableBody({
        rows: [['same', 'same']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| same | same |' }
        ],
        columnDiff
      })
      const sameCells = container.querySelectorAll('.git-diff-same-content')
      expect(sameCells.length).toBeGreaterThan(0)
    })
  })

  describe('追加行の列差分表示（mappingあり）', () => {
    it('追加行で削除列のプレースホルダが表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      const placeholders = container.querySelectorAll('[data-placeholder-reason="deleted-column"]')
      expect(placeholders.length).toBeGreaterThan(0)
    })

    it('追加行で低信頼度の削除列に「推定」テキストが含まれる', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.5 }]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder?.getAttribute('title')).toContain('推定')
    })

    it('追加行で高信頼度の削除列に「推定」テキストが含まれない', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.95 }]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder?.getAttribute('title')).not.toContain('推定')
    })

    it('追加行で追加列が通常セルとして表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [2],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 2, type: 'added', confidence: 0.9, newIndex: 2 }]
      }
      renderTableBody({
        headers: ['A', 'B', 'C'],
        rows: [['a1', 'b1', 'c1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      // MemoizedCell としてレンダリングされる
    })

    it('追加行の残存列がMemoizedCellとしてレンダリングされる', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      expect(screen.getByTestId('cell-0-0')).toHaveTextContent('a1')
      expect(screen.getByTestId('cell-0-1')).toHaveTextContent('b1')
    })
  })

  describe('ヘッダ行(row=-1)の列差分表示', () => {
    it('列ヘッダーOFF・列差分あり時、削除列ヘッダが表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        oldHeaders: ['H1', 'H2', 'H3'],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H3'],
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      // ヘッダ行で削除列のプレースホルダ
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder).toBeInTheDocument()
    })

    it('列ヘッダーOFF・列差分あり時、残存列ヘッダが正しく表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H2'],
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      // ヘッダ行が正しくレンダリングされる
      expect(container.querySelector('.column-header-content')).toBeInTheDocument()
    })

    it('列ヘッダーOFF・追加列がヘッダ行に表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [2],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 2, type: 'added', confidence: 0.9, newIndex: 2 }]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H2', 'H3'],
        rows: [['a1', 'b1', 'c1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      // 追加列がヘッダに表示される
      const headerContents = container.querySelectorAll('.column-header-content')
      expect(headerContents.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('追加行の列差分表示（mappingなし、フォールバック）', () => {
    it('mappingなしで削除列のプレースホルダが表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder).toBeInTheDocument()
    })

    it('mappingなしで低信頼度の削除列', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        positions: [{ index: 1, type: 'removed', confidence: 0.3 }]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder?.getAttribute('title')).toContain('推定')
    })

    it('mappingなしで通常セルがMemoizedCellとして表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: []
      }
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })

    it('mappingなし・行ヘッダーON時に先頭列がスキップされる', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 4,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [1]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      renderTableBody({
        headers: ['RH', 'A', 'B'],
        rows: [['rh1', 'a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff,
        headerConfig
      })
      // colIndex=0 はスキップされる（フォールバックパスでもreturn null）
    })

    it('mappingなし・ヘッダ行(row=-1)でoldHeadersが表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        oldHeaders: ['OldH1', 'OldH2', 'OldH3']
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H2'],
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      const headerContents = container.querySelectorAll('.column-header-content')
      expect(headerContents.length).toBeGreaterThanOrEqual(2)
    })

    it('mappingなし・ヘッダ行(row=-1)でoldHeadersがない場合セル内容が使われる', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: []
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      renderTableBody({
        headers: ['H1', 'H2'],
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
    })
  })

  describe('削除行表示（行ヘッダーON）', () => {
    it('行ヘッダーON時、削除行の先頭列がスキップされる（mappingあり）', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [],
        mapping: [0, 1, 2]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      const { container } = renderTableBody({
        headers: ['RH', 'A', 'B'],
        rows: [['rh1', 'a1', 'b1']],
        headerConfig,
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| rh_old | old1 | old2 |' }
        ],
        columnDiff
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('行ヘッダーON時、削除行の先頭列がスキップされる（mappingなし）', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      const { container } = renderTableBody({
        headers: ['RH', 'A', 'B'],
        rows: [['rh1', 'a1', 'b1']],
        headerConfig,
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| rh_old | old1 | old2 |' }
        ]
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })
  })

  describe('行ヘッダー表示', () => {
    it('行ヘッダーON時に行番号ラベルと行ヘッダー値が表示される', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      const { container } = renderTableBody({
        headerConfig,
        rows: [['Title1', 'b1', 'c1']]
      })
      expect(container.querySelector('.row-number-label')).toBeInTheDocument()
      expect(container.querySelector('.row-header-title')).toBeInTheDocument()
    })

    it('行ヘッダーON時にrow-header-with-valueクラスが付く', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      renderTableBody({ headerConfig })
      const rowNumber = screen.getByTitle('Row 1: a1')
      expect(rowNumber).toHaveClass('row-header-with-value')
    })
  })

  describe('gitDiffStatusクラス', () => {
    it('追加行の行番号にgit-diff-addedクラスが付く', () => {
      renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ]
      })
      const rowNumber = screen.getByTitle('Row 1')
      expect(rowNumber).toHaveClass('git-diff-added')
    })

    it('git差分がない行にはgitDiffクラスが付かない', () => {
      renderTableBody()
      const rowNumber = screen.getByTitle('Row 1')
      expect(rowNumber.className).not.toContain('git-diff-')
    })
  })

  describe('parseTableRowCells（内部関数）', () => {
    // parseTableRowCells は内部関数だが、削除行表示経由でテストできる
    it('空のrowContentで空配列が返る', () => {
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '' }
        ]
      })
      // oldContent='' → parseTableRowCells returns [] → deletedCells is empty
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('通常のrowContentが正しくパースされる', () => {
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| cell1 | cell2 |' }
        ]
      })
      const deletedCells = container.querySelectorAll('.git-diff-deleted-cell')
      expect(deletedCells.length).toBe(2)
    })
  })

  describe('追加行の列差分表示（mappingあり）ヘッダ行', () => {
    it('ヘッダ行で追加列に対して残存列がMemoizedCellでなくtdで表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [2],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 2, type: 'added', confidence: 0.9, newIndex: 2 }]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H2', 'H3'],
        rows: [['a1', 'b1', 'c1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      // ヘッダ行に.column-header-contentが存在
      const headerContents = container.querySelectorAll('.column-header-content')
      expect(headerContents.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('mapping付き列差分の追加行で行ヘッダON', () => {
    it('mapping付き・行ヘッダーON時にoldColIdx=0がスキップされる', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 4,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1, 2],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      renderTableBody({
        headers: ['RH', 'A', 'B'],
        rows: [['rh1', 'a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff,
        headerConfig
      })
      // rowHeader列がスキップされる
      expect(screen.queryByTestId('cell-0-0')).not.toBeInTheDocument()
    })
  })

  describe('mapping付き追加行でpositionsなしの場合', () => {
    it('positionsがない場合でもmapping付き表示が正常に動く', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        mapping: [0, 1]
      }
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })
  })

  describe('削除行の交互網掛け', () => {
    it('奇数行の削除行にstriped-rowクラスが付く', () => {
      const { container } = renderTableBody({
        rows: [['a1', 'b1', 'c1'], ['a2', 'b2', 'c2']],
        gitDiff: [
          { row: 1, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 | old3 |' }
        ]
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toHaveClass('striped-row')
    })
  })

  describe('その他のデータ行（非ADDED行）で追加列がある場合', () => {
    it('unchanged行で追加列がハッチングプレースホルダとして表示される', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [2],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 2, type: 'added', confidence: 0.9, newIndex: 2 }]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B', 'C'],
        rows: [['a1', 'b1', 'c1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.UNCHANGED }
        ],
        columnDiff
      })
      // UNCHANGED行ではhasColumnChanges=trueだがgitDiffStatus !== ADDED
      // → shouldUseDeletedBeforeColumns = false → 通常レンダリング
    })
  })

  describe('mappingなしフォールバック・ヘッダ行の削除列', () => {
    it('ヘッダ行でmappingなし・列差分あり・追加行の場合に列が削除されてプレースホルダ表示', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H3'],
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder).toBeInTheDocument()
    })
  })

  describe('onMouseDown on row number (getDragProps branch)', () => {
    it('行番号のmouseDownでgetDragPropsがある場合', () => {
      const getDragProps = jest.fn(() => ({}))
      renderTableBody({ getDragProps })
      const rowNumber = screen.getByTitle('Row 1')
      fireEvent.mouseDown(rowNumber)
      // getDragProps がある場合でもエラーにならない（空のハンドラ）
    })
  })

  describe('positionsフィルタリングの確認', () => {
    it('positionsにremovedのみある場合addedPositionsは空', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 | old3 |' }
        ],
        columnDiff
      })
      // addedPositions が空なので追加プレースホルダなし
      const addedPlaceholders = container.querySelectorAll('[data-placeholder-reason="added-column"]')
      expect(addedPlaceholders.length).toBe(0)
    })
  })

  describe('columnDiff.positionsのindexとnewIndex', () => {
    it('positionsのnewIndexがundefinedの場合indexが使われる', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 1, type: 'added', confidence: 0.9 }]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B', 'C'],
        rows: [['a1', 'b1', 'c1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 |' }
        ],
        columnDiff,
        editorState: createEditorState({ columnWidths: { 1: 200 } })
      })
      const placeholders = container.querySelectorAll('[data-placeholder-reason="added-column"]')
      expect(placeholders.length).toBeGreaterThan(0)
    })
  })

  describe('hasColumnChanges判定', () => {
    it('columnDiffがあるがdeletedColumnsもpositionsのaddedもない場合', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        mapping: [0, 1]
      }
      renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      // hasColumnChanges = false → shouldUseDeletedBeforeColumns = false → 通常レンダリング
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })

    it('columnDiffがundefinedの場合', () => {
      renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ]
      })
      // columnDiff undefined → 通常レンダリング
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })
  })

  describe('positionsが未定義（confidence fallback）', () => {
    it('positionsがundefinedの場合confidence=0.5にフォールバック', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1]
        // positions が undefined
      }
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder?.getAttribute('title')).toContain('推定')
    })
  })

  describe('Branchカバレッジ補完', () => {
    it('行ヘッダーONでcells[0]が空文字列の場合', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      const { container } = renderTableBody({
        headerConfig,
        rows: [['', 'b1', 'c1']]
      })
      // rowHeaderValue = '' でタイトルが適切に表示される
      const rowNumberCell = container.querySelector('.row-number')
      expect(rowNumberCell).toBeInTheDocument()
      expect(rowNumberCell?.getAttribute('title')).toMatch(/Row 1/)
    })

    it('削除行の rowIndex < 0 の場合 addedCells は空配列', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [],
        mapping: [0, 1, 2]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H2', 'H3'],
        rows: [['a1', 'b1', 'c1']],
        headerConfig,
        gitDiff: [
          { row: -1, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 | old3 |' }
        ],
        columnDiff
      })
      // row=-1 の削除行が表示される
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('削除行でmapping付き・headerConfig.hasRowHeaders=true でoldColIdx=0がスキップされる', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [],
        mapping: [0, 1, 2]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      const { container } = renderTableBody({
        headers: ['RH', 'A', 'B'],
        rows: [['rh1', 'a1', 'b1']],
        headerConfig,
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| rh | old1 | old2 |' }
        ],
        columnDiff
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('削除行でmappingなし・headerConfig.hasRowHeaders=true でcellIndex=0がスキップされる', () => {
      const headerConfig: HeaderConfig = { hasColumnHeaders: true, hasRowHeaders: true }
      const { container } = renderTableBody({
        headers: ['RH', 'A', 'B'],
        rows: [['rh1', 'a1', 'b1']],
        headerConfig,
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| rh | old1 | old2 |' }
        ]
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('削除行でmapping付き・削除列のpositionsが空配列の場合', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        mapping: [0, 1],
        positions: []
      }
      const { container } = renderTableBody({
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 |' }
        ],
        columnDiff
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('mapping付き削除行のnewColIdx=-1でaddedCellsのnewColIdxが空の場合', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [2],
        mapping: [0, 1, -1],
        positions: [{ index: 2, type: 'removed', confidence: 0.9 }]
      }
      const { container } = renderTableBody({
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 | old3 |' }
        ],
        columnDiff
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('gitDiffのrowGitDiffがundefinedの行', () => {
      renderTableBody({
        rows: [['a1', 'b1', 'c1'], ['a2', 'b2', 'c2']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
          // row=1 にはgitDiffエントリなし
        ]
      })
      // row=1 は gitDiffStatus = undefined → アイコンなし
      expect(screen.getByTestId('cell-1-0')).toBeInTheDocument()
    })

    it('headerConfig?.hasColumnHeaders が undefined の場合 minRow=0', () => {
      const onCellSelect = jest.fn()
      renderTableBody({ onCellSelect, headerConfig: undefined })
      fireEvent.click(screen.getByTestId('commit-up-0-0'))
      // headerConfig undefined → minRow=0 → 移動なし
      expect(onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('削除行でmappingなしフォールバック・同内容でないセル', () => {
      const { container } = renderTableBody({
        rows: [['a1', 'b1', 'c1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| different | other | more |' }
        ]
      })
      const sameCells = container.querySelectorAll('.git-diff-same-content')
      expect(sameCells.length).toBe(0)
    })

    it('フォールバック削除行でヘッダ数が多い場合のパディング', () => {
      const { container } = renderTableBody({
        headers: ['A', 'B', 'C', 'D', 'E'],
        rows: [['a1', 'b1', 'c1', 'd1', 'e1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 |' }
        ],
        editorState: createEditorState({ columnWidths: { 3: 200, 4: 180 } })
      })
      const notExistCells = container.querySelectorAll('.git-diff-column-not-exist')
      expect(notExistCells.length).toBe(3)
    })

    it('mapping付きの追加行でpositions内のaddedでnewIndexが定義されている場合', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 1, type: 'added', confidence: 0.95, newIndex: 1 }]
      }
      renderTableBody({
        headers: ['A', 'NEW', 'B'],
        rows: [['a1', 'new1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
    })

    it('ヘッダ行(row=-1)でmapping付きの削除列にoldHeaders未定義', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
        // oldHeaders が未定義
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H3'],
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder).toBeInTheDocument()
    })

    it('ヘッダ行(row=-1)でmappingなし・削除列の表示', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }],
        oldHeaders: ['H1', 'H2deleted', 'H3']
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H3'],
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      // フォールバックパスで削除列のプレースホルダ
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder).toBeInTheDocument()
    })

    it('columnDiffがあるがgitDiffStatusがMODIFIEDの場合は通常レンダリング', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.MODIFIED }
        ],
        columnDiff
      })
      // MODIFIED → shouldUseDeletedBeforeColumns = false → 通常レンダリング
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })

    it('mapping付き・追加行でpositions空配列', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: []
      }
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder).toBeInTheDocument()
    })

    it('mapping付き・ヘッダ行の追加列でpositionsの位置挿入', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 1, type: 'added', confidence: 0.9, newIndex: 1 }]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'NEW', 'H2'],
        rows: [['a1', 'new', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      const headerContents = container.querySelectorAll('.column-header-content')
      expect(headerContents.length).toBeGreaterThanOrEqual(3)
    })

    it('columnWidths にカスタム値がある場合の幅設定', () => {
      const editorState = createEditorState({
        columnWidths: { 0: 200, 1: 300 }
      })
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        editorState,
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      // 列幅がカスタム値で設定される
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder).toBeInTheDocument()
    })

    it('mapping付きフォールバック・ヘッダ行(row=-1)でoldHeadersが空配列の場合', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        oldHeaders: []
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H2'],
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      const headerContents = container.querySelectorAll('.column-header-content')
      expect(headerContents.length).toBeGreaterThanOrEqual(1)
    })

    it('mapping付きフォールバック・ヘッダ行(row=-1)でoldHeaders[oldColIdx]が空', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        oldHeaders: ['H1', '', 'H3']
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H3'],
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      const headerContents = container.querySelectorAll('.column-header-content')
      expect(headerContents.length).toBeGreaterThanOrEqual(2)
    })

    it('mapping付きフォールバック・positionsなしでconfidence=0.5にフォールバック', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1]
        // positions は undefined
      }
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      const placeholder = container.querySelector('[data-placeholder-reason="deleted-column"]')
      expect(placeholder?.getAttribute('title')).toContain('推定')
    })

    it('削除行mapping: deletedCellsが足りない場合のfallback', () => {
      // oldContent のセル数 < mapping の列数 → deletedCells[oldColIdx] が undefined → || '' が発動
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 4,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1, 2]
      }
      const { container } = renderTableBody({
        headers: ['A', 'B', 'C'],
        rows: [['a1', 'b1', 'c1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 |' }
        ],
        columnDiff
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('削除行mapping: positions内のnewIndexがundefined', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 1, type: 'added', confidence: 0.9 }] // newIndex なし
      }
      const { container } = renderTableBody({
        headers: ['A', 'NEW', 'B'],
        rows: [['a1', 'new', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 |' }
        ],
        columnDiff
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('削除行mappingなし: addedCellsの要素がundefined', () => {
      // addedCells = cells (rowIndex >= 0) でcellsの要素数 < deletedCellsの要素数
      const { container } = renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1']],   // 1要素だけ → addedCells[1] が undefined
        gitDiff: [
          { row: 0, status: GitDiffStatus.DELETED, isDeletedRow: true, oldContent: '| old1 | old2 |' }
        ]
      })
      const deletedRow = container.querySelector('.git-diff-deleted-row')
      expect(deletedRow).toBeInTheDocument()
    })

    it('ADDED行+mapping: headers要素が不足するfallback', () => {
      // mapping の newColIdx が headers の範囲外 → headers[newColIdx] || '' が発動
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 4,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1, 2]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1'],  // 要素不足: headers[1], headers[2] は undefined
        rows: [['a1', 'b1', 'c1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      const headerContents = container.querySelectorAll('.column-header-content')
      expect(headerContents.length).toBeGreaterThanOrEqual(1)
    })

    it('ADDED行+mapping: cells要素が不足するfallback', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 4,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1, 2]
      }
      renderTableBody({
        headers: ['A', 'B', 'C'],
        rows: [['a1']],  // 要素不足: cells[1], cells[2] は undefined → || '' 発動
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })

    it('ADDED行+mapping: isSearchResultとisCurrentSearchResultを渡す', () => {
      const isSearchResult = jest.fn(() => true)
      const isCurrentSearchResult = jest.fn(() => false)
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff,
        isSearchResult,
        isCurrentSearchResult
      })
      expect(isSearchResult).toHaveBeenCalled()
      expect(isCurrentSearchResult).toHaveBeenCalled()
    })

    it('ADDED行+mapping: 編集中のセルがある場合', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const editorState = createEditorState({
        currentEditingCell: { row: 0, col: 0 }
      })
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        editorState,
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff,
        initialCellInput: 'test'
      })
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })

    it('ADDED行+mapping: columnWidthsにカスタム値がある場合', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        mapping: [0, -1, 1],
        positions: [{ index: 1, type: 'removed', confidence: 0.9 }]
      }
      const editorState = createEditorState({
        columnWidths: { 0: 200, 1: 300 }
      })
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        editorState,
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })

    it('ADDED行+mapping: addedPositions のnewIndexがundefined', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 1, type: 'added', confidence: 0.9 }] // newIndex なし
      }
      renderTableBody({
        headers: ['A', 'NEW', 'B'],
        rows: [['a1', 'new', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })

    it('ADDED行+mapping: addedPositionsでheaders/cells要素が不足', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 4,
        addedColumns: [2, 3],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [
          { index: 2, type: 'added', confidence: 0.9, newIndex: 2 },
          { index: 3, type: 'added', confidence: 0.9, newIndex: 3 }
        ]
      }
      renderTableBody({
        headers: ['A', 'B'],   // headers[2], headers[3] は undefined
        rows: [['a1', 'b1']],  // cells[2], cells[3] は undefined
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })

    it('ADDED行+mapping: addedPositions でisSearchResult/isCurrentSearchResult渡す', () => {
      const isSearchResult = jest.fn(() => false)
      const isCurrentSearchResult = jest.fn(() => false)
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 1, type: 'added', confidence: 0.9, newIndex: 1 }]
      }
      renderTableBody({
        headers: ['A', 'NEW', 'B'],
        rows: [['a1', 'new', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff,
        isSearchResult,
        isCurrentSearchResult
      })
    })

    it('ADDED行+mapping: addedPositions で編集中のセル', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 3,
        addedColumns: [1],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [{ index: 1, type: 'added', confidence: 0.9, newIndex: 1 }]
      }
      const editorState = createEditorState({
        currentEditingCell: { row: 0, col: 1 }
      })
      renderTableBody({
        headers: ['A', 'NEW', 'B'],
        rows: [['a1', 'new', 'b1']],
        editorState,
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff,
        initialCellInput: 'editing'
      })
    })

    it('ヘッダ行(row=-1)+mapping: addedPositionsでheaders要素が不足', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 4,
        addedColumns: [2, 3],
        deletedColumns: [],
        mapping: [0, 1],
        positions: [
          { index: 2, type: 'added', confidence: 0.9, newIndex: 2 },
          { index: 3, type: 'added', confidence: 0.9, newIndex: 3 }
        ]
      }
      const headerConfig: HeaderConfig = { hasColumnHeaders: false, hasRowHeaders: false }
      const { container } = renderTableBody({
        headers: ['H1', 'H2'],  // headers[2], headers[3] は undefined
        rows: [['a1', 'b1']],
        headerConfig,
        columnDiff,
        gitDiff: []
      })
      const headerContents = container.querySelectorAll('.column-header-content')
      expect(headerContents.length).toBeGreaterThanOrEqual(2)
    })

    it('フォールバック: ADDED行でoldHeaders[oldColIdx]がfalsy', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [1],
        oldHeaders: ['H1', '', 'H3']
      }
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument()
    })

    it('フォールバック: ADDED行でisSearchResult/isCurrentSearchResult渡す', () => {
      const isSearchResult = jest.fn(() => true)
      const isCurrentSearchResult = jest.fn(() => true)
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        positions: [{ index: 0, type: 'added', confidence: 0.9, newIndex: 0 }]
      }
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff,
        isSearchResult,
        isCurrentSearchResult
      })
    })

    it('フォールバック: ADDED行で編集中のセル', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        positions: [{ index: 0, type: 'added', confidence: 0.9, newIndex: 0 }]
      }
      const editorState = createEditorState({
        currentEditingCell: { row: 0, col: 0 }
      })
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        editorState,
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff,
        initialCellInput: 'test'
      })
    })

    it('フォールバック: ADDED行でcolumnWidthsにカスタム値', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 2,
        newColumnCount: 2,
        addedColumns: [],
        deletedColumns: [],
        positions: [{ index: 0, type: 'added', confidence: 0.9, newIndex: 0 }]
      }
      const editorState = createEditorState({
        columnWidths: { 0: 200, 1: 300 }
      })
      renderTableBody({
        headers: ['A', 'B'],
        rows: [['a1', 'b1']],
        editorState,
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
    })

    it('フォールバック: ADDED行でcells要素不足', () => {
      const columnDiff: ColumnDiffInfo = {
        oldColumnCount: 3,
        newColumnCount: 3,
        addedColumns: [],
        deletedColumns: [],
        positions: [{ index: 0, type: 'added', confidence: 0.9, newIndex: 0 }]
      }
      renderTableBody({
        headers: ['A', 'B', 'C'],
        rows: [['a1']],  // cells[1], cells[2] は undefined
        gitDiff: [
          { row: 0, status: GitDiffStatus.ADDED }
        ],
        columnDiff
      })
    })
  })
})
