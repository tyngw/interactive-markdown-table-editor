import { useCallback, useEffect, useState, useRef } from 'react'
import { TableData, VSCodeMessage } from '../types'
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
  currentTableIndex: number // 現在のテーブルインデックス
  onTableUpdate: (data: TableData) => void
  onSendMessage: (message: VSCodeMessage) => void
}

const TableEditor: React.FC<TableEditorProps> = ({
  tableData,
  currentTableIndex,
  onTableUpdate,
  onSendMessage
}) => {
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    type: null,
    index: -1,
    position: { x: 0, y: 0 }
  })

  const { updateStatus, updateTableInfo, updateSaveStatus, updateSortViewOnly } = useStatus()

  const {
    tableData: currentTableData,
    editorState,
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
    setColumnWidth,
    sortColumn,
    moveRow,
    moveColumn,
    restoreOriginalView,
    commitSortToFile
  } = useTableEditor(tableData)

  // クリップボード機能
  const { copyToClipboard, pasteFromClipboard } = useClipboard()

  // CSVエクスポート機能
  const { exportToCSV } = useCSVExport()

  // ドラッグ&ドロップ機能
  const { getDragProps, getDropProps } = useDragDrop({
    onMoveRow: moveRow,
    onMoveColumn: moveColumn
  })

  // テーブルデータが変更されたらVSCodeに通知
  const previousTableDataRef = useRef<TableData | null>(null)
  useEffect(() => {
    // Only call onTableUpdate if the data actually changed from the previous external update
    const prev = previousTableDataRef.current
    const hasChanged = !prev || 
      prev.rows.length !== currentTableData.rows.length ||
      prev.headers.length !== currentTableData.headers.length ||
      JSON.stringify(prev.rows) !== JSON.stringify(currentTableData.rows) ||
      JSON.stringify(prev.headers) !== JSON.stringify(currentTableData.headers)
    
    if (hasChanged) {
      onTableUpdate(currentTableData)
    }
    
    previousTableDataRef.current = { ...currentTableData, rows: [...currentTableData.rows.map(row => [...row])], headers: [...currentTableData.headers] }
    updateTableInfo(currentTableData.rows.length, currentTableData.headers.length)
    updateSortViewOnly(editorState.sortState.isViewOnly)
  }, [currentTableData, onTableUpdate])

  // Track sort view-only state changes
  useEffect(() => {
    console.log('🔍 Sort state changed:', {
      column: editorState.sortState.column,
      direction: editorState.sortState.direction,
      isViewOnly: editorState.sortState.isViewOnly,
      hasOriginalData: !!editorState.sortState.originalData
    })
    updateSortViewOnly(editorState.sortState.isViewOnly)
  }, [editorState.sortState, updateSortViewOnly])

  // セル更新時にVSCodeに保存を通知
  const handleCellUpdate = useCallback((row: number, col: number, value: string) => {
    console.log('🔧 TableEditor: Cell update triggered');
    console.log(`   Row: ${row}, Col: ${col}, Value: "${value}"`);
    console.log(`   Current Table Index: ${currentTableIndex}`);
    
    updateCell(row, col, value)
    updateSaveStatus('saving')
    
    const messageData = { row, col, value, tableIndex: currentTableIndex };
    console.log('📤 TableEditor: Sending message data:', JSON.stringify(messageData, null, 2));
    
    onSendMessage({
      command: 'updateCell',
      data: messageData
    })
    // Auto-saved status will be updated when VSCode responds
    setTimeout(() => updateSaveStatus('saved'), 500)
  }, [updateCell, onSendMessage, currentTableIndex])

  // ヘッダー更新時にVSCodeに保存を通知
  const handleHeaderUpdate = useCallback((col: number, value: string) => {
    updateHeader(col, value)
    onSendMessage({
      command: 'updateHeader',
      data: { col, value, tableIndex: currentTableIndex }
    })
  }, [updateHeader, onSendMessage, currentTableIndex])

  // 行追加
  const handleAddRow = useCallback((index?: number) => {
    addRow(index)
    onSendMessage({
      command: 'addRow',
      data: { index, tableIndex: currentTableIndex }
    })
  }, [addRow, onSendMessage, currentTableIndex])

  // 行削除
  const handleDeleteRow = useCallback((index: number) => {
    deleteRow(index)
    onSendMessage({
      command: 'deleteRows',
      data: { indices: [index], tableIndex: currentTableIndex }
    })
  }, [deleteRow, onSendMessage, currentTableIndex])

  // 複数行削除
  const handleDeleteRows = useCallback((indices: number[]) => {
    // Sort in descending order for safe deletion
    const sortedIndices = [...indices].sort((a, b) => b - a)
    sortedIndices.forEach(index => deleteRow(index))
    onSendMessage({
      command: 'deleteRows',
      data: { indices, tableIndex: currentTableIndex }
    })
  }, [deleteRow, onSendMessage, currentTableIndex])

  // 列追加
  const handleAddColumn = useCallback((index?: number) => {
    addColumn(index)
    onSendMessage({
      command: 'addColumn',
      data: { index, tableIndex: currentTableIndex }
    })
  }, [addColumn, onSendMessage, currentTableIndex])

  // 列削除
  const handleDeleteColumn = useCallback((index: number) => {
    deleteColumn(index)
    onSendMessage({
      command: 'deleteColumns',
      data: { indices: [index], tableIndex: currentTableIndex }
    })
  }, [deleteColumn, onSendMessage, currentTableIndex])

  // 複数列削除
  const handleDeleteColumns = useCallback((indices: number[]) => {
    // Sort in descending order for safe deletion
    const sortedIndices = [...indices].sort((a, b) => b - a)
    sortedIndices.forEach(index => deleteColumn(index))
    onSendMessage({
      command: 'deleteColumns',
      data: { indices, tableIndex: currentTableIndex }
    })
  }, [deleteColumn, onSendMessage, currentTableIndex])

  // ソート実行
  const handleSort = useCallback((col: number) => {
    console.log('🔧 Sort triggered for column:', col)
    console.log('🔧 Current sort state before:', {
      column: editorState.sortState.column,
      direction: editorState.sortState.direction,
      isViewOnly: editorState.sortState.isViewOnly
    })
    sortColumn(col)
  }, [sortColumn, editorState.sortState])

  // ソートをファイルに保存
  const handleCommitSort = useCallback(() => {
    if (editorState.sortState.column >= 0 && editorState.sortState.isViewOnly) {
      commitSortToFile()
      onSendMessage({
        command: 'sort',
        data: { 
          column: editorState.sortState.column, 
          direction: editorState.sortState.direction,
          tableIndex: currentTableIndex
        }
      })
      updateStatus('success', 'Sort committed to file')
  updateSortViewOnly(false)
    }
  }, [onSendMessage, editorState.sortState, commitSortToFile, currentTableIndex])

  // 元の表示に戻す
  const handleRestoreOriginal = useCallback(() => {
    restoreOriginalView()
    updateStatus('success', 'Original view restored')
  updateSortViewOnly(false)
  }, [restoreOriginalView])

  // 全選択
  const handleSelectAll = useCallback(() => {
    selectAll()
  }, [selectAll])

  // 行選択
  const handleRowSelect = useCallback((rowIndex: number, event: React.MouseEvent) => {
    event.preventDefault()
    selectRow(rowIndex, event.shiftKey)
  }, [selectRow])

  // 列選択
  const handleColumnSelect = useCallback((colIndex: number, event: React.MouseEvent) => {
    event.preventDefault()
    selectColumn(colIndex, event.shiftKey)
  }, [selectColumn])

  // 行コンテキストメニュー表示
  const handleShowRowContextMenu = useCallback((event: React.MouseEvent, rowIndex: number) => {
    event.preventDefault()
    setContextMenuState({
      type: 'row',
      index: rowIndex,
      position: { x: event.clientX, y: event.clientY }
    })
  }, [])

  // 列コンテキストメニュー表示
  const handleShowColumnContextMenu = useCallback((event: React.MouseEvent, colIndex: number) => {
    event.preventDefault()
    setContextMenuState({
      type: 'column',
      index: colIndex,
      position: { x: event.clientX, y: event.clientY }
    })
  }, [])

  // コンテキストメニューを閉じる
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState({
      type: null,
      index: -1,
      position: { x: 0, y: 0 }
    })
  }, [])

  // クリップボード操作
  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(
      currentTableData,
      editorState.selectedCells,
      editorState.selectionRange
    )
    if (success) {
      updateStatus('success', 'セルをクリップボードにコピーしました')
    } else {
      updateStatus('error', 'コピーに失敗しました')
    }
  }, [copyToClipboard, currentTableData, editorState.selectedCells, editorState.selectionRange])

  const handlePaste = useCallback(async () => {
    console.log('🔍 handlePaste called')
    console.log('🔍 currentEditingCell:', editorState.currentEditingCell)
    console.log('🔍 selectionRange:', editorState.selectionRange)
    
    const pastedData = await pasteFromClipboard(editorState.currentEditingCell)
    
    
    // セルが選択されていない場合のフォールバック処理
    if (!editorState.selectionRange) {
      console.log('🔍 No selection range - setting up fallback selection')
      const startPos = editorState.currentEditingCell || { row: 0, col: 0 }
      selectCell(startPos.row, startPos.col)
      
      // 選択が設定されるまで少し待ってから再試行
      setTimeout(() => {
        if (pastedData) {
          handlePaste()
        }
      }, 50)
      return
    }
    
    if (pastedData && editorState.selectionRange) {
      const { start } = editorState.selectionRange
      
      // ペーストデータのサイズを計算
      const pasteRows = pastedData.length
      const pasteCols = pastedData[0]?.length || 0
      const targetEndRow = start.row + pasteRows - 1
      const targetEndCol = start.col + pasteCols - 1
      
      // 必要な行数と列数を計算
      const currentRowCount = currentTableData.rows.length
      const currentColCount = currentTableData.headers.length
      const neededRows = Math.max(0, targetEndRow + 1 - currentRowCount)
      const neededCols = Math.max(0, targetEndCol + 1 - currentColCount)
      
      console.log('🔍 Paste info:', { pasteRows, pasteCols, neededRows, neededCols })
      
      // 不足している列を追加
      for (let i = 0; i < neededCols; i++) {
        addColumn()
      }
      
      // 不足している行を追加
      for (let i = 0; i < neededRows; i++) {
        addRow()
      }
      
      // 一括更新用のデータを準備
      const updates: Array<{ row: number; col: number; value: string }> = []
      
      pastedData.forEach((row, rowOffset) => {
        row.forEach((cellValue, colOffset) => {
          const targetRow = start.row + rowOffset
          const targetCol = start.col + colOffset
          
          // 範囲外チェックを削除（テーブルを拡張しているため）
          if (targetRow >= 0 && targetCol >= 0) {
            updates.push({ row: targetRow, col: targetCol, value: cellValue })
          }
        })
      })
      
      console.log('🔍 Updates to apply:', updates)
      
      // 一括更新を実行
      if (updates.length > 0) {
        updateCells(updates)
        
        // VSCodeに一括更新を通知
        onSendMessage({
          command: 'bulkUpdateCells',
          data: { updates, tableIndex: currentTableIndex }
        })
        
        // テーブル拡張も通知
        if (neededRows > 0 || neededCols > 0) {
          updateStatus('success', `クリップボードからペーストしました（${neededRows > 0 ? `${neededRows}行` : ''}${neededRows > 0 && neededCols > 0 ? '、' : ''}${neededCols > 0 ? `${neededCols}列` : ''}を自動追加）`)
        } else {
          updateStatus('success', 'クリップボードからペーストしました')
        }
      }
    } else if (!pastedData) {
      console.log('🔍 No pasted data received')
      updateStatus('error', 'クリップボードにデータがありません')
    } else {
      console.log('🔍 Paste failed for unknown reason')
      updateStatus('error', 'ペーストに失敗しました')
    }
  }, [pasteFromClipboard, editorState, currentTableData, updateCells, addColumn, addRow, onSendMessage, updateStatus, currentTableIndex, selectCell])

  const handleCut = useCallback(async () => {
    const success = await copyToClipboard(
      currentTableData,
      editorState.selectedCells,
      editorState.selectionRange
    )
    
    if (success && editorState.selectionRange) {
      // 選択されたセルをクリア（一括更新）
      const { start, end } = editorState.selectionRange
      const minRow = Math.min(start.row, end.row)
      const maxRow = Math.max(start.row, end.row)
      const minCol = Math.min(start.col, end.col)
      const maxCol = Math.max(start.col, end.col)
      
      const updates: Array<{ row: number; col: number; value: string }> = []
      
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          if (row >= 0) {
            updates.push({ row, col, value: '' })
          }
        }
      }
      
      if (updates.length > 0) {
        updateCells(updates)
        
        // VSCodeに一括更新を通知
        onSendMessage({
          command: 'bulkUpdateCells',
          data: { updates, tableIndex: currentTableIndex }
        })
      }
      
      updateStatus('success', 'セルを切り取りました')
    } else {
      updateStatus('error', '切り取りに失敗しました')
    }
  }, [copyToClipboard, currentTableData, editorState, updateCells, onSendMessage, updateStatus])

  // セルクリア機能（Delete/Backspaceキー用）
  const handleClearCells = useCallback(() => {
    if (editorState.selectedCells.size === 0) return

    const updates: Array<{ row: number; col: number; value: string }> = []
    
    editorState.selectedCells.forEach(cellKey => {
      const [row, col] = cellKey.split('-').map(Number)
      if (row >= 0 && row < currentTableData.rows.length && 
          col >= 0 && col < currentTableData.headers.length) {
        updates.push({ row, col, value: '' })
      }
    })

    if (updates.length > 0) {
      updateCells(updates)
      
      // VSCodeに一括更新を通知
      onSendMessage({
        command: 'bulkUpdateCells',
        data: { updates, tableIndex: currentTableIndex }
      })
      
      updateStatus('success', '選択されたセルをクリアしました')
    }
  }, [editorState.selectedCells, currentTableData, updateCells, onSendMessage, updateStatus])

  // CSVエクスポート
  const handleExportCSV = useCallback((encoding: string = 'utf8') => {
    const success = exportToCSV(currentTableData, onSendMessage, undefined, encoding)
    if (success) {
      const encodingLabel = encoding === 'sjis' ? 'Shift_JIS' : 'UTF-8'
      updateStatus('success', `CSVエクスポートを開始しました (${encodingLabel})`)
    } else {
      updateStatus('error', 'CSVエクスポートに失敗しました')
    }
  }, [exportToCSV, currentTableData, onSendMessage, updateStatus])

  // TSVエクスポート
  const handleExportTSV = useCallback((encoding: string = 'utf8') => {
    // TSV形式でエクスポート（タブ区切り）
    const tsvContent = [
      currentTableData.headers.join('\t'),
      ...currentTableData.rows.map(row => row.join('\t'))
    ].join('\n')

    onSendMessage({
      command: 'exportFile',
      data: {
        content: tsvContent,
        format: 'tsv',
        encoding: encoding
      }
    })

    const encodingLabel = encoding === 'sjis' ? 'Shift_JIS' : 'UTF-8'
    updateStatus('success', `TSVエクスポートを開始しました (${encodingLabel})`)
  }, [currentTableData, onSendMessage, updateStatus])

  // キーボードナビゲーション
  useKeyboardNavigation({
    tableData: currentTableData,
    currentEditingCell: editorState.currentEditingCell,
    selectionRange: editorState.selectionRange,
    onCellSelect: selectCell,
    onCellEdit: setCurrentEditingCell,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onCut: handleCut,
    onClearCells: handleClearCells,
    onSelectAll: handleSelectAll
  })

  return (
    <div id="table-content">
  {/* ソートアクションは下部のエクスポートアクション列に統合 */}

      {/* テーブル */}
      <div className="table-container">
        <table className="table-editor">
          <TableHeader
            headers={currentTableData.headers}
            columnWidths={editorState.columnWidths}
            sortState={editorState.sortState}
            onHeaderUpdate={handleHeaderUpdate}
            onSort={handleSort}
            onColumnResize={setColumnWidth}
            onAddColumn={handleAddColumn}
            onDeleteColumn={handleDeleteColumn}
            onSelectAll={handleSelectAll}
            onColumnSelect={handleColumnSelect}
            onShowColumnContextMenu={handleShowColumnContextMenu}
            getDragProps={getDragProps}
            getDropProps={getDropProps}
          />
          <TableBody
            headers={currentTableData.headers}
            rows={currentTableData.rows}
            editorState={editorState}
            onCellUpdate={handleCellUpdate}
            onCellSelect={selectCell}
            onCellEdit={setCurrentEditingCell}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
            onRowSelect={handleRowSelect}
            onShowRowContextMenu={handleShowRowContextMenu}
            getDragProps={getDragProps}
            getDropProps={getDropProps}
          />
        </table>
      </div>

      {/* エクスポート/ソートアクション */}
      <div className="export-actions">
        {editorState.sortState.isViewOnly && (
          <div className="inline-sort-actions">
            <button className="export-btn" onClick={handleRestoreOriginal}>
              📄 Restore Original
            </button>
            <button className="export-btn" onClick={handleCommitSort}>
              💾 Save Sort to File
            </button>
          </div>
        )}
        <select 
          className="encoding-select" 
          id="encodingSelect"
          defaultValue="utf8"
          onChange={(e) => {
            // Store selected encoding for export
            (e.target as HTMLSelectElement).dataset.selectedEncoding = e.target.value
          }}
        >
          <option value="utf8">UTF-8</option>
          <option value="sjis">Shift_JIS</option>
        </select>
        <button 
          className="export-btn" 
          onClick={() => {
            const select = document.getElementById('encodingSelect') as HTMLSelectElement
            const encoding = select?.value || 'utf8'
            handleExportCSV(encoding)
          }}
        >
          📄 Export CSV
        </button>
        <button 
          className="export-btn" 
          onClick={() => {
            const select = document.getElementById('encodingSelect') as HTMLSelectElement
            const encoding = select?.value || 'utf8'
            handleExportTSV(encoding)
          }}
        >
          📋 Export TSV
        </button>
      </div>

      {/* コンテキストメニュー */}
      <ContextMenu
        menuState={contextMenuState}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        onDeleteRows={handleDeleteRows}
        onAddColumn={handleAddColumn}
        onDeleteColumn={handleDeleteColumn}
        onDeleteColumns={handleDeleteColumns}
        onClose={handleCloseContextMenu}
        selectedCells={editorState.selectedCells}
        tableData={currentTableData}
      />
    </div>
  )
}

export default TableEditor