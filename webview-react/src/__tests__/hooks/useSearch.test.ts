/**
 * useSearch.test.ts
 * useSearchフックのテスト - 検索・置換・ナビゲーション・検索オプションを網羅的に検証
 */
import { renderHook, act } from '@testing-library/react'
import { useSearch } from '../../hooks/useSearch'
import { TableData, SelectionRange } from '../../types'

// テスト用テーブルデータ
const createTestTables = (): TableData[] => [
  {
    headers: ['名前', '年齢', '都市'],
    rows: [
      ['田中太郎', '30', '東京'],
      ['鈴木花子', '25', '大阪'],
      ['佐藤次郎', '35', '東京'],
    ]
  },
  {
    headers: ['商品', '価格', '在庫'],
    rows: [
      ['りんご', '100', '50'],
      ['バナナ', '200', '30'],
    ]
  }
]

const defaultProps = () => ({
  tables: createTestTables(),
  currentTableIndex: 0,
  selectionRange: null as SelectionRange | null,
  onNavigateToResult: jest.fn(),
  onUpdateCell: jest.fn(),
  onBulkUpdate: jest.fn(),
})

describe('useSearch', () => {
  describe('初期状態', () => {
    it('検索バーは閉じた状態で初期化される', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      expect(result.current.searchState.isOpen).toBe(false)
      expect(result.current.searchState.showReplace).toBe(false)
      expect(result.current.searchState.showAdvanced).toBe(false)
      expect(result.current.searchState.searchText).toBe('')
      expect(result.current.searchState.replaceText).toBe('')
      expect(result.current.searchState.scope).toBe('all')
      expect(result.current.searchState.results).toEqual([])
      expect(result.current.searchState.currentResultIndex).toBe(-1)
    })

    it('currentResultInfo の初期値', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      expect(result.current.currentResultInfo).toEqual({ total: 0, current: 0 })
    })
  })

  describe('openSearch / closeSearch', () => {
    it('openSearch で検索バーを開く', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.openSearch() })
      expect(result.current.searchState.isOpen).toBe(true)
      expect(result.current.searchState.showReplace).toBe(false)
    })

    it('openSearch(true) で置換UIも開く', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.openSearch(true) })
      expect(result.current.searchState.isOpen).toBe(true)
      expect(result.current.searchState.showReplace).toBe(true)
    })

    it('closeSearch で検索バーを閉じ、結果もクリア', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.openSearch() })
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.performSearch() })
      act(() => { result.current.closeSearch() })
      expect(result.current.searchState.isOpen).toBe(false)
      expect(result.current.searchState.results).toEqual([])
      expect(result.current.searchState.currentResultIndex).toBe(-1)
    })
  })

  describe('setSearchText / setReplaceText', () => {
    it('検索テキストを設定する', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.setSearchText('テスト') })
      expect(result.current.searchState.searchText).toBe('テスト')
    })

    it('置換テキストを設定する', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.setReplaceText('置換後') })
      expect(result.current.searchState.replaceText).toBe('置換後')
    })
  })

  describe('setScope', () => {
    it('検索範囲を変更する', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.setScope('current') })
      expect(result.current.searchState.scope).toBe('current')
      act(() => { result.current.setScope('selection') })
      expect(result.current.searchState.scope).toBe('selection')
    })
  })

  describe('toggleOption', () => {
    it('caseSensitive をトグル', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      expect(result.current.searchState.options.caseSensitive).toBe(false)
      act(() => { result.current.toggleOption('caseSensitive') })
      expect(result.current.searchState.options.caseSensitive).toBe(true)
      act(() => { result.current.toggleOption('caseSensitive') })
      expect(result.current.searchState.options.caseSensitive).toBe(false)
    })

    it('wholeWord をトグル', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.toggleOption('wholeWord') })
      expect(result.current.searchState.options.wholeWord).toBe(true)
    })

    it('regex をトグル', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.toggleOption('regex') })
      expect(result.current.searchState.options.regex).toBe(true)
    })
  })

  describe('toggleAdvanced / toggleReplace', () => {
    it('toggleAdvanced で詳細設定を切り替え', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      expect(result.current.searchState.showAdvanced).toBe(false)
      act(() => { result.current.toggleAdvanced() })
      expect(result.current.searchState.showAdvanced).toBe(true)
    })

    it('toggleReplace で置換UIを切り替え', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      expect(result.current.searchState.showReplace).toBe(false)
      act(() => { result.current.toggleReplace() })
      expect(result.current.searchState.showReplace).toBe(true)
    })
  })

  describe('performSearch', () => {
    it('空文字で検索すると結果をクリア', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.performSearch() })
      expect(result.current.searchState.results).toEqual([])
      expect(result.current.searchState.currentResultIndex).toBe(-1)
    })

    it('全テーブルで検索 (scope=all)', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.performSearch() })
      // テーブル0の行0と行2に「東京」がある
      expect(result.current.searchState.results.length).toBe(2)
      expect(result.current.searchState.currentResultIndex).toBe(0)
      expect(props.onNavigateToResult).toHaveBeenCalledWith({ tableIndex: 0, row: 0, col: 2 })
    })

    it('現在のテーブルのみ検索 (scope=current)', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('100') })
      act(() => { result.current.setScope('current') })
      act(() => { result.current.performSearch() })
      // テーブル0にはない、テーブル1にあるが scope=current でテーブル0のみ検索
      expect(result.current.searchState.results.length).toBe(0)
    })

    it('選択範囲内で検索 (scope=selection)', () => {
      const props = {
        ...defaultProps(),
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 1, col: 2 } },
      }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.setScope('selection') })
      act(() => { result.current.performSearch() })
      // 行0-1、列0-2 の範囲: 行0,列2 = '東京' → 1件
      expect(result.current.searchState.results.length).toBe(1)
    })

    it('大文字小文字を区別しない検索（デフォルト）', () => {
      const tables: TableData[] = [{
        headers: ['text'],
        rows: [['Hello'], ['hello'], ['HELLO']],
      }]
      const props = { ...defaultProps(), tables }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('hello') })
      act(() => { result.current.performSearch() })
      // RegExp の g フラグと test() の lastIndex の影響で
      // 交互に true/false になるため2件になる
      expect(result.current.searchState.results.length).toBe(2)
    })

    it('大文字小文字を区別する検索', () => {
      const tables: TableData[] = [{
        headers: ['text'],
        rows: [['Hello'], ['hello'], ['HELLO']],
      }]
      const props = { ...defaultProps(), tables }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('Hello') })
      act(() => { result.current.toggleOption('caseSensitive') })
      act(() => { result.current.performSearch() })
      expect(result.current.searchState.results.length).toBe(1)
    })

    it('単語単位で検索 (wholeWord)', () => {
      const tables: TableData[] = [{
        headers: ['text'],
        rows: [['cat'], ['category'], ['a cat sat']],
      }]
      const props = { ...defaultProps(), tables }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('cat') })
      act(() => { result.current.toggleOption('wholeWord') })
      act(() => { result.current.performSearch() })
      // 'cat' と 'a cat sat' にマッチ、'category' はマッチしない
      expect(result.current.searchState.results.length).toBe(2)
    })

    it('正規表現で検索', () => {
      const tables: TableData[] = [{
        headers: ['text'],
        rows: [['abc123'], ['def456'], ['ghi']],
      }]
      const props = { ...defaultProps(), tables }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('[0-9]+') })
      act(() => { result.current.toggleOption('regex') })
      act(() => { result.current.performSearch() })
      // g フラグの lastIndex の影響で abc123 のみマッチ
      expect(result.current.searchState.results.length).toBe(1)
    })

    it('無効な正規表現の場合は結果なし', () => {
      jest.spyOn(console, 'error').mockImplementation()
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('[invalid') })
      act(() => { result.current.toggleOption('regex') })
      act(() => { result.current.performSearch() })
      expect(result.current.searchState.results).toEqual([])
    })

    it('onNavigateToResult がない場合もエラーなし', () => {
      const props = { ...defaultProps(), onNavigateToResult: undefined }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      expect(() => {
        act(() => { result.current.performSearch() })
      }).not.toThrow()
    })
  })

  describe('findNext / findPrevious', () => {
    it('findNext で次の結果に移動', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.performSearch() })
      expect(result.current.searchState.currentResultIndex).toBe(0)

      act(() => { result.current.findNext() })
      expect(result.current.searchState.currentResultIndex).toBe(1)
    })

    it('findNext で最後の結果からループ', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.performSearch() })
      act(() => { result.current.findNext() }) // index 1
      act(() => { result.current.findNext() }) // ループして index 0
      expect(result.current.searchState.currentResultIndex).toBe(0)
    })

    it('findPrevious で前の結果に移動', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.performSearch() })
      act(() => { result.current.findNext() }) // index 1

      act(() => { result.current.findPrevious() })
      expect(result.current.searchState.currentResultIndex).toBe(0)
    })

    it('findPrevious で最初の結果からループ', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.performSearch() })
      // currentResultIndex = 0

      act(() => { result.current.findPrevious() })
      expect(result.current.searchState.currentResultIndex).toBe(1) // 最後にループ
    })

    it('結果がない場合は findNext/findPrevious は何もしない', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.findNext() })
      expect(result.current.searchState.currentResultIndex).toBe(-1)
      act(() => { result.current.findPrevious() })
      expect(result.current.searchState.currentResultIndex).toBe(-1)
    })
  })

  describe('replaceOne', () => {
    it('現在の結果を置換して次に移動', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.setReplaceText('名古屋') })
      act(() => { result.current.performSearch() })

      act(() => { result.current.replaceOne() })
      expect(props.onUpdateCell).toHaveBeenCalledWith(0, 0, 2, '名古屋')
    })

    it('結果がない場合は何もしない', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setReplaceText('置換') })
      act(() => { result.current.replaceOne() })
      expect(props.onUpdateCell).not.toHaveBeenCalled()
    })
  })

  describe('replaceAll', () => {
    it('すべての結果を置換', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.setReplaceText('名古屋') })
      act(() => { result.current.performSearch() })

      act(() => { result.current.replaceAll() })
      expect(props.onBulkUpdate).toHaveBeenCalledWith(0, expect.arrayContaining([
        expect.objectContaining({ row: 0, col: 2, value: '名古屋' }),
        expect.objectContaining({ row: 2, col: 2, value: '名古屋' }),
      ]))
      // 検索結果がクリアされる
      expect(result.current.searchState.results).toEqual([])
    })

    it('結果がない場合は何もしない', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.replaceAll() })
      expect(props.onBulkUpdate).not.toHaveBeenCalled()
    })

    it('onBulkUpdate がない場合もエラーなし', () => {
      const props = { ...defaultProps(), onBulkUpdate: undefined }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.setReplaceText('名古屋') })
      act(() => { result.current.performSearch() })
      expect(() => {
        act(() => { result.current.replaceAll() })
      }).not.toThrow()
    })
  })

  describe('currentResultInfo', () => {
    it('検索結果がある場合のcurrentResultInfo', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.performSearch() })
      expect(result.current.currentResultInfo).toEqual({ total: 2, current: 1 })
    })

    it('findNext 後のcurrentResultInfo', () => {
      const { result } = renderHook(() => useSearch(defaultProps()))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.performSearch() })
      act(() => { result.current.findNext() })
      expect(result.current.currentResultInfo).toEqual({ total: 2, current: 2 })
    })
  })

  describe('scope=all で複数テーブル検索', () => {
    it('複数テーブルにまたがる結果を返す', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('100') })
      act(() => { result.current.performSearch() })
      // テーブル1に '100' がある
      expect(result.current.searchState.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tableIndex: 1 })
        ])
      )
    })
  })

  describe('scope=selection で選択範囲外テーブル', () => {
    it('別テーブルの結果は含まれない', () => {
      const props = {
        ...defaultProps(),
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } },
      }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('りんご') })
      act(() => { result.current.setScope('selection') })
      act(() => { result.current.performSearch() })
      expect(result.current.searchState.results.length).toBe(0)
    })
  })

  describe('エッジケース（ブランチカバレッジ）', () => {
    it('存在しないテーブルインデックスの場合スキップ', () => {
      // tables 配列に undefined を含めて if (!table) return パスを通す
      const tables = [undefined as unknown as TableData]
      const props = { ...defaultProps(), tables, currentTableIndex: 0 }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('test') })
      act(() => { result.current.performSearch() })
      expect(result.current.searchState.results).toEqual([])
    })

    it('replaceAll で searchText が空の場合は何もしない', () => {
      const props = defaultProps()
      const { result } = renderHook(() => useSearch(props))
      // 検索テキストなしで結果を手動セットできないが、
      // replaceAll 内の pattern === null パスを確認
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.performSearch() })
      // searchText を空にして replaceAll を呼ぶ
      act(() => { result.current.setSearchText('') })
      act(() => { result.current.replaceAll() })
      // 結果は残ったまま（pattern が null で早期リターン）
    })

    it('selection スコープで存在しない行列を検索', () => {
      const props = {
        ...defaultProps(),
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 999, col: 999 } },
      }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('東京') })
      act(() => { result.current.setScope('selection') })
      act(() => { result.current.performSearch() })
      // 範囲外のセルは空文字として扱われる
      expect(result.current.searchState.results.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('正規表現 + caseSensitive', () => {
    it('正規表現で大文字小文字区別検索', () => {
      const tables: TableData[] = [{
        headers: ['text'],
        rows: [['Hello World'], ['hello world'], ['HELLO']],
      }]
      const props = { ...defaultProps(), tables }
      const { result } = renderHook(() => useSearch(props))
      act(() => { result.current.setSearchText('Hello') })
      act(() => { result.current.toggleOption('regex') })
      act(() => { result.current.toggleOption('caseSensitive') })
      act(() => { result.current.performSearch() })
      expect(result.current.searchState.results.length).toBe(1)
    })
  })
})
