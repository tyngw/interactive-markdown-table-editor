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

  test('selects pasted area after single cell paste', async () => {
    const mockSelectCell = jest.fn()
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell
    }))
    
    // 単一セルデータをモック
    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('TestData')
    
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      new Set(),
      { row: 1, col: 1 }
    )
    
    expect(pasteResult.success).toBe(true)
    expect(mockSelectCell).toHaveBeenCalledWith(1, 1) // 単一セル選択
  })

  test('selects pasted area after multi-cell paste', async () => {
    const mockSelectCell = jest.fn()
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell
    }))
    
    // 複数セルデータをモック (2x2)
    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('A\tB\nC\tD')
    
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      new Set(),
      { row: 0, col: 0 }
    )
    
    expect(pasteResult.success).toBe(true)
    expect(mockSelectCell).toHaveBeenCalledWith(0, 0) // 開始セル選択
    expect(mockSelectCell).toHaveBeenCalledWith(1, 1, true) // 終了セルまで拡張選択
  })

  test('selects pasted area after multi-cell selection paste', async () => {
    const mockSelectCell = jest.fn()
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell
    }))

    // 複数データをモック (1行3列)
    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('X\tY\tZ')

    const selectedCells = new Set(['1-0', '1-2', '2-1']) // 複数セル選択
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      selectedCells,
      null
    )

    expect(pasteResult.success).toBe(true)
    // 複数セルコピーの場合、コピーしたセル数だけ貼り付け（選択範囲を無視）
    // 1x3のデータなので (1,0) から (1,2) まで貼り付け
    expect(mockSelectCell).toHaveBeenCalledWith(1, 0) // 最初のセル
    expect(mockSelectCell).toHaveBeenCalledWith(1, 2, true) // 貼り付けた範囲の最後のセルまで拡張選択
  })

  test('pastes single cell value to all selected cells', async () => {
    const mockSelectCell = jest.fn()
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell
    }))

    // 単一セルのデータをモック
    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('Test')

    const selectedCells = new Set(['0-0', '0-1', '1-0', '1-1']) // 4セル選択
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      selectedCells,
      null
    )

    expect(pasteResult.success).toBe(true)
    // 単一セルコピーの場合、全ての選択されたセルに同じ値を貼り付け
    expect(mockUpdateCells).toHaveBeenCalledWith([
      { row: 0, col: 0, value: 'Test' },
      { row: 0, col: 1, value: 'Test' },
      { row: 1, col: 0, value: 'Test' },
      { row: 1, col: 1, value: 'Test' }
    ])
    // 選択範囲は維持される
    expect(mockSelectCell).toHaveBeenCalledWith(0, 0) // 最初のセル
    expect(mockSelectCell).toHaveBeenCalledWith(1, 1, true) // 最後のセルまで拡張選択
  })

  // パイプ文字のエスケープ処理テスト
  describe('parseTSV with pipe characters', () => {
    test('should NOT escape pipe characters when pasting data (handled by Extension)', () => {
      const { result } = renderHook(() => useClipboard())
      
      // パイプ文字を含むTSVデータ
      const tsvData = 'Column A | B\tColumn C'
      const parsed = result.current.parseTSV(tsvData)
      
      // パイプ文字はそのまま保存される（Extension側でエスケープ）
      expect(parsed).toEqual([['Column A | B', 'Column C']])
    })

    test('should handle multiple cells with pipe characters', () => {
      const { result } = renderHook(() => useClipboard())
      
      const tsvData = 'A | B\tC | D\nE | F\tG | H'
      const parsed = result.current.parseTSV(tsvData)
      
      expect(parsed).toEqual([
        ['A | B', 'C | D'],
        ['E | F', 'G | H']
      ])
    })

    test('should handle quoted cells with pipes', () => {
      const { result } = renderHook(() => useClipboard())
      
      const tsvData = '"Quoted | pipe"\tNormal | pipe'
      const parsed = result.current.parseTSV(tsvData)
      
      expect(parsed).toEqual([['Quoted | pipe', 'Normal | pipe']])
    })

    test('should handle complex data with pipes, newlines, and tabs', () => {
      const { result } = renderHook(() => useClipboard())
      
      const tsvData = '"Multi\nline | pipe"\tSimple | text'
      const parsed = result.current.parseTSV(tsvData)
      
      expect(parsed).toEqual([['Multi<br/>line | pipe', 'Simple | text']])
    })
  })
})
