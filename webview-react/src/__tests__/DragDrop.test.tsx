import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import TableEditor from '../components/TableEditor'
import { StatusProvider } from '../contexts/StatusContext'
import { TableData } from '../types'

const mockSendMessage = jest.fn()

const sampleTableData: TableData = {
  headers: ['Name', 'Age', 'City'],
  rows: [
    ['Alice', '25', 'Tokyo'],
    ['Bob', '30', 'Osaka'],
    ['Charlie', '35', 'Kyoto']
  ]
}

const MockTableEditor = ({ tableData }: { tableData: TableData }) => (
  <StatusProvider>
    <TableEditor
      tableData={tableData}
      onTableUpdate={() => {}}
      onSendMessage={mockSendMessage}
    />
  </StatusProvider>
)

describe('TableEditor - Drag and Drop', () => {
  beforeEach(() => {
    mockSendMessage.mockClear()
    // DOMにdraggableイベントのサポートを追加（まだ定義されていない場合のみ）
    if (!global.DragEvent) {
      Object.defineProperty(global, 'DragEvent', {
        value: class DragEvent extends Event {
          dataTransfer: any
          constructor(type: string, options: any = {}) {
            super(type, options)
            this.dataTransfer = {
              dropEffect: 'move',
              effectAllowed: 'move',
              files: [],
              items: [],
              types: [],
              clearData: jest.fn(),
              getData: jest.fn(),
              setData: jest.fn(),
              setDragImage: jest.fn()
            }
          }
        },
        writable: true,
        configurable: true
      })
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Row Movement', () => {
    test('should send moveRow message when dragging and dropping a row', async () => {
      render(<MockTableEditor tableData={sampleTableData} />)
      
      // 行番号セル（ドラッグ可能要素）を取得
      const rowNumbers = screen.getAllByRole('cell', { name: /^[123]$/ }).filter(cell => 
        cell.classList.contains('row-number')
      )
      expect(rowNumbers).toHaveLength(3)
      
      const firstRowNumber = rowNumbers[0]
      const thirdRowNumber = rowNumbers[2]
      
      // ドラッグ開始
      fireEvent.dragStart(firstRowNumber, {
        dataTransfer: {
          effectAllowed: 'move',
          setData: jest.fn(),
          getData: jest.fn(() => 'row:0')
        }
      })

      // ドラッグオーバー
      fireEvent.dragOver(thirdRowNumber, {
        dataTransfer: {
          dropEffect: 'move'
        }
      })

      // ドロップ
      fireEvent.drop(thirdRowNumber, {
        dataTransfer: {
          getData: jest.fn(() => 'row:0')
        }
      })

      // moveRowメッセージが送信されることを確認
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          command: 'moveRow',
          data: {
            fromIndex: 0,
            toIndex: 2
          }
        })
      })
    })

    test('should display drop indicator during row drag', async () => {
      render(<MockTableEditor tableData={sampleTableData} />)
      
      const rowNumbers = screen.getAllByRole('cell', { name: /^[123]$/ }).filter(cell => 
        cell.classList.contains('row-number')
      )
      const firstRowNumber = rowNumbers[0]
      const secondRowNumber = rowNumbers[1]
      
      // ドラッグ開始
      act(() => {
        fireEvent.dragStart(firstRowNumber, {
          dataTransfer: {
            effectAllowed: 'move',
            setData: jest.fn()
          }
        })
      })
      
      // ドラッグオーバー時にドロップインジケータが表示される
      act(() => {
        fireEvent.dragOver(secondRowNumber, {
          dataTransfer: { dropEffect: 'move' }
        })
      })
      
      // ドロップインジケータの存在を確認
      await waitFor(() => {
        const dropIndicator = document.querySelector('.drop-indicator.row')
        expect(dropIndicator).toBeInTheDocument()
      })
      
      // ドラッグ終了
      act(() => {
        fireEvent.dragEnd(firstRowNumber)
      })
      
      // ドロップインジケータが削除される
      await waitFor(() => {
        const dropIndicator = document.querySelector('.drop-indicator')
        expect(dropIndicator).not.toBeInTheDocument()
      })
    })
  })

  describe('Column Movement', () => {
    test('should send moveColumn message when dragging and dropping a column', async () => {
      render(<MockTableEditor tableData={sampleTableData} />)
      
      // 列ヘッダー（ドラッグ可能要素）を取得
      const nameHeader = screen.getByText('Name')
      const cityHeader = screen.getByText('City')
      
      // ドラッグ開始
      fireEvent.dragStart(nameHeader, {
        dataTransfer: {
          effectAllowed: 'move',
          setData: jest.fn(),
          getData: jest.fn(() => 'column:0')
        }
      })

      // ドラッグオーバー
      fireEvent.dragOver(cityHeader, {
        dataTransfer: {
          dropEffect: 'move'
        }
      })

      // ドロップ
      fireEvent.drop(cityHeader, {
        dataTransfer: {
          getData: jest.fn(() => 'column:0')
        }
      })

      // moveColumnメッセージが送信されることを確認
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          command: 'moveColumn',
          data: {
            fromIndex: 0,
            toIndex: 2
          }
        })
      })
    })

    test('should display drop indicator during column drag', async () => {
      render(<MockTableEditor tableData={sampleTableData} />)
      
      const nameHeader = screen.getByText('Name')
      const ageHeader = screen.getByText('Age')
      
      // ドラッグ開始
      act(() => {
        fireEvent.dragStart(nameHeader, {
          dataTransfer: {
            effectAllowed: 'move',
            setData: jest.fn()
          }
        })
      })
      
      // ドラッグオーバー時にドロップインジケータが表示される
      act(() => {
        fireEvent.dragOver(ageHeader, {
          dataTransfer: { dropEffect: 'move' }
        })
      })
      
      // ドロップインジケータの存在を確認
      await waitFor(() => {
        const dropIndicator = document.querySelector('.drop-indicator.column')
        expect(dropIndicator).toBeInTheDocument()
      })
      
      // ドラッグ終了
      act(() => {
        fireEvent.dragEnd(nameHeader)
      })
      
      // ドロップインジケータが削除される
      await waitFor(() => {
        const dropIndicator = document.querySelector('.drop-indicator')
        expect(dropIndicator).not.toBeInTheDocument()
      })
    })
  })

  describe('Visual Feedback', () => {
    test('should apply drag-over class during drag operations', async () => {
      render(<MockTableEditor tableData={sampleTableData} />)
      
      const rowNumbers = screen.getAllByRole('cell', { name: /^[123]$/ }).filter(cell => 
        cell.classList.contains('row-number')
      )
      const secondRowNumber = rowNumbers[1]
      
      // ドラッグエンター
      act(() => {
        fireEvent.dragEnter(secondRowNumber, {
          dataTransfer: { dropEffect: 'move' }
        })
      })
      
      // drag-overクラスが追加される
      expect(secondRowNumber).toHaveClass('drag-over')
      
      // ドラッグリーブ
      act(() => {
        fireEvent.dragLeave(secondRowNumber)
      })
      
      // drag-overクラスが削除される
      expect(secondRowNumber).not.toHaveClass('drag-over')
    })

    test('should reset visual state on drag end', async () => {
      render(<MockTableEditor tableData={sampleTableData} />)
      
      const rowNumbers = screen.getAllByRole('cell', { name: /^[123]$/ }).filter(cell => 
        cell.classList.contains('row-number')
      )
      const firstRowNumber = rowNumbers[0]
      
      // 不透明度を変更してドラッグ開始をシミュレート
      act(() => {
        fireEvent.dragStart(firstRowNumber)
        if (firstRowNumber instanceof HTMLElement) {
          firstRowNumber.style.opacity = '0.5'
        }
      })
      
      expect(firstRowNumber.style.opacity).toBe('0.5')
      
      // ドラッグ終了
      act(() => {
        fireEvent.dragEnd(firstRowNumber)
      })
      
      // 不透明度がリセットされる
      expect(firstRowNumber.style.opacity).toBe('1')
    })
  })
})