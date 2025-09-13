import { useCallback, useEffect } from 'react'
import { CellPosition, SelectionRange, TableData } from '../types'

interface KeyboardNavigationProps {
  tableData: TableData
  currentEditingCell: CellPosition | null
  selectionRange: SelectionRange | null
  onCellSelect: (row: number, col: number, extend?: boolean) => void
  onCellEdit: (position: CellPosition | null) => void
  onCopy: () => void
  onPaste: () => void
  onCut: () => void
  onClearCells: () => void
  onSelectAll: () => void
}

export function useKeyboardNavigation({
  tableData,
  currentEditingCell,
  selectionRange,
  onCellSelect,
  onCellEdit,
  onCopy,
  onPaste,
  onCut,
  onClearCells,
  onSelectAll
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
        if (hasContent(row, col)) {
          // Move up until we find an empty cell or reach the top
          while (targetRow > 0 && hasContent(targetRow - 1, col)) {
            targetRow--
          }
        } else {
          // Move up until we find a cell with content or reach the top
          while (targetRow > 0 && !hasContent(targetRow - 1, col)) {
            targetRow--
          }
          if (targetRow > 0) {
            // Move to the last cell with content in this group
            while (targetRow > 0 && hasContent(targetRow - 1, col)) {
              targetRow--
            }
          }
        }
        break

      case 'down':
        if (hasContent(row, col)) {
          // Move down until we find an empty cell or reach the bottom
          while (targetRow < totalRows - 1 && hasContent(targetRow + 1, col)) {
            targetRow++
          }
        } else {
          // Move down until we find a cell with content or reach the bottom
          while (targetRow < totalRows - 1 && !hasContent(targetRow + 1, col)) {
            targetRow++
          }
          if (targetRow < totalRows - 1) {
            // Move to the last cell with content in this group
            while (targetRow < totalRows - 1 && hasContent(targetRow + 1, col)) {
              targetRow++
            }
          }
        }
        break

      case 'left':
        if (hasContent(row, col)) {
          // Move left until we find an empty cell or reach the leftmost
          while (targetCol > 0 && hasContent(row, targetCol - 1)) {
            targetCol--
          }
        } else {
          // Move left until we find a cell with content or reach the leftmost
          while (targetCol > 0 && !hasContent(row, targetCol - 1)) {
            targetCol--
          }
          if (targetCol > 0) {
            // Move to the last cell with content in this group
            while (targetCol > 0 && hasContent(row, targetCol - 1)) {
              targetCol--
            }
          }
        }
        break

      case 'right':
        if (hasContent(row, col)) {
          // Move right until we find an empty cell or reach the rightmost
          while (targetCol < totalCols - 1 && hasContent(row, targetCol + 1)) {
            targetCol++
          }
        } else {
          // Move right until we find a cell with content or reach the rightmost
          while (targetCol < totalCols - 1 && !hasContent(row, targetCol + 1)) {
            targetCol++
          }
          if (targetCol < totalCols - 1) {
            // Move to the last cell with content in this group
            while (targetCol < totalCols - 1 && hasContent(row, targetCol + 1)) {
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

    // Smart navigation with Ctrl key
    if (ctrlKey) {
      return getSmartNavigationPosition(currentPos, direction)
    }

    switch (direction) {
      case 'up':
        return { row: Math.max(0, row - 1), col }
      case 'down':
        return { row: Math.min(maxRow, row + 1), col }
      case 'left':
        return { row, col: Math.max(0, col - 1) }
      case 'right':
        return { row, col: Math.min(maxCol, col + 1) }
      default:
        return currentPos
    }
  }, [tableData, getSmartNavigationPosition])

  // Tab/Shift+Tabナビゲーション
  const getTabNextPosition = useCallback((
    currentPos: CellPosition,
    shiftKey = false
  ): CellPosition => {
    const { row, col } = currentPos
    const maxRow = tableData.rows.length - 1
    const maxCol = tableData.headers.length - 1

    if (shiftKey) {
      // Shift+Tab: 前のセルへ
      if (col > 0) {
        return { row, col: col - 1 }
      } else if (row > 0) {
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
        return { row: 0, col: 0 }
      }
    }
  }, [tableData])

  // キーボードイベントハンドラー
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // If focus is inside any input/textarea/contenteditable (e.g., header editor),
    // don't trigger table keyboard navigation.
    const activeEl = (document.activeElement as HTMLElement | null)
    if (activeEl) {
      const tag = activeEl.tagName?.toLowerCase()
      const isFormField = tag === 'input' || tag === 'textarea' || activeEl.isContentEditable
      const isHeaderEditing = activeEl.classList?.contains('header-input')
      const isCellEditing = activeEl.classList?.contains('cell-input')
      if (isFormField || isHeaderEditing || isCellEditing) {
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

    // 現在選択されているセルを取得
    const currentPos = selectionRange?.start
    if (!currentPos) return

    const { key, shiftKey, ctrlKey, metaKey } = event
    const cmdKey = ctrlKey || metaKey

    const scrollCellIntoView = (row: number, col: number) => {
      const container = document.querySelector('.table-container') as HTMLElement | null
      if (!container) return
      const cell = document.querySelector(`td[data-row="${row}"][data-col="${col}"]`) as HTMLElement | null
      if (!cell) return

      const cRect = container.getBoundingClientRect()
      const rRect = cell.getBoundingClientRect()

      let newTop = container.scrollTop
      let newLeft = container.scrollLeft

      if (rRect.top < cRect.top) {
        newTop += rRect.top - cRect.top - 8
      } else if (rRect.bottom > cRect.bottom) {
        newTop += rRect.bottom - cRect.bottom + 8
      }

      if (rRect.left < cRect.left) {
        newLeft += rRect.left - cRect.left - 8
      } else if (rRect.right > cRect.right) {
        newLeft += rRect.right - cRect.right + 8
      }

      container.scrollTo({ top: Math.max(0, newTop), left: Math.max(0, newLeft), behavior: 'auto' })
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
        if (cmdKey) {
          // Ctrl+Home: Top-left corner
          onCellSelect(0, 0, false)
        } else {
          // Home: Start of row
          onCellSelect(currentPos.row, 0, false)
        }
        break
      }

      case 'End': {
        event.preventDefault()
        if (cmdKey) {
          // Ctrl+End: Bottom-right corner
          onCellSelect(tableData.rows.length - 1, tableData.headers.length - 1, false)
        } else {
          // End: End of row
          onCellSelect(currentPos.row, tableData.headers.length - 1, false)
        }
        break
      }

      case 'PageUp': {
        event.preventDefault()
        const nextRow = Math.max(0, currentPos.row - 10)
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
        if (shiftKey) {
          // Shift+Enter: 上のセルへ移動
          const nextPos = getNextCellPosition(currentPos, 'up')
          onCellSelect(nextPos.row, nextPos.col, false)
          setTimeout(() => scrollCellIntoView(nextPos.row, nextPos.col), 0)
        } else {
          // Enter: 編集開始
          if (currentPos.row >= 0) {
            onCellEdit(currentPos)
            setTimeout(() => scrollCellIntoView(currentPos.row, currentPos.col), 0)
          }
        }
        break
      }

      case 'F2': {
        event.preventDefault()
        if (currentPos.row >= 0) {
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

      default:
        // 文字キーが押された場合は編集開始
        if (key.length === 1 && !cmdKey && currentPos.row >= 0) {
          onCellEdit(currentPos)
        }
        break
    }
  }, [
    currentEditingCell,
    selectionRange,
    tableData,
    getNextCellPosition,
    getTabNextPosition,
    onCellSelect,
    onCellEdit,
    onCopy,
    onPaste,
    onCut,
    onClearCells,
    onSelectAll
  ])

  // キーボードイベントリスナーの設定
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    getNextCellPosition,
    getTabNextPosition
  }
}