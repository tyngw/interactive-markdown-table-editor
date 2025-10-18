import { useCallback } from 'react'
import { TableData, VSCodeMessage } from '../types'
import { convertBrTagsToNewlines, escapeCSVField, escapeTSVField } from '../utils/contentConverter'

export function useCSVExport() {
  // CSVコンテンツを生成
  const generateCSVContent = useCallback((tableData: TableData): string => {
    const { headers, rows } = tableData
    
    // ヘッダー行を追加
    const csvRows = [headers]
    
    // データ行を追加
    csvRows.push(...rows)
    
    // CSV形式に変換（カンマ区切り、必要に応じてクォート）
    return csvRows.map(row => 
      row.map(cell => {
        // <br/>タグを改行コードに変換してからエスケープ
        const cellStr = convertBrTagsToNewlines(String(cell || ''))
        return escapeCSVField(cellStr)
      }).join(',')
    ).join('\n')
  }, [])

  // TSV形式でエクスポート（Excelとの互換性向上）
  const generateTSVContent = useCallback((tableData: TableData): string => {
    const { headers, rows } = tableData
    
    const tsvRows = [headers, ...rows]
    
    return tsvRows.map(row => 
      row.map(cell => {
        // <br/>タグを改行コードに変換してからエスケープ
        const cellStr = convertBrTagsToNewlines(String(cell || ''))
        return escapeTSVField(cellStr)
      }).join('\t')
    ).join('\n')
  }, [])

  // ファイル名を生成
  const generateFileName = useCallback((
    baseName?: string, 
    format: 'csv' | 'tsv' = 'csv'
  ): string => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    const base = baseName || 'table_export'
    return `${base}_${timestamp}.${format}`
  }, [])

  // CSVエクスポートを実行
  const exportToCSV = useCallback((
    tableData: TableData,
    onSendMessage: (message: VSCodeMessage) => void,
    fileName?: string,
    encoding: string = 'utf8'
  ) => {
    try {
      const csvContent = generateCSVContent(tableData)
      const finalFileName = fileName || generateFileName(undefined, 'csv')
      
      // VSCodeにエクスポート要求を送信
      onSendMessage({
        command: 'exportCSV',
        data: {
          csvContent,
          filename: finalFileName,
          encoding
        }
      })
      
      return true
    } catch (error) {
      console.error('CSV export failed:', error)
      return false
    }
  }, [generateCSVContent, generateFileName])

  // TSVエクスポートを実行
  const exportToTSV = useCallback((
    tableData: TableData,
    onSendMessage: (message: VSCodeMessage) => void,
    fileName?: string,
    encoding: string = 'utf8'
  ) => {
    try {
      const tsvContent = generateTSVContent(tableData)
      const finalFileName = fileName || generateFileName(undefined, 'tsv')
      
      // VSCodeにエクスポート要求を送信
      onSendMessage({
        command: 'exportCSV',
        data: {
          csvContent: tsvContent,
          filename: finalFileName,
          encoding
        }
      })
      
      return true
    } catch (error) {
      console.error('TSV export failed:', error)
      return false
    }
  }, [generateTSVContent, generateFileName])

  // ブラウザでダウンロード（フォールバック）
  const downloadAsFile = useCallback((
    content: string,
    fileName: string,
    mimeType: string = 'text/csv'
  ) => {
    try {
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      URL.revokeObjectURL(url)
      return true
    } catch (error) {
      console.error('File download failed:', error)
      return false
    }
  }, [])

  return {
    generateCSVContent,
    generateTSVContent,
    generateFileName,
    exportToCSV,
    exportToTSV,
    downloadAsFile
  }
}