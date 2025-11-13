import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { TableData, VSCodeMessage, SortState, HeaderConfig } from '../types'
import { useTableEditor } from '../hooks/useTableEditor'
import { useClipboard } from '../hooks/useClipboard'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'
import { useCSVExport } from '../hooks/useCSVExport'
import { useDragDrop } from '../hooks/useDragDrop'
import { useAutofill } from '../hooks/useAutofill'
import { useSearch } from '../hooks/useSearch'
import { useStatus } from '../contexts/StatusContext'
import TableHeader from './TableHeader'
import TableBody from './TableBody'
import ContextMenu, { ContextMenuState } from './ContextMenu'
import SearchBar from './SearchBar'

interface TableEditorProps {
  tableData: TableData
  currentTableIndex?: number
  allTables?: TableData[]
  onTableUpdate: (data: TableData) => void
  onSendMessage: (message: VSCodeMessage) => void
  onTableSwitch?: (index: number) => void
  sortState?: SortState
  setSortState?: (updater: SortState | ((prev: SortState) => SortState)) => void
  headerConfig?: HeaderConfig
  setHeaderConfig?: (updater: HeaderConfig | ((prev: HeaderConfig) => HeaderConfig)) => void
}

const TableEditor: React.FC<TableEditorProps> = ({
  tableData,
  currentTableIndex = 0,
  allTables,
  onTableUpdate,
  onSendMessage,
  onTableSwitch,
  sortState,
  setSortState,
  headerConfig,
  setHeaderConfig
}) => {
  // 外部未指定時は内部の状態を使用
  const [internalSortState, setInternalSortState] = useState<SortState>({ column: -1, direction: 'none' })
  const effectiveSortState = sortState ?? internalSortState
  const effectiveSetSortState = setSortState ?? setInternalSortState

  const [internalHeaderConfig, setInternalHeaderConfig] = useState<HeaderConfig>({
    hasColumnHeaders: true,
    hasRowHeaders: false
  })
  const effectiveHeaderConfig = headerConfig ?? internalHeaderConfig
  const effectiveSetHeaderConfig = setHeaderConfig ?? setInternalHeaderConfig

  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    type: null,
    index: -1,
    position: { x: 0, y: 0 }
  })
  const [exportEncoding, setExportEncoding] = useState<'utf8' | 'sjis'>('utf8')

  // 非表示の入力キャプチャ（IME入力対応）
  const inputCaptureRef = useRef<HTMLInputElement>(null)
  const [isComposing, setIsComposing] = useState(false)

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
    initialCellInput,
    setInitialCellInput,
    setSelectionAnchor,
    setColumnWidth,
    setRowHeight,
    sortColumn,
    moveRow,
    moveColumn,
    commitSort,
    resetSort,
    viewToModelMap,
    toggleColumnHeaders,
    toggleRowHeaders
  } = useTableEditor(
    tableData,
    `table-${currentTableIndex}`,
    { sortState: effectiveSortState, setSortState: effectiveSetSortState },
    { initializeSelectionOnDataChange: true },
    { headerConfig: effectiveHeaderConfig, setHeaderConfig: effectiveSetHeaderConfig }
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

  const { isDragging: isAutofilling, fillRange, handleFillHandleMouseDown } = useAutofill({
    selectionRange: editorState.selectionRange,
    onUpdateCells: (updates) => {
      updateCells(updates)
      const modelUpdates = mapUpdatesToModel(updates)
      onSendMessage({ command: 'bulkUpdateCells', data: withTableIndex({ updates: modelUpdates }) })
      updateStatus('success', 'オートフィルを適用しました')
    },
    getCellValue: (row: number, col: number) => {
      return displayedTableData.rows[row]?.[col] || ''
    }
  })

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

  // 検索機能
  const effectiveTables = allTables || [tableData]
  const {
    searchState,
    performSearch,
    findNext,
    findPrevious,
    replaceOne,
    replaceAll,
    openSearch,
    closeSearch,
    setSearchText,
    setReplaceText,
    setScope,
    toggleOption,
    toggleAdvanced,
    toggleReplace,
    currentResultInfo
  } = useSearch({
    tables: effectiveTables,
    currentTableIndex,
    selectionRange: editorState.selectionRange,
    onNavigateToResult: useCallback((result) => {
      // 別のシートの場合は先にシートを切り替える
      if (result.tableIndex !== currentTableIndex && onTableSwitch) {
        onTableSwitch(result.tableIndex)
        // シート切り替え後にセル選択とスクロールを実行
        setTimeout(() => {
          selectCell(result.row, result.col, false)
          setTimeout(() => {
            const cell = document.querySelector(`td[data-row="${result.row}"][data-col="${result.col}"]`)
            if (cell) {
              cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
            }
          }, 100)
        }, 100)
      } else {
        // 同じシート内の場合は即座に移動
        selectCell(result.row, result.col, false)
        setTimeout(() => {
          const cell = document.querySelector(`td[data-row="${result.row}"][data-col="${result.col}"]`)
          if (cell) {
            cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
          }
        }, 0)
      }
    }, [currentTableIndex, selectCell, onTableSwitch]),
    onUpdateCell: useCallback((tableIndex, row, col, value) => {
      if (tableIndex === currentTableIndex) {
        updateCell(row, col, value)
        onSendMessage({ command: 'updateCell', data: withTableIndex({ row, col, value }) })
      }
    }, [currentTableIndex, updateCell, onSendMessage, withTableIndex]),
    onBulkUpdate: useCallback((tableIndex, updates) => {
      if (tableIndex === currentTableIndex) {
        updateCells(updates)
        onSendMessage({ command: 'bulkUpdateCells', data: withTableIndex({ updates }) })
      }
    }, [currentTableIndex, updateCells, onSendMessage, withTableIndex])
  })

  // 検索オプション・範囲変更時に自動検索（検索テキストが存在し、結果がある場合のみ）
  useEffect(() => {
    if (searchState.isOpen && searchState.searchText && searchState.results.length > 0) {
      performSearch()
    }
    // performSearchは依存配列から除外（ESLintの警告を抑制）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchState.options, searchState.scope])

  // 検索結果かどうかを判定
  const isSearchResult = useCallback((row: number, col: number) => {
    return searchState.results.some(
      result => result.tableIndex === currentTableIndex && result.row === row && result.col === col
    )
  }, [searchState.results, currentTableIndex])

  // 現在の検索結果かどうかを判定
  const isCurrentSearchResult = useCallback((row: number, col: number) => {
    if (searchState.currentResultIndex < 0) return false
    const currentResult = searchState.results[searchState.currentResultIndex]
    return currentResult &&
      currentResult.tableIndex === currentTableIndex &&
      currentResult.row === row &&
      currentResult.col === col
  }, [searchState.results, searchState.currentResultIndex, currentTableIndex])

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
    // 0行目（列ヘッダーOFF時）はheaders配列を更新
    if (row === -1) {
      updateHeader(col, value)
      onSendMessage({ command: 'updateHeader', data: withTableIndex({ col, value }) })
    } else {
      // 通常のデータセルはrows配列を更新
      updateCell(row, col, value)
      updateSaveStatus('saving')
      const modelRow = toModelRow(row)
      onSendMessage({ command: 'updateCell', data: withTableIndex({ row: modelRow, col, value }) })
      setTimeout(() => updateSaveStatus('saved'), 500)
    }
  }, [updateCell, updateHeader, onSendMessage, updateSaveStatus, toModelRow, withTableIndex])

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

  // 入力キャプチャのイベントハンドラー（IME対応）
  const handleInputCaptureCompositionStart = useCallback(() => {
    setIsComposing(true)
  }, [])

  const handleInputCaptureCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false)
    const input = e.currentTarget
    const value = input.value

    // 選択されているセルを取得
    const currentPos = editorState.selectionRange?.end || editorState.selectionRange?.start
    if (currentPos && value && !editorState.currentEditingCell) {
      // IME確定後、編集モードに入る
      setInitialCellInput(value)
      setCurrentEditingCell(currentPos)
    }

    // 入力をクリア
    input.value = ''
  }, [editorState.selectionRange, editorState.currentEditingCell, setCurrentEditingCell, setInitialCellInput])

  const handleInputCaptureInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    // IME入力中は処理しない
    if (isComposing) return

    const input = e.currentTarget
    const value = input.value

    // 選択されているセルを取得
    const currentPos = editorState.selectionRange?.end || editorState.selectionRange?.start
    if (currentPos && value && !editorState.currentEditingCell) {
      // 非IME入力の場合、即座に編集モードに入る
      setInitialCellInput(value)
      setCurrentEditingCell(currentPos)
    }

    // 入力をクリア
    input.value = ''
  }, [isComposing, editorState.selectionRange, editorState.currentEditingCell, setCurrentEditingCell, setInitialCellInput])

  // セル選択時に入力キャプチャにフォーカス
  useEffect(() => {
    // 編集中でない場合、inputCaptureにフォーカス
    if (!editorState.currentEditingCell && inputCaptureRef.current && editorState.selectionRange) {
      inputCaptureRef.current.focus()
      // 編集モード終了時に初期入力をクリア
      if (initialCellInput) {
        setInitialCellInput(null)
      }
    }
  }, [editorState.currentEditingCell, editorState.selectionRange, initialCellInput, setInitialCellInput])

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
    onRedo: () => onSendMessage({ command: 'redo' }),
    headerConfig: editorState.headerConfig,
    onOpenSearch: useCallback((withReplace = false) => {
      openSearch(withReplace)
      if (withReplace) {
        toggleReplace()
      }
    }, [openSearch, toggleReplace])
  })

  const handleExportCsv = useCallback(() => {
    exportToCSV(displayedTableData, onSendMessage, undefined, exportEncoding)
  }, [displayedTableData, exportEncoding, exportToCSV, onSendMessage])

  const handleExportTsv = useCallback(() => {
    exportToTSV(displayedTableData, onSendMessage, undefined, exportEncoding)
  }, [displayedTableData, exportEncoding, exportToTSV, onSendMessage])

  const handleImportCsv = useCallback(() => {
    onSendMessage({ command: 'importCSV', data: withTableIndex({}) })
  }, [onSendMessage, withTableIndex])

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
      <SearchBar
        searchState={searchState}
        currentResultInfo={currentResultInfo}
        onSearchTextChange={setSearchText}
        onReplaceTextChange={setReplaceText}
        onSearch={performSearch}
        onFindNext={findNext}
        onFindPrevious={findPrevious}
        onReplaceOne={replaceOne}
        onReplaceAll={replaceAll}
        onClose={closeSearch}
        onToggleOption={toggleOption}
        onToggleAdvanced={toggleAdvanced}
        onScopeChange={setScope}
      />
      {/* 非表示の入力キャプチャ（IME入力対応） */}
      <input
        ref={inputCaptureRef}
        type="text"
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: '1px',
          height: '1px',
          left: '-9999px'
        }}
        onCompositionStart={handleInputCaptureCompositionStart}
        onCompositionEnd={handleInputCaptureCompositionEnd}
        onInput={handleInputCaptureInput}
        aria-hidden="true"
        tabIndex={-1}
      />
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
            headerConfig={editorState.headerConfig}
          />
          <TableBody
            headers={displayedTableData.headers}
            rows={displayedTableData.rows}
            editorState={editorState}
            onCellUpdate={handleCellUpdate}
            onHeaderUpdate={handleHeaderUpdate}
            onCellSelect={selectCell}
            onCellEdit={setCurrentEditingCell}
            initialCellInput={initialCellInput}
            onAddRow={addRow}
            onDeleteRow={handleDeleteRow}
            onRowSelect={handleRowSelect}
            onShowRowContextMenu={(e, i) => setContextMenuState({ type: 'row', index: i, position: { x: e.clientX, y: e.clientY } })}
            getDragProps={getDragProps}
            getDropProps={getDropProps}
            selectedRows={selectedRows}
            fillRange={fillRange}
            onFillHandleMouseDown={handleFillHandleMouseDown}
            headerConfig={editorState.headerConfig}
            isSearchResult={isSearchResult}
            isCurrentSearchResult={isCurrentSearchResult}
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
        onImportCsv={handleImportCsv}
        onExportCsv={handleExportCsv}
        onExportTsv={handleExportTsv}
        exportEncoding={exportEncoding}
        onChangeEncoding={handleEncodingChange}
        onResetSort={handleResetSort}
        onCommitSort={handleCommitSort}
        hasActiveSort={editorState.sortState.direction !== 'none'}
        headerConfig={editorState.headerConfig}
        onToggleColumnHeaders={toggleColumnHeaders}
        onToggleRowHeaders={toggleRowHeaders}
      />
    </div>
  )
}

export default TableEditor
