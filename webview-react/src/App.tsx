import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import TableEditor from './components/TableEditor'
import TableTabs from './components/TableTabs'
import StatusBar from './components/StatusBar'
import { StatusProvider } from './contexts/StatusContext'
import { useDynamicTheme } from './contexts/DynamicThemeContext'
import { useCommunication } from './hooks/useCommunication'
import { getVSCodeTheme } from './styles/theme'
import { applyCssVariablesInline } from './utils/cssVariables'
import { TableData, SortState } from './types'

function AppContent() {
  const { t } = useTranslation()
  const { setTheme } = useDynamicTheme()

  const [allTables, setAllTables] = useState<TableData[]>([])
  const [currentTableIndex, setCurrentTableIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [themeRequested, setThemeRequested] = useState(false)
  const [fontSettings, setFontSettings] = useState<{ fontFamily?: string; fontSize?: number }>({})
  // テーブルごとのソート状態を上位で管理
  const [sortStates, setSortStates] = useState<SortState[]>([])
  const pendingTabSwitchRef = useRef<{index: number, time: number} | null>(null)
  const allTablesRef = useRef<TableData[]>([])
  const currentIndexRef = useRef<number>(0)
  // gitDiffデータを別管理して不正な再レンダリング防止
  const [gitDiffMap, setGitDiffMap] = useState<Map<number, any[]>>(new Map())
  // initialData 変更時に handleTableUpdate の呼び出しを無視するフラグ
  const isInitializing = useRef(false)
  // Git差分表示フラグ
  const [showGitDiff, setShowGitDiff] = useState(false)

  // refを最新の値で同期
  useEffect(() => {
    allTablesRef.current = allTables
  }, [allTables])

  useEffect(() => {
    currentIndexRef.current = currentTableIndex
  }, [currentTableIndex])

  // cを取得し、gitDiffマップから対応するデータを合成
  // updateTableDataに既にgitDiffが含まれている場合はそれを使用、
  // 含まれていない場合はgitDiffMapから取得
  // showGitDiffフラグはUI側で処理するため、ここでは常にgitDiffを含める
  const currentTableData = useMemo(() => {
    const baseTable = allTables[currentTableIndex] || null
    if (!baseTable) {
      return null
    }
    
    // baseTableに既にgitDiffが含まれている場合はそのまま返す
    if (baseTable.gitDiff) {
      return baseTable
    }
    // gitDiffマップがある場合は合成
    const gitDiff = gitDiffMap.get(currentTableIndex)
    if (gitDiff) {
      return { ...baseTable, gitDiff }
    }
    return baseTable
  }, [allTables, currentTableIndex, gitDiffMap])


  // onTableData コールバックは定義せず、通信マネージャーのハンドラーで直接状態更新
  const handleTableDataMessage = useCallback((data: TableData | TableData[]) => {
    // initialData 変更により handleTableUpdate が呼ばれることを防ぐ
    isInitializing.current = true
    
    if (Array.isArray(data)) {
      setAllTables(data)
      // 同期的に ref を更新（batch update 内で ref を更新）
      allTablesRef.current = data
      setSortStates((prev) => {
        const next = [...prev]
        for (let i = next.length; i < data.length; i++) {
          next[i] = { column: -1, direction: 'none' }
        }
        return next.slice(0, data.length)
      })
      const len = data.length
      if (currentIndexRef.current >= len) {
        setCurrentTableIndex(0)
        currentIndexRef.current = 0
      }
    } else {
      setAllTables([data])
      // 同期的に ref を更新（batch update 内で ref を更新）
      allTablesRef.current = [data]
      setSortStates([{ column: -1, direction: 'none' }])
      setCurrentTableIndex(0)
      currentIndexRef.current = 0
    }
    // テーブルデータ更新時にgitDiffMapをリセット（古いデータの遺残を防ぐ）
    setGitDiffMap(new Map())
    setLoading(false)
  }, [])

  const communication = useCommunication({
    onTableData: handleTableDataMessage,
    onGitDiffData: useCallback((diffData: Array<{tableIndex: number, gitDiff: any[]}>) => {
      // gitDiffを別状態で管理して、allTablesの参照を変えない
      setGitDiffMap(prevMap => {
        const newMap = new Map(prevMap);
        diffData.forEach(diff => {
          newMap.set(diff.tableIndex, diff.gitDiff);
        });
        return newMap;
      });
    }, []),
    onError: useCallback((errorMessage: string) => {
      console.error('[MTE][React] onError', errorMessage)
      setError(errorMessage)
      setLoading(false)
    }, []),
    onThemeVariables: useCallback((data: any) => {
      // テーマ変数を受け取り、DynamicThemeContext 経由で更新
      console.log('[MTE][React] onThemeVariables received:', data);
      const rootEl = (document.getElementById('mte-root') || document.getElementById('root') || document.documentElement) as HTMLElement;
      
      // cssTextが提供されている場合、DOMに注入してから テーマを再取得
      if (data && data.cssText) {
        try {
          // 既存のテーマ スタイル要素を探すか、新規作成
          let styleEl = document.getElementById('mte-theme-overrides');
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'mte-theme-overrides';
            document.head.appendChild(styleEl);
            console.log('[MTE][React] Created new style element for theme overrides');
          }
          // CSSテキストを設定（複数セレクタで#mte-rootと#rootの両方に定義されている）
          styleEl.textContent = data.cssText;
          console.log('[MTE][React] Applied theme CSS to DOM, cssText length:', data.cssText.length);
          console.log('[MTE][React] First 200 chars of cssText:', data.cssText.substring(0, 200));

          // スタイルタグの適用順序に依存せず確実に反映させるため、受信したCSS変数をインラインで設定する
          const applied1 = applyCssVariablesInline(data.cssText, document.documentElement);
          const applied2 = applyCssVariablesInline(data.cssText, rootEl);
          
          // 設定されたインラインスタイルの内容をログ出力
          const inlineStyleStr = document.documentElement.getAttribute('style') || '';
          console.log('[MTE][React] Applied inline CSS variables:', { 
            appliedToRoot: applied1, 
            appliedToTarget: applied2,
            targetElement: rootEl.id || 'documentElement',
            documentElementStyleLength: inlineStyleStr.length,
            firstFewVars: inlineStyleStr.substring(0, 200)
          });
          
          // StatusBar関連の変数が正しく設定されているか確認
          const statusBarBgValue = document.documentElement.style.getPropertyValue('--vscode-statusBar-background');
          const statusBarFgValue = document.documentElement.style.getPropertyValue('--vscode-statusBar-foreground');
          console.log('[MTE][React] StatusBar CSS variables on document.documentElement:', {
            statusBarBackground: statusBarBgValue || '(not set)',
            statusBarForeground: statusBarFgValue || '(not set)'
          });
        } catch (error) {
          console.error('[MTE][React] Failed to apply theme CSS:', error);
        }
      } else {
        console.log('[MTE][React] No cssText provided in theme variables, theme is set to "inherit"');
      }
      
      // CSS変数を取得し、テーマオブジェクトを再構築
      const updatedTheme = getVSCodeTheme();
      console.log('[MTE][React] Updated theme colors:', {
        editorBackground: updatedTheme.editorBackground,
        editorForeground: updatedTheme.editorForeground,
        statusBarBackground: updatedTheme.statusBarBackground,
        menuBackground: updatedTheme.menuBackground,
        menuForeground: updatedTheme.menuForeground,
        menuSelectionBackground: updatedTheme.menuSelectionBackground,
        focusBorder: updatedTheme.focusBorder,
      });
      setTheme(updatedTheme); // EmotionのThemeProviderに新しいテーマオブジェクトを渡す
      console.log('[MTE][React] Theme set via setTheme, theme should be updated in context');
    }, [setTheme]),
    onFontSettings: useCallback((data: any) => {
      if (data && (data.fontFamily || data.fontSize)) {
        setFontSettings({
          fontFamily: data.fontFamily,
          fontSize: data.fontSize
        })
        
        // Apply font settings as CSS variables on the root element
        const rootEl = (document.getElementById('mte-root') || document.getElementById('root') || document.documentElement) as HTMLElement;
        if (data.fontFamily) {
          rootEl.style.setProperty('--mte-font-family', data.fontFamily);
        }
        if (data.fontSize && data.fontSize > 0) {
          rootEl.style.setProperty('--mte-font-size', `${data.fontSize}px`);
        }
        console.log('[MTE][React] Applied font settings:', data);
      }
    }, []),
    onSetActiveTable: useCallback((index: number) => {
      // Immediately update the index to avoid flicker
      if (index !== currentIndexRef.current) {
        setCurrentTableIndex(index)
        currentIndexRef.current = index
        // Clear any pending tab switch since this is authoritative
        pendingTabSwitchRef.current = null
      }
    }, [])
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
    communication.requestTableData()

    // テーマ変数をリクエスト（一度だけ）
    if (!themeRequested) {
      communication.requestThemeVariables()
      setThemeRequested(true)

      // VSCodeの初期化遅延に対応するため、少し遅延してもう一度リクエスト
      setTimeout(() => {
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
    // 初期化フェーズ中は呼び出しを無視
    if (isInitializing.current) {
      isInitializing.current = false
      return
    }

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
    // 同期的に ref も更新
    allTablesRef.current = newTables
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
          showGitDiff={showGitDiff}
        />
        <div className="bottom-chrome">
          <TableTabs
            tables={allTables}
            currentTableIndex={currentTableIndex}
            onTabChange={handleTabChange}
          />
          <StatusBar 
            showGitDiff={showGitDiff} 
            sortState={sortStates[currentTableIndex]}
            onGitDiffToggle={(show) => {
              // ソート済み状態でgit差分表示をONにする場合、ソートを解除
              if (show && sortStates[currentTableIndex]?.direction !== 'none') {
                setSortStates((prev) => {
                  const next = [...prev]
                  next[currentTableIndex] = { column: -1, direction: 'none' }
                  return next
                })
              }
              setShowGitDiff(show)
            }}
          />
        </div>
        </div>
      </div>
    </StatusProvider>
  )
}

function App() {
  return <AppContent />
}

export default App
