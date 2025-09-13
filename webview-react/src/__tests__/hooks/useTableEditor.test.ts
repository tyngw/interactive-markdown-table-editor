import { renderHook, act } from '@testing-library/react'
import { useTableEditor } from '../../hooks/useTableEditor'
import { TableData } from '../../types'

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
    // 各テストの前にモックデータをリセット
    jest.clearAllMocks()
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

  test('selects range correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.selectCell(0, 0)
    })

    act(() => {
      result.current.selectCell(1, 1, true) // extend selection
    })

    expect(result.current.editorState.selectedCells.size).toBe(4) // 2x2 range
    expect(result.current.editorState.selectedCells.has('0-0')).toBe(true)
    expect(result.current.editorState.selectedCells.has('0-1')).toBe(true)
    expect(result.current.editorState.selectedCells.has('1-0')).toBe(true)
    expect(result.current.editorState.selectedCells.has('1-1')).toBe(true)
  })

  test('moves row correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.moveRow(0, 2)
    })

    expect(result.current.tableData.rows[0]).toEqual(['Bob', '30', 'Osaka'])
    expect(result.current.tableData.rows[2]).toEqual(['Alice', '25', 'Tokyo'])
  })

  test('moves column correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.moveColumn(0, 2)
    })

    expect(result.current.tableData.headers).toEqual(['Age', 'City', 'Name'])
    expect(result.current.tableData.rows[0]).toEqual(['25', 'Tokyo', 'Alice'])
  })

  test('sorts column correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.sortColumn(0) // Sort by Name (ascending)
    })

    expect(result.current.editorState.sortState.column).toBe(0)
    expect(result.current.editorState.sortState.direction).toBe('asc')
    expect(result.current.tableData.rows[0][0]).toBe('Alice')
    expect(result.current.tableData.rows[1][0]).toBe('Bob')
    expect(result.current.tableData.rows[2][0]).toBe('Charlie')
  })

  test('clears selection correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))

    act(() => {
      result.current.selectCell(0, 0)
    })

    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.editorState.selectedCells.size).toBe(0)
    expect(result.current.editorState.selectionRange).toBeNull()
  })
})