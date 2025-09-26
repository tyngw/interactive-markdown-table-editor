import { useCallback, useEffect, useState, useMemo } from 'react'
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
  const [exportEncoding, setExportEncoding] = useState<'utf8' | 'sjis'>('utf8')

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
    resetSort,
    viewToModelMap
  } = useTableEditor(
    tableData,
    `table-${currentTableIndex}`,
    { sortState: effectiveSortState, setSortState: effectiveSetSortState },
    { initializeSelectionOnDataChange: true }
  )

  const toModelRow = useCallback((viewRow: number): number => {
    if (!Array.isArray(viewToModelMap)) {
      return viewRow
    }
    const mapped = viewToModelMap[viewRow]
    return typeof mapped === 'number' ? mapped : viewRow
  }, [viewToModelMap])

  const mapUpdatesToModel = useCallback((updates: Array<{ row: number; col: number; value: string }>) => {
    return updates.map(update => ({
      ...update,
      row: toModelRow(update.row)
    }))
  }, [toModelRow])

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
    updateCells,
    selectCell
  })

  const { exportToCSV, exportToTSV } = useCSVExport()

  const { getDragProps, getDropProps } = useDragDrop({
    onMoveRow: (fromIndex: number, toIndex: number) => {
      console.log(`TableEditor: onMoveRow called with fromIndex=${fromIndex}, toIndex=${toIndex}`)
      if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') {
        console.error(`Invalid indices in onMoveRow: fromIndex=${fromIndex} (${typeof fromIndex}), toIndex=${toIndex} (${typeof toIndex})`)
        return
      }
      moveRow(fromIndex, toIndex)
      const messageData = withTableIndex({ fromIndex, toIndex })
      console.log(`Sending moveRow message:`, messageData)
      onSendMessage({ command: 'moveRow', data: messageData })
    },
    onMoveColumn: (fromIndex: number, toIndex: number) => {
      console.log(`TableEditor: onMoveColumn called with fromIndex=${fromIndex}, toIndex=${toIndex}`)
      if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') {
        console.error(`Invalid indices in onMoveColumn: fromIndex=${fromIndex} (${typeof fromIndex}), toIndex=${toIndex} (${typeof toIndex})`)
        return
      }
      moveColumn(fromIndex, toIndex)
      const messageData = withTableIndex({ fromIndex, toIndex })
      console.log(`Sending moveColumn message:`, messageData)
      onSendMessage({ command: 'moveColumn', data: messageData })
    }
  })

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
    const modelRow = toModelRow(row)
    onSendMessage({ command: 'updateCell', data: withTableIndex({ row: modelRow, col, value }) })
    setTimeout(() => updateSaveStatus('saved'), 500)
  }, [updateCell, onSendMessage, updateSaveStatus, toModelRow, withTableIndex])

  const handleHeaderUpdate = useCallback((col: number, value: string) => {
    updateHeader(col, value)
    onSendMessage({ command: 'updateHeader', data: withTableIndex({ col, value }) })
  }, [updateHeader, onSendMessage, withTableIndex])

  const handleAddRow = useCallback((index?: number) => {
    addRow(index)
    onSendMessage({ command: 'addRow', data: withTableIndex({ index }) })
  }, [addRow, onSendMessage, withTableIndex])

  const handleDeleteRows = useCallback((indices: number[]) => {
    const sortedViewIndices = [...indices].sort((a, b) => b - a)
    const modelIndices = sortedViewIndices.map(toModelRow).sort((a, b) => b - a)
    sortedViewIndices.forEach(index => deleteRow(index))
    onSendMessage({ command: 'deleteRows', data: withTableIndex({ indices: modelIndices }) })
  }, [deleteRow, onSendMessage, toModelRow, withTableIndex])

  // 単一行削除でも拡張に同期する
  const handleDeleteRow = useCallback((index: number) => {
    handleDeleteRows([index])
  }, [handleDeleteRows])

  const handleAddColumn = useCallback((index?: number) => {
    addColumn(index)
    onSendMessage({ command: 'addColumn', data: withTableIndex({ index }) })
  }, [addColumn, onSendMessage, withTableIndex])

  const handleDeleteColumns = useCallback((indices: number[]) => {
    const sortedIndices = [...indices].sort((a, b) => b - a)
    sortedIndices.forEach(index => deleteColumn(index))
    onSendMessage({ command: 'deleteColumns', data: withTableIndex({ indices }) })
  }, [deleteColumn, onSendMessage, withTableIndex])

  // 単一列削除でも拡張に同期する
  const handleDeleteColumn = useCallback((index: number) => {
    handleDeleteColumns([index])
  }, [handleDeleteColumns])

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
        const modelUpdates = mapUpdatesToModel(result.updates)
        onSendMessage({ command: 'bulkUpdateCells', data: withTableIndex({ updates: modelUpdates }) })
      }
      updateStatus('success', result.message)
    } else {
      updateStatus('error', result.message)
    }
  }, [displayedTableData, editorState, mapUpdatesToModel, onSendMessage, pasteFromClipboard, updateStatus, withTableIndex])

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
        const modelUpdates = mapUpdatesToModel(updates)
        onSendMessage({ command: 'bulkUpdateCells', data: withTableIndex({ updates: modelUpdates }) })
      }
      updateStatus('success', 'セルを切り取りました')
    } else {
      updateStatus('error', '切り取りに失敗しました')
    }
  }, [copySelectedCells, displayedTableData, editorState, mapUpdatesToModel, onSendMessage, updateCells, updateStatus, withTableIndex])

  const handleClearCells = useCallback(() => {
    const updates: Array<{ row: number; col: number; value: string }> = []
    editorState.selectedCells.forEach(cellKey => {
      const [row, col] = cellKey.split('-').map(Number)
      updates.push({ row, col, value: '' })
    })
    if (updates.length > 0) {
      updateCells(updates)
      const modelUpdates = mapUpdatesToModel(updates)
      onSendMessage({ command: 'bulkUpdateCells', data: withTableIndex({ updates: modelUpdates }) })
      updateStatus('success', '選択されたセルをクリアしました')
    }
  }, [editorState.selectedCells, mapUpdatesToModel, onSendMessage, updateCells, updateStatus, withTableIndex])

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
    onSetSelectionAnchor: setSelectionAnchor,
    onUndo: () => onSendMessage({ command: 'undo' }),
    onRedo: () => onSendMessage({ command: 'redo' })
  })

  const handleExportCsv = useCallback(() => {
    exportToCSV(displayedTableData, onSendMessage, undefined, exportEncoding)
  }, [displayedTableData, exportEncoding, exportToCSV, onSendMessage])

  const handleExportTsv = useCallback(() => {
    exportToTSV(displayedTableData, onSendMessage, undefined, exportEncoding)
  }, [displayedTableData, exportEncoding, exportToTSV, onSendMessage])

  const handleEncodingChange = useCallback((next: 'utf8' | 'sjis') => {
    setExportEncoding(next)
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenuState({ type: null, index: -1, position: { x: 0, y: 0 } })
  }, [])

  const handleEditorContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return
    }
    event.preventDefault()
    setContextMenuState({
      type: 'editor',
      index: -1,
      position: { x: event.clientX, y: event.clientY }
    })
  }, [])

  return (
    <div id="table-content" onContextMenu={handleEditorContextMenu}>
      <div className="table-container">
        <table className="table-editor">
          <TableHeader
            headers={displayedTableData.headers}
            columnWidths={editorState.columnWidths}
            sortState={editorState.sortState}
            onHeaderUpdate={handleHeaderUpdate}
            onSort={handleSort}
            onColumnResize={setColumnWidth}
            onAddColumn={handleAddColumn}
            onDeleteColumn={handleDeleteColumn}
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
            onDeleteRow={handleDeleteRow}
            onRowSelect={handleRowSelect}
            onShowRowContextMenu={(e, i) => setContextMenuState({ type: 'row', index: i, position: { x: e.clientX, y: e.clientY } })}
            getDragProps={getDragProps}
            getDropProps={getDropProps}
            selectedRows={selectedRows}
          />
        </table>
      </div>

      <ContextMenu
        menuState={contextMenuState}
  onAddRow={handleAddRow}
    onDeleteRow={handleDeleteRow}
        onDeleteRows={handleDeleteRows}
  onAddColumn={handleAddColumn}
    onDeleteColumn={handleDeleteColumn}
        onDeleteColumns={handleDeleteColumns}
        onClose={closeContextMenu}
        selectedCells={editorState.selectedCells}
        tableData={displayedTableData}
        onExportCsv={handleExportCsv}
        onExportTsv={handleExportTsv}
        exportEncoding={exportEncoding}
        onChangeEncoding={handleEncodingChange}
        onResetSort={handleResetSort}
        onCommitSort={handleCommitSort}
        hasActiveSort={editorState.sortState.direction !== 'none'}
      />
    </div>
  )
}

export default TableEditor
