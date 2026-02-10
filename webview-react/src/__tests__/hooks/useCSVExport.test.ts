import { renderHook } from '@testing-library/react'
import { useCSVExport } from '../../hooks/useCSVExport'
import { TableData } from '../../types'

describe('useCSVExport', () => {
  const mockTableData: TableData = {
    headers: ['Name', 'Description', 'Notes'],
    rows: [
      ['Alice', 'Simple text', 'Normal note'],
      ['Bob', 'Multi<br/>line<br/>text', 'Has breaks'],
      ['Charlie', 'Text with, comma', 'Special chars']
    ]
  }

  describe('generateCSVContent', () => {
    it('should convert br tags to newlines in CSV output', () => {
      const { result } = renderHook(() => useCSVExport())
      const csvContent = result.current.generateCSVContent(mockTableData)
      
      // brタグが改行コードに変換されていることを確認
      expect(csvContent).toContain('Multi\nline\ntext')
      expect(csvContent).not.toContain('<br/>')
      expect(csvContent).not.toContain('<br>')
    })

    it('should quote fields with commas', () => {
      const { result } = renderHook(() => useCSVExport())
      const csvContent = result.current.generateCSVContent(mockTableData)
      
      expect(csvContent).toContain('"Text with, comma"')
    })

    it('should quote fields with newlines', () => {
      const { result } = renderHook(() => useCSVExport())
      const csvContent = result.current.generateCSVContent(mockTableData)
      
      expect(csvContent).toContain('"Multi\nline\ntext"')
    })

    it('should escape double quotes', () => {
      const tableData: TableData = {
        headers: ['Name'],
        rows: [['Text with "quotes"']]
      }
      
      const { result } = renderHook(() => useCSVExport())
      const csvContent = result.current.generateCSVContent(tableData)
      
      expect(csvContent).toContain('"Text with ""quotes"""')
    })

    it('should handle empty cells', () => {
      const tableData: TableData = {
        headers: ['A', 'B', 'C'],
        rows: [['', 'value', '']]
      }
      
      const { result } = renderHook(() => useCSVExport())
      const csvContent = result.current.generateCSVContent(tableData)
      
      expect(csvContent).toContain(',value,')
    })
  })

  describe('generateTSVContent', () => {
    it('should convert br tags to newlines in TSV output', () => {
      const { result } = renderHook(() => useCSVExport())
      const tsvContent = result.current.generateTSVContent(mockTableData)
      
      // brタグが改行コードに変換されていることを確認
      expect(tsvContent).toContain('Multi\nline\ntext')
      expect(tsvContent).not.toContain('<br/>')
      expect(tsvContent).not.toContain('<br>')
    })

    it('null/undefinedセルを空文字列として処理する', () => {
      const tableData: TableData = {
        headers: ['A', 'B'],
        rows: [[null as unknown as string, undefined as unknown as string]]
      }
      const { result } = renderHook(() => useCSVExport())
      const tsvContent = result.current.generateTSVContent(tableData)

      // null/undefinedは空文字列に変換される
      expect(tsvContent).toContain('\t')
    })

    it('should use tabs as delimiters', () => {
      const { result } = renderHook(() => useCSVExport())
      const tsvContent = result.current.generateTSVContent(mockTableData)
      
      expect(tsvContent).toContain('\t')
      expect(tsvContent.split('\n')[0]).toContain('Name\tDescription\tNotes')
    })

    it('should quote fields with tabs', () => {
      const tableData: TableData = {
        headers: ['Name'],
        rows: [['Text with\ttab']]
      }
      
      const { result } = renderHook(() => useCSVExport())
      const tsvContent = result.current.generateTSVContent(tableData)
      
      expect(tsvContent).toContain('"Text with\ttab"')
    })

    it('should quote fields with newlines', () => {
      const { result } = renderHook(() => useCSVExport())
      const tsvContent = result.current.generateTSVContent(mockTableData)
      
      expect(tsvContent).toContain('"Multi\nline\ntext"')
    })
  })

  describe('generateFileName', () => {
    it('should generate filename with timestamp for CSV', () => {
      const { result } = renderHook(() => useCSVExport())
      const filename = result.current.generateFileName('test', 'csv')
      
      expect(filename).toMatch(/^test_\d{8}T\d{6}\.csv$/)
    })

    it('should generate filename with timestamp for TSV', () => {
      const { result } = renderHook(() => useCSVExport())
      const filename = result.current.generateFileName('test', 'tsv')
      
      expect(filename).toMatch(/^test_\d{8}T\d{6}\.tsv$/)
    })

    it('should use default name when baseName is not provided', () => {
      const { result } = renderHook(() => useCSVExport())
      const filename = result.current.generateFileName(undefined, 'csv')
      
      expect(filename).toMatch(/^table_export_\d{8}T\d{6}\.csv$/)
    })

    it('引数なしでデフォルトのCSVファイル名を生成する', () => {
      const { result } = renderHook(() => useCSVExport())
      const filename = result.current.generateFileName()
      
      expect(filename).toMatch(/^table_export_\d{8}T\d{6}\.csv$/)
    })
  })

  describe('exportToCSV', () => {
    it('should send correct message to VSCode', () => {
      const messages: any[] = []
      const mockSendMessage = (msg: any) => messages.push(msg)
      
      const { result } = renderHook(() => useCSVExport())
      result.current.exportToCSV(mockTableData, mockSendMessage, 'test.csv', 'utf8')
      
      expect(messages).toHaveLength(1)
      expect(messages[0].command).toBe('exportCSV')
      expect(messages[0].data.filename).toBe('test.csv')
      expect(messages[0].data.encoding).toBe('utf8')
      expect(messages[0].data.csvContent).toContain('Multi\nline\ntext')
    })

    it('should handle Shift_JIS encoding', () => {
      const messages: any[] = []
      const mockSendMessage = (msg: any) => messages.push(msg)
      
      const { result } = renderHook(() => useCSVExport())
      result.current.exportToCSV(mockTableData, mockSendMessage, 'test.csv', 'sjis')
      
      expect(messages[0].data.encoding).toBe('sjis')
    })
  })

  describe('exportToTSV', () => {
    it('should send correct message to VSCode', () => {
      const messages: any[] = []
      const mockSendMessage = (msg: any) => messages.push(msg)
      
      const { result } = renderHook(() => useCSVExport())
      result.current.exportToTSV(mockTableData, mockSendMessage, 'test.tsv', 'utf8')
      
      expect(messages).toHaveLength(1)
      expect(messages[0].command).toBe('exportCSV')
      expect(messages[0].data.filename).toBe('test.tsv')
      expect(messages[0].data.csvContent).toContain('\t')
      expect(messages[0].data.csvContent).toContain('Multi\nline\ntext')
    })
  })

  describe('exportToCSV - エラーハンドリング', () => {
    it('エラーが発生した場合はfalseを返す', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()
      const mockSendMessage = jest.fn().mockImplementation(() => {
        throw new Error('Send failed')
      })

      const { result } = renderHook(() => useCSVExport())
      const ret = result.current.exportToCSV(mockTableData, mockSendMessage)

      expect(ret).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith('CSV export failed:', expect.any(Error))
      errorSpy.mockRestore()
    })
  })

  describe('exportToTSV - エラーハンドリング', () => {
    it('エラーが発生した場合はfalseを返す', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()
      const mockSendMessage = jest.fn().mockImplementation(() => {
        throw new Error('Send failed')
      })

      const { result } = renderHook(() => useCSVExport())
      const ret = result.current.exportToTSV(mockTableData, mockSendMessage)

      expect(ret).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith('TSV export failed:', expect.any(Error))
      errorSpy.mockRestore()
    })
  })

  describe('downloadAsFile', () => {
    it('ファイルをダウンロードしてtrueを返す', () => {
      // URL.createObjectURL と revokeObjectURL のモック
      const mockUrl = 'blob:mock-url'
      const originalCreateObjectURL = URL.createObjectURL
      const originalRevokeObjectURL = URL.revokeObjectURL
      URL.createObjectURL = jest.fn().mockReturnValue(mockUrl)
      URL.revokeObjectURL = jest.fn()

      const { result } = renderHook(() => useCSVExport())
      const ret = result.current.downloadAsFile('csv,content', 'test.csv', 'text/csv')

      expect(ret).toBe(true)
      expect(URL.createObjectURL).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl)

      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
    })

    it('エラーが発生した場合はfalseを返す', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()
      const originalCreateObjectURL = URL.createObjectURL
      URL.createObjectURL = jest.fn().mockImplementation(() => {
        throw new Error('createObjectURL failed')
      })

      const { result } = renderHook(() => useCSVExport())
      const ret = result.current.downloadAsFile('content', 'test.csv')

      expect(ret).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith('File download failed:', expect.any(Error))

      URL.createObjectURL = originalCreateObjectURL
      errorSpy.mockRestore()
    })
  })
})
