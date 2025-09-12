import { useState, useEffect } from 'react'
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

  // Debug theme loading
  useEffect(() => {
    console.log('=== APP DEBUG: Theme state changed ===')
    console.log('Theme loaded:', isLoaded)
    console.log('Theme object keys:', Object.keys(theme))
    console.log('Sample theme values:', {
      'editor.background': theme['editor.background'],
      'sideBar.background': theme['sideBar.background'],
      'panel.border': theme['panel.border']
    })
  }, [theme, isLoaded])

  const currentTableData = allTables[currentTableIndex] || null

  const { sendMessage } = useVSCodeCommunication({
    onTableData: (data: TableData | TableData[]) => {
      if (Array.isArray(data)) {
        setAllTables(data)
        // 現在のインデックスが範囲外の場合は0にリセット
        if (currentTableIndex >= data.length) {
          setCurrentTableIndex(0)
        }
      } else {
        setAllTables([data])
        setCurrentTableIndex(0)
      }
      setLoading(false)
    },
    onError: (errorMessage: string) => {
      setError(errorMessage)
      setLoading(false)
    },
    onThemeVariables: (data: any) => {
      console.log('=== APP DEBUG: Received theme variables from VSCode ===', data)
      applyThemeVariables(data)
    }
  })

  // タブ変更時の処理
  const handleTabChange = (index: number) => {
    setCurrentTableIndex(index)
    sendMessage({ command: 'switchTable', data: { index } })
  }

  useEffect(() => {
    // Debug: Check window properties when React app starts
    console.log('=== REACT APP DEBUG: App started ===')
    console.log('window.cssUri:', (window as any).cssUri)
    console.log('All window properties containing "css":', 
      Object.keys(window).filter(key => key.toLowerCase().includes('css')))
    
    // 初期データをリクエスト
    sendMessage({ command: 'requestTableData' })
    
    // テーマ変数をリクエスト（一度だけ）
    if (!themeRequested) {
      console.log('=== REACT APP DEBUG: Requesting theme variables (initial) ===')
      sendMessage({ command: 'requestThemeVariables' })
      setThemeRequested(true)
      
      // VSCodeの初期化遅延に対応するため、少し遅延してもう一度リクエスト
      setTimeout(() => {
        console.log('=== REACT APP DEBUG: Requesting theme variables (backup) ===')
        sendMessage({ command: 'requestThemeVariables' })
      }, 500)
    }
  }, [sendMessage, themeRequested, setThemeRequested])

  // Debug: Periodically check CSS variables
  useEffect(() => {
    const checkCSSVariables = () => {
      const computedStyle = getComputedStyle(document.documentElement)
      const vars = [
        '--vscode-editor-background',
        '--vscode-sideBar-background',
        '--vscode-panel-border',
        '--vscode-list-activeSelectionBackground'
      ]
      
      console.log('=== PERIODIC CSS CHECK ===')
      vars.forEach(varName => {
        const value = computedStyle.getPropertyValue(varName).trim()
        console.log(`${varName}: "${value}"`)
      })
      
      // Also check if external CSS is loaded
      const links = document.querySelectorAll('link[rel="stylesheet"]')
      console.log('Loaded stylesheets:', Array.from(links).map(link => (link as HTMLLinkElement).href))
    }
    
    // Check immediately and then every 5 seconds for the first minute
    checkCSSVariables()
    const interval = setInterval(checkCSSVariables, 5000)
    
    // Stop checking after 1 minute
    setTimeout(() => clearInterval(interval), 60000)
    
    return () => clearInterval(interval)
  }, [])

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