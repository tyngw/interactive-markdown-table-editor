import React, { useCallback, useEffect, useRef } from 'react'
import { SearchState, SearchScope } from '../types'

interface SearchBarProps {
  searchState: SearchState
  currentResultInfo: { total: number; current: number }
  onSearchTextChange: (text: string) => void
  onReplaceTextChange: (text: string) => void
  onSearch: () => void
  onFindNext: () => void
  onFindPrevious: () => void
  onReplaceOne: () => void
  onReplaceAll: () => void
  onClose: () => void
  onToggleOption: (option: 'caseSensitive' | 'wholeWord' | 'regex') => void
  onToggleAdvanced: () => void
  onScopeChange: (scope: SearchScope) => void
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchState,
  currentResultInfo,
  onSearchTextChange,
  onReplaceTextChange,
  onSearch,
  onFindNext,
  onFindPrevious,
  onReplaceOne,
  onReplaceAll,
  onClose,
  onToggleOption,
  onToggleAdvanced,
  onScopeChange
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 検索バーが開いたときに検索入力にフォーカス
  useEffect(() => {
    if (searchState.isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
      searchInputRef.current.select()
    }
  }, [searchState.isOpen])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        // Shift+Enter: 前の検索結果に移動（検索結果がある場合）
        if (searchState.results.length > 0) {
          onFindPrevious()
        } else {
          onSearch()
        }
      } else {
        // Enter: 検索を実行
        onSearch()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onSearch, onFindPrevious, onClose, searchState.results.length])

  const handleReplaceKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onReplaceOne()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onReplaceOne, onClose])

  if (!searchState.isOpen) {
    return null
  }

  return (
    <div className="search-bar">
      <div className="search-row">
        <div className="search-input-container">
          <span className="search-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="検索..."
            value={searchState.searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {searchState.searchText && (
            <span className="search-result-count">
              {currentResultInfo.total > 0
                ? `${currentResultInfo.current}/${currentResultInfo.total}`
                : '一致なし'}
            </span>
          )}
        </div>
        <div className="search-actions">
          <button
            className="search-nav-button"
            title="前を検索 (Shift+Enter)"
            onClick={onFindPrevious}
            disabled={currentResultInfo.total === 0}
          >
            ⬆
          </button>
          <button
            className="search-nav-button"
            title="次を検索 (Enter)"
            onClick={onFindNext}
            disabled={currentResultInfo.total === 0}
          >
            ⬇
          </button>
          <button
            className={`search-option-button ${searchState.options.caseSensitive ? 'active' : ''}`}
            title="大文字小文字を区別"
            onClick={() => onToggleOption('caseSensitive')}
          >
            Aa
          </button>
          <button
            className={`search-option-button ${searchState.options.wholeWord ? 'active' : ''}`}
            title="完全一致"
            onClick={() => onToggleOption('wholeWord')}
          >
            Ab
          </button>
          <button
            className={`search-option-button ${searchState.options.regex ? 'active' : ''}`}
            title="正規表現"
            onClick={() => onToggleOption('regex')}
          >
            .*
          </button>
          <button
            className={`search-advanced-button ${searchState.showAdvanced ? 'active' : ''}`}
            title="詳細設定"
            onClick={onToggleAdvanced}
          >
            ⚙
          </button>
          <button
            className="search-close-button"
            title="閉じる (Esc)"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>

      {searchState.showReplace && (
        <div className="replace-row">
          <div className="search-input-container">
            <span className="search-icon">📝</span>
            <input
              type="text"
              className="search-input"
              placeholder="置換..."
              value={searchState.replaceText}
              onChange={(e) => onReplaceTextChange(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
            />
          </div>
          <div className="search-actions">
            <button
              className="replace-button"
              title="置換"
              onClick={onReplaceOne}
              disabled={currentResultInfo.total === 0}
            >
              置換
            </button>
            <button
              className="replace-all-button"
              title="すべて置換"
              onClick={onReplaceAll}
              disabled={currentResultInfo.total === 0}
            >
              すべて置換
            </button>
          </div>
        </div>
      )}

      {searchState.showAdvanced && (
        <div className="advanced-row">
          <label className="scope-label">検索範囲:</label>
          <select
            className="scope-select"
            value={searchState.scope}
            onChange={(e) => onScopeChange(e.target.value as SearchScope)}
          >
            <option value="all">すべてのシート</option>
            <option value="current">現在のシート</option>
            <option value="selection">選択中のセル</option>
          </select>
        </div>
      )}
    </div>
  )
}

export default SearchBar
