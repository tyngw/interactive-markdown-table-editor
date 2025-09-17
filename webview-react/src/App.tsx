import { useState, useEffect, useRef, useCallback } from 'react'
import TableEditor from './components/TableEditor'
import TableTabs from './components/TableTabs'
import StatusBar from './components/StatusBar'
import { StatusProvider } from './contexts/StatusContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { useVSCodeCommunication } from './hooks/useVSCodeCommunication'
import { TableData, SortState } from './types'

function AppContent() {
  console.log('[React] AppContent initializing...')
  const [allTables, setAllTables] = useState<TableData[]>([])
  const [currentTableIndex, setCurrentTableIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [themeRequested, setThemeRequested] = useState(false)
  // テーブルごとのソート状態を上位で管理
  const [sortStates, setSortStates] = useState<SortState[]>([])
  const { theme, isLoaded, applyThemeVariables } = useTheme()
  const lastUpdateRef = useRef<{hash: string, time: number} | null>(null)
  const currentIndexRef = useRef(0)
  const pendingTabSwitchRef = useRef<{index: number, time: number} | null>(null)
  const allTablesRef = useRef<TableData[]>([])

  // refを最新の値で同期
  useEffect(() => {
    allTablesRef.current = allTables
  }, [allTables])

  useEffect(() => {
    currentIndexRef.current = currentTableIndex
  }, [currentTableIndex])

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
        // テーブル数に応じて sortStates を整列
        setSortStates((prev) => {
          const next = [...prev]
          for (let i = next.length; i < data.length; i++) {
            next[i] = { column: -1, direction: 'none' }
          }
          return next.slice(0, data.length)
        })
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
  setSortStates([{ column: -1, direction: 'none' }])
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

  // 開発用: VSCode外でテストする場合のサンプルデータ（DEV ビルドのみ）
  if (import.meta.env?.DEV && typeof window !== 'undefined' && !(window as any).acquireVsCodeApi && allTables.length === 0) {
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

  // onTableUpdateコールバックを安定化して無限ループを防ぐ
  const handleTableUpdate = useCallback((updatedData: TableData) => {
    // refから最新の値を取得（依存配列から除外してコールバックを安定化）
    const currentTables = allTablesRef.current
    const currentIdx = currentIndexRef.current
    
    // データが実際に変更されているかチェック（無限ループ防止）
    const currentData = currentTables[currentIdx]
    if (currentData && JSON.stringify(currentData) === JSON.stringify(updatedData)) {
      console.log('[App] Skipping table update - no actual changes')
      return
    }
    
    console.log('[App] Applying table update - changes detected')
    const newTables = [...currentTables]
    newTables[currentIdx] = updatedData
    setAllTables(newTables)
  }, []) // 依存配列を空にしてコールバックを完全に安定化

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
          onTableUpdate={handleTableUpdate}
          onSendMessage={sendMessage}
          sortState={sortStates[currentTableIndex]}
          setSortState={(updater) => {
            setSortStates((prev) => {
              const next = [...prev]
              const current = prev[currentTableIndex] ?? { column: -1, direction: 'none' }
              next[currentTableIndex] = typeof updater === 'function' ? (updater as any)(current) : updater
              return next
            })
          }}
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