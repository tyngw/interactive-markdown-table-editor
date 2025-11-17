import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ContextMenu from '../components/ContextMenu'

/**
 * Import CSV Context Menu Integration Tests
 *
 * These tests ensure that the Import CSV functionality in the context menu
 * is properly wired up and calls the correct callback when clicked.
 * This prevents regression where the menu item exists but doesn't work.
 */
describe('ContextMenu - Import CSV Integration', () => {
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
      ['Row2Col1', 'Row2Col2', 'Row2Col3']
    ]
  }

  const mockHeaderConfig = {
    hasColumnHeaders: true,
    hasRowHeaders: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Import CSV Menu Item', () => {
    test('should render Import CSV menu item in editor context menu', () => {
      const menuState = {
        type: 'editor' as const,
        index: -1,
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          tableData={mockTableData}
          onImportCsv={mockOnImportCsv}
          onExportCsv={mockOnExportCsv}
          onExportTsv={mockOnExportTsv}
          exportEncoding="utf8"
          onChangeEncoding={mockOnChangeEncoding}
          onResetSort={mockOnResetSort}
          onCommitSort={mockOnCommitSort}
          hasActiveSort={false}
          headerConfig={mockHeaderConfig}
          onToggleColumnHeaders={mockOnToggleColumnHeaders}
          onToggleRowHeaders={mockOnToggleRowHeaders}
        />
      )

      // Import CSV menu item should be present
      const importCsvButton = screen.getByText(/Import CSV/i)
      expect(importCsvButton).toBeInTheDocument()
    })

    test('should call onImportCsv callback when Import CSV is clicked', async () => {
      const user = userEvent.setup()

      const menuState = {
        type: 'editor' as const,
        index: -1,
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          tableData={mockTableData}
          onImportCsv={mockOnImportCsv}
          onExportCsv={mockOnExportCsv}
          onExportTsv={mockOnExportTsv}
          exportEncoding="utf8"
          onChangeEncoding={mockOnChangeEncoding}
          onResetSort={mockOnResetSort}
          onCommitSort={mockOnCommitSort}
          hasActiveSort={false}
          headerConfig={mockHeaderConfig}
          onToggleColumnHeaders={mockOnToggleColumnHeaders}
          onToggleRowHeaders={mockOnToggleRowHeaders}
        />
      )

      // Click Import CSV
      const importCsvButton = screen.getByText(/Import CSV/i)
      await user.click(importCsvButton)

      // Should call onImportCsv exactly once
      expect(mockOnImportCsv).toHaveBeenCalledTimes(1)

      // Should also close the menu
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    test('should not render Import CSV in row context menu', () => {
      const menuState = {
        type: 'row' as const,
        index: 0,
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          tableData={mockTableData}
          onImportCsv={mockOnImportCsv}
        />
      )

      // Import CSV should NOT be in row context menu
      expect(screen.queryByText(/Import CSV/i)).not.toBeInTheDocument()
    })

    test('should not render Import CSV in column context menu', () => {
      const menuState = {
        type: 'column' as const,
        index: 0,
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          tableData={mockTableData}
          onImportCsv={mockOnImportCsv}
        />
      )

      // Import CSV should NOT be in column context menu
      expect(screen.queryByText(/Import CSV/i)).not.toBeInTheDocument()
    })

    test('should handle missing onImportCsv callback gracefully', async () => {
      const user = userEvent.setup()

      const menuState = {
        type: 'editor' as const,
        index: -1,
        position: { x: 100, y: 100 }
      }

      // Render without onImportCsv callback
      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          tableData={mockTableData}
          onExportCsv={mockOnExportCsv}
          onExportTsv={mockOnExportTsv}
          exportEncoding="utf8"
          onChangeEncoding={mockOnChangeEncoding}
          onResetSort={mockOnResetSort}
          onCommitSort={mockOnCommitSort}
          hasActiveSort={false}
          headerConfig={mockHeaderConfig}
          onToggleColumnHeaders={mockOnToggleColumnHeaders}
          onToggleRowHeaders={mockOnToggleRowHeaders}
        />
      )

      const importCsvButton = screen.getByText(/Import CSV/i)

      // Should not throw an error when clicked
      await expect(user.click(importCsvButton)).resolves.not.toThrow()

      // Menu should still close
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Menu Item Order and Grouping', () => {
    test('Import CSV should appear before header toggles', () => {
      const menuState = {
        type: 'editor' as const,
        index: -1,
        position: { x: 100, y: 100 }
      }

      const { container } = render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          tableData={mockTableData}
          onImportCsv={mockOnImportCsv}
          onExportCsv={mockOnExportCsv}
          onExportTsv={mockOnExportTsv}
          exportEncoding="utf8"
          onChangeEncoding={mockOnChangeEncoding}
          onResetSort={mockOnResetSort}
          onCommitSort={mockOnCommitSort}
          hasActiveSort={false}
          headerConfig={mockHeaderConfig}
          onToggleColumnHeaders={mockOnToggleColumnHeaders}
          onToggleRowHeaders={mockOnToggleRowHeaders}
        />
      )

      const menuItems = container.querySelectorAll('.context-menu-item')
      const menuTexts = Array.from(menuItems).map(item => item.textContent)

      // Import CSV should be the first item
      expect(menuTexts[0]).toContain('Import CSV')
    })
  })

  describe('Export CSV Integration (for comparison)', () => {
    test('Export CSV should also work correctly', async () => {
      const user = userEvent.setup()

      const menuState = {
        type: 'editor' as const,
        index: -1,
        position: { x: 100, y: 100 }
      }

      render(
        <ContextMenu
          menuState={menuState}
          onAddRow={mockOnAddRow}
          onDeleteRow={mockOnDeleteRow}
          onDeleteRows={mockOnDeleteRows}
          onAddColumn={mockOnAddColumn}
          onDeleteColumn={mockOnDeleteColumn}
          onDeleteColumns={mockOnDeleteColumns}
          onClose={mockOnClose}
          tableData={mockTableData}
          onImportCsv={mockOnImportCsv}
          onExportCsv={mockOnExportCsv}
          onExportTsv={mockOnExportTsv}
          exportEncoding="utf8"
          onChangeEncoding={mockOnChangeEncoding}
          onResetSort={mockOnResetSort}
          onCommitSort={mockOnCommitSort}
          hasActiveSort={false}
          headerConfig={mockHeaderConfig}
          onToggleColumnHeaders={mockOnToggleColumnHeaders}
          onToggleRowHeaders={mockOnToggleRowHeaders}
        />
      )

      // Click Export CSV
      const exportCsvButton = screen.getByText(/Export CSV/i)
      await user.click(exportCsvButton)

      // Both Import and Export should follow the same pattern
      expect(mockOnExportCsv).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })
});
