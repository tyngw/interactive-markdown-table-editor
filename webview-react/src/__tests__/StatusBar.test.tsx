/**
 * StatusBar.test.tsx
 * StatusBarコンポーネントのテスト
 * ステータスバーの表示、Git Diffボタン、AutoSaveボタン、ソート状態表示、テーブル情報表示を検証
 */

import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import StatusBar from '../components/StatusBar'
import { DynamicThemeProvider } from '../contexts/DynamicThemeContext'
import { StatusProvider, useStatus } from '../contexts/StatusContext'

// StatusContextの値を外部から設定するためのヘルパーコンポーネント
let statusUpdater: any = null
const StatusSetter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ctx = useStatus()
  statusUpdater = ctx
  return <>{children}</>
}

describe('StatusBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    statusUpdater = null
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const renderStatusBar = (props = {}) => {
    return render(
      <DynamicThemeProvider>
        <StatusProvider>
          <StatusSetter>
            <StatusBar {...props} />
          </StatusSetter>
        </StatusProvider>
      </DynamicThemeProvider>
    )
  }

  it('ステータスバーがレンダリングされる', () => {
    renderStatusBar()
    expect(screen.getByTestId('mte-status-bar')).toBeInTheDocument()
  })

  it('AutoSaveボタンが表示される', () => {
    renderStatusBar()
    expect(screen.getByLabelText('Auto Save')).toBeInTheDocument()
  })

  it('Git Diffボタンが表示される', () => {
    renderStatusBar()
    expect(screen.getByLabelText('Git Diff')).toBeInTheDocument()
  })

  it('autoSaveEnabled=trueの場合にチェックマークが表示される', () => {
    renderStatusBar({ autoSaveEnabled: true })
    const autoSaveBtn = screen.getByLabelText('Auto Save')
    expect(autoSaveBtn.textContent).toContain('✓')
  })

  it('autoSaveEnabled=falseの場合に⊘が表示される', () => {
    renderStatusBar({ autoSaveEnabled: false })
    const autoSaveBtn = screen.getByLabelText('Auto Save')
    expect(autoSaveBtn.textContent).toContain('⊘')
  })

  it('showGitDiff=trueの場合にGit Diffボタンにチェックマークが表示される', () => {
    renderStatusBar({ showGitDiff: true })
    const gitDiffBtn = screen.getByLabelText('Git Diff')
    expect(gitDiffBtn.textContent).toContain('✓')
  })

  it('showGitDiff=falseの場合にGit Diffボタンに⊘が表示される', () => {
    renderStatusBar({ showGitDiff: false })
    const gitDiffBtn = screen.getByLabelText('Git Diff')
    expect(gitDiffBtn.textContent).toContain('⊘')
  })

  it('AutoSaveボタンをクリックするとonAutoSaveToggleが呼ばれる', async () => {
    const mockToggle = jest.fn()
    const user = userEvent.setup()
    renderStatusBar({ autoSaveEnabled: true, onAutoSaveToggle: mockToggle })
    await user.click(screen.getByLabelText('Auto Save'))
    expect(mockToggle).toHaveBeenCalledWith(false)
  })

  it('Git Diffボタンをクリックするとon GitDiffToggleが呼ばれる', async () => {
    const mockToggle = jest.fn()
    const user = userEvent.setup()
    renderStatusBar({ showGitDiff: false, onGitDiffToggle: mockToggle })
    await user.click(screen.getByLabelText('Git Diff'))
    expect(mockToggle).toHaveBeenCalledWith(true)
  })

  it('isDirty=trueかつautoSaveEnabled=falseの場合にSave*が表示される', () => {
    renderStatusBar({ isDirty: true, autoSaveEnabled: false })
    expect(screen.getByText('Save*')).toBeInTheDocument()
  })

  it('isDirty=falseの場合にSaveが表示される', () => {
    renderStatusBar({ isDirty: false, autoSaveEnabled: true })
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('Diffラベルが表示される', () => {
    renderStatusBar()
    expect(screen.getByText('Diff')).toBeInTheDocument()
  })

  it('テーブル情報がStatusContext経由で表示される', () => {
    renderStatusBar()
    act(() => {
      statusUpdater.updateTableInfo(5, 3)
    })
    // i18n ja: "{{rows}} 行 × {{columns}} 列"
    expect(screen.getByText('5 行 × 3 列')).toBeInTheDocument()
  })

  it('ソート状態が表示される（propSortState）', () => {
    renderStatusBar({
      sortState: { column: 0, direction: 'asc' },
      showGitDiff: false
    })
    // i18n ja: statusBar.sorted = "表示順序はソートされています"
    expect(screen.getByText(/表示順序はソートされています/)).toBeInTheDocument()
  })

  it('ソート状態がnoneの場合はソートメッセージが表示されない', () => {
    renderStatusBar({
      sortState: { column: 0, direction: 'none' },
      showGitDiff: false
    })
    expect(screen.queryByText(/表示順序はソートされています/)).not.toBeInTheDocument()
  })

  it('showGitDiff=trueの場合はソートメッセージが表示されない', () => {
    renderStatusBar({
      sortState: { column: 0, direction: 'asc' },
      showGitDiff: true
    })
    expect(screen.queryByText(/表示順序はソートされています/)).not.toBeInTheDocument()
  })

  it('ステータスメッセージが表示される', () => {
    renderStatusBar()
    act(() => {
      statusUpdater.updateStatus('info', 'テストメッセージ')
    })
    expect(screen.getByText('テストメッセージ')).toBeInTheDocument()
  })

  it('選択情報が表示される', () => {
    renderStatusBar()
    act(() => {
      statusUpdater.updateSelection('A1:B2')
    })
    expect(screen.getByText('A1:B2')).toBeInTheDocument()
  })

  it('saveStatus=savingの場合にspinnerが表示される', () => {
    renderStatusBar({ autoSaveEnabled: true })
    act(() => {
      statusUpdater.updateSaveStatus('saving')
    })
    const autoSaveBtn = screen.getByLabelText('Auto Save')
    const spinner = autoSaveBtn.querySelector('.mte-loading-spinner')
    expect(spinner).toBeInTheDocument()
  })

  it('onAutoSaveToggleがundefinedの場合、クリックしてもエラーにならない', async () => {
    const user = userEvent.setup()
    renderStatusBar({ onAutoSaveToggle: undefined })
    // エラーが発生しないことを確認
    await user.click(screen.getByLabelText('Auto Save'))
  })

  it('onGitDiffToggleがundefinedの場合、クリックしてもエラーにならない', async () => {
    const user = userEvent.setup()
    renderStatusBar({ onGitDiffToggle: undefined })
    await user.click(screen.getByLabelText('Git Diff'))
  })

  it('contextSortStateからソート状態を取得する', () => {
    renderStatusBar({ showGitDiff: false })
    act(() => {
      statusUpdater.updateSortState({ column: 1, direction: 'desc' })
    })
    expect(screen.getByText(/表示順序はソートされています/)).toBeInTheDocument()
  })

  it('themeのフィールドが欠けている場合にフォールバック値が使われる', () => {
    // useDynamicTheme をモックして theme フィールドを部分的に空にする
    const mockUseDynamicTheme = jest.fn().mockReturnValue({
      theme: {
        // statusBarBackground, statusBarForeground, statusBarBorder を undefined にする
      },
      setTheme: jest.fn(),
    })
    jest.spyOn(require('../contexts/DynamicThemeContext'), 'useDynamicTheme').mockImplementation(mockUseDynamicTheme)

    render(
      <DynamicThemeProvider>
        <StatusProvider>
          <StatusSetter>
            <StatusBar />
          </StatusSetter>
        </StatusProvider>
      </DynamicThemeProvider>
    )

    const statusBar = screen.getByTestId('mte-status-bar')
    // フォールバック値がinline styleに適用される（jsdomはHEXをRGBに変換する）
    expect(statusBar.style.backgroundColor).toBe('rgb(0, 122, 204)')
    expect(statusBar.style.color).toBe('rgb(255, 255, 255)')
    expect(statusBar.style.borderTopColor).toBe('transparent')

    jest.restoreAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
  })

  it('themeが欠けた状態でsaveStatus=savingの場合にspinnerのフォールバック色が使われる', () => {
    const mockUseDynamicTheme = jest.fn().mockReturnValue({
      theme: {},
      setTheme: jest.fn(),
    })
    jest.spyOn(require('../contexts/DynamicThemeContext'), 'useDynamicTheme').mockImplementation(mockUseDynamicTheme)

    render(
      <DynamicThemeProvider>
        <StatusProvider>
          <StatusSetter>
            <StatusBar autoSaveEnabled={true} />
          </StatusSetter>
        </StatusProvider>
      </DynamicThemeProvider>
    )

    // saveStatus を saving に設定
    act(() => {
      statusUpdater.updateSaveStatus('saving')
    })

    const autoSaveBtn = screen.getByLabelText('Auto Save')
    const spinner = autoSaveBtn.querySelector('.mte-loading-spinner')
    expect(spinner).toBeInTheDocument()
    // spinnerのフォールバック色が適用される
    expect(spinner!.getAttribute('style')).toContain('rgb(255, 255, 255)')

    jest.restoreAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
  })

})
