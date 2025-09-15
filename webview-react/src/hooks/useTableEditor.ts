import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { TableData, CellPosition, ColumnWidths, EditorState } from '../types'
import { useSelection } from './useSelection'
import { useSort } from './useSort'

export function useTableEditor(initialData: TableData) {
  const [tableData, setTableData] = useState<TableData>(initialData)
  const [currentEditingCell, setCurrentEditingCell] = useState<CellPosition | null>(null)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({})

  const selection = useSelection({
    tableRowCount: tableData.rows.length,
    tableColCount: tableData.headers.length
  })

  // Sort management using the separated useSort hook
  const useSortResult = useSort()
  console.log('🔍 [useTableEditor] useSort returned:', useSortResult)
  
  if (!useSortResult) {
    throw new Error('useSort returned undefined')
  }
  
  const { sortState, sortColumn, resetSortState } = useSortResult
  console.log('🔍 [useTableEditor] Destructured values:', { sortState, sortColumn, resetSortState })

  const { displayedData, viewToModelMap } = useMemo(() => {
    console.log('🔍 [useTableEditor] useMemo sortState:', sortState)
    
    // sortStateが未定義の場合のガード
    if (!sortState) {
      console.warn('⚠️ [useTableEditor] sortState is undefined, returning original data')
      return {
        displayedData: tableData,
        viewToModelMap: tableData.rows.map((_, index) => index),
      }
    }
    
    const { column, direction } = sortState
    console.log('🔍 [useTableEditor] Sort parameters - column:', column, 'direction:', direction)
    
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
    console.log('🔍 Resetting table state due to initialData change')
    setTableData(initialData)
    setCurrentEditingCell(null)
    setColumnWidths({})
    
    stableFunctions.current.resetSortState()
    stableFunctions.current.initializeSelection()
  }, [initialData])

  const updateCell = useCallback((viewIndex: number, col: number, value: string) => {
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

  const addRow = useCallback((viewIndex?: number) => {
    console.log('🔍 [useTableEditor] addRow called, sortState:', sortState)
    const isSorted = sortState?.direction !== 'none'
    setTableData(prev => {
      const newRows = [...prev.rows]
      const newRow = new Array(prev.headers.length).fill('')
      
      let insertIndex = viewIndex
      if (isSorted || viewIndex === undefined) {
        insertIndex = newRows.length
      } else {
        const modelIndex = viewToModelMap[viewIndex]
        insertIndex = modelIndex !== undefined ? modelIndex : newRows.length
      }

      newRows.splice(insertIndex, 0, newRow)
      return { ...prev, rows: newRows }
    })
  }, [sortState?.direction, viewToModelMap])

  const deleteRow = useCallback((viewIndex: number) => {
    const modelIndex = viewToModelMap[viewIndex]
    if (modelIndex === undefined) return

    setTableData(prev => {
      const newRows = [...prev.rows]
      newRows.splice(modelIndex, 1)
      return { ...prev, rows: newRows }
    })
  }, [viewToModelMap])

  const addColumn = useCallback((index?: number) => {
    setTableData(prev => {
      const insertIndex = index !== undefined ? index : prev.headers.length
      const newHeaders = [...prev.headers]
      newHeaders.splice(insertIndex, 0, `Column ${insertIndex + 1}`)
      
      const newRows = prev.rows.map(row => {
        const newRow = [...row]
        newRow.splice(insertIndex, 0, '')
        return newRow
      })
      
      return { ...prev, headers: newHeaders, rows: newRows }
    })
  }, [])

  const deleteColumn = useCallback((index: number) => {
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
    console.log('🔍 [useTableEditor] moveRow called, sortState:', sortState)
    if (sortState?.direction !== 'none') return;
    setTableData(prev => {
      const newRows = [...prev.rows]
      const [movedRow] = newRows.splice(fromIndex, 1)
      newRows.splice(toIndex, 0, movedRow)
      return { ...prev, rows: newRows }
    })
  }, [sortState?.direction])

  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
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
    setTableData(displayedData)
    resetSortState()
  }, [displayedData, resetSortState])

  const editorState: EditorState = useMemo(() => {
    console.log('🔍 [useTableEditor] Building editorState with sortState:', sortState)
    
    // sortStateが未定義の場合のデフォルト値を設定
    const safeSortState = sortState || { column: -1, direction: 'none' as const }
    console.log('🔍 [useTableEditor] Using safeSortState:', safeSortState)
    
    const state = {
      currentEditingCell,
      selectedCells: selection.selectionState.selectedCells,
      selectionRange: selection.selectionState.selectionRange,
      isSelecting: selection.selectionState.isSelecting,
      sortState: safeSortState,
      columnWidths
    }
    console.log('🔍 [useTableEditor] Built editorState:', state)
    return state
  }, [currentEditingCell, selection.selectionState, sortState, columnWidths])

  return {
  // Display用のデータ（ソート適用後）
  tableData: displayedData,
  // モデル（実体）データ（ソート前／元データ）
  modelTableData: tableData,
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
    setSelectionAnchor: selection.setSelectionAnchor,
    setColumnWidth,
    moveRow,
    moveColumn,
    sortColumn,
    commitSort,
    resetSort: resetSortState,
  }
}