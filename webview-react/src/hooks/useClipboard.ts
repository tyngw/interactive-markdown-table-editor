import { useCallback } from 'react'
import { TableData, CellPosition, SelectionRange } from '../types'

// フックが受け取る依存関数の型を定義
interface ClipboardDependencies {
  addRow: (index?: number) => void
  addColumn: (index?: number) => void
  updateCells: (updates: Array<{ row: number; col: number; value: string }>) => void
}

export function useClipboard({ addRow, addColumn, updateCells }: ClipboardDependencies) {
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
    return data.map(row => row.join('\t')).join('\n')
  }, [])

  // TSVデータを解析
  const parseTSV = useCallback((tsvData: string): string[][] => {
    return tsvData.split('\n').map(row => row.split('\t'))
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
  const exportTSV = useCallback((
    tableData: TableData,
    includeHeaders: boolean = true
  ): string => {
    const data = includeHeaders 
      ? [tableData.headers, ...tableData.rows] 
      : tableData.rows
    return convertToTSV(data)
  }, [convertToTSV])

  // CSV形式でエクスポート
  const exportCSV = useCallback((
    tableData: TableData,
    includeHeaders: boolean = true
  ): string => {
    const data = includeHeaders 
      ? [tableData.headers, ...tableData.rows] 
      : tableData.rows
    
    return data.map(row => 
      row.map(cell => {
        // CSV形式では、カンマやダブルクォートを含む値をダブルクォートで囲む
        const escaped = cell.replace(/"/g, '""')
        return cell.includes(',') || cell.includes('"') || cell.includes('\n') 
          ? `"${escaped}"` 
          : escaped
      }).join(',')
    ).join('\n')
  }, [])

  // クリップボードからペースト（テーブル拡張機能付き）
  const pasteFromClipboard = useCallback(async (
    tableData: TableData,
    selectionRange: SelectionRange | null,
    selectedCells: Set<string>,
    currentEditingCell: CellPosition | null
  ): Promise<{ success: boolean; message: string; updates?: Array<{ row: number; col: number; value: string }> }> => {
    try {
      console.log('🔍 pasteFromClipboard called with selection:', { selectionRange, selectedCells: selectedCells.size, currentEditingCell })
      
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
      if (selectedCells.size > 1 && !selectionRange) {
        // 複数セル選択時: 選択されたセルに順番にペースト
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
      
      // テーブル拡張実行
      if (neededCols > 0) {
        for (let i = 0; i < neededCols; i++) {
          addColumn()
        }
      }
      if (neededRows > 0) {
        for (let i = 0; i < neededRows; i++) {
          addRow()
        }
      }

      // セル更新データを生成
      const updates: Array<{ row: number; col: number; value: string }> = []
      pastedData.forEach((row, rowOffset) => {
        row.forEach((cellValue, colOffset) => {
          updates.push({
            row: startPos.row + rowOffset,
            col: startPos.col + colOffset,
            value: cellValue
          })
        })
      })

      // セル更新実行（テーブル拡張後にsetTimeoutで実行）
      if (updates.length > 0) {
        setTimeout(() => updateCells(updates), 0)
      }

      // 成功メッセージの生成
      let message = 'クリップボードからペーストしました'
      if (neededRows > 0 || neededCols > 0) {
        const expansions = []
        if (neededRows > 0) expansions.push(`${neededRows}行`)
        if (neededCols > 0) expansions.push(`${neededCols}列`)
        message += `（${expansions.join('、')}を自動追加）`
      }

      return { success: true, message, updates }

    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      
      // フォールバック: execCommandを試す（古いブラウザ対応）
      try {
        const textarea = document.createElement('textarea')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        
        const success = document.execCommand('paste')
        const text = textarea.value
        document.body.removeChild(textarea)
        
        if (success && text) {
          const fallbackData = parseTSV(text)
          // 簡単なフォールバック処理（拡張なし）
          const updates: Array<{ row: number; col: number; value: string }> = []
          const startPos = selectionRange?.start || currentEditingCell || { row: 0, col: 0 }
          
          fallbackData.forEach((row, rowOffset) => {
            row.forEach((cellValue, colOffset) => {
              const targetRow = startPos.row + rowOffset
              const targetCol = startPos.col + colOffset
              if (targetRow < tableData.rows.length && targetCol < tableData.headers.length) {
                updates.push({ row: targetRow, col: targetCol, value: cellValue })
              }
            })
          })
          
          if (updates.length > 0) {
            updateCells(updates)
            return { success: true, message: 'ペーストしました（フォールバック）', updates }
          }
        }
      } catch (fallbackError) {
        console.error('Fallback paste also failed:', fallbackError)
      }
      
      return { success: false, message: 'ペースト処理中にエラーが発生しました' }
    }
  }, [addRow, addColumn, updateCells, parseTSV])

  return {
    copySelectedCells,
    copyEntireTable,
    pasteFromClipboard,
    exportTSV,
    exportCSV
  }
}