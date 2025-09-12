import { useCallback, useEffect } from 'react'
import { VSCodeMessage, TableData } from '../types'

interface VSCodeCommunicationCallbacks {
  onTableData?: (data: TableData | TableData[]) => void
  onError?: (error: string) => void
  onSuccess?: (message: string) => void
  onThemeVariables?: (data: any) => void
  onSetActiveTable?: (index: number) => void
}

export function useVSCodeCommunication(callbacks: VSCodeCommunicationCallbacks) {
  const { onTableData, onError, onSuccess, onThemeVariables, onSetActiveTable } = callbacks

  // VSCodeにメッセージを送信
  const sendMessage = useCallback((message: VSCodeMessage) => {
    console.log('🚀 React: Sending message to VSCode:', message.command);
    console.log('📦 React: Message data:', JSON.stringify(message.data, null, 2));
    
    if (window.vscode) {
      window.vscode.postMessage(message)
    } else {
      console.warn('VSCode API not available')
    }
  }, [])

  // VSCodeからのメッセージを受信
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      console.log('React: Received message from VSCode:', message.command, message)

      switch (message.command) {
        case 'updateTableData':
          if (onTableData) {
            // VSCodeから送られてくるデータ構造をそのまま渡す
            if (Array.isArray(message.data)) {
              // 複数テーブルの場合
              onTableData(message.data)
            } else if (message.data && message.data.headers && message.data.rows) {
              // 単一テーブルの場合
              onTableData(message.data)
            }
          }
          break

        case 'error':
          if (onError) {
            onError(message.message || 'Unknown error')
          }
          break

        case 'success':
          if (onSuccess) {
            onSuccess(message.message || 'Success')
          }
          break

        case 'cellUpdateError':
          if (onError) {
            onError(`Cell update failed: ${message.data?.error || 'Unknown error'}`)
          }
          break

        case 'headerUpdateError':
          if (onError) {
            onError(`Header update failed: ${message.data?.error || 'Unknown error'}`)
          }
          break

        case 'applyThemeVariables':
          if (onThemeVariables && message.data) {
            onThemeVariables(message.data)
          }
          break

        case 'setActiveTable':
          if (onSetActiveTable && message.data && typeof message.data.index === 'number') {
            onSetActiveTable(message.data.index)
          }
          break

        default:
          console.log('Unknown message from VSCode:', message)
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [onTableData, onError, onSuccess, onThemeVariables, onSetActiveTable])

  return { sendMessage }
}