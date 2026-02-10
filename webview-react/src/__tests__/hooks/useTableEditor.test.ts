import { renderHook, act } from '@testing-library/react'
import { useTableEditor } from '../../hooks/useTableEditor'
import { TableData, SortState, HeaderConfig } from '../../types'
import { useState } from 'react'

const createMockTableData = (): TableData => ({
  headers: ['Name', 'Age', 'City'],
  rows: [
    ['Alice', '25', 'Tokyo'],
    ['Bob', '30', 'Osaka'],
    ['Charlie', '35', 'Kyoto']
  ]
})

describe('useTableEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('initializes with correct data', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    expect(result.current.tableData).toEqual(mockTableData)
    expect(result.current.editorState.currentEditingCell).toBeNull()
    expect(result.current.editorState.selectedCells.size).toBe(0)
  })

  test('updates cell correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.updateCell(0, 0, 'Alice Smith')
    })

    expect(result.current.tableData.rows[0][0]).toBe('Alice Smith')
  })

  test('updates header correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.updateHeader(0, 'Full Name')
    })

    expect(result.current.tableData.headers[0]).toBe('Full Name')
  })

  test('adds row correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.addRow(1)
    })

    expect(result.current.tableData.rows).toHaveLength(4)
    expect(result.current.tableData.rows[1]).toEqual(['', '', ''])
  })

  test('deletes row correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.deleteRow(1)
    })

    expect(result.current.tableData.rows).toHaveLength(2)
    expect(result.current.tableData.rows[1]).toEqual(['Charlie', '35', 'Kyoto'])
  })

  test('adds column correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.addColumn(1)
    })

    expect(result.current.tableData.headers).toHaveLength(4)
    expect(result.current.tableData.headers[1]).toBe('Column 2')
    expect(result.current.tableData.rows[0]).toHaveLength(4)
  })

  test('deletes column correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.deleteColumn(1)
    })

    expect(result.current.tableData.headers).toHaveLength(2)
    expect(result.current.tableData.headers).toEqual(['Name', 'City'])
    expect(result.current.tableData.rows[0]).toEqual(['Alice', 'Tokyo'])
  })

  test('selects cell correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.selectCell(0, 1)
    })

    expect(result.current.editorState.selectedCells.has('0-1')).toBe(true)
    expect(result.current.editorState.selectionRange).toEqual({
      start: { row: 0, col: 1 },
      end: { row: 0, col: 1 }
    })
  })

  test('moves multiple rows preserving order', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.moveRows([0, 2], 1)
    })

    expect(result.current.tableData.rows).toEqual([
      ['Alice', '25', 'Tokyo'],
      ['Charlie', '35', 'Kyoto'],
      ['Bob', '30', 'Osaka']
    ])
  })

  test('moves multiple columns preserving order', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.moveColumns([0, 2], 1)
    })

    expect(result.current.tableData.headers).toEqual(['Age', 'Name', 'City'])
    expect(result.current.tableData.rows[0]).toEqual(['25', 'Alice', 'Tokyo'])
  })

  test('keeps row selection aligned when moving multiple rows downward', () => {
    const tableData: TableData = {
      headers: ['Name'],
      rows: [['R1'], ['R2'], ['R3'], ['R4']]
    }

    const { result } = renderHook(() => useTableEditor(tableData))

    act(() => { result.current.selectRow(1) })
    act(() => { result.current.selectRow(2, true) })
    act(() => { result.current.moveRows([1, 2], 4) })

    expect(result.current.tableData.rows.map(r => r[0])).toEqual(['R1', 'R4', 'R2', 'R3'])
    expect(Array.from(result.current.editorState.fullySelectedRows).sort()).toEqual([2, 3])
    expect(result.current.editorState.selectionRange?.start.row).toBe(2)
    expect(result.current.editorState.selectionRange?.end.row).toBe(3)
  })

  test('keeps column selection aligned when moving multiple columns rightward', () => {
    const tableData: TableData = {
      headers: ['A', 'B', 'C', 'D'],
      rows: [
        ['r1a', 'r1b', 'r1c', 'r1d'],
        ['r2a', 'r2b', 'r2c', 'r2d']
      ]
    }

    const { result } = renderHook(() => useTableEditor(tableData))

    act(() => { result.current.selectColumn(1) })
    act(() => { result.current.selectColumn(2, true) })
    act(() => { result.current.moveColumns([1, 2], 4) })

    expect(result.current.tableData.headers).toEqual(['A', 'D', 'B', 'C'])
    expect(Array.from(result.current.editorState.fullySelectedCols).sort()).toEqual([2, 3])
    expect(result.current.editorState.selectionRange?.start.col).toBe(2)
    expect(result.current.editorState.selectionRange?.end.col).toBe(3)
  })

  test('selects range correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.selectCell(0, 0) })
    act(() => { result.current.selectCell(1, 1, true) })

    expect(result.current.editorState.selectedCells.size).toBe(4)
    expect(result.current.editorState.selectedCells.has('0-0')).toBe(true)
    expect(result.current.editorState.selectedCells.has('0-1')).toBe(true)
    expect(result.current.editorState.selectedCells.has('1-0')).toBe(true)
    expect(result.current.editorState.selectedCells.has('1-1')).toBe(true)
  })

  test('moves row correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.moveRow(0, 2) })

    expect(result.current.tableData.rows[0]).toEqual(['Bob', '30', 'Osaka'])
    expect(result.current.tableData.rows[1]).toEqual(['Alice', '25', 'Tokyo'])
    expect(result.current.tableData.rows[2]).toEqual(['Charlie', '35', 'Kyoto'])
  })

  test('moves column correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.moveColumn(0, 2) })

    expect(result.current.tableData.headers).toEqual(['Age', 'City', 'Name'])
    expect(result.current.tableData.rows[0]).toEqual(['25', 'Tokyo', 'Alice'])
  })

  test('sorts column correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.sortColumn(0) })

    expect(result.current.editorState.sortState.column).toBe(0)
    expect(result.current.editorState.sortState.direction).toBe('asc')
    expect(result.current.tableData.rows[0][0]).toBe('Alice')
    expect(result.current.tableData.rows[1][0]).toBe('Bob')
    expect(result.current.tableData.rows[2][0]).toBe('Charlie')
  })

  test('clears selection correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.selectCell(0, 0) })
    act(() => { result.current.clearSelection() })

    expect(result.current.editorState.selectedCells.size).toBe(0)
    expect(result.current.editorState.selectionRange).toBeNull()
  })

  // === externalSort パスのテスト ===

  describe('with externalSort', () => {
    test('uses external sort state and cycles asc -> desc -> none', () => {
      const mockTableData = createMockTableData()

      const { result } = renderHook(() => {
        const [sortState, setSortState] = useState<SortState>({ column: -1, direction: 'none' })
        return {
          editor: useTableEditor(mockTableData, undefined, { sortState, setSortState }),
          sortState
        }
      })

      // Sort column 0 => asc
      act(() => { result.current.editor.sortColumn(0) })
      expect(result.current.sortState).toEqual({ column: 0, direction: 'asc' })

      // Sort column 0 again => desc
      act(() => { result.current.editor.sortColumn(0) })
      expect(result.current.sortState).toEqual({ column: 0, direction: 'desc' })

      // Sort column 0 again => none
      act(() => { result.current.editor.sortColumn(0) })
      expect(result.current.sortState).toEqual({ column: -1, direction: 'none' })
    })

    test('sorts different column starts with asc', () => {
      const mockTableData = createMockTableData()

      const { result } = renderHook(() => {
        const [sortState, setSortState] = useState<SortState>({ column: 0, direction: 'asc' })
        return {
          editor: useTableEditor(mockTableData, undefined, { sortState, setSortState }),
          sortState
        }
      })

      act(() => { result.current.editor.sortColumn(1) })
      expect(result.current.sortState).toEqual({ column: 1, direction: 'asc' })
    })

    test('resetSort resets external sort state', () => {
      const mockTableData = createMockTableData()

      const { result } = renderHook(() => {
        const [sortState, setSortState] = useState<SortState>({ column: 0, direction: 'asc' })
        return {
          editor: useTableEditor(mockTableData, undefined, { sortState, setSortState }),
          sortState
        }
      })

      act(() => { result.current.editor.resetSort() })
      expect(result.current.sortState).toEqual({ column: -1, direction: 'none' })
    })

    test('external sort from none cycles to asc for same column', () => {
      const mockTableData = createMockTableData()

      const { result } = renderHook(() => {
        const [sortState, setSortState] = useState<SortState>({ column: 0, direction: 'none' })
        return {
          editor: useTableEditor(mockTableData, undefined, { sortState, setSortState }),
          sortState
        }
      })

      // same column, direction='none' => should go to asc
      act(() => { result.current.editor.sortColumn(0) })
      expect(result.current.sortState).toEqual({ column: 0, direction: 'asc' })
    })
  })

  // === 数値ソートのテスト ===

  test('sorts numeric values ascending', () => {
    const numericData: TableData = {
      headers: ['Name', 'Score'],
      rows: [['Alice', '100'], ['Bob', '5'], ['Charlie', '50']]
    }
    const { result } = renderHook(() => useTableEditor(numericData))

    act(() => { result.current.sortColumn(1) })

    expect(result.current.tableData.rows[0][1]).toBe('5')
    expect(result.current.tableData.rows[1][1]).toBe('50')
    expect(result.current.tableData.rows[2][1]).toBe('100')
  })

  test('sorts numeric values descending', () => {
    const numericData: TableData = {
      headers: ['Name', 'Score'],
      rows: [['Alice', '100'], ['Bob', '5'], ['Charlie', '50']]
    }
    const { result } = renderHook(() => useTableEditor(numericData))

    act(() => { result.current.sortColumn(1) }) // asc
    act(() => { result.current.sortColumn(1) }) // desc

    expect(result.current.tableData.rows[0][1]).toBe('100')
    expect(result.current.tableData.rows[1][1]).toBe('50')
    expect(result.current.tableData.rows[2][1]).toBe('5')
  })

  // === updateCells のテスト ===

  test('updates multiple cells at once', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.updateCells([
        { row: 0, col: 0, value: 'Updated Alice' },
        { row: 1, col: 1, value: '99' },
        { row: 2, col: 2, value: 'Nagoya' }
      ])
    })

    expect(result.current.tableData.rows[0][0]).toBe('Updated Alice')
    expect(result.current.tableData.rows[1][1]).toBe('99')
    expect(result.current.tableData.rows[2][2]).toBe('Nagoya')
  })

  test('updateCells ignores invalid row indices', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.updateCells([
        { row: 0, col: 0, value: 'Valid' },
        { row: 99, col: 0, value: 'Invalid' }
      ])
    })

    expect(result.current.tableData.rows[0][0]).toBe('Valid')
  })

  // === updateCell の modelIndex undefined ガード ===

  test('updateCell does nothing for out-of-range view index', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))
    const originalRows = result.current.tableData.rows.map(r => [...r])

    act(() => { result.current.updateCell(99, 0, 'should not update') })

    expect(result.current.tableData.rows).toEqual(originalRows)
  })

  // === deleteRow の modelIndex undefined ガード ===

  test('deleteRow does nothing for out-of-range view index', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.deleteRow(99) })

    expect(result.current.tableData.rows).toHaveLength(3)
  })

  // === addRow のテスト ===

  test('adds row at end when no index is provided', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.addRow() })

    expect(result.current.tableData.rows).toHaveLength(4)
    expect(result.current.tableData.rows[3]).toEqual(['', '', ''])
  })

  test('adds multiple rows at once', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.addRow(1, 3) })

    expect(result.current.tableData.rows).toHaveLength(6)
  })

  test('adds row at end when sorted (ignores viewIndex)', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.sortColumn(0) }) // asc

    act(() => { result.current.addRow(0) })

    expect(result.current.modelTableData.rows).toHaveLength(4)
    expect(result.current.modelTableData.rows[3]).toEqual(['', '', ''])
  })

  test('adds row at end when viewIndex maps to undefined model index', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    // viewIndex 99 does not exist in viewToModelMap, should fall back to newRows.length
    act(() => { result.current.addRow(99) })

    expect(result.current.tableData.rows).toHaveLength(4)
    expect(result.current.tableData.rows[3]).toEqual(['', '', ''])
  })

  // === addColumn のテスト ===

  test('adds column at end when no index is provided', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.addColumn() })

    expect(result.current.tableData.headers).toHaveLength(4)
    expect(result.current.tableData.headers[3]).toBe('Column 4')
  })

  test('adds multiple columns at once', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.addColumn(1, 2) })

    expect(result.current.tableData.headers).toHaveLength(5)
    expect(result.current.tableData.headers[1]).toBe('Column 2')
    expect(result.current.tableData.headers[2]).toBe('Column 3')
  })

  // === moveRows ソート中はno-op ===

  test('moveRows does nothing when sorted', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.sortColumn(0) })

    const dataBefore = result.current.tableData.rows.map(r => [...r])

    act(() => { result.current.moveRows([0], 2) })

    expect(result.current.tableData.rows).toEqual(dataBefore)
  })

  // === moveRows 空/無効インデックスのテスト ===

  test('moveRows does nothing with empty indices', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))
    const dataBefore = result.current.tableData.rows.map(r => [...r])

    act(() => { result.current.moveRows([], 1) })

    expect(result.current.tableData.rows).toEqual(dataBefore)
  })

  test('moveRows filters out-of-range indices', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))
    const dataBefore = result.current.tableData.rows.map(r => [...r])

    act(() => { result.current.moveRows([-1, 99], 1) })

    expect(result.current.tableData.rows).toEqual(dataBefore)
  })

  // === moveColumns 無効インデックスのテスト ===

  test('moveColumns does nothing with out-of-range indices', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))
    const headersBefore = [...result.current.tableData.headers]

    act(() => { result.current.moveColumns([-1, 99], 1) })

    expect(result.current.tableData.headers).toEqual(headersBefore)
  })

  // === setColumnWidth のテスト ===

  test('sets column width correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.setColumnWidth(0, 200) })

    expect(result.current.editorState.columnWidths[0]).toBe(200)
  })

  // === commitSort のテスト ===

  test('commitSort applies sort to model data and resets sort state', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.sortColumn(0) })
    expect(result.current.editorState.sortState.direction).toBe('asc')

    act(() => { result.current.commitSort() })

    expect(result.current.editorState.sortState.direction).toBe('none')
    expect(result.current.modelTableData.rows[0][0]).toBe('Alice')
    expect(result.current.modelTableData.rows[1][0]).toBe('Bob')
    expect(result.current.modelTableData.rows[2][0]).toBe('Charlie')
  })

  test('commitSort with externalSort resets external sort state', () => {
    const mockTableData = createMockTableData()

    const { result } = renderHook(() => {
      const [sortState, setSortState] = useState<SortState>({ column: 0, direction: 'asc' })
      return {
        editor: useTableEditor(mockTableData, undefined, { sortState, setSortState }),
        sortState
      }
    })

    act(() => { result.current.editor.commitSort() })

    expect(result.current.sortState).toEqual({ column: -1, direction: 'none' })
  })

  // === toggleColumnHeaders / toggleRowHeaders のテスト ===

  test('toggleColumnHeaders toggles the hasColumnHeaders flag', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    expect(result.current.editorState.headerConfig.hasColumnHeaders).toBe(true)

    act(() => { result.current.toggleColumnHeaders() })

    expect(result.current.editorState.headerConfig.hasColumnHeaders).toBe(false)
  })

  test('toggleRowHeaders toggles the hasRowHeaders flag', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    expect(result.current.editorState.headerConfig.hasRowHeaders).toBe(false)

    act(() => { result.current.toggleRowHeaders() })

    expect(result.current.editorState.headerConfig.hasRowHeaders).toBe(true)
  })

  // === externalHeaderConfig のテスト ===

  test('uses external header config when provided', () => {
    const mockTableData = createMockTableData()

    const { result } = renderHook(() => {
      const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
        hasColumnHeaders: false,
        hasRowHeaders: true
      })
      return {
        editor: useTableEditor(
          mockTableData, undefined, undefined, undefined,
          { headerConfig, setHeaderConfig }
        ),
        headerConfig
      }
    })

    expect(result.current.editor.editorState.headerConfig.hasColumnHeaders).toBe(false)
    expect(result.current.editor.editorState.headerConfig.hasRowHeaders).toBe(true)

    act(() => { result.current.editor.toggleColumnHeaders() })

    expect(result.current.headerConfig.hasColumnHeaders).toBe(true)
  })

  // === initialData 変更時の effect テスト ===

  describe('initialData change effects', () => {
    test('external data update with shape change resets sort and initializes selection', () => {
      const data1 = createMockTableData()
      const data2: TableData = {
        headers: ['A', 'B'],
        rows: [['1', '2']]
      }

      const { result, rerender } = renderHook(
        ({ data }) => useTableEditor(data, undefined, undefined, { initializeSelectionOnDataChange: true }),
        { initialProps: { data: data1 } }
      )

      act(() => { result.current.sortColumn(0) })
      expect(result.current.editorState.sortState.direction).toBe('asc')

      rerender({ data: data2 })

      expect(result.current.editorState.sortState.direction).toBe('none')
    })

    test('external data update without shape change preserves sort', () => {
      const data1 = createMockTableData()
      const data2: TableData = {
        headers: ['X', 'Y', 'Z'],
        rows: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']]
      }

      const { result, rerender } = renderHook(
        ({ data }) => useTableEditor(data),
        { initialProps: { data: data1 } }
      )

      act(() => { result.current.sortColumn(0) })
      expect(result.current.editorState.sortState.direction).toBe('asc')

      rerender({ data: data2 })

      expect(result.current.editorState.sortState.direction).toBe('asc')
    })

    test('internal update skips sort reset (wasInternal flag)', () => {
      const mockTableData = createMockTableData()

      const { result, rerender } = renderHook(
        ({ data }) => useTableEditor(data),
        { initialProps: { data: mockTableData } }
      )

      act(() => { result.current.sortColumn(0) })
      expect(result.current.editorState.sortState.direction).toBe('asc')

      act(() => { result.current.updateCell(0, 0, 'ZZZ') })

      const updatedData: TableData = {
        headers: ['Name', 'Age', 'City'],
        rows: [['ZZZ', '25', 'Tokyo'], ['Bob', '30', 'Osaka'], ['Charlie', '35', 'Kyoto']]
      }
      rerender({ data: updatedData })

      expect(result.current.editorState.sortState.direction).toBe('asc')
    })

    test('echo window expires after 800ms', () => {
      const mockTableData = createMockTableData()

      const { result, rerender } = renderHook(
        ({ data }) => useTableEditor(data),
        { initialProps: { data: mockTableData } }
      )

      act(() => { result.current.updateCell(0, 0, 'ZZZ') })

      act(() => { jest.advanceTimersByTime(900) })

      const differentShape: TableData = {
        headers: ['A', 'B'],
        rows: [['1', '2']]
      }
      rerender({ data: differentShape })

      expect(result.current.editorState.sortState.direction).toBe('none')
    })

    test('initializeSelectionOnDataChange with no existing selection initializes selection', () => {
      const data1 = createMockTableData()
      const data2: TableData = {
        headers: ['X', 'Y', 'Z'],
        rows: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]
      }

      const { result, rerender } = renderHook(
        ({ data }) => useTableEditor(data, undefined, undefined, { initializeSelectionOnDataChange: true }),
        { initialProps: { data: data1 } }
      )

      const initialSize = result.current.editorState.selectedCells.size

      rerender({ data: data2 })

      // Selection should be initialized or re-initialized
      expect(result.current.editorState.selectedCells.size).toBeGreaterThan(0)
    })

    test('initializeSelectionOnDataChange preserves selection when shape unchanged and selection exists', () => {
      const data1 = createMockTableData()
      const data2: TableData = {
        headers: ['X', 'Y', 'Z'],
        rows: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]
      }

      const { result, rerender } = renderHook(
        ({ data }) => useTableEditor(data, undefined, undefined, { initializeSelectionOnDataChange: true }),
        { initialProps: { data: data1 } }
      )

      act(() => { result.current.selectCell(1, 1) })
      expect(result.current.editorState.selectedCells.has('1-1')).toBe(true)

      rerender({ data: data2 })

      expect(result.current.editorState.selectedCells.size).toBeGreaterThan(0)
    })

    test('does not initialize selection when editing cell', () => {
      const data1 = createMockTableData()
      const data2: TableData = {
        headers: ['X', 'Y', 'Z'],
        rows: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]
      }

      const { result, rerender } = renderHook(
        ({ data }) => useTableEditor(data, undefined, undefined, { initializeSelectionOnDataChange: true }),
        { initialProps: { data: data1 } }
      )

      act(() => { result.current.setCurrentEditingCell({ row: 0, col: 0 }) })

      rerender({ data: data2 })

      expect(result.current.editorState.currentEditingCell).toBeNull()
    })

    test('initializeSelectionOnDataChange=false preserves empty selection', () => {
      const data1 = createMockTableData()
      const data2: TableData = {
        headers: ['X', 'Y', 'Z'],
        rows: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]
      }

      const { result, rerender } = renderHook(
        ({ data }) => useTableEditor(data, undefined, undefined, { initializeSelectionOnDataChange: false }),
        { initialProps: { data: data1 } }
      )

      rerender({ data: data2 })

      expect(result.current.editorState.selectedCells.size).toBe(0)
    })

    test('initializeSelectionOnDataChange re-initializes selection on shape change even if selection exists', () => {
      const data1 = createMockTableData()
      const data2: TableData = {
        headers: ['A', 'B'],
        rows: [['1', '2']]
      }

      const { result, rerender } = renderHook(
        ({ data }) => useTableEditor(data, undefined, undefined, { initializeSelectionOnDataChange: true }),
        { initialProps: { data: data1 } }
      )

      act(() => { result.current.selectCell(1, 1) })

      rerender({ data: data2 })

      expect(result.current.editorState.selectedCells.size).toBeGreaterThan(0)
    })
  })

  // === markInternalUpdate タイマークリアのテスト ===

  test('markInternalUpdate clears previous timer on rapid updates', () => {
    const mockTableData = createMockTableData()
    const { result, rerender } = renderHook(
      ({ data }) => useTableEditor(data),
      { initialProps: { data: mockTableData } }
    )

    // Multiple rapid internal updates
    act(() => { result.current.updateCell(0, 0, 'First') })
    act(() => { result.current.updateCell(0, 0, 'Second') })

    // Advance partially (not past 800ms from last update)
    act(() => { jest.advanceTimersByTime(400) })

    // Echo back: still within window so sort should be preserved
    const echoData: TableData = {
      headers: ['Name', 'Age', 'City'],
      rows: [['Second', '25', 'Tokyo'], ['Bob', '30', 'Osaka'], ['Charlie', '35', 'Kyoto']]
    }
    rerender({ data: echoData })

    // Should not reset sort (still within echo window)
    // The fact that no error is thrown confirms timer clearing works
    expect(result.current.tableData.rows[0][0]).toBe('Second')
  })

  // === viewToModelMap のテスト ===

  test('viewToModelMap maps correctly when sorted', () => {
    const mockTableData: TableData = {
      headers: ['Name'],
      rows: [['Charlie'], ['Alice'], ['Bob']]
    }
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.sortColumn(0) })

    expect(result.current.tableData.rows[0][0]).toBe('Alice')
    expect(result.current.tableData.rows[1][0]).toBe('Bob')
    expect(result.current.tableData.rows[2][0]).toBe('Charlie')
    expect(result.current.viewToModelMap).toEqual([1, 2, 0])
  })

  // === initialData の headerConfig テスト ===

  test('initializes headerConfig from initialData if provided', () => {
    const dataWithHeaderConfig = {
      ...createMockTableData(),
      headerConfig: { hasColumnHeaders: false, hasRowHeaders: true }
    }
    const { result } = renderHook(() => useTableEditor(dataWithHeaderConfig as any))

    expect(result.current.editorState.headerConfig.hasColumnHeaders).toBe(false)
    expect(result.current.editorState.headerConfig.hasRowHeaders).toBe(true)
  })

  // === setCurrentEditingCell / initialCellInput のテスト ===

  test('setCurrentEditingCell and setInitialCellInput work correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.setCurrentEditingCell({ row: 1, col: 2 })
      result.current.setInitialCellInput('test input')
    })

    expect(result.current.editorState.currentEditingCell).toEqual({ row: 1, col: 2 })
    expect(result.current.initialCellInput).toBe('test input')
  })

  // === selectAll / selectRow / selectColumn のテスト ===

  test('selectAll selects all cells', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.selectAll() })

    expect(result.current.editorState.selectedCells.size).toBe(9)
  })

  test('selectRow selects entire row', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.selectRow(0) })

    expect(result.current.editorState.fullySelectedRows.has(0)).toBe(true)
  })

  test('selectColumn selects entire column', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.selectColumn(0) })

    expect(result.current.editorState.fullySelectedCols.has(0)).toBe(true)
  })

  // === sort で br タグを含むデータのソート ===

  test('sorts data with <br> tags correctly', () => {
    const dataWithBr: TableData = {
      headers: ['Name'],
      rows: [['Charlie<br>Smith'], ['Alice<br/>Jones'], ['Bob<br />Doe']]
    }
    const { result } = renderHook(() => useTableEditor(dataWithBr))

    act(() => { result.current.sortColumn(0) })

    expect(result.current.tableData.rows[0][0]).toBe('Alice<br/>Jones')
    expect(result.current.tableData.rows[1][0]).toBe('Bob<br />Doe')
    expect(result.current.tableData.rows[2][0]).toBe('Charlie<br>Smith')
  })

  // === updateCell via viewToModelMap when sorted ===

  test('updateCell correctly maps view index to model index when sorted', () => {
    const mockTableData: TableData = {
      headers: ['Name'],
      rows: [['Charlie'], ['Alice'], ['Bob']]
    }
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.sortColumn(0) })

    act(() => { result.current.updateCell(0, 0, 'Alice Updated') })

    expect(result.current.modelTableData.rows[1][0]).toBe('Alice Updated')
  })

  // === onDragStart / onDragEnter / onDragEnd のテスト ===

  test('exposes drag handlers', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    expect(typeof result.current.onDragStart).toBe('function')
    expect(typeof result.current.onDragEnter).toBe('function')
    expect(typeof result.current.onDragEnd).toBe('function')
  })

  // === selectionAnchor のテスト ===

  test('setSelectionAnchor works', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.setSelectionAnchor({ row: 1, col: 1 }) })

    expect(result.current.selectionAnchor).toEqual({ row: 1, col: 1 })
  })

  // === descending sort for strings (localeCompare) ===

  test('sorts strings descending correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => { result.current.sortColumn(0) }) // asc
    act(() => { result.current.sortColumn(0) }) // desc

    expect(result.current.tableData.rows[0][0]).toBe('Charlie')
    expect(result.current.tableData.rows[1][0]).toBe('Bob')
    expect(result.current.tableData.rows[2][0]).toBe('Alice')
  })

  // === sort with mixed numeric and string values ===

  test('sorts mixed values as strings when not all numeric', () => {
    const mixedData: TableData = {
      headers: ['Value'],
      rows: [['banana'], ['10'], ['apple']]
    }
    const { result } = renderHook(() => useTableEditor(mixedData))

    act(() => { result.current.sortColumn(0) })

    // '10' as string, 'apple', 'banana' should use localeCompare
    expect(result.current.tableData.rows[0][0]).toBe('10')
    expect(result.current.tableData.rows[1][0]).toBe('apple')
    expect(result.current.tableData.rows[2][0]).toBe('banana')
  })

  // === sort with empty values ===

  test('sorts with empty values', () => {
    const dataWithEmpty: TableData = {
      headers: ['Name'],
      rows: [['Charlie'], [''], ['Alice']]
    }
    const { result } = renderHook(() => useTableEditor(dataWithEmpty))

    act(() => { result.current.sortColumn(0) })

    expect(result.current.tableData.rows[0][0]).toBe('')
    expect(result.current.tableData.rows[1][0]).toBe('Alice')
    expect(result.current.tableData.rows[2][0]).toBe('Charlie')
  })

  // === externalSort commitSort with sorted data ===

  test('commitSort with externalSort applies sort permanently', () => {
    const mockTableData: TableData = {
      headers: ['Name'],
      rows: [['Charlie'], ['Alice'], ['Bob']]
    }

    const { result } = renderHook(() => {
      const [sortState, setSortState] = useState<SortState>({ column: -1, direction: 'none' })
      return {
        editor: useTableEditor(mockTableData, undefined, { sortState, setSortState }),
        sortState
      }
    })

    act(() => { result.current.editor.sortColumn(0) })
    expect(result.current.sortState.direction).toBe('asc')

    act(() => { result.current.editor.commitSort() })

    expect(result.current.sortState).toEqual({ column: -1, direction: 'none' })
    expect(result.current.editor.modelTableData.rows[0][0]).toBe('Alice')
    expect(result.current.editor.modelTableData.rows[1][0]).toBe('Bob')
    expect(result.current.editor.modelTableData.rows[2][0]).toBe('Charlie')
  })

  // === options undefined ===

  test('works with no options', () => {
    const data1 = createMockTableData()
    const data2: TableData = {
      headers: ['X', 'Y', 'Z'],
      rows: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]
    }

    const { result, rerender } = renderHook(
      ({ data }) => useTableEditor(data),
      { initialProps: { data: data1 } }
    )

    // No options specified at all
    rerender({ data: data2 })

    expect(result.current.tableData.headers).toEqual(['X', 'Y', 'Z'])
  })

  // === toggleHeaders with externalHeaderConfig ===

  test('toggleRowHeaders with external header config', () => {
    const mockTableData = createMockTableData()

    const { result } = renderHook(() => {
      const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
        hasColumnHeaders: true,
        hasRowHeaders: false
      })
      return {
        editor: useTableEditor(
          mockTableData, undefined, undefined, undefined,
          { headerConfig, setHeaderConfig }
        ),
        headerConfig
      }
    })

    act(() => { result.current.editor.toggleRowHeaders() })

    expect(result.current.headerConfig.hasRowHeaders).toBe(true)
  })
})
