import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import TableEditor from '../components/TableEditor'
import { StatusProvider } from '../contexts/StatusContext'
import { DynamicThemeProvider } from '../contexts/DynamicThemeContext'
import { TableData } from '../types'

const mockTableData: TableData = {
  headers: ['A', 'B', 'C'],
  rows: [
    ['short', 'multi\nline\ntext', 'x'],
    ['row2', 'b2', 'c2']
  ]
}

describe('Edit mode textbox height spec', () => {
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

  test('textarea height matches row max height during edit', async () => {
    const user = userEvent.setup()
    setup()

    // 1行目を編集開始（B列は複数行で高さが高い想定）
    const cell = screen.getByText('short')
    await user.dblClick(cell)

    const textarea = screen.getByDisplayValue('short') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()

    // 親 <td> へ rowMaxHeight を模擬的に付与し、heightUpdate を発火
    const td = textarea.closest('td') as HTMLElement
    td.dataset.rowMaxHeight = '64'
    td.dataset.originalHeight = '20'

    const event = new CustomEvent('heightUpdate', { detail: { originalHeight: 20, rowMaxHeight: 64 } })
    textarea.dispatchEvent(event)

    // CellEditor は textarea.style.height ではなく td.style.height / td.style.minHeight を設定する
    // jsdom では scrollHeight が 0 のため finalHeight = max(32, 64, 0) = 64
    expect(td.style.height).toBe('64px')
    expect(td.style.minHeight).toBe('64px')
    // 行最大より大きいコンテンツではスクロール許可（jsdom では scrollHeight は 0 なので multiline にはならない）
    expect(textarea.getAttribute('data-multiline')).toBeNull()
  })
})
