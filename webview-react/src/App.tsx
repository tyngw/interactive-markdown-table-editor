import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import TableEditor from './components/TableEditor'
import TableTabs from './components/TableTabs'
import StatusBar from './components/StatusBar'
import { StatusProvider } from './contexts/StatusContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { useCommunication } from './hooks/useCommunication'
import { TableData, SortState } from './types'

function AppContent() {
  const { t } = useTranslation()

  const [allTables, setAllTables] = useState<TableData[]>([])
  const [currentTableIndex, setCurrentTableIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [themeRequested, setThemeRequested] = useState(false)
  const [fontSettings, setFontSettings] = useState<{ fontFamily?: string; fontSize?: number }>({})
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


  const communication = useCommunication({
    onTableData: (data: TableData | TableData[]) => {
      console.log('[MTE][React] onTableData received', {
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 1,
        timestamp: Date.now()
      })
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
      console.log('[MTE][React] onTableData handled', {
        loading: false,
        tableCount: Array.isArray(data) ? data.length : 1
      })
    },
    onGitDiffData: (diffData: Array<{tableIndex: number, gitDiff: any[]}>) => {
      console.log('[MTE][React] onGitDiffData received', diffData);
      setAllTables(prevTables => {
        const newTables = [...prevTables];
        diffData.forEach(diff => {
          if (newTables[diff.tableIndex]) {
            newTables[diff.tableIndex] = {
              ...newTables[diff.tableIndex],
              gitDiff: diff.gitDiff,
            };
          }
        });
        return newTables;
      });
    },
    onError: (errorMessage: string) => {
      console.error('[MTE][React] onError', errorMessage)
      setError(errorMessage)
      setLoading(false)
    },
    onThemeVariables: (data: any) => {
      console.log('[MTE][React] onThemeVariables received', {
        keys: data && typeof data === 'object' ? Object.keys(data) : null
      })
      // Theme variables logging disabled for production
      applyThemeVariables(data)
    },
    onFontSettings: (data: any) => {
      console.log('[MTE][React] onFontSettings received', data)
      if (data && (data.fontFamily || data.fontSize)) {
        setFontSettings({
          fontFamily: data.fontFamily,
          fontSize: data.fontSize
        })
      }
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
    communication.switchTable(index)
  }

  useEffect(() => {
    // Debug: Check window properties when React app starts
    // 初期データをリクエスト
    console.log('[MTE][React] requesting initial table data');
    communication.requestTableData()

    // テーマ変数をリクエスト（一度だけ）
    if (!themeRequested) {
      console.log('[MTE][React] requesting theme variables (initial)');
      communication.requestThemeVariables()
      setThemeRequested(true)

      // VSCodeの初期化遅延に対応するため、少し遅延してもう一度リクエスト
      setTimeout(() => {
        console.log('[MTE][React] requesting theme variables (delayed retry)');
        communication.requestThemeVariables()
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 初期化は1回だけ実行

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

  // Apply font settings to CSS custom properties
  useEffect(() => {
    const root = document.documentElement
    if (fontSettings.fontFamily) {
      root.style.setProperty('--mte-font-family', fontSettings.fontFamily)
    } else {
      root.style.removeProperty('--mte-font-family')
    }
    if (fontSettings.fontSize && fontSettings.fontSize > 0) {
      root.style.setProperty('--mte-font-size', `${fontSettings.fontSize}px`)
    } else {
      root.style.removeProperty('--mte-font-size')
    }
  }, [fontSettings])

  // onTableUpdateコールバックを安定化して無限ループを防ぐ
  const handleTableUpdate = useCallback((updatedData: TableData) => {
    // refから最新の値を取得（依存配列から除外してコールバックを安定化）
    const currentTables = allTablesRef.current
    const currentIdx = currentIndexRef.current

    // データが実際に変更されているかチェック（無限ループ防止）
    const currentData = currentTables[currentIdx]
    if (currentData && JSON.stringify(currentData) === JSON.stringify(updatedData)) {
      return
    }

    const newTables = [...currentTables]
    newTables[currentIdx] = updatedData
    setAllTables(newTables)
  }, []) // 依存配列を空にしてコールバックを完全に安定化

  if (loading) {
    return (
      <div className="loading">
        {t('loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="error">
        {t('error', { message: error })}
      </div>
    )
  }

  if (!currentTableData) {
    return (
      <div className="error">
        {t('noTableData')}
      </div>
    )
  }

  return (
    <StatusProvider>
      <div id="mte-root">
        <div id="app">
        <TableEditor
          tableData={currentTableData}
          currentTableIndex={currentTableIndex}
          allTables={allTables}
          onTableUpdate={handleTableUpdate}
          onSendMessage={communication.sendMessage}
          onTableSwitch={handleTabChange}
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
        <div className="bottom-chrome">
          <TableTabs
            tables={allTables}
            currentTableIndex={currentTableIndex}
            onTabChange={handleTabChange}
          />
          <StatusBar />
        </div>
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
