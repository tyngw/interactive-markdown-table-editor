import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import TableEditor from '../components/TableEditor'
import { StatusProvider } from '../contexts/StatusContext'
import { DynamicThemeProvider } from '../contexts/DynamicThemeContext'
import { TableData } from '../types'

const mockTableData: TableData = {
  headers: ['A', 'B'],
  rows: [
    ['short', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
  ]
}

describe('Edit mode textbox dynamic height', () => {
  const mockOnTableUpdate = jest.fn()
  const mockOnSendMessage = jest.fn()

  const setup = () => render(
    <DynamicThemeProvider>
      <StatusProvider>
        <TableEditor
          tableData={mockTableData}
          onTableUpdate={mockOnTableUpdate}
          onSendMessage={mockOnSendMessage}
        />
      </StatusProvider>
    </DynamicThemeProvider>
  )

  test('height grows to match edited content if it becomes the max', async () => {
    const user = userEvent.setup()
    setup()

    // B列が多文字で高い前提、A列を編集してさらに長くする
    const cell = screen.getByText('short')
    await user.dblClick(cell)

    const textarea = screen.getByDisplayValue('short') as HTMLTextAreaElement
    const td = textarea.closest('td') as HTMLElement

    // 初期 rowMaxHeight を 48 に設定
    td.dataset.rowMaxHeight = '48'
    td.dataset.originalHeight = '20'
    textarea.dispatchEvent(new CustomEvent('heightUpdate', { detail: { originalHeight: 20, rowMaxHeight: 48 } }))

    // 値を長くする（jsdomではscrollHeight反映が難しいため文字追加後に heightUpdate を再度送る）
    textarea.value = 'long\n'.repeat(50)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))

    // 疑似的に contentHeight がより大きくなったケースを heightUpdate で再通知
    textarea.dispatchEvent(new CustomEvent('heightUpdate', { detail: { rowMaxHeight: 120 } }))

    // CellEditor は td.style.height を設定する（textarea.style.height ではない）
    // jsdom では scrollHeight=0 なので finalHeight = max(32, 120, 0) = 120
    expect(parseInt(td.style.height || '0', 10)).toBeGreaterThanOrEqual(120)
  })
})
