import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { TableData, CellPosition, SelectionRange, SortState, ColumnWidths, EditorState } from '../types'

export function useTableEditor(initialData: TableData) {
  const [tableData, setTableData] = useState<TableData>(initialData)
  const [currentEditingCell, setCurrentEditingCell] = useState<CellPosition | null>(null)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({})
  const [sortState, setSortState] = useState<SortState>({
    column: -1,
    direction: 'none',
    isViewOnly: false,
    originalData: null
  })

  // Sync state when the incoming table changes (e.g., tab switch)
  // Use a ref to track if we should skip the reset due to ongoing sort operation
  const skipResetRef = useRef(false)
  
  useEffect(() => {
    // Don't reset state if we're currently in a sorting operation
    if (skipResetRef.current) {
      console.log('🔍 Skipping state reset due to skip flag')
      return
    }
    
    console.log('🔍 Resetting table state due to initialData change')
    setTableData(initialData)
    setCurrentEditingCell(null)
    setSelectedCells(new Set())
    setSelectionRange(null)
    setIsSelecting(false)
    setColumnWidths({})
    setSortState({ column: -1, direction: 'none', isViewOnly: false, originalData: null })
  }, [initialData])

  // セルの値を更新
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

  // 複数セルの一括更新
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

  // ヘッダーを更新
  const updateHeader = useCallback((col: number, value: string) => {
    setTableData(prev => {
      const newHeaders = [...prev.headers]
      newHeaders[col] = value
      return { ...prev, headers: newHeaders }
    })
  }, [])

  // 行を追加
  const addRow = useCallback((index?: number) => {
    setTableData(prev => {
      const newRows = [...prev.rows]
      const newRow = new Array(prev.headers.length).fill('')
      const insertIndex = index !== undefined ? index : newRows.length
      newRows.splice(insertIndex, 0, newRow)
      return { ...prev, rows: newRows }
    })
  }, [])

  // 行を削除
  const deleteRow = useCallback((index: number) => {
    setTableData(prev => {
      const newRows = [...prev.rows]
      newRows.splice(index, 1)
      return { ...prev, rows: newRows }
    })
  }, [])

  // 列を追加
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

  // 列を削除
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

  // セルを選択
  const selectCell = useCallback((row: number, col: number, extend = false) => {
    const cellKey = `${row}-${col}`
    
    if (extend && selectionRange) {
      // 範囲選択を拡張
      const newRange: SelectionRange = {
        start: selectionRange.start,
        end: { row, col }
      }
      setSelectionRange(newRange)
      
      // 範囲内のすべてのセルを選択
      const newSelectedCells = new Set<string>()
      const minRow = Math.min(newRange.start.row, newRange.end.row)
      const maxRow = Math.max(newRange.start.row, newRange.end.row)
      const minCol = Math.min(newRange.start.col, newRange.end.col)
      const maxCol = Math.max(newRange.start.col, newRange.end.col)
      
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          newSelectedCells.add(`${r}-${c}`)
        }
      }
      setSelectedCells(newSelectedCells)
    } else {
      // 単一セル選択
      setSelectedCells(new Set([cellKey]))
      setSelectionRange({ start: { row, col }, end: { row, col } })
    }
  }, [selectionRange])

  // 選択をクリア
  const clearSelection = useCallback(() => {
    setSelectedCells(new Set())
    setSelectionRange(null)
    setCurrentEditingCell(null)
  }, [])

  // 行全体を選択
  const selectRow = useCallback((rowIndex: number, extend = false) => {
    const newSelectedCells = new Set<string>()
    const headers = tableData.headers
    
    if (extend && selectionRange) {
      // 範囲選択
      const startRow = selectionRange.start.row
      const endRow = rowIndex
      const minRow = Math.min(startRow, endRow)
      const maxRow = Math.max(startRow, endRow)
      
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = 0; col < headers.length; col++) {
          newSelectedCells.add(`${row}-${col}`)
        }
      }
      
      setSelectionRange({
        start: selectionRange.start,
        end: { row: rowIndex, col: headers.length - 1 }
      })
    } else {
      // 単一行選択
      for (let col = 0; col < headers.length; col++) {
        newSelectedCells.add(`${rowIndex}-${col}`)
      }
      
      setSelectionRange({
        start: { row: rowIndex, col: 0 },
        end: { row: rowIndex, col: headers.length - 1 }
      })
    }
    
    setSelectedCells(newSelectedCells)
  }, [tableData.headers, selectionRange])

  // 列全体を選択
  const selectColumn = useCallback((colIndex: number, extend = false) => {
    const newSelectedCells = new Set<string>()
    const rows = tableData.rows
    
    if (extend && selectionRange) {
      // 範囲選択
      const startCol = selectionRange.start.col
      const endCol = colIndex
      const minCol = Math.min(startCol, endCol)
      const maxCol = Math.max(startCol, endCol)
      
      for (let row = 0; row < rows.length; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          newSelectedCells.add(`${row}-${col}`)
        }
      }
      
      setSelectionRange({
        start: selectionRange.start,
        end: { row: rows.length - 1, col: colIndex }
      })
    } else {
      // 単一列選択
      for (let row = 0; row < rows.length; row++) {
        newSelectedCells.add(`${row}-${colIndex}`)
      }
      
      setSelectionRange({
        start: { row: 0, col: colIndex },
        end: { row: rows.length - 1, col: colIndex }
      })
    }
    
    setSelectedCells(newSelectedCells)
  }, [tableData.rows, selectionRange])

  // 全選択
  const selectAll = useCallback(() => {
    const newSelectedCells = new Set<string>()
    const { headers, rows } = tableData
    
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < headers.length; col++) {
        newSelectedCells.add(`${row}-${col}`)
      }
    }
    
    setSelectedCells(newSelectedCells)
    setSelectionRange({
      start: { row: 0, col: 0 },
      end: { row: rows.length - 1, col: headers.length - 1 }
    })
  }, [tableData])

  // 列幅を設定
  const setColumnWidth = useCallback((col: number, width: number) => {
    setColumnWidths(prev => ({ ...prev, [col]: width }))
  }, [])

  // 行を移動
  const moveRow = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    
    setTableData(prev => {
      const newRows = [...prev.rows]
      const [movedRow] = newRows.splice(fromIndex, 1)
      newRows.splice(toIndex, 0, movedRow)
      return { ...prev, rows: newRows }
    })
  }, [])

  // 列を移動
  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    
    setTableData(prev => {
      // ヘッダーを移動
      const newHeaders = [...prev.headers]
      const [movedHeader] = newHeaders.splice(fromIndex, 1)
      newHeaders.splice(toIndex, 0, movedHeader)
      
      // 各行のデータを移動
      const newRows = prev.rows.map(row => {
        const newRow = [...row]
        const [movedCell] = newRow.splice(fromIndex, 1)
        newRow.splice(toIndex, 0, movedCell)
        return newRow
      })
      
      return { ...prev, headers: newHeaders, rows: newRows }
    })
  }, [])

  // Apply view-only sort (does not modify file) - 3-state toggle: asc → desc → none
  const sortColumn = useCallback((col: number) => {
    console.log('🔧 sortColumn called with col:', col)
    console.log('🔧 Current tableData before sort:', tableData)
    
    // Set skip flag to prevent useEffect from resetting state
    skipResetRef.current = true
    
    setSortState(prev => {
      console.log('🔧 setSortState callback, prev state:', prev)
      let direction: 'asc' | 'desc' | 'none' = 'asc'
      
      // Determine new direction based on current state
      if (prev.column === col) {
        // Same column clicked - cycle through states
        if (prev.direction === 'asc') {
          direction = 'desc'
        } else if (prev.direction === 'desc') {
          direction = 'none'
        } else {
          direction = 'asc'
        }
      } else {
        // Different column clicked - start with asc
        direction = 'asc'
      }

      console.log('🔧 Determined direction:', direction)

      // Store original data if this is the first sort
      const originalData = prev.originalData || tableData
      
      if (direction === 'none') {
        // Restore original data
        console.log('🔧 Restoring original data:', originalData)
        setTableData(originalData)
        // Clear skip flag when sort operation is complete
        skipResetRef.current = false
        const newState = {
          column: -1,
          direction: 'none' as const,
          isViewOnly: false,
          originalData: null
        }
        console.log('🔧 Returning new state (restore):', newState)
        return newState
      } else {
        // Apply sort to display data
        console.log('🔧 Sorting data with direction:', direction)
        const sortedData = sortTableData(originalData, col, direction)
        console.log('🔧 Sorted data:', sortedData)
        setTableData(sortedData)
        const newState = {
          column: col,
          direction: direction,
          isViewOnly: true,
          originalData: originalData
        }
        console.log('🔧 Returning new state (sort):', newState)
        return newState
      }
    })
  }, [tableData])

  // Sort table data utility function
  const sortTableData = useCallback((data: TableData, columnIndex: number, direction: 'asc' | 'desc') => {
    const sortedData = JSON.parse(JSON.stringify(data)) // Deep clone
    
    const sortedIndices = sortedData.rows.map((row: string[], index: number) => ({
      index,
      value: row[columnIndex] || '',
      row
    }))

    sortedIndices.sort((a: { index: number; value: string; row: string[] }, b: { index: number; value: string; row: string[] }) => {
      // Convert <br/> tags to spaces for sorting comparison
      const aVal = a.value.toString().replace(/<br\s*\/?>/gi, ' ').toLowerCase().trim()
      const bVal = b.value.toString().replace(/<br\s*\/?>/gi, ' ').toLowerCase().trim()
      
      // Try numeric comparison first
      const aNum = parseFloat(aVal)
      const bNum = parseFloat(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum
      }
      
      // Fall back to string comparison
      if (direction === 'asc') {
        return aVal.localeCompare(bVal)
      } else {
        return bVal.localeCompare(aVal)
      }
    })

    sortedData.rows = sortedIndices.map((item: { index: number; value: string; row: string[] }) => item.row)
    return sortedData
  }, [])

  // Restore original view (before any sorting)
  const restoreOriginalView = useCallback(() => {
    skipResetRef.current = false // Clear skip flag
    setSortState(prev => {
      if (prev.originalData) {
        setTableData(prev.originalData)
        return {
          column: -1,
          direction: 'none',
          isViewOnly: false,
          originalData: null
        }
      }
      return prev
    })
  }, [])

  // Commit current sort to file
  const commitSortToFile = useCallback(() => {
    skipResetRef.current = false // Clear skip flag
    setSortState(prev => {
      if (prev.isViewOnly) {
        return {
          column: prev.column,
          direction: prev.direction,
          isViewOnly: false,
          originalData: null
        }
      }
      return prev
    })
  }, [])

  // エディタ状態をまとめて返す
  const editorState: EditorState = useMemo(() => ({
    currentEditingCell,
    selectedCells,
    selectionRange,
    isSelecting,
    sortState,
    columnWidths
  }), [currentEditingCell, selectedCells, selectionRange, isSelecting, sortState, columnWidths])

  return {
    tableData,
    editorState,
    setTableData,
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
    clearSelection,
    setCurrentEditingCell,
    setIsSelecting,
    setColumnWidth,
    moveRow,
    moveColumn,
    sortColumn,
    restoreOriginalView,
    commitSortToFile
  }
}