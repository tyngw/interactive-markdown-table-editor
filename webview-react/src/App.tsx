import { useState, useEffect, useRef } from 'react'
import TableEditor from './components/TableEditor'
import TableTabs from './components/TableTabs'
import StatusBar from './components/StatusBar'
import { StatusProvider } from './contexts/StatusContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { useVSCodeCommunication } from './hooks/useVSCodeCommunication'
import { TableData } from './types'

function AppContent() {
  const [allTables, setAllTables] = useState<TableData[]>([])
  const [currentTableIndex, setCurrentTableIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [themeRequested, setThemeRequested] = useState(false)
  const { theme, isLoaded, applyThemeVariables } = useTheme()
  const lastUpdateRef = useRef<{hash: string, time: number} | null>(null)
  const currentIndexRef = useRef(0)
  const pendingTabSwitchRef = useRef<{index: number, time: number} | null>(null)

  // Debug theme loading
  useEffect(() => {
    // Theme state tracking disabled for production
  }, [theme, isLoaded])

  const currentTableData = allTables[currentTableIndex] || null

  // Debug: Current table index
  useEffect(() => {
    console.log('📊 App: currentTableIndex updated to:', currentTableIndex);
    console.log('📊 App: Total tables:', allTables.length);
  }, [currentTableIndex, allTables.length])

  // Debug: Log when currentTableData changes to track rendering
  useEffect(() => {
    // currentTableData change tracking disabled for production
  }, [currentTableData, currentTableIndex, allTables.length])

  const { sendMessage } = useVSCodeCommunication({
    onTableData: (data: TableData | TableData[]) => {
      // Logging disabled for production
      // If too many updates arrive while a pending tab switch is stale, ignore
      const pend = pendingTabSwitchRef.current
      if (pend && Date.now() - pend.time > 2000) {
        pendingTabSwitchRef.current = null
      }
      // Debounce/ignore duplicate updates to avoid flicker
      try {
        const payload = Array.isArray(data) ? data : [data]
        const hash = JSON.stringify(payload)
        const now = Date.now()
        const last = lastUpdateRef.current
        if (last && last.hash === hash) {
          setLoading(false)
          return
        }
        lastUpdateRef.current = { hash, time: now }
      } catch (e) {
        console.warn('[MTE][React] Failed to compute payload hash', e)
      }
      if (Array.isArray(data)) {
        setAllTables(data)
        const len = data.length
        const now = Date.now()
        const pending = pendingTabSwitchRef.current
        if (pending && (now - pending.time) < 600 && pending.index >= 0 && pending.index < len) {
          setCurrentTableIndex(pending.index)
          currentIndexRef.current = pending.index
        } else {
          if (currentIndexRef.current >= len) {
            setCurrentTableIndex(0)
            currentIndexRef.current = 0
          } else {
            // Keep current index stable to avoid oscillation
            setCurrentTableIndex(currentIndexRef.current)
          }
        }
      } else {
        setAllTables([data])
        setCurrentTableIndex(0)
        currentIndexRef.current = 0
      }
      setLoading(false)
    },
    onError: (errorMessage: string) => {
      setError(errorMessage)
      setLoading(false)
    },
    onThemeVariables: (data: any) => {
      // Theme variables logging disabled for production
      applyThemeVariables(data)
    },
    onSetActiveTable: (index: number) => {
      // Immediately update the index to avoid flicker
      if (index !== currentIndexRef.current) {
        setCurrentTableIndex(index)
        currentIndexRef.current = index
        // Clear any pending tab switch since this is authoritative
        pendingTabSwitchRef.current = null
      }
    }
  })

  // タブ変更時の処理
  const handleTabChange = (index: number) => {
    
    setCurrentTableIndex(index)
    currentIndexRef.current = index
    pendingTabSwitchRef.current = { index, time: Date.now() }
    sendMessage({ command: 'switchTable', data: { index } })
  }

  useEffect(() => {
    // Debug: Check window properties when React app starts
    // 初期データをリクエスト
    sendMessage({ command: 'requestTableData' })
    
    // テーマ変数をリクエスト（一度だけ）
    if (!themeRequested) {
      sendMessage({ command: 'requestThemeVariables' })
      setThemeRequested(true)
      
      // VSCodeの初期化遅延に対応するため、少し遅延してもう一度リクエスト
      setTimeout(() => {
        sendMessage({ command: 'requestThemeVariables' })
      }, 500)
    }

    // 開発用: VSCode外でテストする場合のサンプルデータ
    if (typeof window !== 'undefined' && !(window as any).acquireVsCodeApi && allTables.length === 0) {
      // プロダクション環境では小さなサンプルデータのみ提供
      const testTables: TableData[] = [
        {
          headers: ['Name', 'Age', 'City'],
          rows: [
            ['Alice', '25', 'Tokyo'],
            ['Bob', '30', 'Osaka'],
            ['Charlie', '35', 'Kyoto']
          ]
        }
      ]
      
      setAllTables(testTables)
      setLoading(false)
    }
  }, [sendMessage, themeRequested, setThemeRequested, allTables.length])

  // keep ref in sync when state changes (covers programmatic changes)
  useEffect(() => {
    currentIndexRef.current = currentTableIndex
  }, [currentTableIndex])

  // Debug: log index and table list changes to catch oscillation
  useEffect(() => {
    // State change tracking disabled for production
  }, [currentTableIndex])

  useEffect(() => {
    // Table count tracking disabled for production  
  }, [allTables.length])



  if (loading) {
    return (
      <div className="loading">
        テーブルデータを読み込み中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="error">
        エラー: {error}
      </div>
    )
  }

  if (!currentTableData) {
    return (
      <div className="error">
        テーブルデータが見つかりません
      </div>
    )
  }

  return (
    <StatusProvider>
      <div id="mte-root">
        <div id="app">
        <TableTabs
          tables={allTables}
          currentTableIndex={currentTableIndex}
          onTabChange={handleTabChange}
        />
        <TableEditor 
          tableData={currentTableData}
          currentTableIndex={currentTableIndex}
          onTableUpdate={(updatedData) => {
            const newTables = [...allTables]
            newTables[currentTableIndex] = updatedData
            setAllTables(newTables)
          }}
          onSendMessage={sendMessage}
        />
        <StatusBar />
        </div>
      </div>
    </StatusProvider>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App