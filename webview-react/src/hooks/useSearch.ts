import { useState, useCallback, useMemo } from 'react'
import { TableData, SearchState, SearchResult, SearchScope, SearchOptions, SelectionRange } from '../types'

interface UseSearchProps {
  tables: TableData[]
  currentTableIndex: number
  selectionRange: SelectionRange | null
  onNavigateToResult?: (result: SearchResult) => void
  onUpdateCell?: (tableIndex: number, row: number, col: number, value: string) => void
  onBulkUpdate?: (tableIndex: number, updates: Array<{ row: number; col: number; value: string }>) => void
}

export function useSearch({
  tables,
  currentTableIndex,
  selectionRange,
  onNavigateToResult,
  onUpdateCell,
  onBulkUpdate
}: UseSearchProps) {
  const [searchState, setSearchState] = useState<SearchState>({
    isOpen: false,
    showReplace: false,
    showAdvanced: false,
    searchText: '',
    replaceText: '',
    scope: 'all',
    options: {
      caseSensitive: false,
      wholeWord: false,
      regex: false
    },
    results: [],
    currentResultIndex: -1
  })

  // 検索パターンを作成
  const createSearchPattern = useCallback((searchText: string, options: SearchOptions): RegExp | null => {
    if (!searchText) return null

    try {
      if (options.regex) {
        // 正規表現モード
        const flags = options.caseSensitive ? 'g' : 'gi'
        return new RegExp(searchText, flags)
      } else {
        // 通常の文字列検索
        let pattern = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // エスケープ
        if (options.wholeWord) {
          pattern = `\\b${pattern}\\b`
        }
        const flags = options.caseSensitive ? 'g' : 'gi'
        return new RegExp(pattern, flags)
      }
    } catch (e) {
      // 正規表現のパースエラー
      console.error('Invalid search pattern:', e)
      return null
    }
  }, [])

  // 検索を実行
  const performSearch = useCallback(() => {
    const { searchText, scope, options } = searchState
    if (!searchText) {
      setSearchState(prev => ({ ...prev, results: [], currentResultIndex: -1 }))
      return
    }

    const pattern = createSearchPattern(searchText, options)
    if (!pattern) {
      setSearchState(prev => ({ ...prev, results: [], currentResultIndex: -1 }))
      return
    }

    const results: SearchResult[] = []

    // 検索範囲を決定
    const searchTables = scope === 'all'
      ? tables.map((_, idx) => idx)
      : [currentTableIndex]

    searchTables.forEach(tableIndex => {
      const table = tables[tableIndex]
      if (!table) return

      // 選択中のセルのみ検索する場合
      if (scope === 'selection' && selectionRange && tableIndex === currentTableIndex) {
        const { start, end } = selectionRange
        const minRow = Math.min(start.row, end.row)
        const maxRow = Math.max(start.row, end.row)
        const minCol = Math.min(start.col, end.col)
        const maxCol = Math.max(start.col, end.col)

        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            const cellValue = table.rows[row]?.[col] || ''
            if (pattern.test(cellValue)) {
              results.push({ tableIndex, row, col })
            }
          }
        }
      } else {
        // テーブル全体を検索
        table.rows.forEach((rowData, row) => {
          rowData.forEach((cellValue, col) => {
            if (pattern.test(cellValue)) {
              results.push({ tableIndex, row, col })
            }
          })
        })
      }
    })

    setSearchState(prev => ({
      ...prev,
      results,
      currentResultIndex: results.length > 0 ? 0 : -1
    }))

    // 最初の結果に移動
    if (results.length > 0 && onNavigateToResult) {
      onNavigateToResult(results[0])
    }
  }, [searchState.searchText, searchState.scope, searchState.options, tables, currentTableIndex, selectionRange, createSearchPattern, onNavigateToResult])

  // 次の検索結果に移動
  const findNext = useCallback(() => {
    const { results, currentResultIndex } = searchState
    if (results.length === 0) return

    const nextIndex = (currentResultIndex + 1) % results.length
    setSearchState(prev => ({ ...prev, currentResultIndex: nextIndex }))

    if (onNavigateToResult) {
      onNavigateToResult(results[nextIndex])
    }
  }, [searchState.results, searchState.currentResultIndex, onNavigateToResult])

  // 前の検索結果に移動
  const findPrevious = useCallback(() => {
    const { results, currentResultIndex } = searchState
    if (results.length === 0) return

    const prevIndex = currentResultIndex <= 0 ? results.length - 1 : currentResultIndex - 1
    setSearchState(prev => ({ ...prev, currentResultIndex: prevIndex }))

    if (onNavigateToResult) {
      onNavigateToResult(results[prevIndex])
    }
  }, [searchState.results, searchState.currentResultIndex, onNavigateToResult])

  // 1件置換
  const replaceOne = useCallback(() => {
    const { results, currentResultIndex, replaceText, searchText, options } = searchState
    if (results.length === 0 || currentResultIndex < 0) return

    const result = results[currentResultIndex]
    if (onUpdateCell) {
      const table = tables[result.tableIndex]
      const oldValue = table.rows[result.row][result.col]
      const pattern = createSearchPattern(searchText, options)

      if (pattern) {
        const newValue = oldValue.replace(pattern, replaceText)
        onUpdateCell(result.tableIndex, result.row, result.col, newValue)
      }
    }

    // 置換後、次の結果に移動
    findNext()
  }, [searchState.results, searchState.currentResultIndex, searchState.replaceText, searchState.searchText, searchState.options, tables, onUpdateCell, createSearchPattern, findNext])

  // すべて置換
  const replaceAll = useCallback(() => {
    const { results, replaceText, searchText, options } = searchState
    if (results.length === 0) return

    const pattern = createSearchPattern(searchText, options)
    if (!pattern) return

    // テーブルごとにグループ化
    const updatesByTable = new Map<number, Array<{ row: number; col: number; value: string }>>()

    results.forEach(result => {
      const table = tables[result.tableIndex]
      const oldValue = table.rows[result.row][result.col]
      const newValue = oldValue.replace(pattern, replaceText)

      if (!updatesByTable.has(result.tableIndex)) {
        updatesByTable.set(result.tableIndex, [])
      }

      updatesByTable.get(result.tableIndex)!.push({
        row: result.row,
        col: result.col,
        value: newValue
      })
    })

    // 一括更新を実行
    if (onBulkUpdate) {
      updatesByTable.forEach((updates, tableIndex) => {
        onBulkUpdate(tableIndex, updates)
      })
    }

    // 検索結果をクリア
    setSearchState(prev => ({ ...prev, results: [], currentResultIndex: -1 }))
  }, [searchState.results, searchState.replaceText, searchState.searchText, searchState.options, tables, createSearchPattern, onBulkUpdate])

  // 検索バーを開く
  const openSearch = useCallback((withReplace = false) => {
    setSearchState(prev => ({
      ...prev,
      isOpen: true,
      showReplace: withReplace
    }))
  }, [])

  // 検索バーを閉じる
  const closeSearch = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      isOpen: false,
      results: [],
      currentResultIndex: -1
    }))
  }, [])

  // 検索テキストを更新
  const setSearchText = useCallback((text: string) => {
    setSearchState(prev => ({ ...prev, searchText: text }))
  }, [])

  // 置換テキストを更新
  const setReplaceText = useCallback((text: string) => {
    setSearchState(prev => ({ ...prev, replaceText: text }))
  }, [])

  // 検索範囲を更新
  const setScope = useCallback((scope: SearchScope) => {
    setSearchState(prev => ({ ...prev, scope }))
  }, [])

  // 検索オプションを更新
  const toggleOption = useCallback((option: keyof SearchOptions) => {
    setSearchState(prev => ({
      ...prev,
      options: {
        ...prev.options,
        [option]: !prev.options[option]
      }
    }))
  }, [])

  // 詳細設定の表示切り替え
  const toggleAdvanced = useCallback(() => {
    setSearchState(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))
  }, [])

  // 置換UIの表示切り替え
  const toggleReplace = useCallback(() => {
    setSearchState(prev => ({ ...prev, showReplace: !prev.showReplace }))
  }, [])

  // 現在の検索結果情報
  const currentResultInfo = useMemo(() => {
    const { results, currentResultIndex } = searchState
    if (results.length === 0) {
      return { total: 0, current: 0 }
    }
    return {
      total: results.length,
      current: currentResultIndex + 1
    }
  }, [searchState])

  return {
    searchState,
    performSearch,
    findNext,
    findPrevious,
    replaceOne,
    replaceAll,
    openSearch,
    closeSearch,
    setSearchText,
    setReplaceText,
    setScope,
    toggleOption,
    toggleAdvanced,
    toggleReplace,
    currentResultInfo
  }
}
