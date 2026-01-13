import React from 'react'
import { render, waitFor } from '@testing-library/react'
import TableEditor from '../components/TableEditor'
import { StatusProvider } from '../contexts/StatusContext'
import { DynamicThemeProvider } from '../contexts/DynamicThemeContext'

// Mock react-i18next to avoid initializing real i18n in tests
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: any) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} }
}))

const minimalTableData = {
  headers: ['A', 'B', 'C'],
  rows: [['1', '2', '3'], ['4', '5', '6']],
  columnDiff: undefined,
  gitDiff: undefined
}

describe('TableEditor scroll-padding behavior', () => {
  test('sets scrollPaddingTop/Left on .table-container based on header and row-number', async () => {
    const onTableUpdate = jest.fn()
    const onSendMessage = jest.fn()

    const { container } = render(
      <DynamicThemeProvider>
        <StatusProvider>
          <div>
            <TableEditor
              tableData={minimalTableData as any}
              onTableUpdate={onTableUpdate}
              onSendMessage={onSendMessage}
            />
          </div>
        </StatusProvider>
      </DynamicThemeProvider>
    )

    // Wait for effect to run and style to be applied
    await waitFor(() => {
      const tableContainer = container.querySelector('.table-container') as HTMLElement | null
      expect(tableContainer).not.toBeNull()
      // scrollPaddingTop and scrollPaddingLeft should be non-empty strings
      const top = tableContainer!.style.scrollPaddingTop
      const left = tableContainer!.style.scrollPaddingLeft
      expect(top).toBeTruthy()
      expect(left).toBeTruthy()
      // Should be pixel values
      expect(top).toMatch(/px$/)
      expect(left).toMatch(/px$/)
    })
  })
})
