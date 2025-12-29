import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { CellPosition, SelectionRange } from '../types'

export interface SelectionState {
  selectedCells: Set<string>
  fullySelectedRows: Set<number>
  fullySelectedCols: Set<number>
  selectionRange: SelectionRange | null
  selectionAnchor: CellPosition | null
}

interface UseSelectionOptions {
  tableRowCount: number
  tableColCount: number
}

export function useSelection({ tableRowCount, tableColCount }: UseSelectionOptions) {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [fullySelectedRows, setFullySelectedRows] = useState<Set<number>>(new Set())
  const [fullySelectedCols, setFullySelectedCols] = useState<Set<number>>(new Set())
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null)
  const [selectionAnchor, setSelectionAnchor] = useState<CellPosition | null>(null)

  // 選択をクリア
  const clearSelection = useCallback(() => {
    setSelectedCells(new Set())
    setFullySelectedRows(new Set())
    setFullySelectedCols(new Set())
    setSelectionRange(null)
    setSelectionAnchor(null)
  }, [])

  // 初期選択状態を設定（A1セル）
  const initializeSelection = useCallback(() => {
    console.log('[MTE][useSelection] initializeSelection called. tableRowCount=', tableRowCount, 'tableColCount=', tableColCount)
    if (tableRowCount > 0 && tableColCount > 0) {
      const firstCell = { row: 0, col: 0 }
      setSelectedCells(new Set(['0-0']))
      setFullySelectedRows(new Set())
      setFullySelectedCols(new Set())
      setSelectionRange({ start: firstCell, end: firstCell })
      setSelectionAnchor(firstCell)
      selectionAnchorRef.current = firstCell
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

  // selectionAnchorの最新値を保持するRef（コールバックの依存関係を切るため）
  const selectionAnchorRef = useRef<CellPosition | null>(null)

  // StateとRefを同期
  useEffect(() => {
    selectionAnchorRef.current = selectionAnchor
  }, [selectionAnchor])

  // セルを選択
  const selectCell = useCallback((row: number, col: number, extend = false, toggle = false) => {
    const cellKey = `${row}-${col}`
    const currentAnchor = selectionAnchorRef.current
    console.log('[useSelection] selectCell called:', { row, col, extend, toggle, currentAnchor })

    // toggleまたは単一セル選択時は全行/全列選択状態を解除
    // Shift拡張（extend）の場合は、基点が全行/全列選択の一部だった場合の挙動が複雑だが、
    // ここではシンプルに「セル単位の操作になったら全行/全列フラグはクリア」する
    setFullySelectedRows(new Set())
    setFullySelectedCols(new Set())

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
    } else if (extend && currentAnchor) {
      // Shift+矢印キー：selectionAnchorを起点として範囲選択
      console.log('[useSelection] Using selectionAnchor for extend:', currentAnchor)
      const newRange: SelectionRange = {
        start: currentAnchor,
        end: { row, col }
      }
      setSelectionRange(newRange)
      setSelectedCells(generateCellKeysInRange(currentAnchor, { row, col }))
    } else if (extend && selectionRange) {
      // マウス範囲選択：現在のselectionRangeを拡張
      console.log('[useSelection] Using selectionRange for extend:', selectionRange.start)
      const newRange: SelectionRange = {
        start: selectionRange.start,
        end: { row, col }
      }
      setSelectionRange(newRange)
      setSelectedCells(generateCellKeysInRange(newRange.start, newRange.end))
    } else {
      // 単一セル選択：selectionAnchorを新しく設定
      console.log('[useSelection] Single cell selection, setting new anchor:', { row, col })
      setSelectedCells(new Set([cellKey]))
      setSelectionRange({ start: { row, col }, end: { row, col } })
      setSelectionAnchor({ row, col })
      // Refも即時更新（次のイベントハンドラ呼び出しに備える）
      selectionAnchorRef.current = { row, col }
    }
  }, [selectionRange, selectedCells, generateCellKeysInRange])

  // 行全体を選択
  const selectRow = useCallback((rowIndex: number, extend = false) => {
    const newSelectedCells = new Set<string>()
    let newFullySelectedRows = new Set<number>()

    if (extend && selectionRange) {
      // 範囲選択
      // 既存の選択が完全行選択を含んでいた場合、それを引き継ぐべきか？
      // 基本的には「直前の選択状態」に依存するが、ここではシンプルに
      // 「今回の操作でカバーされる行」を全て完全選択とする
      // ただし、selectionRange.start が前回の操作の基点になっているはず

      const startRow = selectionRange.start.row
      const endRow = rowIndex
      const minRow = Math.min(startRow, endRow)
      const maxRow = Math.max(startRow, endRow)

      for (let row = minRow; row <= maxRow; row++) {
        newFullySelectedRows.add(row)
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
      newFullySelectedRows.add(rowIndex)
      for (let col = 0; col < tableColCount; col++) {
        newSelectedCells.add(`${rowIndex}-${col}`)
      }

      setSelectionRange({
        start: { row: rowIndex, col: 0 },
        end: { row: rowIndex, col: tableColCount - 1 }
      })
      // 行選択開始時はアンカーも更新（A列）
      setSelectionAnchor({ row: rowIndex, col: 0 })
      selectionAnchorRef.current = { row: rowIndex, col: 0 }
    }

    setSelectedCells(newSelectedCells)
    setFullySelectedRows(newFullySelectedRows)
    // 行選択時は列選択状態をクリア
    setFullySelectedCols(new Set())
  }, [tableColCount, selectionRange])

  // 列全体を選択
  const selectColumn = useCallback((colIndex: number, extend = false) => {
    const newSelectedCells = new Set<string>()
    let newFullySelectedCols = new Set<number>()

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

      for (let col = minCol; col <= maxCol; col++) {
        newFullySelectedCols.add(col)
      }

      setSelectionRange({
        start: selectionRange.start,
        end: { row: tableRowCount - 1, col: colIndex }
      })
    } else {
      // 単一列選択
      newFullySelectedCols.add(colIndex)
      for (let row = 0; row < tableRowCount; row++) {
        newSelectedCells.add(`${row}-${colIndex}`)
      }

      setSelectionRange({
        start: { row: 0, col: colIndex },
        end: { row: tableRowCount - 1, col: colIndex }
      })
      // 列選択開始時はアンカーも更新（0行目）
      setSelectionAnchor({ row: 0, col: colIndex })
      selectionAnchorRef.current = { row: 0, col: colIndex }
    }

    setSelectedCells(newSelectedCells)
    setFullySelectedCols(newFullySelectedCols)
    // 列選択時は行選択状態をクリア
    setFullySelectedRows(new Set())
  }, [tableRowCount, selectionRange])

  // 全選択
  const selectAll = useCallback(() => {
    const newSelectedCells = new Set<string>()
    const newFullySelectedRows = new Set<number>()
    const newFullySelectedCols = new Set<number>()

    for (let row = 0; row < tableRowCount; row++) {
      newFullySelectedRows.add(row)
      for (let col = 0; col < tableColCount; col++) {
        newSelectedCells.add(`${row}-${col}`)
      }
    }

    for (let col = 0; col < tableColCount; col++) {
      newFullySelectedCols.add(col)
    }

    setSelectedCells(newSelectedCells)
    setFullySelectedRows(newFullySelectedRows)
    setFullySelectedCols(newFullySelectedCols)

    setSelectionRange({
      start: { row: 0, col: 0 },
      end: { row: tableRowCount - 1, col: tableColCount - 1 }
    })
    setSelectionAnchor({ row: 0, col: 0 })
    selectionAnchorRef.current = { row: 0, col: 0 }
  }, [tableRowCount, tableColCount])

  // ドラッグ選択関連
  // isMouseDraggingRef: マウスが押されているかどうか（ドラッグ中か）
  const isMouseDraggingRef = useRef(false)

  const onDragStart = useCallback((row: number, col: number) => {
    isMouseDraggingRef.current = true
    // ドラッグ開始時は単一選択として扱う
    // これにより、アンカーが正しく設定される
    selectCell(row, col, false, false)
  }, [selectCell])

  const onDragEnter = useCallback((row: number, col: number) => {
    if (isMouseDraggingRef.current) {
      // ドラッグ中は現在のアンカーを起点に拡張選択を行う（Shift+Click相当）
      selectCell(row, col, true, false)
    }
  }, [selectCell])

  const onDragEnd = useCallback(() => {
    isMouseDraggingRef.current = false
  }, [])

  // Selection state object
  const selectionState: SelectionState = useMemo(() => ({
    selectedCells,
    fullySelectedRows,
    fullySelectedCols,
    selectionRange,
    selectionAnchor
  }), [selectedCells, fullySelectedRows, fullySelectedCols, selectionRange, selectionAnchor])

  return {
    selectionState,
    selectCell,
    selectRow,
    selectColumn,
    selectAll,
    clearSelection,
    initializeSelection,
    setSelectionAnchor,
    // ドラッグ選択関数
    onDragStart,
    onDragEnter,
    onDragEnd
  }
}
