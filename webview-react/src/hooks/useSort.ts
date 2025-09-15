import { useState, useCallback } from 'react'
import { SortState } from '../types'

export function useSort() {
  const [sortState, setSortState] = useState<SortState>({
    column: -1,
    direction: 'none'
  })

  console.log('🔍 [useSort] Hook initialized, sortState:', sortState)

  const sortColumn = useCallback((col: number) => {
    console.log('🔍 [useSort] sortColumn called with:', col)
    setSortState(prev => {
      console.log('🔍 [useSort] Previous sortState:', prev)
      let newState: SortState
      if (prev.column === col) {
        // 同じ列の場合: asc → desc → none の順で循環
        switch (prev.direction) {
          case 'asc':
            newState = { column: col, direction: 'desc' }
            break
          case 'desc':
            newState = { column: -1, direction: 'none' }
            break
          default:
            newState = { column: col, direction: 'asc' }
            break
        }
      } else {
        // 別の列の場合: 常にascから開始
        newState = { column: col, direction: 'asc' }
      }
      console.log('🔍 [useSort] New sortState:', newState)
      return newState
    })
  }, [])

  const resetSortState = useCallback(() => {
    console.log('🔍 [useSort] resetSortState called')
    setSortState({
      column: -1,
      direction: 'none'
    })
  }, [])

  const returnValue = {
    sortState,
    sortColumn,
    resetSortState
  }
  
  console.log('🔍 [useSort] Hook returning:', returnValue)
  return returnValue
}