import { useCallback } from 'react'
import { TableData, CellPosition, SelectionRange } from '../types'

// フックが受け取る依存関数の型を定義
interface ClipboardDependencies {
  addRow: (index?: number) => void
  addColumn: (index?: number) => void
  updateCells: (updates: Array<{ row: number; col: number; value: string }>) => void
}

const defaultDeps: ClipboardDependencies = {
  addRow: () => {},
  addColumn: () => {},
  updateCells: () => {}
}

export function useClipboard(deps: ClipboardDependencies = defaultDeps) {
  const { addRow, addColumn, updateCells } = deps
  // 選択されたセルのデータを取得
  const getSelectedCellsData = useCallback((
    tableData: TableData,
    selectedCells: Set<string>,
    selectionRange: SelectionRange | null
  ): string[][] => {
    if (!selectionRange || selectedCells.size === 0) {
      return []
    }

    const { start, end } = selectionRange
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    const result: string[][] = []
    
    for (let row = minRow; row <= maxRow; row++) {
      const rowData: string[] = []
      for (let col = minCol; col <= maxCol; col++) {
        const cellValue = row === -1 
          ? tableData.headers[col] || ''
          : tableData.rows[row]?.[col] || ''
        rowData.push(cellValue)
      }
      result.push(rowData)
    }

    return result
  }, [])

  // データをTSV形式に変換
  const convertToTSV = useCallback((data: string[][]): string => {
    return data.map(row => 
      row.map(cell => {
        // Convert <br> tags to newlines for clipboard export
        let cellText = cell.replace(/<br\s*\/?>/gi, '\n')
        
        // If cell contains tabs, newlines, or quotes, we need to quote it
        if (cellText.includes('\t') || cellText.includes('\n') || cellText.includes('"')) {
          // Escape quotes by doubling them and wrap in quotes
          cellText = '"' + cellText.replace(/"/g, '""') + '"'
        }
        
        return cellText
      }).join('\t')
    ).join('\n')
  }, [])

  // TSVデータを解析
  const parseTSV = useCallback((tsvData: string): string[][] => {
    const result: string[][] = []
    let currentRow: string[] = []
    let currentCell = ''
    let inQuotes = false
    let i = 0
    
    while (i < tsvData.length) {
      const char = tsvData[i]
      
      if (char === '"' && !inQuotes) {
        inQuotes = true
      } else if (char === '"' && inQuotes) {
        if (i + 1 < tsvData.length && tsvData[i + 1] === '"') {
          // Escaped quote
          currentCell += '"'
          i++ // Skip next quote
        } else {
          inQuotes = false
        }
      } else if (char === '\t' && !inQuotes) {
        // Convert newlines to <br> tags for storage
        currentCell = currentCell.replace(/\n/g, '<br/>')
        currentRow.push(currentCell)
        currentCell = ''
      } else if (char === '\n' && !inQuotes) {
        // End of row - convert newlines to <br> tags for storage
        currentCell = currentCell.replace(/\n/g, '<br/>')
        currentRow.push(currentCell)
        if (currentRow.length > 0) {
          result.push(currentRow)
        }
        currentRow = []
        currentCell = ''
      } else {
        currentCell += char
      }
      i++
    }
    
    // Add final cell and row if any content remains
    if (currentCell !== '' || currentRow.length > 0) {
      currentCell = currentCell.replace(/\n/g, '<br/>')
      currentRow.push(currentCell)
      if (currentRow.length > 0) {
        result.push(currentRow)
      }
    }
    
    return result
  }, [])

  // 選択されたセルをクリップボードにコピー
  const copySelectedCells = useCallback(async (
    tableData: TableData,
    selectedCells: Set<string>,
    selectionRange: SelectionRange | null
  ): Promise<boolean> => {
    try {
      const selectedData = getSelectedCellsData(tableData, selectedCells, selectionRange)
      if (selectedData.length === 0) {
        return false
      }

      const tsvData = convertToTSV(selectedData)
      await navigator.clipboard.writeText(tsvData)
      return true
    } catch (error) {
      console.error('Failed to copy selected cells to clipboard:', error)
      return false
    }
  }, [getSelectedCellsData, convertToTSV])

  // テーブル全体をクリップボードにコピー
  const copyEntireTable = useCallback(async (
    tableData: TableData,
    includeHeaders: boolean = true
  ): Promise<boolean> => {
    try {
      const data = includeHeaders 
        ? [tableData.headers, ...tableData.rows] 
        : tableData.rows
      
      const tsvData = convertToTSV(data)
      await navigator.clipboard.writeText(tsvData)
      return true
    } catch (error) {
      console.error('Failed to copy entire table to clipboard:', error)
      return false
    }
  }, [convertToTSV])

  // TSV形式でエクスポート
  // 旧: exportTSV/exportCSV は useCSVExport に一本化したため削除

  // クリップボードからペースト（テーブル拡張機能付き）
  const pasteFromClipboard = useCallback((async (...args: any[]) => {
    try {
      // レガシー互換: pasteFromClipboard(currentCell)
      if (args.length === 1 && args[0] && typeof args[0] === 'object' && 'row' in args[0] && 'col' in args[0]) {
        const clipboardText = await navigator.clipboard.readText()
        return parseTSV(clipboardText)
      }

      // 現行: pasteFromClipboard(tableData, selectionRange, selectedCells, currentEditingCell)
      const [tableData, selectionRange, selectedCells, currentEditingCell] = args as [
        TableData,
        SelectionRange | null,
        Set<string>,
        CellPosition | null
      ]

      console.log('🔍 pasteFromClipboard called with selection:', { selectionRange, selectedCells: selectedCells?.size ?? 0, currentEditingCell })

      const clipboardText = await navigator.clipboard.readText()
      if (!clipboardText || clipboardText.trim() === '') {
        return { success: false, message: 'クリップボードにデータがありません' }
      }

      const pastedData = parseTSV(clipboardText)
      if (pastedData.length === 0) {
        return { success: false, message: 'ペーストデータが無効です' }
      }

      // ペースト開始位置の決定
      let startPos: CellPosition
      if (selectionRange) {
        startPos = selectionRange.start
      } else if (currentEditingCell) {
        startPos = currentEditingCell
      } else {
        startPos = { row: 0, col: 0 }
      }

      // 複数セル選択時の特別な処理
      if (selectedCells && selectedCells.size > 1 && !selectionRange) {
        const sortedCells = Array.from(selectedCells).map(cellKey => {
          const [row, col] = cellKey.split('-').map(Number)
          return { row, col, key: cellKey }
        }).sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col)

        const flatData = pastedData.flat()
        const updates: Array<{ row: number; col: number; value: string }> = []

        for (let i = 0; i < Math.min(sortedCells.length, flatData.length); i++) {
          const cell = sortedCells[i]
          const value = flatData[i] || ''
          updates.push({ row: cell.row, col: cell.col, value })
        }

        if (updates.length > 0) {
          updateCells(updates)
          return {
            success: true,
            message: `選択されたセルにペーストしました（${updates.length}セル）`,
            updates
          }
        }
        return { success: false, message: 'ペーストするデータがありません' }
      }

      // 通常の矩形範囲ペースト処理
      const pasteRows = pastedData.length
      const pasteCols = pastedData[0]?.length || 0
      const targetEndRow = startPos.row + pasteRows - 1
      const targetEndCol = startPos.col + pasteCols - 1

      // テーブル拡張が必要かチェック
      const neededRows = Math.max(0, targetEndRow + 1 - tableData.rows.length)
      const neededCols = Math.max(0, targetEndCol + 1 - tableData.headers.length)

      if (neededCols > 0) {
        for (let i = 0; i < neededCols; i++) addColumn()
      }
      if (neededRows > 0) {
        for (let i = 0; i < neededRows; i++) addRow()
      }

      const updates: Array<{ row: number; col: number; value: string }> = []
      pastedData.forEach((row, rowOffset) => {
        row.forEach((cellValue, colOffset) => {
          updates.push({ row: startPos.row + rowOffset, col: startPos.col + colOffset, value: cellValue })
        })
      })

      if (updates.length > 0) setTimeout(() => updateCells(updates), 0)

      let message = 'クリップボードからペーストしました'
      if (neededRows > 0 || neededCols > 0) {
        const expansions = [] as string[]
        if (neededRows > 0) expansions.push(`${neededRows}行`)
        if (neededCols > 0) expansions.push(`${neededCols}列`)
        message += `（${expansions.join('、')}を自動追加）`
      }

      return { success: true, message, updates }
    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      return { success: false, message: 'ペースト処理中にエラーが発生しました' }
    }
  }) as any, [addRow, addColumn, updateCells, parseTSV])

  return {
    // 互換 API（テスト用に公開）
    convertToTSV,
    parseTSV,
    getSelectedCellsData,
    copyToClipboard: copySelectedCells,
    // 現行 API
    copySelectedCells,
    copyEntireTable,
    pasteFromClipboard
  }
}