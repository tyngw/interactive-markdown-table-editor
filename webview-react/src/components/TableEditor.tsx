import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { TableData, VSCodeMessage, SortState, HeaderConfig, CellPosition, SearchResult } from '../types'
import {
  cleanupCellVisualArtifacts,
  clearCellTemporaryMarker,
  markCellAsTemporarilyEmpty,
  queryCellElement
} from '../utils/cellDomUtils'
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

  // IME対応の透明入力要素（Googleスプレッドシート方式）
  const inputCaptureRef = useRef<HTMLTextAreaElement>(null)
  const [isComposing, setIsComposing] = useState(false)
  const compositionHandledRef = useRef(false)
  const pendingCompositionCleanupRef = useRef<CellPosition | null>(null)
  const [inputCaptureStyle, setInputCaptureStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    opacity: 0,
    pointerEvents: 'none',
    width: '1px',
    height: '1px',
    left: '0',
    top: '0',
    zIndex: -1
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
    initialCellInput,
    setInitialCellInput,
    setSelectionAnchor,
    setColumnWidth,
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

  // initialCellInput を遅延クリアするためのタイムアウト参照
  const clearInitialInputTimeoutRef = useRef<number | null>(null)

  // 編集開始や initialCellInput の変更時に遅延クリアのタイムアウトをキャンセル
  useEffect(() => {
    if (editorState.currentEditingCell && (clearInitialInputTimeoutRef as any).current) {
      window.clearTimeout((clearInitialInputTimeoutRef as any).current)
      ;(clearInitialInputTimeoutRef as any).current = null
    }
    return () => {
      if ((clearInitialInputTimeoutRef as any).current) {
        window.clearTimeout((clearInitialInputTimeoutRef as any).current)
        ;(clearInitialInputTimeoutRef as any).current = null
      }
    }
  }, [editorState.currentEditingCell, initialCellInput])

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

  // IME入力で一時的に適用した高さ調整や不可視スペーサーを確実に片付ける
  const markCellAsTempEmptyWithTracking = useCallback((position: CellPosition) => {
    if (markCellAsTemporarilyEmpty(position)) {
      pendingCompositionCleanupRef.current = { ...position }
    }
  }, [markCellAsTemporarilyEmpty])

  const selectedRows = useMemo(() => {
    const rows = new Set<number>();
    editorState.selectedCells.forEach(cellKey => {
      rows.add(parseInt(cellKey.split('-')[0], 10));
    });
    return rows;
  }, [editorState.selectedCells]);

  useEffect(() => {
    if (editorState.currentEditingCell) {
      return
    }

    const cleanupTarget = pendingCompositionCleanupRef.current
      || editorState.selectionRange?.end
      || editorState.selectionRange?.start

    if (cleanupTarget) {
      cleanupCellVisualArtifacts(cleanupTarget)
    }
    pendingCompositionCleanupRef.current = null
  }, [editorState.currentEditingCell, editorState.selectionRange, cleanupCellVisualArtifacts])

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

  const { fillRange, handleFillHandleMouseDown } = useAutofill({
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
  onNavigateToResult: useCallback((result: SearchResult) => {
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
  onUpdateCell: useCallback((tableIndex: number, row: number, col: number, value: string) => {
      if (tableIndex === currentTableIndex) {
        updateCell(row, col, value)
        onSendMessage({ command: 'updateCell', data: withTableIndex({ row, col, value }) })
      }
  }, [currentTableIndex, updateCell, onSendMessage, withTableIndex]),
  onBulkUpdate: useCallback((tableIndex: number, updates: Array<{ row: number; col: number; value: string }>) => {
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

  const handleAddRow = useCallback((index?: number, count?: number) => {
    // Add rows locally (for immediate UI feedback)
    const rowCount = count || 1
    addRow(index, rowCount)
    // Send message to backend with count parameter (always include count, even if it's 1)
    onSendMessage({ command: 'addRow', data: withTableIndex({ index, count: rowCount }) })
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

  const handleAddColumn = useCallback((index?: number, count?: number) => {
    // Add columns locally (for immediate UI feedback)
    const columnCount = count || 1
    addColumn(index, columnCount)
    // Send message to backend with count parameter (always include count, even if it's 1)
    onSendMessage({ command: 'addColumn', data: withTableIndex({ index, count: columnCount }) })
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
    compositionHandledRef.current = false
    // 未編集セルに対して IME による入力が始まったら、
    // モデルを即座にクリアするのではなく、表示のみ隠す（data-temp-empty）
    // ことで race を回避する（実際のモデル更新は commit 時に行う）
    const currentPos = editorState.selectionRange?.end || editorState.selectionRange?.start
    if (currentPos && !editorState.currentEditingCell) {
      console.debug('[input-capture] marking cell visually empty (compositionstart)', currentPos)
      markCellAsTempEmptyWithTracking(currentPos)
    }
  }, [editorState.selectionRange, editorState.currentEditingCell, markCellAsTempEmptyWithTracking])

  const handleInputCaptureCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    const input = e.currentTarget
    const value = input.value

    // 選択されているセルを取得
    const selectionPos = editorState.selectionRange?.end || editorState.selectionRange?.start
    const targetPos = selectionPos || pendingCompositionCleanupRef.current
    const shouldDeferModelUpdate = !editorState.currentEditingCell

    if (targetPos && value && !editorState.currentEditingCell) {
      // IME確定後、編集モードに入る（モデルはここでクリアしない）
      console.debug('[input-capture] compositionend value:', value, 'pos:', targetPos)
      setInitialCellInput(value)
      console.debug('[input-capture] setInitialCellInput ->', value)
      setCurrentEditingCell(targetPos)
      console.debug('[input-capture] setCurrentEditingCell ->', targetPos)
      compositionHandledRef.current = true // 処理済みフラグを立てる
    }

    // IME 確定時には既存のセル値を上書きしたいのでモデルを更新する
    // （compositionend のあとで行うため IME の組成を壊さない）
    if (selectionPos && value && !shouldDeferModelUpdate) {
      try {
        console.debug('[input-capture] compositionend -> updating model cell', selectionPos, value)
        handleCellUpdate(selectionPos.row, selectionPos.col, value)
      } catch (err) {
        console.debug('[input-capture] failed to update model on compositionend', err)
        try {
          updateCell(selectionPos.row, selectionPos.col, value)
        } catch (e) {
          console.debug('[input-capture] fallback updateCell failed', e)
        }
      }
    }

    // 入力をクリア
    input.value = ''

    // 編集モードに入ったので見た目の非表示フラグを解除
    // 編集モードに入ったので見た目の非表示フラグを解除
    if (targetPos) {
      console.debug('[input-capture] removing data-temp-empty on', targetPos)
      clearCellTemporaryMarker(targetPos)
    }

    // isComposingをfalseにする前に、次のinputイベントを無視するため少し待つ
    setTimeout(() => {
      setIsComposing(false)
      compositionHandledRef.current = false
    }, 0)
  }, [editorState.selectionRange, editorState.currentEditingCell, clearCellTemporaryMarker, handleCellUpdate, setCurrentEditingCell, setInitialCellInput, updateCell])

  // (no composition update handling)

  const handleInputCaptureInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    // IME入力中は処理しない
    if (isComposing) return

    // compositionendで既に処理済みの場合は無視
    if (compositionHandledRef.current) {
      compositionHandledRef.current = false
      return
    }

    const input = e.currentTarget
    const value = input.value
    console.debug('[input-capture] input event value:', JSON.stringify(value))

    // 選択されているセルを取得
    const currentPos = editorState.selectionRange?.end || editorState.selectionRange?.start
    if (currentPos && value && !editorState.currentEditingCell) {
      console.debug('[input-capture] non-IME input at', currentPos, 'value=', JSON.stringify(value))

      // 非IME入力の場合もモデルを即座にクリアせず、表示のみ隠してから編集モードへ遷移する
      console.debug('[input-capture] marking cell visually empty (non-IME)', currentPos)
  markCellAsTempEmptyWithTracking(currentPos)

      // 編集モードに入る（モデル更新は CellEditor 側の commit で行う）
      setInitialCellInput(value)
      console.debug('[input-capture] setInitialCellInput ->', value)
      setCurrentEditingCell(currentPos)
      console.debug('[input-capture] setCurrentEditingCell ->', currentPos)

      // 編集モードに入ったら見た目のフラグは解除
      console.debug('[input-capture] removing data-temp-empty (non-IME) on', currentPos)
      clearCellTemporaryMarker(currentPos)
    }

    // 入力をクリア
    input.value = ''
  }, [isComposing, editorState.selectionRange, editorState.currentEditingCell, markCellAsTempEmptyWithTracking, clearCellTemporaryMarker, setCurrentEditingCell, setInitialCellInput])

  const handleInputCaptureKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (isComposing || compositionHandledRef.current)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [isComposing])

  // input-captureでのペーストを処理（編集モードに遷移せずにペースト実行）
  const handleInputCapturePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    // textareaの値をクリア（inputイベントが発火しないように）
    if (e.currentTarget) {
      e.currentTarget.value = ''
    }
    // 実際のペースト処理を実行
    handlePaste()
  }, [handlePaste])

  // 選択セルの位置にinputCaptureを配置
  const updateInputCapturePosition = useCallback(() => {
    if (!editorState.selectionRange || editorState.currentEditingCell) {
      // 編集中または選択なしの場合は非表示
      setInputCaptureStyle({
        position: 'fixed',
        opacity: 0,
        pointerEvents: 'none',
        width: '1px',
        height: '1px',
        left: '0',
        top: '0',
        zIndex: -1
      })
      return
    }

    const currentPos = editorState.selectionRange.end || editorState.selectionRange.start
    const cellElement = queryCellElement(currentPos)

    if (cellElement) {
      const rect = cellElement.getBoundingClientRect()
      const computedStyle = window.getComputedStyle(cellElement)

      // CellEditorと同じスタイルを適用
      setInputCaptureStyle({
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        // 明示的に height を設定し、テキストがセル上端に来るようにする
        height: `${rect.height}px`,
        minHeight: `${rect.height}px`,
        fontSize: computedStyle.fontSize,
        fontFamily: computedStyle.fontFamily,
        // CellEditor と同じ外側のパディングを適用しつつ、
        // paddingTop を明示することでテキストを上寄せにする
        padding: '4px 6px', // CellEditorと同じパディング
        paddingTop: '4px',
        border: 'none', // CellEditorと同じ
        backgroundColor: 'transparent', // 既存のセル内容を表示
        boxSizing: 'border-box',
        zIndex: 1000,
        pointerEvents: 'none',
        outline: 'none',
        resize: 'none',
        lineHeight: '1.2',
        // 明示的に display:block にして既定のインラインセンタリング影響を避ける
        display: 'block',
        textAlign: 'left',
        color: computedStyle.color,
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        overflow: 'hidden',
        caretColor: 'transparent' // カーソルを非表示
      })
    }
  }, [editorState.selectionRange, editorState.currentEditingCell, queryCellElement])

  // セル選択時にinputCaptureに常にフォーカス（IME対応）
  useEffect(() => {
    // 編集中でない場合、inputCaptureにフォーカス
    if (!editorState.currentEditingCell && inputCaptureRef.current && editorState.selectionRange) {
      updateInputCapturePosition()
      // 少し遅延を入れてフォーカスを確実に設定（マウスクリック時のため）
      setTimeout(() => {
        if (inputCaptureRef.current && !editorState.currentEditingCell) {
          inputCaptureRef.current.focus()
        }
      }, 0)
      // 編集モード終了時に初期入力をクリアするが、
      // initialCellInput が直近に設定されて編集開始へ遷移するケースで
      // レースが起きるため、即時クリアではなく短い遅延で消去する
      // （編集開始が行われたら editorState.currentEditingCell が set され、
      // タイムアウト内でキャンセルされる）
      if (initialCellInput) {
        // clearInitialInputTimeoutRef を作成してタイムアウトを管理
        if (!(clearInitialInputTimeoutRef as any).current) {
          ;(clearInitialInputTimeoutRef as any).current = window.setTimeout(() => {
            setInitialCellInput(null)
            ;(clearInitialInputTimeoutRef as any).current = null
          }, 100)
        }
      }
    } else {
      updateInputCapturePosition()
    }
  }, [
    editorState.currentEditingCell,
    editorState.selectionRange?.start.row,
    editorState.selectionRange?.start.col,
    editorState.selectionRange?.end.row,
    editorState.selectionRange?.end.col,
    initialCellInput,
    setInitialCellInput,
    updateInputCapturePosition
  ])

  // スクロールとリサイズでinputCaptureの位置を更新
  useEffect(() => {
    const container = document.querySelector('.table-container')
    const handleUpdate = () => {
      updateInputCapturePosition()
    }

    if (container) {
      container.addEventListener('scroll', handleUpdate)
    }
    window.addEventListener('resize', handleUpdate)

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleUpdate)
      }
      window.removeEventListener('resize', handleUpdate)
    }
  }, [updateInputCapturePosition])

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
      {/* IME対応の透明入力要素（Googleスプレッドシート方式） */}
      <textarea
        ref={inputCaptureRef}
        className="input-capture"
        style={inputCaptureStyle}
        onCompositionStart={handleInputCaptureCompositionStart}
        onCompositionEnd={handleInputCaptureCompositionEnd}
        onInput={handleInputCaptureInput}
        onKeyDown={handleInputCaptureKeyDown}
        onPaste={handleInputCapturePaste}
        aria-label="Cell input capture"
        rows={1}
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
