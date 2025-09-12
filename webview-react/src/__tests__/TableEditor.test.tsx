import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import TableEditor from '../components/TableEditor'
import { StatusProvider } from '../contexts/StatusContext'
import { TableData } from '../types'

// モックデータ
const mockTableData: TableData = {
  headers: ['Name', 'Age', 'City'],
  rows: [
    ['Alice', '25', 'Tokyo'],
    ['Bob', '30', 'Osaka'],
    ['Charlie', '35', 'Kyoto']
  ]
}

// VSCode API のモック
const mockVSCodeAPI = {
  postMessage: jest.fn()
}

// グローバルオブジェクトのモック
Object.defineProperty(window, 'vscode', {
  value: mockVSCodeAPI,
  writable: true
})

// クリップボード API のモック
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue('test\tdata\nmore\tdata')
}

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true
})

describe('TableEditor', () => {
  const mockOnTableUpdate = jest.fn()
  const mockOnSendMessage = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const renderTableEditor = () => {
    return render(
      <StatusProvider>
        <TableEditor
          tableData={mockTableData}
          onTableUpdate={mockOnTableUpdate}
          onSendMessage={mockOnSendMessage}
        />
      </StatusProvider>
    )
  }

  test('renders table with correct data', () => {
    renderTableEditor()
    
    // ヘッダーの確認
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Age')).toBeInTheDocument()
    expect(screen.getByText('City')).toBeInTheDocument()
    
    // データの確認
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('Tokyo')).toBeInTheDocument()
  })

  test('renders toolbar with action buttons', () => {
    renderTableEditor()
    
    expect(screen.getByText('📋 コピー')).toBeInTheDocument()
    expect(screen.getByText('📄 ペースト')).toBeInTheDocument()
    expect(screen.getByText('✂️ 切り取り')).toBeInTheDocument()
    expect(screen.getByText('💾 CSV')).toBeInTheDocument()
    expect(screen.getByText('📊 TSV')).toBeInTheDocument()
  })

  test('cell selection works', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    const cell = screen.getByText('Alice')
    await user.click(cell)
    
    // セルが選択されることを確認
    expect(cell.closest('td')).toHaveClass('selected')
  })

  test('cell editing works', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    const cell = screen.getByText('Alice')
    await user.dblClick(cell)
    
    // 編集モードになることを確認
    const textarea = screen.getByDisplayValue('Alice')
    expect(textarea).toBeInTheDocument()
    
    // 値を変更
    await user.clear(textarea)
    await user.type(textarea, 'Alice Smith')
    await user.keyboard('{Enter}')
    
    // VSCodeに更新メッセージが送信されることを確認
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'updateCell',
      data: { row: 0, col: 0, value: 'Alice Smith' }
    })
  })

  test('header editing works', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    const header = screen.getByText('Name')
    await user.dblClick(header)
    
    // 編集モードになることを確認
    const input = screen.getByDisplayValue('Name')
    expect(input).toBeInTheDocument()
    
    // 値を変更
    await user.clear(input)
    await user.type(input, 'Full Name')
    await user.keyboard('{Enter}')
    
    // VSCodeに更新メッセージが送信されることを確認
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'updateHeader',
      data: { col: 0, value: 'Full Name' }
    })
  })

  test('row addition works', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    const addButton = screen.getByText('+ 行を追加')
    await user.click(addButton)
    
    // VSCodeに行追加メッセージが送信されることを確認
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'addRow',
      data: { index: undefined }
    })
  })

  test('column addition works', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    // 列追加ボタンを探す（ヘッダー行の最後の+ボタン）
    const addColumnButton = screen.getByTitle('列を追加')
    await user.click(addColumnButton)
    
    // VSCodeに列追加メッセージが送信されることを確認
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'addColumn',
      data: { index: undefined }
    })
  })

  test('sorting works', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    const nameHeader = screen.getByText('Name')
    await user.click(nameHeader)
    
    // ソートが実行されることを確認（内部状態の変更）
    // ソートアイコンが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/Name ↑/)).toBeInTheDocument()
    })
  })

  test('copy functionality works', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    // セルを選択
    const cell = screen.getByText('Alice')
    await user.click(cell)
    
    // コピーボタンをクリック
    const copyButton = screen.getByText('📋 コピー')
    await user.click(copyButton)
    
    // クリップボードAPIが呼ばれることを確認
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  test('CSV export works', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    const csvButton = screen.getByText('💾 CSV')
    await user.click(csvButton)
    
    // VSCodeにエクスポートメッセージが送信されることを確認
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'exportCSV',
      data: expect.objectContaining({
        csvContent: expect.stringContaining('Name,Age,City'),
        filename: expect.stringMatching(/\.csv$/),
        encoding: 'utf8'
      })
    })
  })

  test('keyboard navigation works', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    // セルを選択
    const cell = screen.getByText('Alice')
    await user.click(cell)
    
    // 矢印キーでナビゲーション
    await user.keyboard('{ArrowRight}')
    
    // 次のセルが選択されることを確認
    const ageCell = screen.getByText('25')
    expect(ageCell.closest('td')).toHaveClass('selected')
  })

  test('context menu works with correct indices', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    // 2行目（インデックス1）の行番号を右クリック
    const rowNumber = screen.getByText('2')
    await user.pointer({ keys: '[MouseRight]', target: rowNumber })
    
    // コンテキストメニューが表示されることを確認
    expect(screen.getByText('この上に行を追加')).toBeInTheDocument()
    expect(screen.getByText('この下に行を追加')).toBeInTheDocument()
    expect(screen.getByText('この行を削除')).toBeInTheDocument()
    
    // 行削除をクリック
    const deleteButton = screen.getByText('この行を削除')
    await user.click(deleteButton)
    
    // 正しいインデックス（1）で削除メッセージが送信されることを確認
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'deleteRows',
      data: { indices: [1] }
    })
  })

  test('context menu row addition works with correct indices', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    // 2行目（インデックス1）の行番号を右クリック
    const rowNumber = screen.getByText('2')
    await user.pointer({ keys: '[MouseRight]', target: rowNumber })
    
    // 「この上に行を追加」をクリック
    const addAboveButton = screen.getByText('この上に行を追加')
    await user.click(addAboveButton)
    
    // 正しいインデックス（1）で行追加メッセージが送信されることを確認
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'addRow',
      data: { index: 1 }
    })
  })

  test('context menu column operations work with correct indices', async () => {
    const user = userEvent.setup()
    renderTableEditor()
    
    // 2列目（Age列、インデックス1）のヘッダーを右クリック
    const ageHeader = screen.getByText('Age')
    await user.pointer({ keys: '[MouseRight]', target: ageHeader })
    
    // コンテキストメニューが表示されることを確認
    expect(screen.getByText('この左に列を追加')).toBeInTheDocument()
    expect(screen.getByText('この右に列を追加')).toBeInTheDocument()
    expect(screen.getByText('この列を削除')).toBeInTheDocument()
    
    // 列削除をクリック
    const deleteColumnButton = screen.getByText('この列を削除')
    await user.click(deleteColumnButton)
    
    // 正しいインデックス（1）で削除メッセージが送信されることを確認
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'deleteColumns',
      data: { indices: [1] }
    })
  })
})