import { useCallback, useEffect } from 'react'
import { CellPosition, SelectionRange, TableData, HeaderConfig } from '../types'

interface KeyboardNavigationProps {
  tableData: TableData
  currentEditingCell: CellPosition | null
  selectionRange: SelectionRange | null
  selectionAnchor: CellPosition | null
  onCellSelect: (row: number, col: number, extend?: boolean) => void
  onCellEdit: (position: CellPosition | null) => void
  onCopy: () => void
  onPaste: () => void
  onCut: () => void
  onClearCells: () => void
  onSelectAll: () => void
  onSetSelectionAnchor: (position: CellPosition | null) => void
  onUndo: () => void
  onRedo: () => void
  headerConfig?: HeaderConfig
  onOpenSearch?: (withReplace?: boolean) => void
}

export function useKeyboardNavigation({
  tableData,
  currentEditingCell,
  selectionRange,
  selectionAnchor,
  onCellSelect,
  onCellEdit,
  onCopy,
  onPaste,
  onCut,
  onClearCells,
  onSelectAll,
  onSetSelectionAnchor,
  onUndo,
  onRedo,
  headerConfig,
  onOpenSearch
}: KeyboardNavigationProps) {

  // Helper function to check if a cell has content (for smart navigation)
  const hasContent = useCallback((row: number, col: number): boolean => {
    if (row < 0 || row >= tableData.rows.length || col < 0 || col >= tableData.headers.length) {
      return false
    }
    const cellValue = tableData.rows[row][col]
    return String(cellValue ?? '').trim() !== ''
  }, [tableData])

  // Smart navigation (Excel-like Ctrl+Arrow behavior)
  const getSmartNavigationPosition = useCallback((
    currentPos: CellPosition,
    direction: 'up' | 'down' | 'left' | 'right'
  ): CellPosition => {
    const { row, col } = currentPos
    const totalRows = tableData.rows.length
    const totalCols = tableData.headers.length

    let targetRow = row
    let targetCol = col

    switch (direction) {
      case 'up':
        if (targetRow > 0) {
          const currentHasContent = hasContent(row, col)
          const nextHasContent = hasContent(row - 1, col)

          if (currentHasContent === nextHasContent) {
            // Next cell has same state: jump to end of current state range
            while (targetRow > 0 && hasContent(targetRow - 1, col) === currentHasContent) {
              targetRow--
            }
          } else {
            // Next cell has different state: jump to end of next state range
            targetRow-- // Move to next cell first
            while (targetRow > 0 && hasContent(targetRow - 1, col) === nextHasContent) {
              targetRow--
            }
          }
        }
        break

      case 'down':
        if (targetRow < totalRows - 1) {
          const currentHasContent = hasContent(row, col)
          const nextHasContent = hasContent(row + 1, col)

          if (currentHasContent === nextHasContent) {
            // Next cell has same state: jump to end of current state range
            while (targetRow < totalRows - 1 && hasContent(targetRow + 1, col) === currentHasContent) {
              targetRow++
            }
          } else {
            // Next cell has different state: jump to end of next state range
            targetRow++ // Move to next cell first
            while (targetRow < totalRows - 1 && hasContent(targetRow + 1, col) === nextHasContent) {
              targetRow++
            }
          }
        }
        break

      case 'left':
        if (targetCol > 0) {
          const currentHasContent = hasContent(row, col)
          const nextHasContent = hasContent(row, col - 1)

          if (currentHasContent === nextHasContent) {
            // Next cell has same state: jump to end of current state range
            while (targetCol > 0 && hasContent(row, targetCol - 1) === currentHasContent) {
              targetCol--
            }
          } else {
            // Next cell has different state: jump to end of next state range
            targetCol-- // Move to next cell first
            while (targetCol > 0 && hasContent(row, targetCol - 1) === nextHasContent) {
              targetCol--
            }
          }
        }
        break

      case 'right':
        if (targetCol < totalCols - 1) {
          const currentHasContent = hasContent(row, col)
          const nextHasContent = hasContent(row, col + 1)

          if (currentHasContent === nextHasContent) {
            // Next cell has same state: jump to end of current state range
            while (targetCol < totalCols - 1 && hasContent(row, targetCol + 1) === currentHasContent) {
              targetCol++
            }
          } else {
            // Next cell has different state: jump to end of next state range
            targetCol++ // Move to next cell first
            while (targetCol < totalCols - 1 && hasContent(row, targetCol + 1) === nextHasContent) {
              targetCol++
            }
          }
        }
        break
    }

    return { row: targetRow, col: targetCol }
  }, [tableData, hasContent])

  // 次のセル位置を計算
  const getNextCellPosition = useCallback((
    currentPos: CellPosition,
    direction: 'up' | 'down' | 'left' | 'right',
    ctrlKey = false
  ): CellPosition => {
    const { row, col } = currentPos
    const maxRow = tableData.rows.length - 1
    const maxCol = tableData.headers.length - 1
    // 列ヘッダーOFF時は0行目（内部的にはrow=-1）まで移動可能
    const minRow = (headerConfig?.hasColumnHeaders === false) ? -1 : 0

    // Smart navigation with Ctrl key
    if (ctrlKey) {
      return getSmartNavigationPosition(currentPos, direction)
    }

    switch (direction) {
      case 'up':
        return { row: Math.max(minRow, row - 1), col }
      case 'down':
        return { row: Math.min(maxRow, row + 1), col }
      case 'left':
        return { row, col: Math.max(0, col - 1) }
      case 'right':
        return { row, col: Math.min(maxCol, col + 1) }
      default:
        return currentPos
    }
  }, [tableData, getSmartNavigationPosition, headerConfig])

  // Tab/Shift+Tabナビゲーション
  const getTabNextPosition = useCallback((
    currentPos: CellPosition,
    shiftKey = false
  ): CellPosition => {
    const { row, col } = currentPos
    const maxRow = tableData.rows.length - 1
    const maxCol = tableData.headers.length - 1
    // 列ヘッダーOFF時は0行目（内部的にはrow=-1）が最上行
    const minRow = (headerConfig?.hasColumnHeaders === false) ? -1 : 0

    if (shiftKey) {
      // Shift+Tab: 前のセルへ
      if (col > 0) {
        return { row, col: col - 1 }
      } else if (row > minRow) {
        return { row: row - 1, col: maxCol }
      } else {
        return { row: maxRow, col: maxCol }
      }
    } else {
      // Tab: 次のセルへ
      if (col < maxCol) {
        return { row, col: col + 1 }
      } else if (row < maxRow) {
        return { row: row + 1, col: 0 }
      } else {
        return { row: minRow, col: 0 }
      }
    }
  }, [tableData, headerConfig])

  // キーボードイベントハンドラー
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Shiftキーが押された瞬間にselectionAnchorを設定（メインハンドラー内で管理）
    if (event.key === 'Shift' && !selectionAnchor && selectionRange?.start) {
      const anchorPos = selectionRange.end || selectionRange.start
      onSetSelectionAnchor(anchorPos)
      return // Shiftキー単体の場合は他の処理をしない
    }
    // If focus is inside any input/textarea/contenteditable (e.g., header editor),
    // don't trigger table keyboard navigation.
    // Exception: input-capture element should allow keyboard navigation.
    const activeEl = (document.activeElement as HTMLElement | null)
    if (activeEl) {
      const tag = activeEl.tagName?.toLowerCase()
      const isInputCapture = activeEl.classList?.contains('input-capture')
      const isFormField = tag === 'input' || tag === 'textarea' || activeEl.isContentEditable
      const isHeaderEditing = activeEl.classList?.contains('header-input')
      const isCellEditing = activeEl.classList?.contains('cell-input')
      // Allow keyboard navigation for input-capture element
      if (!isInputCapture && (isFormField || isHeaderEditing || isCellEditing)) {
        return
      }
    }

    // 編集中は特定のキー以外を無効化
    if (currentEditingCell) {
      // Allow certain shortcuts even while editing
      if (event.ctrlKey || event.metaKey) {
        if (['c', 'v', 'x', 'a', 'z', 'y'].includes(event.key.toLowerCase())) {
          // Ctrl+C/V/X/A/Z/Y - allow browser default behavior
          return
        }
      }

      // Let cell editor handle Enter, Tab, Escape
      if (['Enter', 'Tab', 'Escape'].includes(event.key)) {
        return // Cell editor will handle these
      }

      // Block other keys during editing
      return
    }

    const { key, shiftKey, ctrlKey, metaKey } = event
    const cmdKey = ctrlKey || metaKey

    // 現在選択されているセルを取得
    // Shiftキーが押されていない（移動モード）場合は、アンカー（選択開始位置）を基準にする
    // Shiftキーが押されている（拡張モード）場合は、現在の範囲の端（endまたはstart）を基準にする
    const currentPos = (!shiftKey && selectionAnchor)
      ? selectionAnchor
      : (selectionRange?.end || selectionRange?.start)

    if (!currentPos) return

    // Undo/Redo（編集モード外ではVSCode側に委譲）
    if (cmdKey && (key.toLowerCase() === 'z' || key.toLowerCase() === 'y')) {
      event.preventDefault()
      // Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
      const isRedo = (key.toLowerCase() === 'y') || (key.toLowerCase() === 'z' && shiftKey)
      if (isRedo) {
        onRedo()
      } else {
        onUndo()
      }
      return
    }

    const scrollCellIntoView = (row: number, col: number) => {
      const cell = document.querySelector(`td[data-row="${row}"][data-col="${col}"]`) as HTMLElement | null
      if (!cell) return

      // scrollIntoView を使用して、セルをビューポート内に収める
      // block: 'nearest' で最小限のスクロールを行う
      // inline: 'nearest' で水平スクロールも最小限に
      cell.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' })
    }

    switch (key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        event.preventDefault()
        const direction = key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right'
        const nextPos = getNextCellPosition(currentPos, direction, cmdKey)
        onCellSelect(nextPos.row, nextPos.col, shiftKey)
        // ensure visibility
        setTimeout(() => scrollCellIntoView(nextPos.row, nextPos.col), 0)
        break
      }

      case 'Home': {
        event.preventDefault()
        // 列ヘッダーOFF時は0行目（内部的にはrow=-1）が最上行
        const topRow = (headerConfig?.hasColumnHeaders === false) ? -1 : 0
        if (cmdKey) {
          // Ctrl+Home: Top-left corner
          onCellSelect(topRow, 0, false)
          setTimeout(() => scrollCellIntoView(topRow, 0), 0)
        } else {
          // Home: Start of row
          onCellSelect(currentPos.row, 0, false)
          setTimeout(() => scrollCellIntoView(currentPos.row, 0), 0)
        }
        break
      }

      case 'End': {
        event.preventDefault()
        if (cmdKey) {
          // Ctrl+End: Bottom-right corner
          const nextRow = tableData.rows.length - 1
          const nextCol = tableData.headers.length - 1
          onCellSelect(nextRow, nextCol, false)
          setTimeout(() => scrollCellIntoView(nextRow, nextCol), 0)
        } else {
          // End: End of row
          const nextCol = tableData.headers.length - 1
          onCellSelect(currentPos.row, nextCol, false)
          setTimeout(() => scrollCellIntoView(currentPos.row, nextCol), 0)
        }
        break
      }

      case 'PageUp': {
        event.preventDefault()
        // 列ヘッダーOFF時は0行目（内部的にはrow=-1）が最上行
        const minRow = (headerConfig?.hasColumnHeaders === false) ? -1 : 0
        const nextRow = Math.max(minRow, currentPos.row - 10)
        onCellSelect(nextRow, currentPos.col, false)
        setTimeout(() => scrollCellIntoView(nextRow, currentPos.col), 0)
        break
      }

      case 'PageDown': {
        event.preventDefault()
        const nextRow = Math.min(tableData.rows.length - 1, currentPos.row + 10)
        onCellSelect(nextRow, currentPos.col, false)
        setTimeout(() => scrollCellIntoView(nextRow, currentPos.col), 0)
        break
      }

      case 'Tab': {
        event.preventDefault()
        const nextPos = getTabNextPosition(currentPos, shiftKey)
        onCellSelect(nextPos.row, nextPos.col, false)
        setTimeout(() => scrollCellIntoView(nextPos.row, nextPos.col), 0)
        break
      }

      case 'Enter': {
        event.preventDefault()
        // 列ヘッダーOFF時は0行目（内部的にはrow=-1）が最上行
        const minRow = (headerConfig?.hasColumnHeaders === false) ? -1 : 0
        if (shiftKey) {
          // Shift+Enter: 上のセルへ移動
          const nextPos = getNextCellPosition(currentPos, 'up')
          onCellSelect(nextPos.row, nextPos.col, false)
          setTimeout(() => scrollCellIntoView(nextPos.row, nextPos.col), 0)
        } else {
          // Check if multiple cells are selected
          const isMultipleSelection = selectionRange && (
            selectionRange.start.row !== selectionRange.end.row ||
            selectionRange.start.col !== selectionRange.end.col
          )

          if (isMultipleSelection && selectionRange) {
            // Multiple selection: cycle anchor cell within selection range
            const minSelRow = Math.min(selectionRange.start.row, selectionRange.end.row)
            const maxSelRow = Math.max(selectionRange.start.row, selectionRange.end.row)
            const minSelCol = Math.min(selectionRange.start.col, selectionRange.end.col)
            const maxSelCol = Math.max(selectionRange.start.col, selectionRange.end.col)

            let nextRow = currentPos.row + 1
            let nextCol = currentPos.col

            // If we're at the bottom of the selection range, wrap around
            if (nextRow > maxSelRow) {
              nextRow = minSelRow
              nextCol = currentPos.col + 1
              // If we're at the rightmost column, wrap to first column
              if (nextCol > maxSelCol) {
                nextCol = minSelCol
              }
            }

            // Clear selection anchor to prevent it from interfering with extend mode
            onSetSelectionAnchor(null)

            // Move anchor within selection range, maintaining the selection
            // Use extend=true to keep the selection range intact
            onCellSelect(nextRow, nextCol, true)
            setTimeout(() => scrollCellIntoView(nextRow, nextCol), 0)
          } else {
            // Single selection: Enter editing mode
            if (currentPos.row >= minRow) {
              onCellEdit(currentPos)
              setTimeout(() => scrollCellIntoView(currentPos.row, currentPos.col), 0)
            }
          }
        }
        break
      }

      case 'F2': {
        event.preventDefault()
        // 列ヘッダーOFF時は0行目（内部的にはrow=-1）が最上行
        const minRow = (headerConfig?.hasColumnHeaders === false) ? -1 : 0
        if (currentPos.row >= minRow) {
          onCellEdit(currentPos)
        }
        break
      }

      case 'Delete':
      case 'Backspace': {
        event.preventDefault()
        onClearCells()
        break
      }

      case 'Escape': {
        event.preventDefault()
        // 選択をクリア - handled by parent component
        break
      }

      case 'c':
      case 'C': {
        if (cmdKey) {
          event.preventDefault()
          onCopy()
        }
        break
      }

      case 'v':
      case 'V': {
        if (cmdKey) {
          event.preventDefault()
          onPaste()
        }
        break
      }

      case 'x':
      case 'X': {
        if (cmdKey) {
          event.preventDefault()
          onCut()
        }
        break
      }

      case 'a':
      case 'A': {
        if (cmdKey) {
          event.preventDefault()
          onSelectAll()
        }
        break
      }

      case 'f':
      case 'F': {
        if (cmdKey && onOpenSearch) {
          event.preventDefault()
          onOpenSearch(false) // 簡易検索モード
        }
        break
      }

      case 'h':
      case 'H': {
        if (cmdKey && onOpenSearch) {
          event.preventDefault()
          onOpenSearch(true) // 置換モード
        }
        break
      }

      default:
        // 文字キーが押された場合は何もしない
        // inputCaptureが処理する
        // 列ヘッダーOFF時は0行目（内部的にはrow=-1）が最上行
        break
    }
  }, [
    currentEditingCell,
    selectionRange,
    selectionAnchor,
    tableData,
    getNextCellPosition,
    getTabNextPosition,
    onCellSelect,
    onCellEdit,
    onCopy,
    onPaste,
    onCut,
    onClearCells,
    onSelectAll,
    onSetSelectionAnchor,
    onUndo,
    onRedo,
    headerConfig,
    onOpenSearch
  ])

  // キーボードイベントリスナーの設定
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // 旧Shiftキーイベントリスナーの設定は削除
  // useEffect(() => {
  //   document.addEventListener('keydown', handleShiftKeyDown)
  //   document.addEventListener('keyup', handleShiftKeyUp)
  //   return () => {
  //     document.removeEventListener('keydown', handleShiftKeyDown)
  //     document.removeEventListener('keyup', handleShiftKeyUp)
  //   }
  // }, [handleShiftKeyDown, handleShiftKeyUp])

  return {
    getNextCellPosition,
    getTabNextPosition
  }
}