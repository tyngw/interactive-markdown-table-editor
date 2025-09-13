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

describe('useTableEditor (Simple)', () => {
  test('initializes correctly', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))
    
    expect(result.current.tableData).toEqual(mockTableData)
    expect(result.current.editorState.currentEditingCell).toBeNull()
  })

  test('updates cell', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))
    
    act(() => {
      result.current.updateCell(0, 0, 'Alice Smith')
    })
    
    expect(result.current.tableData.rows[0][0]).toBe('Alice Smith')
  })

  test('adds row', () => {
    const mockTableData = createMockTableData()
    const { result } = renderHook(() => useTableEditor(mockTableData))
    
    const initialRowCount = result.current.tableData.rows.length
    
    act(() => {
      result.current.addRow()
    })
    
    expect(result.current.tableData.rows).toHaveLength(initialRowCount + 1)
  })
})