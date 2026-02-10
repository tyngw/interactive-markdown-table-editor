import { useState, useCallback, useRef } from 'react'
import { SortState } from '../types'

/**
 * useSort
 * Ensure each logical consumer gets its own isolated state.
 * instanceKey is only for debugging/diagnostics.
 */
export function useSort(instanceKey?: string) {
  const [sortState, setSortState] = useState<SortState>({
    column: -1,
    direction: 'none'
  })

  const keyRef = useRef(instanceKey)
  console.log('[useSort] init', { key: keyRef.current, sortState })

  const sortColumn = useCallback((col: number) => {
    console.log('[useSort] sortColumn', { key: keyRef.current, col })
    setSortState(prev => {
      console.log('[useSort] prev', { key: keyRef.current, prev })
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
          // 通常のフローではnone時にcolumn=-1になるため到達しない防御的分岐
          /* istanbul ignore next */
          default:
            newState = { column: col, direction: 'asc' }
            break
        }
      } else {
        // 別の列の場合: 常にascから開始
        newState = { column: col, direction: 'asc' }
      }
      console.log('[useSort] next', { key: keyRef.current, newState })
      return newState
    })
  }, [])

  const resetSortState = useCallback(() => {
    console.log('[useSort] reset', { key: keyRef.current })
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
  
  console.log('[useSort] return', { key: keyRef.current, returnValue })
  return returnValue
}