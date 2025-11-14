import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { TableData, CellPosition, ColumnWidths, EditorState, SortState, HeaderConfig } from '../types'
import { useSelection } from './useSelection'
import { useSort } from './useSort'

type SetSortState = (updater: SortState | ((prev: SortState) => SortState)) => void
type SetHeaderConfig = (updater: HeaderConfig | ((prev: HeaderConfig) => HeaderConfig)) => void

export function useTableEditor(
  initialData: TableData,
  instanceKey?: string,
  externalSort?: { sortState: SortState; setSortState: SetSortState },
  options?: { initializeSelectionOnDataChange?: boolean },
  externalHeaderConfig?: { headerConfig: HeaderConfig; setHeaderConfig: SetHeaderConfig }
) {
  const [tableData, setTableData] = useState<TableData>(initialData)
  const [currentEditingCell, setCurrentEditingCell] = useState<CellPosition | null>(null)
  const [initialCellInput, setInitialCellInput] = useState<string | null>(null)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({})
  const [internalHeaderConfig, setInternalHeaderConfig] = useState<HeaderConfig>(
    (initialData as any).headerConfig || {
      hasColumnHeaders: true,  // デフォルトで列ヘッダーあり
      hasRowHeaders: false     // デフォルトで行ヘッダーなし
    }
  )

  // 外部から提供されたheaderConfigを使用、なければ内部状態を使用
  const headerConfig = externalHeaderConfig?.headerConfig ?? internalHeaderConfig
  const setHeaderConfig = externalHeaderConfig?.setHeaderConfig ?? setInternalHeaderConfig
  // 内部由来のデータ更新（セル編集・行列操作など）を検知するためのフラグ
  const internalUpdateRef = useRef(false)
  const internalUpdateTsRef = useRef<number>(0)
  const internalUpdateClearTimerRef = useRef<number | undefined>(undefined as any)

  const selection = useSelection({
    tableRowCount: tableData.rows.length,
    tableColCount: tableData.headers.length
  })

  // Sort management: prefer external controller if provided
  let sortState: SortState
  let sortColumn: (col: number) => void
  let resetSortState: () => void

  if (externalSort) {
    sortState = externalSort.sortState
    sortColumn = (col: number) => {
      externalSort.setSortState((prev) => {
        let next: SortState
        if (prev.column === col) {
          next = prev.direction === 'asc'
            ? { column: col, direction: 'desc' }
            : prev.direction === 'desc'
              ? { column: -1, direction: 'none' }
              : { column: col, direction: 'asc' }
        } else {
          next = { column: col, direction: 'asc' }
        }
        return next
      })
    }
    resetSortState = () => externalSort.setSortState({ column: -1, direction: 'none' })
  } else {
    const useSortResult = useSort(instanceKey)
    sortState = useSortResult.sortState
    sortColumn = useSortResult.sortColumn
    resetSortState = useSortResult.resetSortState
  }

  const { displayedData, viewToModelMap } = useMemo(() => {
    // sortStateが未定義の場合のガード
    if (!sortState) {
      return {
        displayedData: tableData,
        viewToModelMap: tableData.rows.map((_, index) => index),
      }
    }

    const { column, direction } = sortState

    if (direction === 'none' || column < 0) {
      return {
        displayedData: tableData,
        viewToModelMap: tableData.rows.map((_, index) => index),
      }
    }

    const indexedRows = tableData.rows.map((row, index) => ({ row, originalIndex: index }))

    indexedRows.sort((a, b) => {
      const aVal = a.row[column]?.toString().replace(/<br\s*\/?>/gi, ' ').toLowerCase().trim() || ''
      const bVal = b.row[column]?.toString().replace(/<br\s*\/?>/gi, ' ').toLowerCase().trim() || ''
      
      const aNum = parseFloat(aVal)
      const bNum = parseFloat(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum
      }
      
      return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })

    return {
      displayedData: {
        ...tableData,
        rows: indexedRows.map(item => item.row),
      },
      viewToModelMap: indexedRows.map(item => item.originalIndex),
    }
  }, [tableData, sortState])

  // Stable functions to avoid infinite effect loops
  const stableFunctions = useRef({
    resetSortState,
    initializeSelection: selection.initializeSelection,
  })

  useEffect(() => {
    stableFunctions.current.resetSortState = resetSortState
    stableFunctions.current.initializeSelection = selection.initializeSelection
  }, [resetSortState, selection.initializeSelection])

  useEffect(() => {
    // initialData の変更に伴う状態同期
    const now = Date.now()
    const echoWindowMs = 800
    const withinEchoWindow = internalUpdateTsRef.current > 0 && (now - internalUpdateTsRef.current) <= echoWindowMs
    const wasInternal = internalUpdateRef.current || withinEchoWindow

    // 現在の形状と新しい形状の差分（行数・列数の比較）
    const prevRowCount = tableData?.rows?.length ?? 0
    const prevColCount = tableData?.headers?.length ?? 0
    const nextRowCount = initialData?.rows?.length ?? 0
    const nextColCount = initialData?.headers?.length ?? 0
    const shapeChanged = prevRowCount !== nextRowCount || prevColCount !== nextColCount

    console.log('[MTE][useTableEditor] initialData changed.', {
      internalUpdateRef: internalUpdateRef.current,
      withinEchoWindow,
      wasInternal,
      currentEditingCell,
      initializeSelectionOnDataChange: options?.initializeSelectionOnDataChange,
      prevRowCount,
      prevColCount,
      nextRowCount,
      nextColCount,
      shapeChanged
    })

    setTableData(initialData)
    setCurrentEditingCell(null)
    // Don't reset column widths and row heights to preserve them across table updates
    // setColumnWidths({})
    // setRowHeights({})

    if (wasInternal) {
      console.log('[MTE][useTableEditor] Skipping sort reset and selection initialization due to internal or echo update')
      // internal フラグはタイムウィンドウ経過後にクリア（次の内部操作で更新）
      return
    }

    // 外部からのデータ更新時: 形状変化がある場合のみソートリセット
    if (shapeChanged) {
      console.log('[MTE][useTableEditor] External update with shape change. Resetting sort state')
      stableFunctions.current.resetSortState()
    } else {
      console.log('[MTE][useTableEditor] External update without shape change. Preserving sort state')
    }

    // 選択の初期化は「選択が既にあり、形状が変わらない場合」は抑止して維持
    const hasSelection = !!selection.selectionState.selectionRange && selection.selectionState.selectedCells.size > 0
    const isEditingCell = currentEditingCell !== null
    if (options?.initializeSelectionOnDataChange && !isEditingCell) {
      if (!hasSelection || shapeChanged) {
        console.log('[MTE][useTableEditor] Initializing selection to first cell (A1)')
        stableFunctions.current.initializeSelection()
      } else {
        console.log('[MTE][useTableEditor] Preserving selection (already selected and shape unchanged)')
      }
    } else {
      console.log('[MTE][useTableEditor] Preserving selection (no initialization condition)')
    }
  }, [initialData])

  const markInternalUpdate = () => {
    internalUpdateRef.current = true
    internalUpdateTsRef.current = Date.now()
    // 既存タイマーをクリアし、新たにウィンドウ経過後にフラグを下ろす
    if (internalUpdateClearTimerRef.current) {
      clearTimeout(internalUpdateClearTimerRef.current)
    }
    internalUpdateClearTimerRef.current = setTimeout(() => {
      internalUpdateRef.current = false
      internalUpdateTsRef.current = 0
      internalUpdateClearTimerRef.current = undefined as any
    }, 800) as any
  }

  const updateCell = useCallback((viewIndex: number, col: number, value: string) => {
    markInternalUpdate()
    const modelIndex = viewToModelMap[viewIndex]
    if (modelIndex === undefined) return

    setTableData(prev => {
      const newRows = [...prev.rows]
      newRows[modelIndex] = [...newRows[modelIndex]]
      newRows[modelIndex][col] = value
      return { ...prev, rows: newRows }
    })
  }, [viewToModelMap])

  const updateCells = useCallback((updates: Array<{ row: number; col: number; value: string }>) => {
    markInternalUpdate()
    setTableData(prev => {
      const newRows = [...prev.rows]
      updates.forEach(({ row: viewIndex, col, value }) => {
        const modelIndex = viewToModelMap[viewIndex]
        if (modelIndex !== undefined && newRows[modelIndex]) {
          newRows[modelIndex] = [...newRows[modelIndex]]
          newRows[modelIndex][col] = value
        }
      })
      return { ...prev, rows: newRows }
    })
  }, [viewToModelMap])

  const addRow = useCallback((viewIndex?: number, count: number = 1) => {
    markInternalUpdate()
    const isSorted = sortState?.direction !== 'none'
    setTableData(prev => {
      const newRows = [...prev.rows]

      let insertIndex = viewIndex
      if (isSorted || viewIndex === undefined) {
        insertIndex = newRows.length
      } else {
        const modelIndex = viewToModelMap[viewIndex]
        insertIndex = modelIndex !== undefined ? modelIndex : newRows.length
      }

      // Add multiple rows at once
      const rowsToAdd: string[][] = []
      for (let i = 0; i < count; i++) {
        rowsToAdd.push(new Array(prev.headers.length).fill(''))
      }
      newRows.splice(insertIndex, 0, ...rowsToAdd)

      return { ...prev, rows: newRows }
    })
  }, [sortState?.direction, viewToModelMap])

  const deleteRow = useCallback((viewIndex: number) => {
    markInternalUpdate()
    const modelIndex = viewToModelMap[viewIndex]
    if (modelIndex === undefined) return

    setTableData(prev => {
      const newRows = [...prev.rows]
      newRows.splice(modelIndex, 1)
      return { ...prev, rows: newRows }
    })
  }, [viewToModelMap])

  const addColumn = useCallback((index?: number, count: number = 1) => {
    markInternalUpdate()
    setTableData(prev => {
      const insertIndex = index !== undefined ? index : prev.headers.length
      const newHeaders = [...prev.headers]

      // Add multiple columns at once
      const headersToAdd: string[] = []
      for (let i = 0; i < count; i++) {
        headersToAdd.push(`Column ${insertIndex + i + 1}`)
      }
      newHeaders.splice(insertIndex, 0, ...headersToAdd)

      const newRows = prev.rows.map(row => {
        const newRow = [...row]
        const cellsToAdd = new Array(count).fill('')
        newRow.splice(insertIndex, 0, ...cellsToAdd)
        return newRow
      })

      return { ...prev, headers: newHeaders, rows: newRows }
    })
  }, [])

  const deleteColumn = useCallback((index: number) => {
    markInternalUpdate()
    setTableData(prev => {
      const newHeaders = [...prev.headers]
      newHeaders.splice(index, 1)
      const newRows = prev.rows.map(row => {
        const newRow = [...row]
        newRow.splice(index, 1)
        return newRow
      })
      return { ...prev, headers: newHeaders, rows: newRows }
    })
  }, [])

  const moveRow = useCallback((fromIndex: number, toIndex: number) => {
    markInternalUpdate()
    if (sortState?.direction !== 'none') return;
    setTableData(prev => {
      const newRows = [...prev.rows]
      const [movedRow] = newRows.splice(fromIndex, 1)
      newRows.splice(toIndex, 0, movedRow)
      return { ...prev, rows: newRows }
    })
  }, [sortState?.direction])

  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    markInternalUpdate()
    setTableData(prev => {
      const newHeaders = [...prev.headers]
      const [movedHeader] = newHeaders.splice(fromIndex, 1)
      newHeaders.splice(toIndex, 0, movedHeader)
      const newRows = prev.rows.map(row => {
        const newRow = [...row]
        const [movedCell] = newRow.splice(fromIndex, 1)
        newRow.splice(toIndex, 0, movedCell)
        return newRow
      })
      return { ...prev, headers: newHeaders, rows: newRows }
    })
  }, [])

  const setColumnWidth = useCallback((col: number, width: number) => {
    setColumnWidths(prev => ({ ...prev, [col]: width }))
  }, [])

  const commitSort = useCallback(() => {
    markInternalUpdate()
    setTableData(displayedData)
    resetSortState()
  }, [displayedData, resetSortState])

  const toggleColumnHeaders = useCallback(() => {
    setHeaderConfig(prev => ({
      ...prev,
      hasColumnHeaders: !prev.hasColumnHeaders
    }))
  }, [setHeaderConfig])

  const toggleRowHeaders = useCallback(() => {
    setHeaderConfig(prev => ({
      ...prev,
      hasRowHeaders: !prev.hasRowHeaders
    }))
  }, [setHeaderConfig])

  const editorState: EditorState = useMemo(() => {
    // sortStateが未定義の場合のデフォルト値を設定
    const safeSortState = sortState || { column: -1, direction: 'none' as const }

    return {
      currentEditingCell,
      selectedCells: selection.selectionState.selectedCells,
      selectionRange: selection.selectionState.selectionRange,
      isSelecting: selection.selectionState.isSelecting,
      sortState: safeSortState,
      columnWidths,
      headerConfig
    }
  }, [currentEditingCell, selection.selectionState, sortState, columnWidths, headerConfig])

  return {
  // Display用のデータ（ソート適用後）
  tableData: displayedData,
  // モデル（実体）データ（ソート前／元データ）
  modelTableData: tableData,
    viewToModelMap,
    editorState,
    selectionAnchor: selection.selectionState.selectionAnchor,
    updateCell,
    updateCells,
    updateHeader: (col: number, value: string) => setTableData(prev => ({...prev, headers: prev.headers.map((h, i) => i === col ? value : h)})),
    addRow,
    deleteRow,
    addColumn,
    deleteColumn,
    selectCell: selection.selectCell,
    selectRow: selection.selectRow,
    selectColumn: selection.selectColumn,
    selectAll: selection.selectAll,
    clearSelection: selection.clearSelection,
    setCurrentEditingCell,
    initialCellInput,
    setInitialCellInput,
    setSelectionAnchor: selection.setSelectionAnchor,
    setColumnWidth,
    moveRow,
    moveColumn,
    sortColumn,
    commitSort,
    resetSort: resetSortState,
    toggleColumnHeaders,
    toggleRowHeaders,
  }
}
