import { useState, useCallback, useMemo, useEffect } from 'react'
import { TableData, CellPosition, ColumnWidths, EditorState } from '../types'
import { useSelection } from './useSelection'
import { useSort } from './useSort'

export function useTableEditor(initialData: TableData) {
  const [tableData, setTableData] = useState<TableData>(initialData)
  const [currentEditingCell, setCurrentEditingCell] = useState<CellPosition | null>(null)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({})

  // Selection management using the separated useSelection hook
  const selection = useSelection({
    tableRowCount: tableData.rows.length,
    tableColCount: tableData.headers.length
  })

  // Sort management using the separated useSort hook
  const sort = useSort({
    onDataUpdate: setTableData
  })

  // Sync state when the incoming table changes (e.g., tab switch)
  useEffect(() => {
    // Don't reset state if we're currently in a sorting operation
    if (sort.sortState.isViewOnly) {
      console.log('🔍 Skipping state reset due to active sort operation')
      return
    }
    
    console.log('🔍 Resetting table state due to initialData change')
    setTableData(initialData)
    setCurrentEditingCell(null)
    setColumnWidths({})
    
    // Reset sort state directly to avoid infinite loops
    sort.resetSortState()

    // Initialize selection directly to avoid infinite loops
    selection.initializeSelection()
  }, [initialData, sort.sortState.isViewOnly]) // Remove function dependencies to prevent infinite loops

  // Cell operations
  const updateCell = useCallback((row: number, col: number, value: string) => {
    setTableData(prev => {
      const newRows = [...prev.rows]
      if (!newRows[row]) {
        newRows[row] = []
      }
      newRows[row][col] = value
      return { ...prev, rows: newRows }
    })
  }, [])

  // Batch cell updates
  const updateCells = useCallback((updates: Array<{ row: number; col: number; value: string }>) => {
    setTableData(prev => {
      const newRows = [...prev.rows]
      updates.forEach(({ row, col, value }) => {
        if (!newRows[row]) {
          newRows[row] = []
        }
        newRows[row][col] = value
      })
      return { ...prev, rows: newRows }
    })
  }, [])

  // Header operations
  const updateHeader = useCallback((col: number, value: string) => {
    setTableData(prev => {
      const newHeaders = [...prev.headers]
      newHeaders[col] = value
      return { ...prev, headers: newHeaders }
    })
  }, [])

  // Row operations
  const addRow = useCallback((index?: number) => {
    setTableData(prev => {
      const newRows = [...prev.rows]
      const newRow = new Array(prev.headers.length).fill('')
      const insertIndex = index !== undefined ? index : newRows.length
      newRows.splice(insertIndex, 0, newRow)
      return { ...prev, rows: newRows }
    })
  }, [])

  const deleteRow = useCallback((index: number) => {
    setTableData(prev => {
      const newRows = [...prev.rows]
      newRows.splice(index, 1)
      return { ...prev, rows: newRows }
    })
  }, [])

  // Column operations
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

  // Move operations
  const moveRow = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    
    setTableData(prev => {
      const newRows = [...prev.rows]
      const [movedRow] = newRows.splice(fromIndex, 1)
      newRows.splice(toIndex, 0, movedRow)
      return { ...prev, rows: newRows }
    })
  }, [])

  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    
    setTableData(prev => {
      // Move header
      const newHeaders = [...prev.headers]
      const [movedHeader] = newHeaders.splice(fromIndex, 1)
      newHeaders.splice(toIndex, 0, movedHeader)
      
      // Move data in each row
      const newRows = prev.rows.map(row => {
        const newRow = [...row]
        const [movedCell] = newRow.splice(fromIndex, 1)
        newRow.splice(toIndex, 0, movedCell)
        return newRow
      })
      
      return { ...prev, headers: newHeaders, rows: newRows }
    })
  }, [])

  // Column width management
  const setColumnWidth = useCallback((col: number, width: number) => {
    setColumnWidths(prev => ({ ...prev, [col]: width }))
  }, [])

  // Sort operations - delegate to useSort hook
  const sortColumn = useCallback((col: number) => {
    return sort.sortColumn(col, tableData)
  }, [sort, tableData])

  // Editor state object
  const editorState: EditorState = useMemo(() => ({
    currentEditingCell,
    selectedCells: selection.selectionState.selectedCells,
    selectionRange: selection.selectionState.selectionRange,
    isSelecting: selection.selectionState.isSelecting,
    sortState: sort.sortState,
    columnWidths
  }), [currentEditingCell, selection.selectionState, sort.sortState, columnWidths])

  return {
    tableData,
    editorState,
    selectionAnchor: selection.selectionState.selectionAnchor,
    setTableData,
    updateCell,
    updateCells,
    updateHeader,
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
    setIsSelecting: selection.setIsSelecting,
    setSelectionAnchor: selection.setSelectionAnchor,
    setColumnWidth,
    moveRow,
    moveColumn,
    sortColumn,
    restoreOriginalView: sort.restoreOriginalView,
    commitSortToFile: sort.commitSortToFile,
    // Drag selection functions
    startDragSelection: selection.startDragSelection,
    updateDragSelection: selection.updateDragSelection,
    endDragSelection: selection.endDragSelection
  }
}