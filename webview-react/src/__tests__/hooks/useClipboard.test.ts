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

  // --- ここから追加テスト ---

  // L93-94: parseTSV のエスケープされたクォート（""）処理
  test('parseTSV handles escaped double quotes inside quoted cell', () => {
    const { result } = renderHook(() => useClipboard())
    // クォート内の "" はリテラルの " に変換される
    const tsv = '"She said ""hi"""\tEnd'
    const data = result.current.parseTSV(tsv)
    expect(data).toEqual([['She said "hi"', 'End']])
  })

  // L93-94: parseTSV のファイル終端処理（引用符付きセルがファイル末尾に来るケース）
  test('parseTSV handles quoted cell at end of input without trailing newline', () => {
    const { result } = renderHook(() => useClipboard())
    const tsv = 'A\t"B\nC"'
    const data = result.current.parseTSV(tsv)
    expect(data).toEqual([['A', 'B<br/>C']])
  })

  // L150: copySelectedCells 内の catch (copyToClipboard 経由)
  // 既存テスト 'handles clipboard errors gracefully' がL150をカバーしているはずだが、
  // consoleエラーも検証
  test('copySelectedCells logs error on clipboard failure', async () => {
    const { result } = renderHook(() => useClipboard())
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error('Copy denied')
    )

    const selectedCells = new Set(['0-0'])
    const selectionRange = { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }

    const success = await result.current.copyToClipboard(
      mockTableData,
      selectedCells,
      selectionRange
    )
    expect(success).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to copy selected cells to clipboard:',
      expect.any(Error)
    )
    consoleSpy.mockRestore()
  })

  // L155-160: copyEntireTable 正常系
  test('copyEntireTable copies all data with headers', async () => {
    const { result } = renderHook(() => useClipboard())

    const success = await result.current.copyEntireTable(mockTableData, true)
    expect(success).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Name\tAge\tCity\nAlice\t25\tTokyo\nBob\t30\tOsaka\nCharlie\t35\tKyoto'
    )
  })

  // L155-160: copyEntireTable ヘッダー無し
  test('copyEntireTable copies data without headers', async () => {
    const { result } = renderHook(() => useClipboard())

    const success = await result.current.copyEntireTable(mockTableData, false)
    expect(success).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Alice\t25\tTokyo\nBob\t30\tOsaka\nCharlie\t35\tKyoto'
    )
  })

  // copyEntireTable エラー系
  test('copyEntireTable returns false on clipboard error', async () => {
    const { result } = renderHook(() => useClipboard())
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error('Access denied')
    )

    const success = await result.current.copyEntireTable(mockTableData)
    expect(success).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to copy entire table to clipboard:',
      expect.any(Error)
    )
    consoleSpy.mockRestore()
  })

  // L167-177: pasteFromClipboard レガシー互換パス（1引数 {row, col} 呼び出し）
  test('pasteFromClipboard legacy path with single {row, col} argument', async () => {
    const { result } = renderHook(() => useClipboard())

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('X\tY\nZ\tW')

    const data = await result.current.pasteFromClipboard({ row: 2, col: 3 })
    expect(data).toEqual([
      ['X', 'Y'],
      ['Z', 'W']
    ])
  })

  // L205: 空のTSVデータガード（空白のみのクリップボード）
  test('pasteFromClipboard returns failure for whitespace-only clipboard', async () => {
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
    }))

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('   ')

    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      new Set(),
      null
    )
    expect(pasteResult.success).toBe(false)
    expect(pasteResult.message).toBe('クリップボードにデータがありません')
  })

  // L205: 空文字列のクリップボード
  test('pasteFromClipboard returns failure for empty clipboard', async () => {
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
    }))

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('')

    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      new Set(),
      null
    )
    expect(pasteResult.success).toBe(false)
    expect(pasteResult.message).toBe('クリップボードにデータがありません')
  })

  // L210: selectionRange も currentEditingCell も null の場合のフォールバック
  test('pasteFromClipboard falls back to {row:0, col:0} when no selection or editing cell', async () => {
    const mockUpdateCells = jest.fn()
    const mockSelectCell = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell,
    }))

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('Hello')

    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,        // selectionRange = null
      new Set(),   // selectedCells は空
      null         // currentEditingCell = null
    )
    expect(pasteResult.success).toBe(true)
    // フォールバックで (0,0) に貼り付け
    expect(mockUpdateCells).toHaveBeenCalledWith([
      { row: 0, col: 0, value: 'Hello' }
    ])
  })

  // L210: selectionRange がある場合はその start を使用
  test('pasteFromClipboard uses selectionRange start as paste position', async () => {
    const mockUpdateCells = jest.fn()
    const mockSelectCell = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell,
    }))

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('Data')

    const selectionRange = { start: { row: 2, col: 1 }, end: { row: 2, col: 1 } }
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      selectionRange,
      new Set(),
      null
    )
    expect(pasteResult.success).toBe(true)
    expect(mockUpdateCells).toHaveBeenCalledWith([
      { row: 2, col: 1, value: 'Data' }
    ])
  })

  // L216 + L321: 複数セル選択 + 複数セルペーストの範囲選択
  test('pasteFromClipboard multi-cell paste to multi-cell selection calls selectCell for range', async () => {
    const mockSelectCell = jest.fn()
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell,
    }))

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('A\tB\nC\tD')

    // 2セル以上選択状態
    const selectedCells = new Set(['0-0', '0-1'])
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      selectedCells,
      null
    )
    expect(pasteResult.success).toBe(true)
    // 選択範囲の最初のセルから2x2貼り付け
    expect(mockUpdateCells).toHaveBeenCalledWith([
      { row: 0, col: 0, value: 'A' },
      { row: 0, col: 1, value: 'B' },
      { row: 1, col: 0, value: 'C' },
      { row: 1, col: 1, value: 'D' },
    ])
    // 2x2 なので range 選択
    expect(mockSelectCell).toHaveBeenCalledWith(0, 0)
    expect(mockSelectCell).toHaveBeenCalledWith(1, 1, true)
  })

  // L216: 複数セル選択ペーストで単一セル値を単一セルに貼り付け（selectCell のsortedCells.length===1パス）
  test('pasteFromClipboard single cell paste to exactly one selected cell', async () => {
    const mockSelectCell = jest.fn()
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell,
    }))

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('Val')

    // selectedCells.size > 1 だが、ソートしたとき 2つのセル
    const selectedCells = new Set(['1-1', '2-2'])
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      selectedCells,
      null
    )
    expect(pasteResult.success).toBe(true)
    expect(mockUpdateCells).toHaveBeenCalledWith([
      { row: 1, col: 1, value: 'Val' },
      { row: 2, col: 2, value: 'Val' },
    ])
    // 単一セルコピーで複数選択の場合、範囲を維持
    expect(mockSelectCell).toHaveBeenCalledWith(1, 1)
    expect(mockSelectCell).toHaveBeenCalledWith(2, 2, true)
  })

  // L292: rowIndex < 0 のガード（ヘッダー行 row=-1 からの貼り付けで正常動作を確認）
  test('pasteFromClipboard allows row=-1 (header row) paste', async () => {
    const mockUpdateCells = jest.fn()
    const mockSelectCell = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell,
    }))

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('NewHeader')

    const selectionRange = { start: { row: -1, col: 0 }, end: { row: -1, col: 0 } }
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      selectionRange,
      new Set(),
      null
    )
    expect(pasteResult.success).toBe(true)
    // row=-1 は許可される
    expect(mockUpdateCells).toHaveBeenCalledWith([
      { row: -1, col: 0, value: 'NewHeader' }
    ])
  })

  // L351-352: ペースト処理中の catch
  test('pasteFromClipboard returns failure on readText error (4-arg path)', async () => {
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
    }))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    ;(navigator.clipboard.readText as jest.Mock).mockRejectedValueOnce(
      new Error('Read denied')
    )

    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      new Set(),
      null
    )
    expect(pasteResult.success).toBe(false)
    expect(pasteResult.message).toBe('ペースト処理中にエラーが発生しました')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to paste from clipboard:',
      expect.any(Error)
    )
    consoleSpy.mockRestore()
  })

  // getSelectedCellsData ヘッダー行（row = -1）のカバー
  test('getSelectedCellsData returns header data when row is -1', () => {
    const { result } = renderHook(() => useClipboard())

    const selectedCells = new Set(['-1-0', '-1-1', '-1-2'])
    const selectionRange = {
      start: { row: -1, col: 0 },
      end: { row: -1, col: 2 }
    }
    const data = result.current.getSelectedCellsData(
      mockTableData,
      selectedCells,
      selectionRange
    )
    expect(data).toEqual([['Name', 'Age', 'City']])
  })

  // copySelectedCells で空選択の場合 false を返す
  test('copySelectedCells returns false for empty selection', async () => {
    const { result } = renderHook(() => useClipboard())

    const success = await result.current.copyToClipboard(
      mockTableData,
      new Set(),
      null
    )
    expect(success).toBe(false)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  // convertToTSV で <br/> を含むセル
  test('convertToTSV converts br tags to newlines in TSV output', () => {
    const { result } = renderHook(() => useClipboard())
    const data = [['line1<br/>line2', 'simple']]
    const tsv = result.current.convertToTSV(data)
    // セル内改行はクォートされる
    expect(tsv).toBe('"line1\nline2"\tsimple')
  })

  // parseTSV: エスケープされたクォート ("")
  test('parseTSV handles escaped quotes correctly', () => {
    const { result } = renderHook(() => useClipboard())
    const tsv = '"He said ""hello"""\tplain'
    const data = result.current.parseTSV(tsv)
    expect(data).toEqual([['He said "hello"', 'plain']])
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

  // Branch L43: headers[col] が undefined の場合のフォールバック
  test('getSelectedCellsData returns empty string for out-of-range header columns', () => {
    const { result } = renderHook(() => useClipboard())

    const sparseTableData: TableData = {
      headers: ['H1'],  // 1列しかない
      rows: [['R1']]
    }
    // col=0 と col=1 を選択 (col=1 は headers に存在しない)
    const selectedCells = new Set(['-1-0', '-1-1'])
    const selectionRange = {
      start: { row: -1, col: 0 },
      end: { row: -1, col: 1 }
    }
    const data = result.current.getSelectedCellsData(
      sparseTableData,
      selectedCells,
      selectionRange
    )
    // headers[1] は undefined → '' にフォールバック
    expect(data).toEqual([['H1', '']])
  })

  // Branch L44: rows[row]?.[col] が undefined の場合のフォールバック
  test('getSelectedCellsData returns empty string for out-of-range row columns', () => {
    const { result } = renderHook(() => useClipboard())

    const sparseTableData: TableData = {
      headers: ['H1', 'H2'],
      rows: [['R1']]  // 1列しかない行
    }
    const selectedCells = new Set(['0-0', '0-1'])
    const selectionRange = {
      start: { row: 0, col: 0 },
      end: { row: 0, col: 1 }
    }
    const data = result.current.getSelectedCellsData(
      sparseTableData,
      selectedCells,
      selectionRange
    )
    // rows[0][1] は undefined → '' にフォールバック
    expect(data).toEqual([['R1', '']])
  })

  // Function 0-2 (defaultDeps): デフォルト deps の関数がペースト時に呼ばれることを確認
  test('pasteFromClipboard with default deps calls updateCells (no-op)', async () => {
    const { result } = renderHook(() => useClipboard())

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('DefaultTest')

    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      new Set(),
      { row: 0, col: 0 }
    )
    // defaultDeps の updateCells は no-op なのでエラーにならない
    expect(pasteResult.success).toBe(true)
  })

  // Branch L201: selectedCells が undefined/null の場合の ?? 0
  test('pasteFromClipboard handles undefined selectedCells gracefully', async () => {
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
    }))

    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('Test')

    // selectedCells を undefined として渡す（型キャストが必要）
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      undefined as any,
      { row: 0, col: 0 }
    )
    expect(pasteResult.success).toBe(true)
  })

  // Branch L226: pastedData[0]?.length が falsy の場合の || 0
  // これは pastedData が [[]] のような空行を持つ場合だが、parseTSV のフィルタで除外される
  // → istanbul ignore を追加するか、ソースをモックせずに到達は困難

  // Branch L253: pastedData の行の列数が不揃いの場合の || '' フォールバック
  test('pasteFromClipboard handles jagged paste data with fallback to empty string', async () => {
    const mockSelectCell = jest.fn()
    const mockUpdateCells = jest.fn()
    const { result } = renderHook(() => useClipboard({
      addRow: () => {},
      addColumn: () => {},
      updateCells: mockUpdateCells,
      selectCell: mockSelectCell,
    }))

    // 1行目は2列、2行目は1列 → pasteCols=2, colOffset=1 で pastedData[1][1] は undefined → ''
    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValueOnce('A\tB\nC')

    const selectedCells = new Set(['0-0', '0-1', '1-0'])
    const pasteResult = await result.current.pasteFromClipboard(
      mockTableData,
      null,
      selectedCells,
      null
    )
    expect(pasteResult.success).toBe(true)
    // 複数セルコピー → 複数セル選択: 選択範囲の先頭から貼り付け
    expect(mockUpdateCells).toHaveBeenCalledWith([
      { row: 0, col: 0, value: 'A' },
      { row: 0, col: 1, value: 'B' },
      { row: 1, col: 0, value: 'C' },
      { row: 1, col: 1, value: '' },  // フォールバック
    ])
  })
})
