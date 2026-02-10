/**
 * useSelection フックのユニットテスト
 * セル選択、行/列選択、全選択、ドラッグ選択、移動後の選択更新をカバー
 */
import { renderHook, act } from '@testing-library/react'
import { useSelection } from '../../hooks/useSelection'

// console.log をモック
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('useSelection', () => {
  // ===== 初期状態 =====
  describe('初期状態', () => {
    it('初期状態では空の選択状態が返される', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      expect(result.current.selectionState.selectedCells.size).toBe(0)
      expect(result.current.selectionState.fullySelectedRows.size).toBe(0)
      expect(result.current.selectionState.fullySelectedCols.size).toBe(0)
      expect(result.current.selectionState.selectionRange).toBeNull()
      expect(result.current.selectionState.selectionAnchor).toBeNull()
    })
  })

  // ===== clearSelection =====
  describe('clearSelection', () => {
    it('選択をすべてクリアする', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // まずセルを選択
      act(() => result.current.selectCell(1, 1))
      expect(result.current.selectionState.selectedCells.size).toBe(1)

      // クリア
      act(() => result.current.clearSelection())
      expect(result.current.selectionState.selectedCells.size).toBe(0)
      expect(result.current.selectionState.selectionRange).toBeNull()
      expect(result.current.selectionState.selectionAnchor).toBeNull()
    })
  })

  // ===== initializeSelection =====
  describe('initializeSelection', () => {
    it('テーブルが存在する場合、A1セル(0,0)を選択する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.initializeSelection())
      expect(result.current.selectionState.selectedCells.has('0-0')).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(1)
      expect(result.current.selectionState.selectionRange).toEqual({
        start: { row: 0, col: 0 },
        end: { row: 0, col: 0 }
      })
      expect(result.current.selectionState.selectionAnchor).toEqual({ row: 0, col: 0 })
    })

    it('テーブルが0行の場合、clearSelectionが呼ばれる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 0, tableColCount: 3 })
      )
      act(() => result.current.initializeSelection())
      expect(result.current.selectionState.selectedCells.size).toBe(0)
      expect(result.current.selectionState.selectionRange).toBeNull()
    })

    it('テーブルが0列の場合、clearSelectionが呼ばれる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 0 })
      )
      act(() => result.current.initializeSelection())
      expect(result.current.selectionState.selectedCells.size).toBe(0)
      expect(result.current.selectionState.selectionRange).toBeNull()
    })
  })

  // ===== selectCell =====
  describe('selectCell', () => {
    it('単一セルを選択する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectCell(1, 2))
      expect(result.current.selectionState.selectedCells.has('1-2')).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(1)
      expect(result.current.selectionState.selectionRange).toEqual({
        start: { row: 1, col: 2 },
        end: { row: 1, col: 2 }
      })
      expect(result.current.selectionState.selectionAnchor).toEqual({ row: 1, col: 2 })
    })

    it('extend=true でアンカーからの範囲選択を行う', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // まず基点を選択
      act(() => result.current.selectCell(0, 0))
      // Shift+選択で範囲拡張
      act(() => result.current.selectCell(2, 2, true))
      expect(result.current.selectionState.selectedCells.size).toBe(9) // 3x3
      expect(result.current.selectionState.selectedCells.has('0-0')).toBe(true)
      expect(result.current.selectionState.selectedCells.has('2-2')).toBe(true)
      expect(result.current.selectionState.selectedCells.has('1-1')).toBe(true)
    })

    it('toggle=true で未選択のセルを追加する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // 最初にセルを選択
      act(() => result.current.selectCell(0, 0))
      // toggle で別のセルを追加
      act(() => result.current.selectCell(1, 1, false, true))
      expect(result.current.selectionState.selectedCells.has('0-0')).toBe(true)
      expect(result.current.selectionState.selectedCells.has('1-1')).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(2)
    })

    it('toggle=true で選択済みセルを解除する（2つ以上のとき）', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // 2つのセルを選択状態にする
      act(() => result.current.selectCell(0, 0))
      act(() => result.current.selectCell(1, 1, false, true))
      expect(result.current.selectionState.selectedCells.size).toBe(2)

      // toggle で既存セルを解除
      act(() => result.current.selectCell(0, 0, false, true))
      expect(result.current.selectionState.selectedCells.has('0-0')).toBe(false)
      expect(result.current.selectionState.selectedCells.has('1-1')).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(1)
    })

    it('toggle=true で最後のセルは解除されない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // 1つだけ選択
      act(() => result.current.selectCell(0, 0))
      expect(result.current.selectionState.selectedCells.size).toBe(1)

      // toggle で同じセルを解除しようとしても残る
      act(() => result.current.selectCell(0, 0, false, true))
      expect(result.current.selectionState.selectedCells.has('0-0')).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(1)
    })

    it('extend=true でanchorがnullだがselectionRangeがある場合、rangeを使う', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // selectCell で (0,0) を選択 → anchor と range が設定される
      act(() => result.current.selectCell(0, 0))
      // anchor を null にクリアする（setSelectionAnchor を直接呼ぶ）
      act(() => result.current.setSelectionAnchor(null))
      // この状態で extend=true で selectCell を呼ぶ
      // selectionAnchorRef.current は useEffect による同期で null になるが、
      // selectionRange は残っているので、else if (extend && selectionRange) の分岐に入る
      act(() => result.current.selectCell(2, 2, true))
      // selectionRange.start(0,0) から (2,2) まで選択される
      expect(result.current.selectionState.selectedCells.size).toBe(9)
      expect(result.current.selectionState.selectedCells.has('0-0')).toBe(true)
      expect(result.current.selectionState.selectedCells.has('2-2')).toBe(true)
    })

    it('selectCell で全行/全列選択状態がクリアされる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // 行選択
      act(() => result.current.selectRow(0))
      expect(result.current.selectionState.fullySelectedRows.has(0)).toBe(true)
      // セル選択すると全行選択がクリアされる
      act(() => result.current.selectCell(1, 1))
      expect(result.current.selectionState.fullySelectedRows.size).toBe(0)
      expect(result.current.selectionState.fullySelectedCols.size).toBe(0)
    })
  })

  // ===== selectRow =====
  describe('selectRow', () => {
    it('単一行を選択する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectRow(1))
      expect(result.current.selectionState.fullySelectedRows.has(1)).toBe(true)
      expect(result.current.selectionState.selectedCells.has('1-0')).toBe(true)
      expect(result.current.selectionState.selectedCells.has('1-1')).toBe(true)
      expect(result.current.selectionState.selectedCells.has('1-2')).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(3)
      expect(result.current.selectionState.fullySelectedCols.size).toBe(0)
    })

    it('extend=true で行範囲を選択する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // まず行1を選択（rangeの基点を設定）
      act(() => result.current.selectRow(0))
      // extendで行2まで拡張
      act(() => result.current.selectRow(2, true))
      expect(result.current.selectionState.fullySelectedRows.has(0)).toBe(true)
      expect(result.current.selectionState.fullySelectedRows.has(1)).toBe(true)
      expect(result.current.selectionState.fullySelectedRows.has(2)).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(9) // 3行 * 3列
    })

    it('行選択時にアンカーが設定される', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectRow(2))
      expect(result.current.selectionState.selectionAnchor).toEqual({ row: 2, col: 0 })
      expect(result.current.selectionState.selectionRange).toEqual({
        start: { row: 2, col: 0 },
        end: { row: 2, col: 2 }
      })
    })
  })

  // ===== selectColumn =====
  describe('selectColumn', () => {
    it('単一列を選択する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectColumn(1))
      expect(result.current.selectionState.fullySelectedCols.has(1)).toBe(true)
      expect(result.current.selectionState.selectedCells.has('0-1')).toBe(true)
      expect(result.current.selectionState.selectedCells.has('1-1')).toBe(true)
      expect(result.current.selectionState.selectedCells.has('2-1')).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(3)
      expect(result.current.selectionState.fullySelectedRows.size).toBe(0)
    })

    it('extend=true で列範囲を選択する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectColumn(0))
      act(() => result.current.selectColumn(2, true))
      expect(result.current.selectionState.fullySelectedCols.has(0)).toBe(true)
      expect(result.current.selectionState.fullySelectedCols.has(1)).toBe(true)
      expect(result.current.selectionState.fullySelectedCols.has(2)).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(9) // 3行 * 3列
    })

    it('列選択時にアンカーが設定される', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectColumn(2))
      expect(result.current.selectionState.selectionAnchor).toEqual({ row: 0, col: 2 })
      expect(result.current.selectionState.selectionRange).toEqual({
        start: { row: 0, col: 2 },
        end: { row: 2, col: 2 }
      })
    })
  })

  // ===== selectAll =====
  describe('selectAll', () => {
    it('全セルを選択する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 2, tableColCount: 2 })
      )
      act(() => result.current.selectAll())
      expect(result.current.selectionState.selectedCells.size).toBe(4)
      expect(result.current.selectionState.fullySelectedRows.size).toBe(2)
      expect(result.current.selectionState.fullySelectedCols.size).toBe(2)
      expect(result.current.selectionState.selectionRange).toEqual({
        start: { row: 0, col: 0 },
        end: { row: 1, col: 1 }
      })
      expect(result.current.selectionState.selectionAnchor).toEqual({ row: 0, col: 0 })
    })
  })

  // ===== ドラッグ選択 =====
  describe('ドラッグ選択', () => {
    it('onDragStart で単一セル選択が行われる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.onDragStart(1, 1))
      expect(result.current.selectionState.selectedCells.has('1-1')).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(1)
    })

    it('onDragEnter でドラッグ中に範囲選択が拡張される', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // ドラッグ開始
      act(() => result.current.onDragStart(0, 0))
      // ドラッグ中にセルに入る
      act(() => result.current.onDragEnter(2, 2))
      expect(result.current.selectionState.selectedCells.size).toBe(9) // 3x3
    })

    it('onDragEnter はドラッグ中でなければ何もしない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // ドラッグ開始せずにonDragEnterを呼ぶ
      act(() => result.current.onDragEnter(2, 2))
      // 選択状態は変わらない
      expect(result.current.selectionState.selectedCells.size).toBe(0)
    })

    it('onDragEnd でドラッグ状態が終了する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.onDragStart(0, 0))
      act(() => result.current.onDragEnd())
      // ドラッグ終了後にonDragEnterを呼んでも拡張されない
      act(() => result.current.onDragEnter(2, 2))
      expect(result.current.selectionState.selectedCells.size).toBe(1)
    })
  })

  // ===== updateSelectedRowsAfterMove =====
  describe('updateSelectedRowsAfterMove', () => {
    it('行の移動後に選択状態を正しく更新する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 4, tableColCount: 3 })
      )
      // 行1を選択
      act(() => result.current.selectRow(1))
      // 行1を行3の位置にドロップ
      act(() => result.current.updateSelectedRowsAfterMove([1], 3))
      // 移動後の選択状態が更新されている
      expect(result.current.selectionState.selectedCells.size).toBe(3)
    })

    it('空の配列の場合は何もしない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectCell(0, 0))
      const before = result.current.selectionState.selectedCells
      act(() => result.current.updateSelectedRowsAfterMove([], 0))
      expect(result.current.selectionState.selectedCells).toBe(before)
    })

    it('無効なインデックスの場合は何もしない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectCell(0, 0))
      const before = result.current.selectionState.selectedCells
      // 範囲外のインデックス
      act(() => result.current.updateSelectedRowsAfterMove([-1, 10], 0))
      expect(result.current.selectionState.selectedCells).toBe(before)
    })

    it('dropIndex が範囲外の場合は何もしない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectCell(0, 0))
      const before = result.current.selectionState.selectedCells
      act(() => result.current.updateSelectedRowsAfterMove([0], -1))
      expect(result.current.selectionState.selectedCells).toBe(before)
    })

    it('dropIndex が totalRows を超える場合は何もしない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectCell(0, 0))
      const before = result.current.selectionState.selectedCells
      act(() => result.current.updateSelectedRowsAfterMove([0], 4))
      expect(result.current.selectionState.selectedCells).toBe(before)
    })

    it('selectionRange と selectionAnchor が null の場合でも正しく動作する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // clearSelection で null にする
      act(() => result.current.clearSelection())
      // 移動を実行（選択がないが、クラッシュしないことを確認）
      act(() => result.current.updateSelectedRowsAfterMove([0], 2))
      expect(result.current.selectionState.selectionRange).toBeNull()
      expect(result.current.selectionState.selectionAnchor).toBeNull()
    })

    it('fullySelectedRows が正しく再マッピングされる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 4, tableColCount: 2 })
      )
      // 行0を完全選択
      act(() => result.current.selectRow(0))
      expect(result.current.selectionState.fullySelectedRows.has(0)).toBe(true)
      // 行0を行2の位置にドロップ
      act(() => result.current.updateSelectedRowsAfterMove([0], 2))
      // 再マッピングされた行が完全選択されている
      expect(result.current.selectionState.fullySelectedRows.size).toBe(1)
    })

    it('複数行を移動した場合にソートコールバックが呼ばれる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 5, tableColCount: 2 })
      )
      // 行2,0（逆順で渡してソートさせる）を選択状態にする
      act(() => result.current.selectRow(0))
      act(() => result.current.selectRow(2, true))
      // 複数行を移動
      act(() => result.current.updateSelectedRowsAfterMove([2, 0], 4))
      expect(result.current.selectionState.selectedCells.size).toBeGreaterThan(0)
    })
  })

  // ===== updateSelectedColsAfterMove =====
  describe('updateSelectedColsAfterMove', () => {
    it('列の移動後に選択状態を正しく更新する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 4 })
      )
      act(() => result.current.selectColumn(1))
      act(() => result.current.updateSelectedColsAfterMove([1], 3))
      expect(result.current.selectionState.selectedCells.size).toBe(3)
    })

    it('空の配列の場合は何もしない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectCell(0, 0))
      const before = result.current.selectionState.selectedCells
      act(() => result.current.updateSelectedColsAfterMove([], 0))
      expect(result.current.selectionState.selectedCells).toBe(before)
    })

    it('無効なインデックスの場合は何もしない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectCell(0, 0))
      const before = result.current.selectionState.selectedCells
      act(() => result.current.updateSelectedColsAfterMove([-1, 10], 0))
      expect(result.current.selectionState.selectedCells).toBe(before)
    })

    it('dropIndex が範囲外の場合は何もしない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectCell(0, 0))
      const before = result.current.selectionState.selectedCells
      act(() => result.current.updateSelectedColsAfterMove([0], -1))
      expect(result.current.selectionState.selectedCells).toBe(before)
    })

    it('dropIndex が totalCols を超える場合は何もしない', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.selectCell(0, 0))
      const before = result.current.selectionState.selectedCells
      act(() => result.current.updateSelectedColsAfterMove([0], 4))
      expect(result.current.selectionState.selectedCells).toBe(before)
    })

    it('selectionRange と selectionAnchor が null の場合でも正しく動作する', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.clearSelection())
      act(() => result.current.updateSelectedColsAfterMove([0], 2))
      expect(result.current.selectionState.selectionRange).toBeNull()
      expect(result.current.selectionState.selectionAnchor).toBeNull()
    })

    it('fullySelectedCols が正しく再マッピングされる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 2, tableColCount: 4 })
      )
      act(() => result.current.selectColumn(0))
      expect(result.current.selectionState.fullySelectedCols.has(0)).toBe(true)
      act(() => result.current.updateSelectedColsAfterMove([0], 2))
      expect(result.current.selectionState.fullySelectedCols.size).toBe(1)
    })

    it('複数列を移動した場合にソートコールバックが呼ばれる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 2, tableColCount: 5 })
      )
      // 列2,0（逆順で渡してソートさせる）を選択
      act(() => result.current.selectColumn(0))
      act(() => result.current.selectColumn(2, true))
      // 複数列を移動
      act(() => result.current.updateSelectedColsAfterMove([2, 0], 4))
      expect(result.current.selectionState.selectedCells.size).toBeGreaterThan(0)
    })
  })

  // ===== generateCellKeysInRange =====
  describe('generateCellKeysInRange (範囲選択を通じて)', () => {
    it('start > end の場合でも正しく範囲生成される', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // (2,2)を基点にして(0,0)に拡張
      act(() => result.current.selectCell(2, 2))
      act(() => result.current.selectCell(0, 0, true))
      expect(result.current.selectionState.selectedCells.size).toBe(9)
    })
  })

  // ===== setSelectionAnchor =====
  describe('setSelectionAnchor', () => {
    it('アンカーを直接設定できる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      act(() => result.current.setSelectionAnchor({ row: 1, col: 2 }))
      expect(result.current.selectionState.selectionAnchor).toEqual({ row: 1, col: 2 })
    })
  })

  // ===== extend で anchor なし・range なしの場合 =====
  describe('selectCell extend で anchor も range もない場合', () => {
    it('extend=true でも anchor/range がなければ単一セル選択になる', () => {
      const { result } = renderHook(() =>
        useSelection({ tableRowCount: 3, tableColCount: 3 })
      )
      // 初期状態（anchor=null, range=null）で extend=true
      act(() => result.current.selectCell(1, 1, true))
      // anchor も range もないので else に入り、単一セル選択
      expect(result.current.selectionState.selectedCells.has('1-1')).toBe(true)
      expect(result.current.selectionState.selectedCells.size).toBe(1)
    })
  })
})
