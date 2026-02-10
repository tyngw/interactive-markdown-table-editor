/**
 * App.test.tsx
 * Appコンポーネントのテスト
 * ローディング状態、エラー表示、テーブルデータ表示、タブ切り替え、
 * Ctrl+S手動保存、テーマ変数適用、フォント設定、setSortState、
 * onGitDiffToggle、onAutoSaveToggle を検証
 */

import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DynamicThemeProvider } from '../contexts/DynamicThemeContext'

// useCommunicationのモック
const mockSendMessage = jest.fn()
const mockSwitchTable = jest.fn()
const mockRequestTableData = jest.fn()
const mockNotifyReady = jest.fn()
const mockRequestThemeVariables = jest.fn()
const mockManualSave = jest.fn()
const mockToggleAutoSave = jest.fn()
const mockRequestFontSettings = jest.fn()

let capturedCallbacks: any = {}

jest.mock('../hooks/useCommunication', () => ({
  useCommunication: (callbacks: any) => {
    capturedCallbacks = callbacks
    return {
      sendMessage: mockSendMessage,
      switchTable: mockSwitchTable,
      requestTableData: mockRequestTableData,
      notifyReady: mockNotifyReady,
      requestThemeVariables: mockRequestThemeVariables,
      manualSave: mockManualSave,
      toggleAutoSave: mockToggleAutoSave,
      requestFontSettings: mockRequestFontSettings,
      isConnected: true,
    }
  }
}))

// cssVariablesのモック
jest.mock('../utils/cssVariables', () => ({
  applyCssVariablesInline: jest.fn().mockReturnValue(0)
}))

jest.mock('../i18n', () => {})

// 子コンポーネントをモックしてpropsをキャプチャ
let capturedTableEditorProps: any = {}
let capturedStatusBarProps: any = {}
let capturedTableTabsProps: any = {}

jest.mock('../components/TableEditor', () => ({
  __esModule: true,
  default: (props: any) => {
    capturedTableEditorProps = props
    return <div data-testid="mock-table-editor">TableEditor</div>
  }
}))

jest.mock('../components/StatusBar', () => ({
  __esModule: true,
  default: (props: any) => {
    capturedStatusBarProps = props
    return <div data-testid="mock-status-bar">StatusBar</div>
  }
}))

jest.mock('../components/TableTabs', () => ({
  __esModule: true,
  default: (props: any) => {
    capturedTableTabsProps = props
    return <div data-testid="mock-table-tabs">TableTabs</div>
  }
}))

