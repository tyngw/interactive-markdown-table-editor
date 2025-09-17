import { useState, useCallback, useMemo, useRef } from 'react'
import { CellPosition, SelectionRange } from '../types'

export interface SelectionState {
  selectedCells: Set<string>
  selectionRange: SelectionRange | null
  selectionAnchor: CellPosition | null
  isSelecting: boolean
}

interface UseSelectionOptions {
  tableRowCount: number
  tableColCount: number
}

export function useSelection({ tableRowCount, tableColCount }: UseSelectionOptions) {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null)
  const [selectionAnchor, setSelectionAnchor] = useState<CellPosition | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)

  // ドラッグ中の高速応答性のためのRef管理
  const dragSelectionRef = useRef<{
    isSelecting: boolean
    startCell: CellPosition | null
    currentSelectedCells: Set<string>
    currentSelectionRange: SelectionRange | null
  }>({
    isSelecting: false,
    startCell: null,
    currentSelectedCells: new Set(),
    currentSelectionRange: null
  })

  // 選択をクリア
  const clearSelection = useCallback(() => {
    setSelectedCells(new Set())
    setSelectionRange(null)
    setSelectionAnchor(null)
    setIsSelecting(false)
  }, [])

  // 初期選択状態を設定（A1セル）
  const initializeSelection = useCallback(() => {
    if (tableRowCount > 0 && tableColCount > 0) {
      const firstCell = { row: 0, col: 0 }
      setSelectedCells(new Set(['0-0']))
      setSelectionRange({ start: firstCell, end: firstCell })
      setSelectionAnchor(firstCell)
    } else {
      clearSelection()
    }
  }, [tableRowCount, tableColCount, clearSelection])

  // 範囲内のセルキーを生成
  const generateCellKeysInRange = useCallback((start: CellPosition, end: CellPosition): Set<string> => {
    const newSelectedCells = new Set<string>()
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)
    
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        newSelectedCells.add(`${r}-${c}`)
      }
    }
    
    return newSelectedCells
  }, [])

  // セルを選択
  const selectCell = useCallback((row: number, col: number, extend = false, toggle = false) => {
    const cellKey = `${row}-${col}`
    console.log('[useSelection] selectCell called:', { row, col, extend, toggle, selectionAnchor })

    if (toggle) {
      const newSelectedCells = new Set(selectedCells)
      if (newSelectedCells.has(cellKey)) {
        // 最後のセルが選択解除されるのを防ぐ
        if (newSelectedCells.size > 1) {
          newSelectedCells.delete(cellKey)
        }
      } else {
        newSelectedCells.add(cellKey)
      }
      setSelectedCells(newSelectedCells)
      setSelectionRange({ start: { row, col }, end: { row, col } })
      // toggleの場合もanchorを設定
      setSelectionAnchor({ row, col })
    } else if (extend && selectionAnchor) {
      // Shift+矢印キー：selectionAnchorを起点として範囲選択
      console.log('[useSelection] Using selectionAnchor for extend:', selectionAnchor)
      const newRange: SelectionRange = {
        start: selectionAnchor,
        end: { row, col }
      }
      setSelectionRange(newRange)
      setSelectedCells(generateCellKeysInRange(selectionAnchor, { row, col }))
      // extendの場合はanchorを変更しない
    } else if (extend && selectionRange) {
      // マウス範囲選択：現在のselectionRangeを拡張
      console.log('[useSelection] Using selectionRange for extend:', selectionRange.start)
      const newRange: SelectionRange = {
        start: selectionRange.start,
        end: { row, col }
      }
      setSelectionRange(newRange)
      setSelectedCells(generateCellKeysInRange(newRange.start, newRange.end))
      // anchorをselectionRange.startに設定
      setSelectionAnchor(selectionRange.start)
    } else {
      // 単一セル選択：selectionAnchorを新しく設定
      console.log('[useSelection] Single cell selection, setting new anchor:', { row, col })
      const newPosition = { row, col }
      setSelectedCells(new Set([cellKey]))
      setSelectionRange({ start: newPosition, end: newPosition })
      setSelectionAnchor(newPosition)
    }
  }, [selectionRange, selectedCells, selectionAnchor, generateCellKeysInRange])

  // 行全体を選択
  const selectRow = useCallback((rowIndex: number, extend = false) => {
    const newSelectedCells = new Set<string>()
    
    if (extend && selectionRange) {
      // 範囲選択
      const startRow = selectionRange.start.row
      const endRow = rowIndex
      const minRow = Math.min(startRow, endRow)
      const maxRow = Math.max(startRow, endRow)
      
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = 0; col < tableColCount; col++) {
          newSelectedCells.add(`${row}-${col}`)
        }
      }
      
      setSelectionRange({
        start: selectionRange.start,
        end: { row: rowIndex, col: tableColCount - 1 }
      })
    } else {
      // 単一行選択
      for (let col = 0; col < tableColCount; col++) {
        newSelectedCells.add(`${rowIndex}-${col}`)
      }
      
      setSelectionRange({
        start: { row: rowIndex, col: 0 },
        end: { row: rowIndex, col: tableColCount - 1 }
      })
    }
    
    setSelectedCells(newSelectedCells)
  }, [tableColCount, selectionRange])

  // 列全体を選択
  const selectColumn = useCallback((colIndex: number, extend = false) => {
    const newSelectedCells = new Set<string>()
    
    if (extend && selectionRange) {
      // 範囲選択
      const startCol = selectionRange.start.col
      const endCol = colIndex
      const minCol = Math.min(startCol, endCol)
      const maxCol = Math.max(startCol, endCol)
      
      for (let row = 0; row < tableRowCount; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          newSelectedCells.add(`${row}-${col}`)
        }
      }
      
      setSelectionRange({
        start: selectionRange.start,
        end: { row: tableRowCount - 1, col: colIndex }
      })
    } else {
      // 単一列選択
      for (let row = 0; row < tableRowCount; row++) {
        newSelectedCells.add(`${row}-${colIndex}`)
      }
      
      setSelectionRange({
        start: { row: 0, col: colIndex },
        end: { row: tableRowCount - 1, col: colIndex }
      })
    }
    
    setSelectedCells(newSelectedCells)
  }, [tableRowCount, selectionRange])

  // 全選択
  const selectAll = useCallback(() => {
    const newSelectedCells = new Set<string>()
    
    for (let row = 0; row < tableRowCount; row++) {
      for (let col = 0; col < tableColCount; col++) {
        newSelectedCells.add(`${row}-${col}`)
      }
    }
    
    setSelectedCells(newSelectedCells)
    setSelectionRange({
      start: { row: 0, col: 0 },
      end: { row: tableRowCount - 1, col: tableColCount - 1 }
    })
  }, [tableRowCount, tableColCount])

  // ドラッグ選択関連
  const startDragSelection = useCallback((row: number, col: number) => {
    dragSelectionRef.current.isSelecting = true
    dragSelectionRef.current.startCell = { row, col }
    const cellKey = `${row}-${col}`
    const newSelectedCells = new Set([cellKey])
    const newSelectionRange = { start: { row, col }, end: { row, col } }
    
    dragSelectionRef.current.currentSelectedCells = newSelectedCells
    dragSelectionRef.current.currentSelectionRange = newSelectionRange
    
    // 即座に表示を更新
    setSelectedCells(newSelectedCells)
    setSelectionRange(newSelectionRange)
    setIsSelecting(true)
  }, [])

  const updateDragSelection = useCallback((row: number, col: number) => {
    if (!dragSelectionRef.current.isSelecting || !dragSelectionRef.current.startCell) {
      return
    }
    
    const startCell = dragSelectionRef.current.startCell
    const newRange = { start: startCell, end: { row, col } }
    const newSelectedCells = generateCellKeysInRange(startCell, { row, col })
    
    dragSelectionRef.current.currentSelectedCells = newSelectedCells
    dragSelectionRef.current.currentSelectionRange = newRange
    
    // RequestAnimationFrameを使って適度にUIを更新
    requestAnimationFrame(() => {
      if (dragSelectionRef.current.isSelecting) {
        setSelectedCells(new Set(dragSelectionRef.current.currentSelectedCells))
        setSelectionRange(dragSelectionRef.current.currentSelectionRange)
      }
    })
  }, [generateCellKeysInRange])

  const endDragSelection = useCallback(() => {
    if (dragSelectionRef.current.isSelecting) {
      // 最終状態をStateに反映
      setSelectedCells(new Set(dragSelectionRef.current.currentSelectedCells))
      setSelectionRange(dragSelectionRef.current.currentSelectionRange)
      setIsSelecting(false)
      
      // Refをリセット
      dragSelectionRef.current.isSelecting = false
      dragSelectionRef.current.startCell = null
    }
  }, [])

  // Selection state object
  const selectionState: SelectionState = useMemo(() => ({
    selectedCells,
    selectionRange,
    selectionAnchor,
    isSelecting
  }), [selectedCells, selectionRange, selectionAnchor, isSelecting])

  return {
    selectionState,
    selectCell,
    selectRow,
    selectColumn,
    selectAll,
    clearSelection,
    initializeSelection,
    setSelectionAnchor,
    setIsSelecting,
    // ドラッグ選択関数
    startDragSelection,
    updateDragSelection,
    endDragSelection
  }
}
