import React, { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
            placeholder={t('searchBar.searchPlaceholder')}
            value={searchState.searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {searchState.searchText && (
            <span className="search-result-count">
              {currentResultInfo.total > 0
                ? `${currentResultInfo.current}/${currentResultInfo.total}`
                : t('searchBar.noMatches')}
            </span>
          )}
        </div>
        <div className="search-actions">
          <button
            className="search-nav-button"
            title={t('searchBar.previousTitle')}
            onClick={onFindPrevious}
            disabled={currentResultInfo.total === 0}
          >
            ⬆
          </button>
          <button
            className="search-nav-button"
            title={t('searchBar.nextTitle')}
            onClick={onFindNext}
            disabled={currentResultInfo.total === 0}
          >
            ⬇
          </button>
          <button
            className={`search-option-button ${searchState.options.caseSensitive ? 'active' : ''}`}
            title={t('searchBar.caseSensitiveTitle')}
            onClick={() => onToggleOption('caseSensitive')}
          >
            Aa
          </button>
          <button
            className={`search-option-button ${searchState.options.wholeWord ? 'active' : ''}`}
            title={t('searchBar.wholeWordTitle')}
            onClick={() => onToggleOption('wholeWord')}
          >
            Ab
          </button>
          <button
            className={`search-option-button ${searchState.options.regex ? 'active' : ''}`}
            title={t('searchBar.regexTitle')}
            onClick={() => onToggleOption('regex')}
          >
            .*
          </button>
          <button
            className={`search-advanced-button ${searchState.showAdvanced ? 'active' : ''}`}
            title={t('searchBar.advancedTitle')}
            onClick={onToggleAdvanced}
          >
            ⚙
          </button>
          <button
            className="search-close-button"
            title={t('searchBar.closeTitle')}
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
              placeholder={t('searchBar.replacePlaceholder')}
              value={searchState.replaceText}
              onChange={(e) => onReplaceTextChange(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
            />
          </div>
          <div className="search-actions">
            <button
              className="replace-button"
              title={t('searchBar.replaceTitle')}
              onClick={onReplaceOne}
              disabled={currentResultInfo.total === 0}
            >
              {t('searchBar.replaceButton')}
            </button>
            <button
              className="replace-all-button"
              title={t('searchBar.replaceAllTitle')}
              onClick={onReplaceAll}
              disabled={currentResultInfo.total === 0}
            >
              {t('searchBar.replaceAllButton')}
            </button>
          </div>
        </div>
      )}

      {searchState.showAdvanced && (
        <div className="advanced-row">
          <label className="scope-label">{t('searchBar.scopeLabel')}</label>
          <select
            className="scope-select"
            value={searchState.scope}
            onChange={(e) => onScopeChange(e.target.value as SearchScope)}
          >
            <option value="all">{t('searchBar.scopeAll')}</option>
            <option value="current">{t('searchBar.scopeCurrent')}</option>
            <option value="selection">{t('searchBar.scopeSelection')}</option>
          </select>
        </div>
      )}
    </div>
  )
}

export default SearchBar
