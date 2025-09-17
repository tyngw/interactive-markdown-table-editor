import { renderHook } from '@testing-library/react'
import { useClipboard } from '../../hooks/useClipboard'
import { TableData } from '../../types'

const mockTableData: TableData = {
  headers: ['Name', 'Age', 'City'],
  rows: [
    ['Alice', '25', 'Tokyo'],
    ['Bob', '30', 'Osaka'],
    ['Charlie', '35', 'Kyoto']
  ]
}

// クリップボード API のモック
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue('Alice\t25\nBob\t30')
  },
  writable: true
})

describe('useClipboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('converts data to TSV correctly', () => {
    const { result } = renderHook(() => useClipboard())
    
    const data = [
      ['Alice', '25', 'Tokyo'],
      ['Bob', '30', 'Osaka']
    ]
    
    const tsv = result.current.convertToTSV(data)
    expect(tsv).toBe('Alice\t25\tTokyo\nBob\t30\tOsaka')
  })

  test('parses TSV correctly', () => {
    const { result } = renderHook(() => useClipboard())
    
    const tsv = 'Alice\t25\tTokyo\nBob\t30\tOsaka'
    const data = result.current.parseTSV(tsv)
    
    expect(data).toEqual([
      ['Alice', '25', 'Tokyo'],
      ['Bob', '30', 'Osaka']
    ])
  })

  test('parses quoted multiline with CRLF correctly', () => {
    const { result } = renderHook(() => useClipboard())
    // Windows CRLF 改行と二重引用符で囲まれたセル内改行
    const tsv = 'Name\tDesc\r\nAlice\t"line1\r\nline2"'
    const data = result.current.parseTSV(tsv)
    expect(data).toEqual([
      ['Name', 'Desc'],
      ['Alice', 'line1<br/>line2']
    ])
  })

  test('parses quoted multiline with lone CR correctly', () => {
    const { result } = renderHook(() => useClipboard())
    // 古いMac形式などの CR 改行
    const tsv = 'A\tB\rX\t"L1\rL2"'
    const data = result.current.parseTSV(tsv)
    expect(data).toEqual([
      ['A', 'B'],
      ['X', 'L1<br/>L2']
    ])
  })

  test('parses consecutive quoted multiline cells correctly', () => {
    const { result } = renderHook(() => useClipboard())
    // 連続する引用符付き多行セル（ユーザーが報告した問題のケース）
    const tsv = '"test\ntest"\t"test\ntest"'
    const data = result.current.parseTSV(tsv)
    expect(data).toEqual([
      ['test<br/>test', 'test<br/>test']
    ])
  })

  test('parses complex multiline TSV with multiple rows correctly', () => {
    const { result } = renderHook(() => useClipboard())
    // 複数行の複雑なケース
    const tsv = '"cell1\nline2"\t"cell2\nline2"\n"row2col1"\t"row2\nwith\nnewlines"'
    const data = result.current.parseTSV(tsv)
    expect(data).toEqual([
      ['cell1<br/>line2', 'cell2<br/>line2'],
      ['row2col1', 'row2<br/>with<br/>newlines']
    ])
  })

  test('gets selected cells data correctly', () => {
    const { result } = renderHook(() => useClipboard())
    
    const selectedCells = new Set(['0-0', '0-1', '1-0', '1-1'])
    const selectionRange = {
      start: { row: 0, col: 0 },
      end: { row: 1, col: 1 }
    }
    
    const data = result.current.getSelectedCellsData(
      mockTableData,
      selectedCells,
      selectionRange
    )
    
    expect(data).toEqual([
      ['Alice', '25'],
      ['Bob', '30']
    ])
  })

  test('copies to clipboard successfully', async () => {
    const { result } = renderHook(() => useClipboard())
    
    const selectedCells = new Set(['0-0', '0-1'])
    const selectionRange = {
      start: { row: 0, col: 0 },
      end: { row: 0, col: 1 }
    }
    
    const success = await result.current.copyToClipboard(
      mockTableData,
      selectedCells,
      selectionRange
    )
    
    expect(success).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Alice\t25')
  })

  test('pastes from clipboard successfully', async () => {
    const { result } = renderHook(() => useClipboard())
    
    const currentCell = { row: 0, col: 0 }
    const data = await result.current.pasteFromClipboard(currentCell)
    
    expect(data).toEqual([
      ['Alice', '25'],
      ['Bob', '30']
    ])
    expect(navigator.clipboard.readText).toHaveBeenCalled()
  })

  test('handles empty selection gracefully', () => {
    const { result } = renderHook(() => useClipboard())
    
    const selectedCells = new Set<string>()
    const selectionRange = null
    
    const data = result.current.getSelectedCellsData(
      mockTableData,
      selectedCells,
      selectionRange
    )
    
    expect(data).toEqual([])
  })

  test('handles clipboard errors gracefully', async () => {
    const { result } = renderHook(() => useClipboard())
    
    // クリップボード API がエラーを投げるようにモック
    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error('Clipboard access denied')
    )
    
    const selectedCells = new Set(['0-0'])
    const selectionRange = {
      start: { row: 0, col: 0 },
      end: { row: 0, col: 0 }
    }
    
    const success = await result.current.copyToClipboard(
      mockTableData,
      selectedCells,
      selectionRange
    )
    
    expect(success).toBe(false)
  })
})