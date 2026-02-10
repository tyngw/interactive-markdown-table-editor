import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ContextMenu from '../components/ContextMenu'
import { DynamicThemeProvider } from '../contexts/DynamicThemeContext'

describe('ContextMenu', () => {
  const mockOnAddRow = jest.fn()
  const mockOnDeleteRow = jest.fn()
  const mockOnDeleteRows = jest.fn()
  const mockOnAddColumn = jest.fn()
  const mockOnDeleteColumn = jest.fn()
  const mockOnDeleteColumns = jest.fn()
  const mockOnClose = jest.fn()
  const mockOnImportCsv = jest.fn()
  const mockOnExportCsv = jest.fn()
  const mockOnExportTsv = jest.fn()
  const mockOnChangeEncoding = jest.fn()
  const mockOnResetSort = jest.fn()
  const mockOnCommitSort = jest.fn()
  const mockOnToggleColumnHeaders = jest.fn()
  const mockOnToggleRowHeaders = jest.fn()

  const mockTableData = {
    headers: ['Header1', 'Header2', 'Header3'],
    rows: [
      ['Row1Col1', 'Row1Col2', 'Row1Col3'],
      ['Row2Col1', 'Row2Col2', 'Row2Col3'],
      ['Row3Col1', 'Row3Col2', 'Row3Col3']
    ]
  }

  /** 共通プロップのヘルパー */
  const defaultProps = () => ({
    onAddRow: mockOnAddRow,
    onDeleteRow: mockOnDeleteRow,
    onDeleteRows: mockOnDeleteRows,
    onAddColumn: mockOnAddColumn,
    onDeleteColumn: mockOnDeleteColumn,
    onDeleteColumns: mockOnDeleteColumns,
    onClose: mockOnClose,
    selectedCells: new Set<string>(),
    tableData: mockTableData,
    onImportCsv: mockOnImportCsv,
    onExportCsv: mockOnExportCsv,
    onExportTsv: mockOnExportTsv,
    onChangeEncoding: mockOnChangeEncoding,
    onResetSort: mockOnResetSort,
    onCommitSort: mockOnCommitSort,
    onToggleColumnHeaders: mockOnToggleColumnHeaders,
    onToggleRowHeaders: mockOnToggleRowHeaders,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
  })

  // ==============================================
  // メニュー表示の基本動作
  // ==============================================

  describe('メニュー表示の動作', () => {
    it('type=null の場合は何もレンダリングされない', () => {
      const menuState = { type: null as const, index: -1, position: { x: 100, y: 100 } }
      const { container } = render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      expect(container.firstChild).toBeNull()
    })

    it('行メニューが正しく表示される', () => {
      const menuState = { type: 'row' as const, index: 0, position: { x: 100, y: 100 } }
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      expect(screen.getByText('この上に行を追加')).toBeInTheDocument()
      expect(screen.getByText('この下に行を追加')).toBeInTheDocument()
      expect(screen.getByText('この行を削除')).toBeInTheDocument()
    })

    it('列メニューが正しく表示される', () => {
      const menuState = { type: 'column' as const, index: 0, position: { x: 100, y: 100 } }
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      expect(screen.getByText('この左に列を追加')).toBeInTheDocument()
      expect(screen.getByText('この右に列を追加')).toBeInTheDocument()
      expect(screen.getByText('この列を削除')).toBeInTheDocument()
    })

    it('バックドロップをクリックするとメニューが閉じる（行メニュー）', async () => {
      const user = userEvent.setup()
      const menuState = { type: 'row' as const, index: 0, position: { x: 100, y: 100 } }
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      const backdrop = document.querySelector('.context-menu-backdrop') as HTMLElement
      await user.click(backdrop)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  // ==============================================
  // エディターメニュー（type='editor'）
  // ==============================================

  describe('エディターメニュー', () => {
    const editorMenuState = { type: 'editor' as const, index: 0, position: { x: 100, y: 100 } }

    it('エディターメニューが正しく表示される', () => {
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      expect(screen.getByText('Import CSV (Auto)')).toBeInTheDocument()
      expect(screen.getByText('Export CSV (UTF8)')).toBeInTheDocument()
      expect(screen.getByText('Export TSV (UTF8)')).toBeInTheDocument()
      expect(screen.getByText('UTF-8')).toBeInTheDocument()
      expect(screen.getByText('Shift_JIS')).toBeInTheDocument()
    })

    it('Import CSV をクリックすると onImportCsv と onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      await user.click(screen.getByText('Import CSV (Auto)'))
      expect(mockOnImportCsv).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('Export CSV をクリックすると onExportCsv と onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      await user.click(screen.getByText('Export CSV (UTF8)'))
      expect(mockOnExportCsv).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('Export TSV をクリックすると onExportTsv と onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      await user.click(screen.getByText('Export TSV (UTF8)'))
      expect(mockOnExportTsv).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('UTF-8 をクリックすると onChangeEncoding("utf8") と onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      await user.click(screen.getByText('UTF-8'))
      expect(mockOnChangeEncoding).toHaveBeenCalledWith('utf8')
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('Shift_JIS をクリックすると onChangeEncoding("sjis") と onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      await user.click(screen.getByText('Shift_JIS'))
      expect(mockOnChangeEncoding).toHaveBeenCalledWith('sjis')
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('列ヘッダーを表示トグルをクリックすると onToggleColumnHeaders と onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      await user.click(screen.getByText('列ヘッダーを表示'))
      expect(mockOnToggleColumnHeaders).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('行ヘッダーを表示トグルをクリックすると onToggleRowHeaders と onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      await user.click(screen.getByText('行ヘッダーを表示'))
      expect(mockOnToggleRowHeaders).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('ソートリセットをクリックすると onResetSort と onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} hasActiveSort={true} />
        </DynamicThemeProvider>
      )
      await user.click(screen.getByText('ソートをリセット'))
      expect(mockOnResetSort).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('ソート保存をクリックすると onCommitSort と onClose が呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} hasActiveSort={true} />
        </DynamicThemeProvider>
      )
      await user.click(screen.getByText('この順序を保存'))
      expect(mockOnCommitSort).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('hasActiveSort=false の場合、ソート関連ボタンが disabled になる', () => {
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} hasActiveSort={false} />
        </DynamicThemeProvider>
      )
      const resetButton = screen.getByText('ソートをリセット').closest('button')
      const commitButton = screen.getByText('この順序を保存').closest('button')
      expect(resetButton).toBeDisabled()
      expect(commitButton).toBeDisabled()
    })

    it('headerConfig.hasColumnHeaders=true/hasRowHeaders=false の場合のチェックマーク', () => {
      render(
        <DynamicThemeProvider>
          <ContextMenu
            menuState={editorMenuState}
            {...defaultProps()}
            headerConfig={{ hasColumnHeaders: true, hasRowHeaders: false }}
          />
        </DynamicThemeProvider>
      )
      const columnHeaderButton = screen.getByText('列ヘッダーを表示').closest('button')
      expect(columnHeaderButton?.querySelector('.context-menu-icon')?.textContent).toBe('✓')

      const rowHeaderButton = screen.getByText('行ヘッダーを表示').closest('button')
      expect(rowHeaderButton?.querySelector('.context-menu-icon')?.textContent).toBe('')
    })

    it('headerConfig.hasRowHeaders=true の場合、行ヘッダーにチェックマーク', () => {
      render(
        <DynamicThemeProvider>
          <ContextMenu
            menuState={editorMenuState}
            {...defaultProps()}
            headerConfig={{ hasColumnHeaders: false, hasRowHeaders: true }}
          />
        </DynamicThemeProvider>
      )
      const rowHeaderButton = screen.getByText('行ヘッダーを表示').closest('button')
      expect(rowHeaderButton?.querySelector('.context-menu-icon')?.textContent).toBe('✓')
    })

    it('exportEncoding=sjis の場合、SJIS ラベルとチェックマーク', () => {
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} exportEncoding="sjis" />
        </DynamicThemeProvider>
      )
      expect(screen.getByText('Export CSV (SJIS)')).toBeInTheDocument()
      expect(screen.getByText('Export TSV (SJIS)')).toBeInTheDocument()

      const sjisButton = screen.getByText('Shift_JIS').closest('button')
      expect(sjisButton?.querySelector('.context-menu-icon')?.textContent).toBe('✓')

      const utf8Button = screen.getByText('UTF-8').closest('button')
      expect(utf8Button?.querySelector('.context-menu-icon')?.textContent).toBe('')
    })

    it('exportEncoding=utf8 の場合、UTF-8 にチェック/Shift_JIS にチェックなし', () => {
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} exportEncoding="utf8" />
        </DynamicThemeProvider>
      )
      const utf8Button = screen.getByText('UTF-8').closest('button')
      expect(utf8Button?.querySelector('.context-menu-icon')?.textContent).toBe('✓')

      const sjisButton = screen.getByText('Shift_JIS').closest('button')
      expect(sjisButton?.querySelector('.context-menu-icon')?.textContent).toBe('')
    })

    it('バックドロップをクリックするとメニューが閉じる（エディターメニュー）', async () => {
      const user = userEvent.setup()
      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={editorMenuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )
      const backdrop = document.querySelector('.context-menu-backdrop') as HTMLElement
      await user.click(backdrop)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('exportEncoding のデフォルトは utf8（省略時）', () => {
      render(
        <DynamicThemeProvider>
          <ContextMenu
            menuState={editorMenuState}
            onAddRow={mockOnAddRow}
            onDeleteRow={mockOnDeleteRow}
            onAddColumn={mockOnAddColumn}
            onDeleteColumn={mockOnDeleteColumn}
            onClose={mockOnClose}
            onExportCsv={mockOnExportCsv}
            onExportTsv={mockOnExportTsv}
            onChangeEncoding={mockOnChangeEncoding}
          />
        </DynamicThemeProvider>
      )
      expect(screen.getByText('Export CSV (UTF8)')).toBeInTheDocument()
    })
  })

  // ==============================================
  // 複数行選択時の行追加機能
  // ==============================================

  describe('複数行選択時の行追加機能', () => {
    it('複数行全選択 → "この上に行を追加" → 選択行数分が最初の選択行の上に追加', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '0-1', '0-2', '1-0', '1-1', '1-2'])
      const menuState = { type: 'row' as const, index: 1, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この上に2行を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この上に2行を追加'))
      expect(mockOnAddRow).toHaveBeenCalledWith(0, 2)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('複数行全選択 → "この下に行を追加" → 選択行数分が最後の選択行の下に追加', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '0-1', '0-2', '1-0', '1-1', '1-2'])
      const menuState = { type: 'row' as const, index: 1, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この下に2行を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この下に2行を追加'))
      expect(mockOnAddRow).toHaveBeenCalledWith(2, 2)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('単一行 → "この上に行を追加" → 1行だけ追加', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '0-1'])
      const menuState = { type: 'row' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この上に行を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この上に行を追加'))
      expect(mockOnAddRow).toHaveBeenCalledWith(0)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('単一行 → "この下に行を追加" → 1行だけ追加', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '0-1'])
      const menuState = { type: 'row' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この下に行を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この下に行を追加'))
      expect(mockOnAddRow).toHaveBeenCalledWith(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('3行全選択時に正しく動作する', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set([
        '0-0', '0-1', '0-2',
        '1-0', '1-1', '1-2',
        '2-0', '2-1', '2-2'
      ])
      const menuState = { type: 'row' as const, index: 1, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この下に3行を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この下に3行を追加'))
      expect(mockOnAddRow).toHaveBeenCalledWith(3, 3)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('selectedCells=undefined の場合、単一行として動作する', async () => {
      const user = userEvent.setup()
      const menuState = { type: 'row' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={undefined} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この上に行を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この上に行を追加'))
      expect(mockOnAddRow).toHaveBeenCalledWith(0)
    })
  })

  // ==============================================
  // 行の削除機能
  // ==============================================

  describe('行の削除機能', () => {
    it('複数行全選択 → "選択した行を削除" → onDeleteRows が呼ばれる', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '0-1', '0-2', '1-0', '1-1', '1-2'])
      const menuState = { type: 'row' as const, index: 1, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('選択した2行を削除')).toBeInTheDocument()
      await user.click(screen.getByText('選択した2行を削除'))
      expect(mockOnDeleteRows).toHaveBeenCalledWith([1, 0])
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('単一行 → "この行を削除" → onDeleteRow が呼ばれる', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '0-1'])
      const menuState = { type: 'row' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この行を削除')).toBeInTheDocument()
      await user.click(screen.getByText('この行を削除'))
      expect(mockOnDeleteRow).toHaveBeenCalledWith(0)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('複数行選択されているが onDeleteRows が未提供の場合、onDeleteRow にフォールバック', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '0-1', '0-2', '1-0', '1-1', '1-2'])
      const menuState = { type: 'row' as const, index: 1, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu
            menuState={menuState}
            {...defaultProps()}
            selectedCells={selectedCells}
            onDeleteRows={undefined}
          />
        </DynamicThemeProvider>
      )

      const deleteButton = screen.getByText('選択した2行を削除').closest('button') as HTMLElement
      await user.click(deleteButton)
      expect(mockOnDeleteRow).toHaveBeenCalledWith(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  // ==============================================
  // 複数列選択時の列追加機能
  // ==============================================

  describe('複数列選択時の列追加機能', () => {
    it('複数列全選択 → "この左に列を追加" → 選択列数分が最初の選択列の左に追加', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set([
        '0-0', '1-0', '2-0',
        '0-1', '1-1', '2-1'
      ])
      const menuState = { type: 'column' as const, index: 1, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この左に2列を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この左に2列を追加'))
      expect(mockOnAddColumn).toHaveBeenCalledWith(0, 2)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('複数列全選択 → "この右に列を追加" → 選択列数分が最後の選択列の右に追加', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set([
        '0-0', '1-0', '2-0',
        '0-1', '1-1', '2-1'
      ])
      const menuState = { type: 'column' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この右に2列を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この右に2列を追加'))
      expect(mockOnAddColumn).toHaveBeenCalledWith(2, 2)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('単一列 → "この左に列を追加" → 1列だけ追加', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '1-0'])
      const menuState = { type: 'column' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この左に列を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この左に列を追加'))
      expect(mockOnAddColumn).toHaveBeenCalledWith(0)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('単一列 → "この右に列を追加" → 1列だけ追加', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '1-0'])
      const menuState = { type: 'column' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この右に列を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この右に列を追加'))
      expect(mockOnAddColumn).toHaveBeenCalledWith(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('selectedCells=undefined の場合、単一列として動作する', async () => {
      const user = userEvent.setup()
      const menuState = { type: 'column' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={undefined} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この左に列を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この左に列を追加'))
      expect(mockOnAddColumn).toHaveBeenCalledWith(0)
    })
  })

  // ==============================================
  // 列の削除機能
  // ==============================================

  describe('列の削除機能', () => {
    it('複数列選択 → "選択した列を削除" → onDeleteColumns が呼ばれる', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set([
        '0-0', '1-0', '2-0',
        '0-1', '1-1', '2-1'
      ])
      const menuState = { type: 'column' as const, index: 1, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('選択した2列を削除')).toBeInTheDocument()
      await user.click(screen.getByText('選択した2列を削除'))
      expect(mockOnDeleteColumns).toHaveBeenCalledWith([1, 0])
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('単一列 → "この列を削除" → onDeleteColumn が呼ばれる', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '1-0'])
      const menuState = { type: 'column' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この列を削除')).toBeInTheDocument()
      await user.click(screen.getByText('この列を削除'))
      expect(mockOnDeleteColumn).toHaveBeenCalledWith(0)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('複数列選択されているが onDeleteColumns が未提供の場合、onDeleteColumn にフォールバック', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set([
        '0-0', '1-0', '2-0',
        '0-1', '1-1', '2-1'
      ])
      const menuState = { type: 'column' as const, index: 1, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu
            menuState={menuState}
            {...defaultProps()}
            selectedCells={selectedCells}
            onDeleteColumns={undefined}
          />
        </DynamicThemeProvider>
      )

      const deleteButton = screen.getByText('選択した2列を削除').closest('button') as HTMLElement
      await user.click(deleteButton)
      expect(mockOnDeleteColumn).toHaveBeenCalledWith(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('複数列選択だが menuState.index が選択に含まれない場合、単一列削除になる', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set([
        '0-0', '1-0', '2-0',
        '0-1', '1-1', '2-1'
      ])
      const menuState = { type: 'column' as const, index: 2, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この列を削除')).toBeInTheDocument()
      await user.click(screen.getByText('この列を削除'))
      expect(mockOnDeleteColumn).toHaveBeenCalledWith(2)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  // ==============================================
  // isRowFullySelected / isColumnFullySelected のエッジケース
  // ==============================================

  describe('isRowFullySelected / isColumnFullySelected のエッジケース', () => {
    it('selectedCells はあるが tableData が undefined → isRowFullySelected は false → 単一行ラベル', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '0-1', '0-2', '1-0', '1-1', '1-2'])
      const menuState = { type: 'row' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu
            menuState={menuState}
            {...defaultProps()}
            selectedCells={selectedCells}
            tableData={undefined}
          />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この上に行を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この上に行を追加'))
      expect(mockOnAddRow).toHaveBeenCalledWith(0)
    })

    it('isColumnFullySelected: tableData が undefined → 単一列ラベル', async () => {
      const user = userEvent.setup()
      const selectedCells = new Set(['0-0', '1-0', '2-0', '0-1', '1-1', '2-1'])
      const menuState = { type: 'column' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu
            menuState={menuState}
            {...defaultProps()}
            selectedCells={selectedCells}
            tableData={undefined}
          />
        </DynamicThemeProvider>
      )

      expect(screen.getByText('この左に列を追加')).toBeInTheDocument()
      await user.click(screen.getByText('この左に列を追加'))
      expect(mockOnAddColumn).toHaveBeenCalledWith(0)
    })

    it('isColumnFullySelected: 列の一部セルが選択されていない場合は false', () => {
      const selectedCells = new Set([
        '0-0', '1-0', /* '2-0' missing */
        '0-1', '1-1', '2-1'
      ])
      const menuState = { type: 'column' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} selectedCells={selectedCells} />
        </DynamicThemeProvider>
      )

      // isColumnFullySelected(0) → false → 単一列ラベル
      expect(screen.getByText('この左に列を追加')).toBeInTheDocument()
    })
  })

  // ==============================================
  // adjustedPosition（位置のクランプ）
  // ==============================================

  describe('adjustedPosition', () => {
    it('メニュー位置がウィンドウ右端を超える場合にクランプされる', () => {
      Object.defineProperty(window, 'innerWidth', { value: 300, writable: true })
      const menuState = { type: 'row' as const, index: 0, position: { x: 500, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )

      const menu = document.querySelector('.context-menu') as HTMLElement
      expect(menu.style.left).toBe('80px')
    })

    it('メニュー位置がウィンドウ下端を超える場合にクランプされる', () => {
      Object.defineProperty(window, 'innerHeight', { value: 250, writable: true })
      const menuState = { type: 'row' as const, index: 0, position: { x: 100, y: 500 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu menuState={menuState} {...defaultProps()} />
        </DynamicThemeProvider>
      )

      const menu = document.querySelector('.context-menu') as HTMLElement
      expect(menu.style.top).toBe('50px')
    })
  })

  // ==============================================
  // オプショナルコールバックが未提供のケース
  // ==============================================

  describe('オプショナルコールバックが未提供の場合', () => {
    it('エディターメニューでコールバック未提供でもクラッシュしない', async () => {
      const user = userEvent.setup()
      const editorMenuState = { type: 'editor' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu
            menuState={editorMenuState}
            onAddRow={mockOnAddRow}
            onDeleteRow={mockOnDeleteRow}
            onAddColumn={mockOnAddColumn}
            onDeleteColumn={mockOnDeleteColumn}
            onClose={mockOnClose}
          />
        </DynamicThemeProvider>
      )

      // 各ボタンをクリックしてもエラーにならないことを確認
      await user.click(screen.getByText('Import CSV (Auto)'))
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('headerConfig 未提供の場合、チェックマークは表示されない', () => {
      const editorMenuState = { type: 'editor' as const, index: 0, position: { x: 100, y: 100 } }

      render(
        <DynamicThemeProvider>
          <ContextMenu
            menuState={editorMenuState}
            onAddRow={mockOnAddRow}
            onDeleteRow={mockOnDeleteRow}
            onAddColumn={mockOnAddColumn}
            onDeleteColumn={mockOnDeleteColumn}
            onClose={mockOnClose}
          />
        </DynamicThemeProvider>
      )

      const columnHeaderButton = screen.getByText('列ヘッダーを表示').closest('button')
      expect(columnHeaderButton?.querySelector('.context-menu-icon')?.textContent).toBe('')

      const rowHeaderButton = screen.getByText('行ヘッダーを表示').closest('button')
      expect(rowHeaderButton?.querySelector('.context-menu-icon')?.textContent).toBe('')
    })
  })
})