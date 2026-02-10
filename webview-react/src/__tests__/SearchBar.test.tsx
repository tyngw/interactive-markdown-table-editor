/**
 * SearchBar.test.tsx
 * SearchBarコンポーネントのテスト
 * 検索バーの表示/非表示、検索・置換操作、キーボード操作、オプション切替、
 * 詳細設定パネル、disabled状態、フォーカス制御を検証
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import SearchBar from '../components/SearchBar'
import { SearchState, SearchScope } from '../types'

// react-i18next をモック
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k })
}))

/** デフォルトの SearchState を生成するヘルパー */
const createDefaultSearchState = (overrides: Partial<SearchState> = {}): SearchState => ({
  isOpen: true,
  showReplace: false,
  showAdvanced: false,
  searchText: '',
  replaceText: '',
  scope: 'all' as SearchScope,
  options: {
    caseSensitive: false,
    wholeWord: false,
    regex: false
  },
  results: [],
  currentResultIndex: -1,
  ...overrides
})

/** デフォルトの props を生成するヘルパー */
const createDefaultProps = (overrides: Record<string, unknown> = {}) => ({
  searchState: createDefaultSearchState(),
  currentResultInfo: { total: 0, current: 0 },
  onSearchTextChange: jest.fn(),
  onReplaceTextChange: jest.fn(),
  onSearch: jest.fn(),
  onFindNext: jest.fn(),
  onFindPrevious: jest.fn(),
  onReplaceOne: jest.fn(),
  onReplaceAll: jest.fn(),
  onClose: jest.fn(),
  onToggleOption: jest.fn(),
  onToggleAdvanced: jest.fn(),
  onScopeChange: jest.fn(),
  ...overrides
})

