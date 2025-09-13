import { useCallback } from 'react'
import { TableData, CellPosition, SelectionRange } from '../types'

export function useClipboard() {
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

  // クリップボードにコピー
  const copyToClipboard = useCallback(async (
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
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }, [getSelectedCellsData, convertToTSV])

  // クリップボードからペースト
  const pasteFromClipboard = useCallback(async (
    currentCell: CellPosition | null
  ): Promise<string[][] | null> => {
    try {
      if (!currentCell) return null

      const clipboardText = await navigator.clipboard.readText()
      if (!clipboardText) return null

      return parseTSV(clipboardText)
    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      return null
    }
  }, [parseTSV])

  return {
    copyToClipboard,
    pasteFromClipboard,
    getSelectedCellsData,
    convertToTSV,
    parseTSV
  }
}