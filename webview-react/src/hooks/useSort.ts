import { useState, useCallback } from 'react'
import { TableData, SortState } from '../types'

export interface UseSortOptions {
  onDataUpdate: (data: TableData) => void
}

export function useSort({ onDataUpdate }: UseSortOptions) {
  const [sortState, setSortState] = useState<SortState>({
    column: -1,
    direction: 'none',
    isViewOnly: false,
    originalData: null
  })

  // テーブルデータをソートするユーティリティ関数
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

  // View-onlyソートを適用（ファイルは変更しない）- 3段階トグル: asc → desc → none
  const sortColumn = useCallback((col: number, currentTableData: TableData) => {
    console.log('🔧 [useSort] sortColumn called with col:', col)
    console.log('🔧 [useSort] Current tableData before sort:', currentTableData)
    
    return new Promise<void>((resolve) => {
      setSortState(prev => {
        console.log('🔧 [useSort] setSortState callback, prev state:', prev)
        let direction: 'asc' | 'desc' | 'none' = 'asc'
        
        // 現在の状態に基づいて新しい方向を決定
        if (prev.column === col) {
          // 同じ列がクリックされた - ステートをサイクル
          if (prev.direction === 'asc') {
            direction = 'desc'
          } else if (prev.direction === 'desc') {
            direction = 'none'
          } else {
            direction = 'asc'
          }
        } else {
          // 異なる列がクリックされた - ascから開始
          direction = 'asc'
        }

        console.log('🔧 [useSort] Determined direction:', direction)

        // 初回ソート時にオリジナルデータを保存
        const originalData = prev.originalData || currentTableData
        
        if (direction === 'none') {
          // オリジナルデータを復元
          console.log('🔧 [useSort] Restoring original data:', originalData)
          onDataUpdate(originalData)
          const newState = {
            column: -1,
            direction: 'none' as const,
            isViewOnly: false,
            originalData: null
          }
          console.log('🔧 [useSort] Returning new state (restore):', newState)
          resolve()
          return newState
        } else {
          // 表示データにソートを適用
          console.log('🔧 [useSort] Sorting data with direction:', direction)
          const sortedData = sortTableData(originalData, col, direction)
          console.log('🔧 [useSort] Sorted data:', sortedData)
          onDataUpdate(sortedData)
          const newState = {
            column: col,
            direction: direction,
            isViewOnly: true,
            originalData: originalData
          }
          console.log('🔧 [useSort] Returning new state (sort):', newState)
          resolve()
          return newState
        }
      })
    })
  }, [sortTableData, onDataUpdate])

  // オリジナルビューを復元（ソート前の状態に戻す）
  const restoreOriginalView = useCallback(() => {
    setSortState(prev => {
      if (prev.originalData) {
        onDataUpdate(prev.originalData)
        return {
          column: -1,
          direction: 'none',
          isViewOnly: false,
          originalData: null
        }
      }
      return prev
    })
  }, [onDataUpdate])

  // 現在のソートをファイルにコミット
  const commitSortToFile = useCallback(() => {
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

  // ソート状態をリセット（新しいテーブルデータが来た時）
  const resetSortState = useCallback(() => {
    setSortState({
      column: -1,
      direction: 'none',
      isViewOnly: false,
      originalData: null
    })
  }, [])

  return {
    sortState,
    sortColumn,
    restoreOriginalView,
    commitSortToFile,
    resetSortState
  }
}
