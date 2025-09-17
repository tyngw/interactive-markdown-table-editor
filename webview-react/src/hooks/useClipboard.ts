import { useCallback } from 'react'
import { TableData, CellPosition, SelectionRange } from '../types'

// フックが受け取る依存関数の型を定義
interface ClipboardDependencies {
  addRow: (index?: number) => void | Promise<void>
  addColumn: (index?: number) => void | Promise<void>
  updateCells: (updates: Array<{ row: number; col: number; value: string }>) => void
  selectCell?: (row: number, col: number, extend?: boolean, toggle?: boolean) => void
}

const defaultDeps: ClipboardDependencies = {
  addRow: () => {},
  addColumn: () => {},
  updateCells: () => {}
}

export function useClipboard(deps: ClipboardDependencies = defaultDeps) {
  const { addRow, addColumn, updateCells, selectCell } = deps
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
    // 改行コードを一律に LF に正規化（\r\n, \r → \n）
    const normalized = tsvData.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    
    let i = 0
    while (i < normalized.length) {
      const row: string[] = []
      let rowEnded = false
      
      while (i < normalized.length && !rowEnded) {
        let currentCell = ''
        let inQuotes = false
        
        // セルの開始がクォートかチェック
        if (i < normalized.length && normalized[i] === '"') {
          inQuotes = true
          i++ // 開始クォートをスキップ
        }
        
        while (i < normalized.length) {
          const char = normalized[i]
          
          if (inQuotes) {
            if (char === '"') {
              // クォート内でクォートに遭遇
              if (i + 1 < normalized.length && normalized[i + 1] === '"') {
                // エスケープされたクォート（""）
                currentCell += '"'
                i += 2
              } else {
                // クォート終了
                inQuotes = false
                i++
              }
            } else {
              currentCell += char
              i++
            }
          } else {
            // クォート外
            if (char === '\t') {
              // セル区切り
              row.push(currentCell.replace(/\n/g, '<br/>'))
              i++
              break // 次のセルへ
            } else if (char === '\n') {
              // 行区切り
              row.push(currentCell.replace(/\n/g, '<br/>'))
              i++
              rowEnded = true
              break // 行終了
            } else {
              currentCell += char
              i++
            }
          }
        }
        
        // ファイル終端の場合
        if (i >= normalized.length) {
          row.push(currentCell.replace(/\n/g, '<br/>'))
          rowEnded = true
        }
      }
      
      // 空行でない場合のみ追加
      if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
        result.push(row)
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
          
          // 貼り付けた範囲を選択状態にする
          if (selectCell && sortedCells.length > 0) {
            const firstCell = sortedCells[0]
            const lastCell = sortedCells[Math.min(sortedCells.length, updates.length) - 1]
            
            // 単一セルの場合は単純選択、複数セルの場合は範囲選択
            if (updates.length === 1) {
              selectCell(firstCell.row, firstCell.col)
            } else {
              // 最初のセルを選択してから、最後のセルまで拡張選択
              selectCell(firstCell.row, firstCell.col)
              selectCell(lastCell.row, lastCell.col, true) // extend=true
            }
          }
          
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

      console.log('🔍 Paste analysis:', {
        startPos,
        pasteRows,
        pasteCols,
        targetEndRow,
        targetEndCol,
        currentRows: tableData.rows.length,
        currentCols: tableData.headers.length
      })

      // セル更新データを準備（Extension側で自動拡張されるため、座標チェックは最小限に）
      const updates: Array<{ row: number; col: number; value: string }> = []
      
      pastedData.forEach((row, rowOffset) => {
        row.forEach((cellValue, colOffset) => {
          const targetRow = startPos.row + rowOffset
          const targetCol = startPos.col + colOffset
          
          // 基本的な座標検証のみ（負の値チェック）
          if (targetRow >= 0 && targetCol >= 0) {
            updates.push({ row: targetRow, col: targetCol, value: cellValue })
          } else {
            console.warn('🔍 Invalid target position (negative):', { targetRow, targetCol })
          }
        })
      })

      console.log('🔍 Updates to apply:', updates)
      
      if (updates.length > 0) {
        updateCells(updates)
        
        // 貼り付けた矩形範囲を選択状態にする
        if (selectCell && pasteRows > 0 && pasteCols > 0) {
          const endRow = startPos.row + pasteRows - 1
          const endCol = startPos.col + pasteCols - 1
          
          // 単一セルの場合は単純選択、複数セルの場合は範囲選択
          if (pasteRows === 1 && pasteCols === 1) {
            selectCell(startPos.row, startPos.col)
          } else {
            // 最初のセルを選択してから、最後のセルまで拡張選択
            selectCell(startPos.row, startPos.col)
            selectCell(endRow, endCol, true) // extend=true
          }
        }
      }

      const message = 'クリップボードからペーストしました（テーブルは自動拡張されます）'

      return { success: true, message, updates }
    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      return { success: false, message: 'ペースト処理中にエラーが発生しました' }
    }
  }) as any, [addRow, addColumn, updateCells, parseTSV, selectCell])

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