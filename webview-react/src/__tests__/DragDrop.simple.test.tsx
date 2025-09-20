import { render, screen, fireEvent } from '@testing-library/react'
import TableEditor from '../components/TableEditor'
import { StatusProvider } from '../contexts/StatusContext'
import { TableData } from '../types'

const mockSendMessage = jest.fn()

// VS Code APIのモック
if (!window.acquireVsCodeApi) {
  Object.defineProperty(window, 'acquireVsCodeApi', {
    value: () => ({
      postMessage: mockSendMessage
    }),
    writable: true,
    configurable: true
  })
}

// テスト用のコンポーネント
const MockTableEditor = ({ tableData }: { tableData: TableData }) => (
  <StatusProvider>
    <TableEditor
      tableData={tableData}
      onTableUpdate={() => {}}
      onSendMessage={mockSendMessage}
    />
  </StatusProvider>
)

const sampleTableData: TableData = {
  headers: ['Name', 'Age', 'City'],
  rows: [
    ['Alice', '25', 'Tokyo'],
    ['Bob', '30', 'Osaka'],
    ['Charlie', '35', 'Kyoto']
  ]
}

describe('TableEditor - Simple Drag and Drop Tests', () => {
  beforeEach(() => {
    mockSendMessage.mockClear()
  })

  test('should render row numbers correctly', () => {
    render(<MockTableEditor tableData={sampleTableData} />)
    
    // 行番号セルを取得
    const rowNumber1 = screen.getByRole('cell', { name: '1' })
    const rowNumber2 = screen.getByRole('cell', { name: '2' })
    const rowNumber3 = screen.getByRole('cell', { name: '3' })
    
    expect(rowNumber1).toBeInTheDocument()
    expect(rowNumber2).toBeInTheDocument()
    expect(rowNumber3).toBeInTheDocument()
    
    // draggable属性をチェック
    expect(rowNumber1).toHaveAttribute('draggable', 'true')
    expect(rowNumber2).toHaveAttribute('draggable', 'true')
    expect(rowNumber3).toHaveAttribute('draggable', 'true')
  })

  test('should send moveRow message when dragging rows', () => {
    render(<MockTableEditor tableData={sampleTableData} />)
    
    const rowNumber1 = screen.getByRole('cell', { name: '1' })
    const rowNumber3 = screen.getByRole('cell', { name: '3' })
    
    // ドラッグ開始
    fireEvent.dragStart(rowNumber1)
    
    // ドロップ
    fireEvent.drop(rowNumber3)
    
    // moveRowメッセージが送信されたか確認
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'moveRow'
      })
    )
  })
})