import App from '../App'

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedCallbacks = {}
    capturedTableEditorProps = {}
    capturedStatusBarProps = {}
    capturedTableTabsProps = {}
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    jest.useFakeTimers()
    // クリーンアップ
    document.documentElement.removeAttribute('style')
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    const styleEl = document.getElementById('mte-theme-overrides')
    if (styleEl) styleEl.remove()
  })

  const renderApp = () => {
    return render(
      <DynamicThemeProvider>
        <App />
      </DynamicThemeProvider>
    )
  }

  /** テーブルデータをセットしてローディング解除するヘルパー */
  const setupWithTableData = (data?: any) => {
    renderApp()
    act(() => {
      capturedCallbacks.onTableData(
        data || { headers: ['H1', 'H2'], rows: [['a', 'b']] }
      )
    })
  }

  /** 複数テーブルをセットしてローディング解除するヘルパー */
  const setupWithMultipleTables = () => {
    renderApp()
    act(() => {
      capturedCallbacks.onTableData([
        { headers: ['H1', 'H2'], rows: [['a', 'b']] },
        { headers: ['H3', 'H4'], rows: [['c', 'd']] },
      ])
    })
  }

  describe('ローディング状態', () => {
    it('初期状態でローディングメッセージが表示される', () => {
      renderApp()
      expect(screen.getByText('テーブルデータを読み込み中...')).toBeInTheDocument()
    })

    it('初期化時にrequestTableDataが呼ばれる', () => {
      renderApp()
      expect(mockRequestTableData).toHaveBeenCalled()
    })

    it('初期化時にnotifyReadyが呼ばれる', () => {
      renderApp()
      expect(mockNotifyReady).toHaveBeenCalled()
    })

    it('初期化時にrequestThemeVariablesが呼ばれる', () => {
      renderApp()
      expect(mockRequestThemeVariables).toHaveBeenCalled()
    })
  })

  describe('エラー表示', () => {
    it('エラーが発生した場合にエラーメッセージが表示される', () => {
      renderApp()
      act(() => {
        capturedCallbacks.onError('テスト用エラー')
      })
      expect(screen.getByText('エラー: テスト用エラー')).toBeInTheDocument()
    })
  })

  describe('テーブルデータ表示', () => {
    it('テーブルデータ受信後にローディングが消える', () => {
      setupWithTableData()
      expect(screen.queryByText('テーブルデータを読み込み中...')).not.toBeInTheDocument()
    })

    it('配列形式のテーブルデータを受信できる', () => {
      setupWithMultipleTables()
      expect(screen.queryByText('テーブルデータを読み込み中...')).not.toBeInTheDocument()
    })

    it('テーブルが空の場合にnoTableDataメッセージが表示される', () => {
      renderApp()
      act(() => {
        capturedCallbacks.onTableData([])
      })
      expect(screen.getByText('テーブルデータが見つかりません')).toBeInTheDocument()
    })

    it('単一オブジェクトにcolumnDiffが含まれる場合に処理される', () => {
      renderApp()
      act(() => {
        capturedCallbacks.onTableData({
          headers: ['H1'],
          rows: [['v1']],
          columnDiff: { oldColumnCount: 1, newColumnCount: 2, addedColumns: [1], deletedColumns: [] }
        })
      })
      expect(screen.queryByText('テーブルデータを読み込み中...')).not.toBeInTheDocument()
    })

    it('単一オブジェクトにgitDiffが含まれる場合に処理される', () => {
      renderApp()
      act(() => {
        capturedCallbacks.onTableData({
          headers: ['H1'],
          rows: [['v1']],
          gitDiff: [{ row: 0, status: 'added' }]
        })
      })
      expect(screen.queryByText('テーブルデータを読み込み中...')).not.toBeInTheDocument()
    })

    it('配列形式のテーブルデータ内のgitDiff/columnDiffが保存される', () => {
      renderApp()
      act(() => {
        capturedCallbacks.onTableData([
          {
            headers: ['H1'],
            rows: [['v1']],
            gitDiff: [{ row: 0, status: 'added' }],
            columnDiff: { oldColumnCount: 1, newColumnCount: 2, addedColumns: [1], deletedColumns: [] }
          },
          { headers: ['H2'], rows: [['v2']] }
        ])
      })
      expect(screen.queryByText('テーブルデータを読み込み中...')).not.toBeInTheDocument()
    })

    it('currentTableIndexが配列長を超える場合に0にリセットされる', () => {
      setupWithMultipleTables()
      act(() => {
        capturedCallbacks.onSetActiveTable(1)
      })
      act(() => {
        capturedCallbacks.onTableData([
          { headers: ['Only'], rows: [['one']] }
        ])
      })
      expect(screen.getByTestId('mock-table-editor')).toBeInTheDocument()
    })
  })

  describe('onSuccessコールバック', () => {
    it('save started フェーズを処理する', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onSuccess({ data: { kind: 'save', phase: 'started' } })
      })
    })

    it('save completed フェーズを処理する', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onSuccess({ data: { kind: 'save', phase: 'completed' } })
      })
    })

    it('save skipped フェーズを処理する', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onSuccess({ data: { kind: 'save', phase: 'skipped' } })
      })
    })

    it('不正なデータでもエラーが発生しない', () => {
      setupWithTableData()
      expect(() => {
        act(() => {
          capturedCallbacks.onSuccess(null)
        })
      }).not.toThrow()
    })

    it('save以外のkindでもエラーが発生しない', () => {
      setupWithTableData()
      expect(() => {
        act(() => {
          capturedCallbacks.onSuccess({ data: { kind: 'other' } })
        })
      }).not.toThrow()
    })
  })

  describe('autoSave状態', () => {
    it('onAutoSaveStateChangedでautoSave状態が変更される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onAutoSaveStateChanged(false)
      })
      expect(capturedStatusBarProps.autoSaveEnabled).toBe(false)
    })
  })

  describe('dirty状態', () => {
    it('onDirtyStateChangedでdirty状態が変更される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onAutoSaveStateChanged(false)
      })
      act(() => {
        capturedCallbacks.onDirtyStateChanged(true)
      })
      expect(capturedStatusBarProps.isDirty).toBe(true)
    })
  })

  describe('Ctrl+Sキーボードショートカット', () => {
    it('autoSave無効かつdirtyの場合にCtrl+Sで手動保存される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onAutoSaveStateChanged(false)
        capturedCallbacks.onDirtyStateChanged(true)
      })
      fireEvent.keyDown(window, { key: 's', ctrlKey: true })
      expect(mockManualSave).toHaveBeenCalled()
    })

    it('autoSave有効の場合はCtrl+Sで手動保存されない', () => {
      setupWithTableData()
      fireEvent.keyDown(window, { key: 's', ctrlKey: true })
      expect(mockManualSave).not.toHaveBeenCalled()
    })

    it('metaKey(Cmd)でも手動保存される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onAutoSaveStateChanged(false)
        capturedCallbacks.onDirtyStateChanged(true)
      })
      fireEvent.keyDown(window, { key: 's', metaKey: true })
      expect(mockManualSave).toHaveBeenCalled()
    })

    it('dirtyでない場合はCtrl+Sで手動保存されない', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onAutoSaveStateChanged(false)
      })
      fireEvent.keyDown(window, { key: 's', ctrlKey: true })
      expect(mockManualSave).not.toHaveBeenCalled()
    })
  })

  describe('gitDiffデータ', () => {
    it('onGitDiffDataでgitDiffデータが設定される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onGitDiffData([
          { tableIndex: 0, gitDiff: [{ row: 0, status: 'modified' }] }
        ])
      })
    })

    it('columnDiff付きのgitDiffデータも処理できる', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onGitDiffData([
          { tableIndex: 0, gitDiff: [], columnDiff: { oldColumnCount: 1, newColumnCount: 2, addedColumns: [1], deletedColumns: [] } }
        ])
      })
    })
  })

  describe('onSetActiveTable', () => {
    it('テーブルインデックスが変更される', () => {
      setupWithMultipleTables()
      act(() => {
        capturedCallbacks.onSetActiveTable(1)
      })
      expect(capturedTableEditorProps.currentTableIndex).toBe(1)
    })

    it('同じインデックスの場合は変更されない', () => {
      setupWithMultipleTables()
      act(() => {
        capturedCallbacks.onSetActiveTable(0)
      })
      expect(capturedTableEditorProps.currentTableIndex).toBe(0)
    })
  })

  describe('フォント設定', () => {
    it('onFontSettingsでフォント設定が適用される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onFontSettings({
          fontFamily: 'Fira Code',
          fontSize: 16
        })
      })
      const root = document.documentElement
      expect(root.style.getPropertyValue('--mte-font-family')).toBe('Fira Code')
      expect(root.style.getPropertyValue('--mte-font-size')).toBe('16px')
    })

    it('フォント設定がnullの場合はエラーにならない', () => {
      setupWithTableData()
      expect(() => {
        act(() => {
          capturedCallbacks.onFontSettings(null)
        })
      }).not.toThrow()
    })

    it('fontFamilyのみの設定も適用される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onFontSettings({ fontFamily: 'Monospace' })
      })
      const root = document.documentElement
      expect(root.style.getPropertyValue('--mte-font-family')).toBe('Monospace')
    })

    it('fontSizeのみの設定も適用される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onFontSettings({ fontSize: 14 })
      })
      const root = document.documentElement
      expect(root.style.getPropertyValue('--mte-font-size')).toBe('14px')
    })
  })

  describe('fontSettings useEffect', () => {
    it('fontSettingsが空の場合CSS変数がremovePropertyされる', () => {
      const root = document.documentElement
      root.style.setProperty('--mte-font-family', 'test')
      root.style.setProperty('--mte-font-size', '20px')
      setupWithTableData()
      // 初期fontSettingsは空なので、removePropertyが呼ばれているはず
      expect(root.style.getPropertyValue('--mte-font-family')).toBe('')
      expect(root.style.getPropertyValue('--mte-font-size')).toBe('')
    })
  })

  describe('テーマ変数', () => {
    it('onThemeVariablesでcssTextが適用される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onThemeVariables({
          cssText: '#mte-root { --vscode-editor-background: #2d2d2d; }'
        })
      })
      const styleEl = document.getElementById('mte-theme-overrides')
      expect(styleEl).not.toBeNull()
    })

    it('cssTextなしのテーマ変数でもエラーにならない', () => {
      setupWithTableData()
      expect(() => {
        act(() => {
          capturedCallbacks.onThemeVariables({})
        })
      }).not.toThrow()
    })

    it('nullデータでもエラーにならない', () => {
      setupWithTableData()
      expect(() => {
        act(() => {
          capturedCallbacks.onThemeVariables(null)
        })
      }).not.toThrow()
    })

    it('既存のstyle要素がある場合は再利用される', () => {
      const existingStyle = document.createElement('style')
      existingStyle.id = 'mte-theme-overrides'
      document.head.appendChild(existingStyle)

      setupWithTableData()
      act(() => {
        capturedCallbacks.onThemeVariables({
          cssText: '#mte-root { --vscode-editor-background: #1e1e1e; }'
        })
      })
      const styleEl = document.getElementById('mte-theme-overrides')
      expect(styleEl).not.toBeNull()
      expect(styleEl!.textContent).toContain('#1e1e1e')
    })

    it('vscode-sideBar-foreground が設定済みの場合はデフォルト値を上書きしない', () => {
      setupWithTableData()
      // applyCssVariablesInlineのモック実装を変更して、CSS変数を実際に設定する
      const { applyCssVariablesInline } = require('../utils/cssVariables')
      applyCssVariablesInline.mockImplementation((cssText: string, el: HTMLElement) => {
        el.style.setProperty('--vscode-sideBar-foreground', '#ff0000')
        el.style.setProperty('--vscode-descriptionForeground', '#00ff00')
        return 2
      })
      act(() => {
        capturedCallbacks.onThemeVariables({
          cssText: ':root { --vscode-sideBar-foreground: #ff0000; --vscode-descriptionForeground: #00ff00; }'
        })
      })
      // 値が既に設定されているので、デフォルト値（#cccccc, #a6a6a6）で上書きされない
      expect(document.documentElement.style.getPropertyValue('--vscode-sideBar-foreground')).toBe('#ff0000')
      expect(document.documentElement.style.getPropertyValue('--vscode-descriptionForeground')).toBe('#00ff00')
      // モックを元に戻す
      applyCssVariablesInline.mockReturnValue(0)
    })

    it('vscode-descriptionForeground が未設定の場合はデフォルト値が設定される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onThemeVariables({
          cssText: ':root { --vscode-editor-background: #2d2d2d; }'
        })
      })
      // デフォルト値が設定される
      expect(document.documentElement.style.getPropertyValue('--vscode-descriptionForeground')).toBe('#a6a6a6')
    })
  })

  describe('遅延初期化', () => {
    it('500ms後にnotifyReadyが再度呼ばれる', () => {
      renderApp()
      expect(mockNotifyReady).toHaveBeenCalledTimes(1)
      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(mockNotifyReady).toHaveBeenCalledTimes(2)
    })

    it('500ms後にrequestThemeVariablesが再度呼ばれる', () => {
      renderApp()
      expect(mockRequestThemeVariables).toHaveBeenCalledTimes(1)
      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(mockRequestThemeVariables).toHaveBeenCalledTimes(2)
    })

    it('requestFontSettingsが初期化時と遅延後に呼ばれる', () => {
      renderApp()
      expect(mockRequestFontSettings).toHaveBeenCalledTimes(1)
      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(mockRequestFontSettings).toHaveBeenCalledTimes(2)
    })
  })

  describe('handleTabChange', () => {
    it('タブ変更でswitchTableが呼ばれる', () => {
      setupWithMultipleTables()
      act(() => {
        capturedTableTabsProps.onTabChange(1)
      })
      expect(mockSwitchTable).toHaveBeenCalledWith(1)
    })

    it('TableEditorのonTableSwitchでもタブ変更される', () => {
      setupWithMultipleTables()
      act(() => {
        capturedTableEditorProps.onTableSwitch(1)
      })
      expect(mockSwitchTable).toHaveBeenCalledWith(1)
    })

    it('タブ変更後にcurrentTableIndexが更新される', () => {
      setupWithMultipleTables()
      act(() => {
        capturedTableTabsProps.onTabChange(1)
      })
      expect(capturedTableEditorProps.currentTableIndex).toBe(1)
    })
  })

  describe('handleTableUpdate', () => {
    it('テーブルデータが変更された場合に更新される', () => {
      setupWithTableData({ headers: ['H1'], rows: [['old']] })
      // onTableDataでisInitializing=trueが設定されるので、
      // 最初のonTableUpdate呼び出しはフラグをクリアするだけ
      act(() => {
        capturedTableEditorProps.onTableUpdate({ headers: ['H1'], rows: [['dummy']] })
      })
      // 2回目の呼び出しで実際の更新が行われる
      act(() => {
        capturedTableEditorProps.onTableUpdate({
          headers: ['H1'],
          rows: [['new']]
        })
      })
      expect(capturedTableEditorProps.tableData.rows[0][0]).toBe('new')
    })

    it('同じデータの場合は更新されない（無限ループ防止）', () => {
      const data = { headers: ['H1'], rows: [['val']] }
      setupWithTableData(data)
      // isInitializingフラグをクリア
      act(() => {
        capturedTableEditorProps.onTableUpdate({ headers: ['H1'], rows: [['dummy']] })
      })
      // 現在のデータに戻す
      act(() => {
        capturedTableEditorProps.onTableUpdate({ headers: ['H1'], rows: [['val2']] })
      })
      // 同じデータを送る → 更新されない
      const prevTableData = capturedTableEditorProps.tableData
      act(() => {
        capturedTableEditorProps.onTableUpdate({ headers: ['H1'], rows: [['val2']] })
      })
      expect(capturedTableEditorProps.tableData).toBe(prevTableData)
    })

    it('初期化中のhandleTableUpdate呼び出しは無視される', () => {
      setupWithTableData({ headers: ['H1'], rows: [['original']] })
      // isInitializingフラグがtrueの状態でonTableUpdateを呼ぶ
      // (setupWithTableDataのonTableDataでtrueに設定済み)
      act(() => {
        capturedTableEditorProps.onTableUpdate({ headers: ['H1'], rows: [['should_be_ignored']] })
      })
      // 初期化中なのでデータは元のまま
      expect(capturedTableEditorProps.tableData.rows[0][0]).toBe('original')
    })
  })

  describe('setSortState コールバック', () => {
    it('関数型updaterでsortStateが更新される', () => {
      setupWithTableData()
      act(() => {
        capturedTableEditorProps.setSortState((prev: any) => ({
          column: 0,
          direction: 'asc'
        }))
      })
      expect(capturedTableEditorProps.sortState).toEqual({
        column: 0,
        direction: 'asc'
      })
    })

    it('オブジェクト型updaterでsortStateが更新される', () => {
      setupWithTableData()
      act(() => {
        capturedTableEditorProps.setSortState({
          column: 1,
          direction: 'desc'
        })
      })
      expect(capturedTableEditorProps.sortState).toEqual({
        column: 1,
        direction: 'desc'
      })
    })
  })

  describe('onGitDiffToggle コールバック', () => {
    it('git差分表示をONにできる', () => {
      setupWithTableData()
      act(() => {
        capturedStatusBarProps.onGitDiffToggle(true)
      })
      expect(capturedStatusBarProps.showGitDiff).toBe(true)
    })

    it('git差分表示をOFFにできる', () => {
      setupWithTableData()
      act(() => {
        capturedStatusBarProps.onGitDiffToggle(true)
      })
      act(() => {
        capturedStatusBarProps.onGitDiffToggle(false)
      })
      expect(capturedStatusBarProps.showGitDiff).toBe(false)
    })

    it('ソート済み状態でgit差分表示をONにするとソートが解除される', () => {
      setupWithTableData()
      act(() => {
        capturedTableEditorProps.setSortState({
          column: 0,
          direction: 'asc'
        })
      })
      act(() => {
        capturedStatusBarProps.onGitDiffToggle(true)
      })
      expect(capturedTableEditorProps.sortState).toEqual({
        column: -1,
        direction: 'none'
      })
      expect(capturedStatusBarProps.showGitDiff).toBe(true)
    })
  })

  describe('onAutoSaveToggle コールバック', () => {
    it('autoSaveトグルでtoggleAutoSaveが呼ばれる', () => {
      setupWithTableData()
      act(() => {
        capturedStatusBarProps.onAutoSaveToggle(false)
      })
      expect(mockToggleAutoSave).toHaveBeenCalledWith(false)
    })
  })

  describe('currentTableData の合成', () => {
    it('gitDiffMapからgitDiffが合成される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onGitDiffData([
          { tableIndex: 0, gitDiff: [{ row: 0, status: 'modified' }] }
        ])
      })
      expect(capturedTableEditorProps.tableData.gitDiff).toEqual([
        { row: 0, status: 'modified' }
      ])
    })

    it('columnDiffMapからcolumnDiffが合成される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onGitDiffData([
          { tableIndex: 0, gitDiff: [], columnDiff: { oldColumnCount: 1 } }
        ])
      })
      expect(capturedTableEditorProps.tableData.columnDiff).toEqual({ oldColumnCount: 1 })
    })

    it('テーブルデータに既にgitDiffがある場合はそれを使用する', () => {
      renderApp()
      act(() => {
        capturedCallbacks.onTableData({
          headers: ['H1'],
          rows: [['v1']],
          gitDiff: [{ row: 0, status: 'added' }]
        })
      })
      expect(capturedTableEditorProps.tableData.gitDiff).toEqual([
        { row: 0, status: 'added' }
      ])
    })
  })

  describe('onFontSettings DOM要素のフォールバック', () => {
    it('mte-root要素にもフォント設定が適用される', () => {
      setupWithTableData()
      act(() => {
        capturedCallbacks.onFontSettings({
          fontFamily: 'Courier New',
          fontSize: 18
        })
      })
      const mteRoot = document.getElementById('mte-root')
      if (mteRoot) {
        expect(mteRoot.style.getPropertyValue('--mte-font-family')).toBe('Courier New')
        expect(mteRoot.style.getPropertyValue('--mte-font-size')).toBe('18px')
      }
    })

    it('mte-root要素がない場合はroot要素またはdocumentElementにフォールバックする', () => {
      // ローディング中はmte-rootがレンダリングされていない
      renderApp()
      // mte-root/rootが存在しない場合、documentElementにフォールバック
      act(() => {
        capturedCallbacks.onFontSettings({
          fontFamily: 'Georgia',
          fontSize: 20
        })
      })
      // documentElementに適用される
      const root = document.documentElement
      expect(root.style.getPropertyValue('--mte-font-family')).toBe('Georgia')
      expect(root.style.getPropertyValue('--mte-font-size')).toBe('20px')
    })
  })

  describe('onThemeVariables DOM要素のフォールバック', () => {
    it('mte-root要素がない場合でもテーマ変数が適用される', () => {
      // ローディング中はmte-rootがレンダリングされていない
      renderApp()
      act(() => {
        capturedCallbacks.onThemeVariables({
          cssText: ':root { --vscode-editor-background: #2d2d2d; }'
        })
      })
      const styleEl = document.getElementById('mte-theme-overrides')
      expect(styleEl).not.toBeNull()
    })

    it('root要素へのフォールバックが機能する', () => {
      // root要素を作成してフォールバック対象にする
      const rootDiv = document.createElement('div')
      rootDiv.id = 'root'
      document.body.appendChild(rootDiv)
      try {
        renderApp()
        act(() => {
          capturedCallbacks.onThemeVariables({
            cssText: ':root { --test-var: value; }'
          })
        })
        const styleEl = document.getElementById('mte-theme-overrides')
        expect(styleEl).not.toBeNull()
      } finally {
        rootDiv.remove()
      }
    })
  })
})