describe('SearchBar', () => {
  // ──────────────────────────────────────────────
  // 1. 表示/非表示
  // ──────────────────────────────────────────────
  describe('表示/非表示', () => {
    it('isOpen=false のとき null を返す', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ isOpen: false })
      })
      const { container } = render(<SearchBar {...props} />)
      expect(container.firstChild).toBeNull()
    })

    it('isOpen=true のとき検索バーが表示される', () => {
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      expect(screen.getByPlaceholderText('searchBar.searchPlaceholder')).toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // 2. 検索入力
  // ──────────────────────────────────────────────
  describe('検索入力', () => {
    it('テキスト変更で onSearchTextChange が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.searchPlaceholder')
      await user.type(input, 'a')
      expect(props.onSearchTextChange).toHaveBeenCalledWith('a')
    })

    it('検索入力に自動フォーカスされる', () => {
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.searchPlaceholder')
      expect(document.activeElement).toBe(input)
    })
  })

  // ──────────────────────────────────────────────
  // 3. 検索キーボード操作
  // ──────────────────────────────────────────────
  describe('検索キーボード操作', () => {
    it('Enter キーで onSearch が呼ばれる', () => {
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.searchPlaceholder')
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(props.onSearch).toHaveBeenCalledTimes(1)
    })

    it('Shift+Enter で検索結果がある場合は onFindPrevious が呼ばれる', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({
          results: [{ tableIndex: 0, row: 0, col: 0 }]
        })
      })
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.searchPlaceholder')
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
      expect(props.onFindPrevious).toHaveBeenCalledTimes(1)
      expect(props.onSearch).not.toHaveBeenCalled()
    })

    it('Shift+Enter で検索結果がない場合は onSearch が呼ばれる', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ results: [] })
      })
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.searchPlaceholder')
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
      expect(props.onSearch).toHaveBeenCalledTimes(1)
      expect(props.onFindPrevious).not.toHaveBeenCalled()
    })

    it('Escape キーで onClose が呼ばれる', () => {
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.searchPlaceholder')
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })

    it('Enter/Escape 以外のキーではコールバックが呼ばれない', () => {
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.searchPlaceholder')
      fireEvent.keyDown(input, { key: 'a' })
      expect(props.onSearch).not.toHaveBeenCalled()
      expect(props.onClose).not.toHaveBeenCalled()
      expect(props.onFindPrevious).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  // 4. ナビゲーションボタン
  // ──────────────────────────────────────────────
  describe('ナビゲーションボタン', () => {
    it('前ボタンクリックで onFindPrevious が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps({
        currentResultInfo: { total: 3, current: 2 }
      })
      render(<SearchBar {...props} />)
      const prevButton = screen.getByTitle('searchBar.previousTitle')
      await user.click(prevButton)
      expect(props.onFindPrevious).toHaveBeenCalledTimes(1)
    })

    it('次ボタンクリックで onFindNext が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps({
        currentResultInfo: { total: 3, current: 2 }
      })
      render(<SearchBar {...props} />)
      const nextButton = screen.getByTitle('searchBar.nextTitle')
      await user.click(nextButton)
      expect(props.onFindNext).toHaveBeenCalledTimes(1)
    })

    it('total=0 のとき前/次ボタンが disabled になる', () => {
      const props = createDefaultProps({
        currentResultInfo: { total: 0, current: 0 }
      })
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.previousTitle')).toBeDisabled()
      expect(screen.getByTitle('searchBar.nextTitle')).toBeDisabled()
    })

    it('total>0 のとき前/次ボタンが enabled になる', () => {
      const props = createDefaultProps({
        currentResultInfo: { total: 5, current: 1 }
      })
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.previousTitle')).not.toBeDisabled()
      expect(screen.getByTitle('searchBar.nextTitle')).not.toBeDisabled()
    })
  })

  // ──────────────────────────────────────────────
  // 5. オプションボタン
  // ──────────────────────────────────────────────
  describe('オプションボタン', () => {
    it('caseSensitive ボタンクリックで onToggleOption("caseSensitive") が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      await user.click(screen.getByTitle('searchBar.caseSensitiveTitle'))
      expect(props.onToggleOption).toHaveBeenCalledWith('caseSensitive')
    })

    it('wholeWord ボタンクリックで onToggleOption("wholeWord") が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      await user.click(screen.getByTitle('searchBar.wholeWordTitle'))
      expect(props.onToggleOption).toHaveBeenCalledWith('wholeWord')
    })

    it('regex ボタンクリックで onToggleOption("regex") が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      await user.click(screen.getByTitle('searchBar.regexTitle'))
      expect(props.onToggleOption).toHaveBeenCalledWith('regex')
    })
  })

  // ──────────────────────────────────────────────
  // 6. オプション active クラス
  // ──────────────────────────────────────────────
  describe('オプション active クラス切り替え', () => {
    it('caseSensitive=true のとき active クラスが付く', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({
          options: { caseSensitive: true, wholeWord: false, regex: false }
        })
      })
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.caseSensitiveTitle')).toHaveClass('active')
    })

    it('caseSensitive=false のとき active クラスが付かない', () => {
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.caseSensitiveTitle')).not.toHaveClass('active')
    })

    it('wholeWord=true のとき active クラスが付く', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({
          options: { caseSensitive: false, wholeWord: true, regex: false }
        })
      })
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.wholeWordTitle')).toHaveClass('active')
    })

    it('wholeWord=false のとき active クラスが付かない', () => {
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.wholeWordTitle')).not.toHaveClass('active')
    })

    it('regex=true のとき active クラスが付く', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({
          options: { caseSensitive: false, wholeWord: false, regex: true }
        })
      })
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.regexTitle')).toHaveClass('active')
    })

    it('regex=false のとき active クラスが付かない', () => {
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.regexTitle')).not.toHaveClass('active')
    })
  })

  // ──────────────────────────────────────────────
  // 7. 検索結果表示
  // ──────────────────────────────────────────────
  describe('検索結果表示', () => {
    it('searchText が空のとき結果カウントスパンが表示されない', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ searchText: '' })
      })
      render(<SearchBar {...props} />)
      expect(screen.queryByText('searchBar.noMatches')).not.toBeInTheDocument()
    })

    it('total > 0 のとき "current/total" が表示される', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ searchText: 'test' }),
        currentResultInfo: { total: 5, current: 2 }
      })
      render(<SearchBar {...props} />)
      expect(screen.getByText('2/5')).toBeInTheDocument()
    })

    it('total === 0 かつ searchText が空でないとき noMatches が表示される', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ searchText: 'notfound' }),
        currentResultInfo: { total: 0, current: 0 }
      })
      render(<SearchBar {...props} />)
      expect(screen.getByText('searchBar.noMatches')).toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  // 8. 閉じる / 詳細ボタン
  // ──────────────────────────────────────────────
  describe('閉じる / 詳細ボタン', () => {
    it('閉じるボタンクリックで onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      await user.click(screen.getByTitle('searchBar.closeTitle'))
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })

    it('詳細ボタンクリックで onToggleAdvanced が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      await user.click(screen.getByTitle('searchBar.advancedTitle'))
      expect(props.onToggleAdvanced).toHaveBeenCalledTimes(1)
    })

    it('showAdvanced=true のとき詳細ボタンに active クラスが付く', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showAdvanced: true })
      })
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.advancedTitle')).toHaveClass('active')
    })

    it('showAdvanced=false のとき詳細ボタンに active クラスが付かない', () => {
      const props = createDefaultProps()
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.advancedTitle')).not.toHaveClass('active')
    })
  })

  // ──────────────────────────────────────────────
  // 9. 置換行
  // ──────────────────────────────────────────────
  describe('置換行', () => {
    it('showReplace=false のとき置換行が表示されない', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: false })
      })
      render(<SearchBar {...props} />)
      expect(screen.queryByPlaceholderText('searchBar.replacePlaceholder')).not.toBeInTheDocument()
    })

    it('showReplace=true のとき置換行が表示される', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: true })
      })
      render(<SearchBar {...props} />)
      expect(screen.getByPlaceholderText('searchBar.replacePlaceholder')).toBeInTheDocument()
    })

    it('置換入力テキスト変更で onReplaceTextChange が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: true })
      })
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.replacePlaceholder')
      await user.type(input, 'x')
      expect(props.onReplaceTextChange).toHaveBeenCalledWith('x')
    })

    it('置換入力で Enter キー押下で onReplaceOne が呼ばれる', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: true })
      })
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.replacePlaceholder')
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(props.onReplaceOne).toHaveBeenCalledTimes(1)
    })

    it('置換入力で Escape キー押下で onClose が呼ばれる', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: true })
      })
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.replacePlaceholder')
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })

    it('置換入力で Enter/Escape 以外のキーではコールバックが呼ばれない', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: true })
      })
      render(<SearchBar {...props} />)
      const input = screen.getByPlaceholderText('searchBar.replacePlaceholder')
      fireEvent.keyDown(input, { key: 'Tab' })
      expect(props.onReplaceOne).not.toHaveBeenCalled()
      expect(props.onClose).not.toHaveBeenCalled()
    })

    it('置換ボタンクリックで onReplaceOne が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: true }),
        currentResultInfo: { total: 3, current: 1 }
      })
      render(<SearchBar {...props} />)
      await user.click(screen.getByTitle('searchBar.replaceTitle'))
      expect(props.onReplaceOne).toHaveBeenCalledTimes(1)
    })

    it('全置換ボタンクリックで onReplaceAll が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: true }),
        currentResultInfo: { total: 3, current: 1 }
      })
      render(<SearchBar {...props} />)
      await user.click(screen.getByTitle('searchBar.replaceAllTitle'))
      expect(props.onReplaceAll).toHaveBeenCalledTimes(1)
    })

    it('total=0 のとき置換/全置換ボタンが disabled になる', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: true }),
        currentResultInfo: { total: 0, current: 0 }
      })
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.replaceTitle')).toBeDisabled()
      expect(screen.getByTitle('searchBar.replaceAllTitle')).toBeDisabled()
    })

    it('total>0 のとき置換/全置換ボタンが enabled になる', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showReplace: true }),
        currentResultInfo: { total: 2, current: 1 }
      })
      render(<SearchBar {...props} />)
      expect(screen.getByTitle('searchBar.replaceTitle')).not.toBeDisabled()
      expect(screen.getByTitle('searchBar.replaceAllTitle')).not.toBeDisabled()
    })
  })

  // ──────────────────────────────────────────────
  // 10. 詳細行 (Advanced)
  // ──────────────────────────────────────────────
  describe('詳細行', () => {
    it('showAdvanced=false のとき詳細行が表示されない', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showAdvanced: false })
      })
      render(<SearchBar {...props} />)
      expect(screen.queryByText('searchBar.scopeLabel')).not.toBeInTheDocument()
    })

    it('showAdvanced=true のとき詳細行が表示される', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showAdvanced: true })
      })
      render(<SearchBar {...props} />)
      expect(screen.getByText('searchBar.scopeLabel')).toBeInTheDocument()
    })

    it('スコープ select にすべてのオプションが表示される', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showAdvanced: true })
      })
      render(<SearchBar {...props} />)
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      // option 要素を検証
      expect(screen.getByText('searchBar.scopeAll')).toBeInTheDocument()
      expect(screen.getByText('searchBar.scopeCurrent')).toBeInTheDocument()
      expect(screen.getByText('searchBar.scopeSelection')).toBeInTheDocument()
    })

    it('スコープ select の初期値が searchState.scope と一致する', () => {
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showAdvanced: true, scope: 'current' })
      })
      render(<SearchBar {...props} />)
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('current')
    })

    it('スコープ変更で onScopeChange が呼ばれる', async () => {
      const user = userEvent.setup()
      const props = createDefaultProps({
        searchState: createDefaultSearchState({ showAdvanced: true, scope: 'all' })
      })
      render(<SearchBar {...props} />)
      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'selection')
      expect(props.onScopeChange).toHaveBeenCalledWith('selection')
    })
  })

  // ──────────────────────────────────────────────
  // 11. フォーカス制御（isOpen 切り替え時）
  // ──────────────────────────────────────────────
  describe('フォーカス制御', () => {
    it('isOpen が false から true に変わったとき検索入力にフォーカスが移る', () => {
      const propsInitial = createDefaultProps({
        searchState: createDefaultSearchState({ isOpen: false })
      })
      const { rerender } = render(<SearchBar {...propsInitial} />)

      const propsOpen = createDefaultProps({
        searchState: createDefaultSearchState({ isOpen: true })
      })
      rerender(<SearchBar {...propsOpen} />)

      const input = screen.getByPlaceholderText('searchBar.searchPlaceholder')
      expect(document.activeElement).toBe(input)
    })
  })
})
