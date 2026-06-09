/**
 * TableTabs.test.tsx
 * TableTabsコンポーネントのテスト
 * タブの表示・非表示、タブクリックによるテーブル切り替え、アクティブタブの表示を検証
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import TableTabs from '../components/TableTabs'
import { DynamicThemeProvider } from '../contexts/DynamicThemeContext'
import { TableData } from '../types'

describe('TableTabs', () => {
  const mockOnTabChange = jest.fn()

  const createTable = (headers: string[] = ['H1', 'H2']): TableData => ({
    headers,
    rows: [['a', 'b']]
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const renderTableTabs = (tables: TableData[], currentTableIndex: number = 0, tabLabelMode: string = 'number') => {
    return render(
      <DynamicThemeProvider>
        <TableTabs
          tables={tables}
          currentTableIndex={currentTableIndex}
          onTabChange={mockOnTabChange}
          tabLabelMode={tabLabelMode}
        />
      </DynamicThemeProvider>
    )
  }

  it('テーブルが1つだけの場合はnullを返す（何も表示しない）', () => {
    const { container } = renderTableTabs([createTable()])
    expect(container.innerHTML).toBe('')
  })

  it('テーブルが0個の場合もnullを返す', () => {
    const { container } = renderTableTabs([])
    expect(container.innerHTML).toBe('')
  })

  it('テーブルが2つ以上の場合はタブが表示される', () => {
    const tables = [createTable(), createTable()]
    renderTableTabs(tables)
    expect(screen.getByTestId('mte-table-tabs')).toBeInTheDocument()
  })

  it('テーブル数と同じ数のタブボタンが表示される', () => {
    const tables = [createTable(), createTable(), createTable()]
    renderTableTabs(tables)
    expect(screen.getByTestId('mte-tab-button-0')).toBeInTheDocument()
    expect(screen.getByTestId('mte-tab-button-1')).toBeInTheDocument()
    expect(screen.getByTestId('mte-tab-button-2')).toBeInTheDocument()
  })

  it('タブのラベルに翻訳されたテーブル番号が表示される', () => {
    const tables = [createTable(), createTable()]
    renderTableTabs(tables)
    // i18n ja: tableTabs.tableLabel = "表 {{index}}"
    expect(screen.getByText('表 1')).toBeInTheDocument()
    expect(screen.getByText('表 2')).toBeInTheDocument()
  })

  it('タブをクリックするとonTabChangeが正しいインデックスで呼ばれる', async () => {
    const user = userEvent.setup()
    const tables = [createTable(), createTable(), createTable()]
    renderTableTabs(tables, 0)

    await user.click(screen.getByTestId('mte-tab-button-1'))
    expect(mockOnTabChange).toHaveBeenCalledWith(1)

    await user.click(screen.getByTestId('mte-tab-button-2'))
    expect(mockOnTabChange).toHaveBeenCalledWith(2)
  })

  it('現在選択中のタブにactive属性が設定される', () => {
    const tables = [createTable(), createTable(), createTable()]
    renderTableTabs(tables, 1)
    const tab0 = screen.getByTestId('mte-tab-button-0')
    const tab1 = screen.getByTestId('mte-tab-button-1')
    const tab2 = screen.getByTestId('mte-tab-button-2')
    expect(tab0).toBeInTheDocument()
    expect(tab1).toBeInTheDocument()
    expect(tab2).toBeInTheDocument()
  })

  describe('ラベルの省略表示とツールチップ', () => {
    it('タブにはdata-tooltip属性でフルラベルが設定される', () => {
      const label = 'My Section'
      const tables = [
        { headers: ['H'], rows: [], headingLabel: label },
        { headers: ['H'], rows: [] }
      ]
      renderTableTabs(tables, 0, 'heading')
      expect(screen.getByTestId('mte-tab-button-0')).toHaveAttribute('data-tooltip', label)
    })

    it('長いラベルでもdata-tooltip属性にフルラベルが設定される', () => {
      const long = 'This Is A Very Long Heading Label That Should Be Truncated By CSS'
      const tables = [
        { headers: ['H'], rows: [], headingLabel: long },
        { headers: ['H'], rows: [] }
      ]
      renderTableTabs(tables, 0, 'heading')
      expect(screen.getByTestId('mte-tab-button-0')).toHaveAttribute('data-tooltip', long)
    })

    it('番号モードでもdata-tooltip属性が設定される', () => {
      const tables = [createTable(), createTable()]
      renderTableTabs(tables)
      expect(screen.getByTestId('mte-tab-button-0')).toHaveAttribute('data-tooltip')
      expect(screen.getByTestId('mte-tab-button-1')).toHaveAttribute('data-tooltip')
    })
  })

  describe('ハンバーガーメニュー', () => {
    it('ハンバーガーボタンが表示される', () => {
      const tables = [createTable(), createTable()]
      renderTableTabs(tables)
      expect(screen.getByTestId('mte-tab-menu-button')).toBeInTheDocument()
    })

    it('初期状態でドロップダウンは非表示', () => {
      const tables = [createTable(), createTable()]
      renderTableTabs(tables)
      expect(screen.queryByTestId('mte-tab-menu')).not.toBeInTheDocument()
    })

    it('ハンバーガーボタンクリックでドロップダウンが表示される', async () => {
      const user = userEvent.setup()
      const tables = [createTable(), createTable()]
      renderTableTabs(tables)

      await user.click(screen.getByTestId('mte-tab-menu-button'))
      expect(screen.getByTestId('mte-tab-menu')).toBeInTheDocument()
    })

    it('ドロップダウンに全テーブルのアイテムが表示される', async () => {
      const user = userEvent.setup()
      const tables = [createTable(), createTable(), createTable()]
      renderTableTabs(tables)

      await user.click(screen.getByTestId('mte-tab-menu-button'))
      expect(screen.getByTestId('mte-tab-menu-item-0')).toBeInTheDocument()
      expect(screen.getByTestId('mte-tab-menu-item-1')).toBeInTheDocument()
      expect(screen.getByTestId('mte-tab-menu-item-2')).toBeInTheDocument()
    })

    it('ドロップダウンのアイテムをクリックするとonTabChangeが呼ばれドロップダウンが閉じる', async () => {
      const user = userEvent.setup()
      const tables = [createTable(), createTable(), createTable()]
      renderTableTabs(tables, 0)

      await user.click(screen.getByTestId('mte-tab-menu-button'))
      await user.click(screen.getByTestId('mte-tab-menu-item-2'))

      expect(mockOnTabChange).toHaveBeenCalledWith(2)
      expect(screen.queryByTestId('mte-tab-menu')).not.toBeInTheDocument()
    })

    it('再度ハンバーガーボタンクリックでドロップダウンが閉じる', async () => {
      const user = userEvent.setup()
      const tables = [createTable(), createTable()]
      renderTableTabs(tables)

      await user.click(screen.getByTestId('mte-tab-menu-button'))
      expect(screen.getByTestId('mte-tab-menu')).toBeInTheDocument()

      await user.click(screen.getByTestId('mte-tab-menu-button'))
      expect(screen.queryByTestId('mte-tab-menu')).not.toBeInTheDocument()
    })
  })

  describe('tabLabelMode=heading', () => {
    const createTableWithHeading = (headingLabel: string): TableData => ({
      headers: ['H1'],
      rows: [['a']],
      headingLabel
    })

    it('headingラベルがある場合はheadingラベルを表示する', () => {
      const tables = [
        createTableWithHeading('Introduction'),
        createTableWithHeading('Summary')
      ]
      renderTableTabs(tables, 0, 'heading')
      expect(screen.getByText('Introduction')).toBeInTheDocument()
      expect(screen.getByText('Summary')).toBeInTheDocument()
    })

    it('headingラベルがない場合は番号ラベルにフォールバックする', () => {
      const tables = [createTable(), createTable()]
      renderTableTabs(tables, 0, 'heading')
      expect(screen.getByText('表 1')).toBeInTheDocument()
      expect(screen.getByText('表 2')).toBeInTheDocument()
    })

    it('headingラベルがあってもtabLabelMode=numberなら番号ラベルを使う', () => {
      const tables = [
        createTableWithHeading('Introduction'),
        createTableWithHeading('Summary')
      ]
      renderTableTabs(tables, 0, 'number')
      expect(screen.queryByText('Introduction')).not.toBeInTheDocument()
      expect(screen.getByText('表 1')).toBeInTheDocument()
      expect(screen.getByText('表 2')).toBeInTheDocument()
    })

    it('ドロップダウンにもheadingラベルが表示される', async () => {
      const user = userEvent.setup()
      const tables = [
        createTableWithHeading('Introduction'),
        createTableWithHeading('Summary')
      ]
      renderTableTabs(tables, 0, 'heading')
      await user.click(screen.getByTestId('mte-tab-menu-button'))
      expect(screen.getByTestId('mte-tab-menu-item-0')).toHaveTextContent('Introduction')
      expect(screen.getByTestId('mte-tab-menu-item-1')).toHaveTextContent('Summary')
    })
  })
})
