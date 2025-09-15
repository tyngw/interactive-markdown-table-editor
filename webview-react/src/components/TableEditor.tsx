import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { TableData, VSCodeMessage, SortState } from '../types'
import { useTableEditor } from '../hooks/useTableEditor'
import { useClipboard } from '../hooks/useClipboard'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'
import { useCSVExport } from '../hooks/useCSVExport'
import { useDragDrop } from '../hooks/useDragDrop'
import { useStatus } from '../contexts/StatusContext'
import TableHeader from './TableHeader'
import TableBody from './TableBody'
import ContextMenu, { ContextMenuState } from './ContextMenu'

interface TableEditorProps {
  tableData: TableData
  currentTableIndex?: number
  onTableUpdate: (data: TableData) => void
  onSendMessage: (message: VSCodeMessage) => void
  sortState?: SortState
  setSortState?: (updater: SortState | ((prev: SortState) => SortState)) => void
}

const TableEditor: React.FC<TableEditorProps> = ({
  tableData,
  currentTableIndex,
  onTableUpdate,
  onSendMessage,
  sortState,
  setSortState
}) => {
  // 外部未指定時は内部の状態を使用
  const [internalSortState, setInternalSortState] = useState<SortState>({ column: -1, direction: 'none' })
  const effectiveSortState = sortState ?? internalSortState
  const effectiveSetSortState = setSortState ?? setInternalSortState
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    type: null,
    index: -1,
    position: { x: 0, y: 0 }
  })

  const { updateStatus, updateTableInfo, updateSaveStatus, updateSortState } = useStatus()

  // 送信データに tableIndex を必要に応じて付与
  const withTableIndex = useCallback(<T extends object>(data: T): T & { tableIndex?: number } => {
    return currentTableIndex !== undefined ? { ...data, tableIndex: currentTableIndex } : { ...data }
  }, [currentTableIndex])

  const {
  tableData: displayedTableData,
  modelTableData,
    editorState,
    selectionAnchor,
    updateCell,
    updateCells,
    updateHeader,
    addRow,
    deleteRow,
    addColumn,
    deleteColumn,
    selectCell,
    selectRow,
    selectColumn,
    selectAll,
    setCurrentEditingCell,
    setSelectionAnchor,
    setColumnWidth,
    sortColumn,
    moveRow,
    moveColumn,
    commitSort,
    resetSort
  } = useTableEditor(
    tableData,
    `table-${currentTableIndex}`,
    { sortState: effectiveSortState, setSortState: effectiveSetSortState },
    { initializeSelectionOnDataChange: true }
  )

  const selectedRows = useMemo(() => {
    const rows = new Set<number>();
    editorState.selectedCells.forEach(cellKey => {
      rows.add(parseInt(cellKey.split('-')[0], 10));
    });
    return rows;
  }, [editorState.selectedCells]);

  const selectedCols = useMemo(() => {
    const cols = new Set<number>();
    editorState.selectedCells.forEach(cellKey => {
      cols.add(parseInt(cellKey.split('-')[1], 10));
    });
    return cols;
  }, [editorState.selectedCells]);

  const { copySelectedCells, pasteFromClipboard } = useClipboard({
    addRow,
    addColumn,
    updateCells
  })

  const { exportToCSV, exportToTSV } = useCSVExport()

  const { getDragProps, getDropProps } = useDragDrop({
    onMoveRow: moveRow,
    onMoveColumn: moveColumn
  })

  // 仮想スクロール用: スクロール位置と可視領域高さを追跡
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const rowHeight = 30 // px, 保守的な固定行高（自動調整は別タスク）
  const virtualizationThreshold = 200 // この行数を超えたら仮想スクロール有効化
  const overscan = 5

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateSize = () => setContainerHeight(el.clientHeight)
    updateSize()
    // ResizeObserver が使えない環境向けに window resize も併用
    const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(updateSize) : null
    ro?.observe(el)
    window.addEventListener('resize', updateSize)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    setScrollTop(containerRef.current.scrollTop)
  }, [])

  const totalRowCount = displayedTableData.rows.length
  const virtualizationEnabled = totalRowCount > virtualizationThreshold
  const visibleWindow = useMemo(() => {
    if (!virtualizationEnabled) return null
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2
    const endIndex = Math.min(totalRowCount, startIndex + visibleCount)
    const topPadding = startIndex * rowHeight
    const bottomPadding = Math.max(0, (totalRowCount - endIndex) * rowHeight)
    return { startIndex, endIndex, topPadding, bottomPadding }
  }, [virtualizationEnabled, scrollTop, containerHeight, rowHeight, overscan, totalRowCount])

  // 列/行選択をUIイベントから受け取りやすい形でラップ
  const handleColumnSelect = useCallback((col: number, event: React.MouseEvent) => {
    const extend = event.shiftKey
    selectColumn(col, extend)
  }, [selectColumn])

  const handleRowSelect = useCallback((row: number, event: React.MouseEvent) => {
    const extend = event.shiftKey
    selectRow(row, extend)
  }, [selectRow])

  // 親へはモデルデータの変更のみ通知（displayedDataはソートで頻繁に変わるため通知しない）
  useEffect(() => {
    onTableUpdate(modelTableData)
    updateTableInfo(modelTableData.rows.length, modelTableData.headers.length)
  }, [modelTableData, onTableUpdate, updateTableInfo])

  // ステータスバー等のUI用にソート状態の更新を分離
  useEffect(() => {
    updateSortState(editorState.sortState)
  }, [editorState.sortState, updateSortState])

  const handleCellUpdate = useCallback((row: number, col: number, value: string) => {
    updateCell(row, col, value)
    updateSaveStatus('saving')
    onSendMessage({ command: 'updateCell', data: withTableIndex({ row, col, value }) })
    setTimeout(() => updateSaveStatus('saved'), 500)
  }, [updateCell, onSendMessage, updateSaveStatus, withTableIndex])

  const handleHeaderUpdate = useCallback((col: number, value: string) => {
    updateHeader(col, value)
    onSendMessage({ command: 'updateHeader', data: withTableIndex({ col, value }) })
  }, [updateHeader, onSendMessage, withTableIndex])

  const handleAddRow = useCallback((index?: number) => {
    addRow(index)
    onSendMessage({ command: 'addRow', data: withTableIndex({ index }) })
  }, [addRow, onSendMessage, withTableIndex])

  const handleDeleteRows = useCallback((indices: number[]) => {
    const sortedIndices = [...indices].sort((a, b) => b - a)
    sortedIndices.forEach(index => deleteRow(index))
    onSendMessage({ command: 'deleteRows', data: withTableIndex({ indices }) })
  }, [deleteRow, onSendMessage, withTableIndex])

  const handleAddColumn = useCallback((index?: number) => {
    addColumn(index)
    onSendMessage({ command: 'addColumn', data: withTableIndex({ index }) })
  }, [addColumn, onSendMessage, withTableIndex])

  const handleDeleteColumns = useCallback((indices: number[]) => {
    const sortedIndices = [...indices].sort((a, b) => b - a)
    sortedIndices.forEach(index => deleteColumn(index))
    onSendMessage({ command: 'deleteColumns', data: withTableIndex({ indices }) })
  }, [deleteColumn, onSendMessage, withTableIndex])

  const handleSort = useCallback((col: number) => {
    sortColumn(col)
  }, [sortColumn])

  const handleCommitSort = useCallback(() => {
    const { column, direction } = editorState.sortState;
    if (direction === 'none') return;

    commitSort();
    updateStatus('success', '現在の表示順序を保存しました');

  onSendMessage({
    command: 'sort',
    data: withTableIndex({ column, direction })
  });
  }, [commitSort, editorState.sortState, onSendMessage, updateStatus, withTableIndex]);

  const handleResetSort = useCallback(() => {
    resetSort();
    updateStatus('info', 'テーブルのソートをリセットしました');
  }, [resetSort, updateStatus]);

  const handleCopy = useCallback(async () => {
    const success = await copySelectedCells(displayedTableData, editorState.selectedCells, editorState.selectionRange)
    updateStatus(success ? 'success' : 'error', success ? 'セルをクリップボードにコピーしました' : 'コピーに失敗しました')
  }, [copySelectedCells, displayedTableData, editorState.selectedCells, editorState.selectionRange, updateStatus])

  const handlePaste = useCallback(async () => {
    const result = await pasteFromClipboard(displayedTableData, editorState.selectionRange, editorState.selectedCells, editorState.currentEditingCell)
    if (result.success) {
      if (result.updates && result.updates.length > 0) {
        onSendMessage({ command: 'bulkUpdateCells', data: withTableIndex({ updates: result.updates }) })
      }
      updateStatus('success', result.message)
    } else {
      updateStatus('error', result.message)
    }
  }, [pasteFromClipboard, displayedTableData, editorState, onSendMessage, updateStatus, withTableIndex])

  const handleCut = useCallback(async () => {
    const success = await copySelectedCells(displayedTableData, editorState.selectedCells, editorState.selectionRange)
    if (success && editorState.selectionRange) {
      const updates: Array<{ row: number; col: number; value: string }> = []
      editorState.selectedCells.forEach(cellKey => {
        const [row, col] = cellKey.split('-').map(Number)
        updates.push({ row, col, value: '' })
      })
      if (updates.length > 0) {
        updateCells(updates)
    onSendMessage({ command: 'bulkUpdateCells', data: withTableIndex({ updates }) })
      }
      updateStatus('success', 'セルを切り取りました')
    } else {
      updateStatus('error', '切り取りに失敗しました')
    }
  }, [copySelectedCells, displayedTableData, editorState, updateCells, onSendMessage, updateStatus, withTableIndex])

  const handleClearCells = useCallback(() => {
    const updates: Array<{ row: number; col: number; value: string }> = []
    editorState.selectedCells.forEach(cellKey => {
      const [row, col] = cellKey.split('-').map(Number)
      updates.push({ row, col, value: '' })
    })
    if (updates.length > 0) {
      updateCells(updates)
    onSendMessage({ command: 'bulkUpdateCells', data: withTableIndex({ updates }) })
      updateStatus('success', '選択されたセルをクリアしました')
    }
  }, [editorState.selectedCells, updateCells, onSendMessage, updateStatus, withTableIndex])

  useKeyboardNavigation({
    tableData: displayedTableData,
    currentEditingCell: editorState.currentEditingCell,
    selectionRange: editorState.selectionRange,
    selectionAnchor: selectionAnchor,
    onCellSelect: selectCell,
    onCellEdit: setCurrentEditingCell,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onCut: handleCut,
    onClearCells: handleClearCells,
    onSelectAll: selectAll,
    onSetSelectionAnchor: setSelectionAnchor
  })

  return (
    <div id="table-content">
      <div className="table-container" ref={containerRef} onScroll={handleScroll}>
        <table className="table-editor">
          <TableHeader
            headers={displayedTableData.headers}
            columnWidths={editorState.columnWidths}
            sortState={editorState.sortState}
            onHeaderUpdate={handleHeaderUpdate}
            onSort={handleSort}
            onColumnResize={setColumnWidth}
            onAddColumn={handleAddColumn}
            onDeleteColumn={deleteColumn}
            onSelectAll={selectAll}
            onColumnSelect={handleColumnSelect}
            onShowColumnContextMenu={(e, i) => setContextMenuState({ type: 'column', index: i, position: { x: e.clientX, y: e.clientY } })}
            getDragProps={getDragProps}
            getDropProps={getDropProps}
            selectedCols={selectedCols}
          />
          <TableBody
            headers={displayedTableData.headers}
            rows={displayedTableData.rows}
            editorState={editorState}
            onCellUpdate={handleCellUpdate}
            onCellSelect={selectCell}
            onCellEdit={setCurrentEditingCell}
            onAddRow={addRow}
            onDeleteRow={deleteRow}
            onRowSelect={handleRowSelect}
            onShowRowContextMenu={(e, i) => setContextMenuState({ type: 'row', index: i, position: { x: e.clientX, y: e.clientY } })}
            getDragProps={getDragProps}
            getDropProps={getDropProps}
            selectedRows={selectedRows}
            virtualization={virtualizationEnabled && visibleWindow ? {
              enabled: true,
              startIndex: visibleWindow.startIndex,
              endIndex: visibleWindow.endIndex,
              topPadding: visibleWindow.topPadding,
              bottomPadding: visibleWindow.bottomPadding
            } : { enabled: false }}
          />
        </table>
      </div>

      <div className="export-actions">
        {editorState.sortState.direction !== 'none' && (
          <div className="inline-sort-actions">
            <button className="export-btn" onClick={handleResetSort}>
              📄 ソートをリセット
            </button>
            <button className="export-btn" onClick={handleCommitSort}>
              💾 この順序を保存
            </button>
          </div>
        )}
        <select 
          className="encoding-select" 
          id="encodingSelect"
          defaultValue="utf8"
        >
          <option value="utf8">UTF-8</option>
          <option value="sjis">Shift_JIS</option>
        </select>
        <button 
          className="export-btn" 
          onClick={() => {
            const select = document.getElementById('encodingSelect') as HTMLSelectElement
            exportToCSV(displayedTableData, onSendMessage, undefined, select?.value || 'utf8')
          }}
        >
          📄 Export CSV
        </button>
        <button 
          className="export-btn" 
          onClick={() => {
            const select = document.getElementById('encodingSelect') as HTMLSelectElement
            exportToTSV(displayedTableData, onSendMessage, undefined, select?.value || 'utf8')
          }}
        >
          📋 Export TSV
        </button>
      </div>

      <ContextMenu
        menuState={contextMenuState}
  onAddRow={handleAddRow}
        onDeleteRow={deleteRow}
        onDeleteRows={handleDeleteRows}
  onAddColumn={handleAddColumn}
        onDeleteColumn={deleteColumn}
        onDeleteColumns={handleDeleteColumns}
        onClose={() => setContextMenuState({ type: null, index: -1, position: { x: 0, y: 0 } })}
        selectedCells={editorState.selectedCells}
        tableData={displayedTableData}
      />
    </div>
  )
}

export default TableEditor
