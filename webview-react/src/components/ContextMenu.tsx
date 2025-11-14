import { useTranslation } from 'react-i18next'

interface ContextMenuState {
  type: 'row' | 'column' | 'editor' | null
  index: number
  position: { x: number; y: number }
}

interface HeaderConfig {
  hasColumnHeaders: boolean
  hasRowHeaders: boolean
}

interface ContextMenuProps {
  menuState: ContextMenuState
  onAddRow: (index?: number, count?: number) => void
  onDeleteRow: (index: number) => void
  onDeleteRows?: (indices: number[]) => void
  onAddColumn: (index?: number, count?: number) => void
  onDeleteColumn: (index: number) => void
  onDeleteColumns?: (indices: number[]) => void
  onClose: () => void
  selectedCells?: Set<string>
  tableData?: { headers: string[]; rows: string[][] }
  onImportCsv?: () => void
  onExportCsv?: () => void
  onExportTsv?: () => void
  exportEncoding?: 'utf8' | 'sjis'
  onChangeEncoding?: (encoding: 'utf8' | 'sjis') => void
  onResetSort?: () => void
  onCommitSort?: () => void
  hasActiveSort?: boolean
  headerConfig?: HeaderConfig
  onToggleColumnHeaders?: () => void
  onToggleRowHeaders?: () => void
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  menuState,
  onAddRow,
  onDeleteRow,
  onDeleteRows,
  onAddColumn,
  onDeleteColumn,
  onDeleteColumns,
  onClose,
  selectedCells,
  tableData,
  onImportCsv,
  onExportCsv,
  onExportTsv,
  exportEncoding = 'utf8',
  onChangeEncoding,
  onResetSort,
  onCommitSort,
  hasActiveSort,
  headerConfig,
  onToggleColumnHeaders,
  onToggleRowHeaders
}) => {
  const { t } = useTranslation()
  if (!menuState.type) return null

  const handleAddRowAbove = () => {
    const selectedRows = getSelectedRows()
    const isCurrentRowFullySelected = isRowFullySelected(menuState.index)

    if (selectedRows.size > 1 && isCurrentRowFullySelected) {
      // Multiple rows selected - add the same number of rows above the first selected row
      const selectedRowArray = Array.from(selectedRows).sort((a, b) => a - b)
      const firstRowIndex = selectedRowArray[0]
      const selectedRowCount = selectedRows.size

      // Add multiple rows at once using count parameter
      onAddRow(firstRowIndex, selectedRowCount)
    } else {
      // Single row - add one row above
      onAddRow(menuState.index)
    }
    onClose()
  }

  const handleAddRowBelow = () => {
    const selectedRows = getSelectedRows()
    const isCurrentRowFullySelected = isRowFullySelected(menuState.index)

    if (selectedRows.size > 1 && isCurrentRowFullySelected) {
      // Multiple rows selected - add the same number of rows below the last selected row
      const selectedRowArray = Array.from(selectedRows).sort((a, b) => b - a) // Sort descending
      const lastRowIndex = selectedRowArray[0] // Highest index
      const selectedRowCount = selectedRows.size

      // Add multiple rows at once using count parameter
      onAddRow(lastRowIndex + 1, selectedRowCount)
    } else {
      // Single row - add one row below
      onAddRow(menuState.index + 1)
    }
    onClose()
  }

  // Get selected rows
  const getSelectedRows = () => {
    if (!selectedCells) return new Set<number>()
    const selectedRows = new Set<number>()
    selectedCells.forEach(cellKey => {
      const [row] = cellKey.split('-').map(Number)
      selectedRows.add(row)
    })
    return selectedRows
  }

  // Get selected columns
  const getSelectedColumns = () => {
    if (!selectedCells) return new Set<number>()
    const selectedColumns = new Set<number>()
    selectedCells.forEach(cellKey => {
      const [, col] = cellKey.split('-').map(Number)
      selectedColumns.add(col)
    })
    return selectedColumns
  }

  // Check if a row is fully selected
  const isRowFullySelected = (rowIndex: number) => {
    if (!selectedCells || !tableData) return false
    for (let col = 0; col < tableData.headers.length; col++) {
      if (!selectedCells.has(`${rowIndex}-${col}`)) {
        return false
      }
    }
    return true
  }

  // Check if a column is fully selected
  const isColumnFullySelected = (colIndex: number) => {
    if (!selectedCells || !tableData) return false
    for (let row = 0; row < tableData.rows.length; row++) {
      if (!selectedCells.has(`${row}-${colIndex}`)) {
        return false
      }
    }
    return true
  }

  const handleDeleteRow = () => {
    const selectedRows = getSelectedRows()
    const isCurrentRowFullySelected = isRowFullySelected(menuState.index)
    
    if (selectedRows.size > 1 && isCurrentRowFullySelected && onDeleteRows) {
      // Multiple rows selected, delete all
      const rowIndices = Array.from(selectedRows).sort((a, b) => b - a) // Sort descending for safe deletion
      onDeleteRows(rowIndices)
    } else {
      // Single row deletion
      onDeleteRow(menuState.index)
    }
    onClose()
  }

  const handleAddColumnLeft = () => {
    const selectedColumns = getSelectedColumns()
    const isCurrentColumnFullySelected = isColumnFullySelected(menuState.index)

    if (selectedColumns.size > 1 && isCurrentColumnFullySelected) {
      // Multiple columns selected - add the same number of columns to the left of the first selected column
      const selectedColumnArray = Array.from(selectedColumns).sort((a, b) => a - b)
      const firstColumnIndex = selectedColumnArray[0]
      const selectedColumnCount = selectedColumns.size

      // Add multiple columns at once using count parameter
      onAddColumn(firstColumnIndex, selectedColumnCount)
    } else {
      // Single column - add one column to the left
      onAddColumn(menuState.index)
    }
    onClose()
  }

  const handleAddColumnRight = () => {
    const selectedColumns = getSelectedColumns()
    const isCurrentColumnFullySelected = isColumnFullySelected(menuState.index)

    if (selectedColumns.size > 1 && isCurrentColumnFullySelected) {
      // Multiple columns selected - add the same number of columns to the right of the last selected column
      const selectedColumnArray = Array.from(selectedColumns).sort((a, b) => b - a) // Sort descending
      const lastColumnIndex = selectedColumnArray[0] // Highest index
      const selectedColumnCount = selectedColumns.size

      // Add multiple columns at once using count parameter
      onAddColumn(lastColumnIndex + 1, selectedColumnCount)
    } else {
      // Single column - add one column to the right
      onAddColumn(menuState.index + 1)
    }
    onClose()
  }

  const handleDeleteColumn = () => {
    const selectedColumns = getSelectedColumns()
    
    if (selectedColumns.size > 1 && selectedColumns.has(menuState.index) && onDeleteColumns) {
      // Multiple columns selected, delete all
      const columnIndices = Array.from(selectedColumns).sort((a, b) => b - a) // Sort descending for safe deletion
      onDeleteColumns(columnIndices)
    } else {
      // Single column deletion
      onDeleteColumn(menuState.index)
    }
    onClose()
  }

  const adjustedPosition = {
    x: Math.min(menuState.position.x, window.innerWidth - 220),
    y: Math.min(menuState.position.y, window.innerHeight - 200)
  }

  if (menuState.type === 'editor') {
    return (
      <>
        <div
          className="context-menu-backdrop"
          onClick={onClose}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
        />
        <div
          className="context-menu"
          style={{ position: 'fixed', left: adjustedPosition.x, top: adjustedPosition.y, zIndex: 1000 }}
        >
          <button className="context-menu-item" onClick={() => { onImportCsv?.(); onClose(); }}>
            <span className="context-menu-icon">📥</span>
            <span className="context-menu-label">{t('importCsvAuto')}</span>
          </button>
          <div className="context-menu-separator"></div>
          <button className="context-menu-item" onClick={() => { onToggleColumnHeaders?.(); onClose(); }}>
            <span className="context-menu-icon">{headerConfig?.hasColumnHeaders ? '✓' : ''}</span>
            <span className="context-menu-label">{t('contextMenu.showColumnHeaders')}</span>
          </button>
          <button className="context-menu-item" onClick={() => { onToggleRowHeaders?.(); onClose(); }}>
            <span className="context-menu-icon">{headerConfig?.hasRowHeaders ? '✓' : ''}</span>
            <span className="context-menu-label">{t('contextMenu.showRowHeaders')}</span>
          </button>
          <div className="context-menu-separator"></div>
          <button className="context-menu-item" onClick={() => { onResetSort?.(); onClose(); }} disabled={!hasActiveSort}>
            <span className="context-menu-icon">🗂️</span>
            <span className="context-menu-label">{t('contextMenu.resetSort')}</span>
          </button>
          <button className="context-menu-item" onClick={() => { onCommitSort?.(); onClose(); }} disabled={!hasActiveSort}>
            <span className="context-menu-icon">💾</span>
            <span className="context-menu-label">{t('contextMenu.commitSort')}</span>
          </button>
          <div className="context-menu-separator"></div>
          <button className="context-menu-item" onClick={() => { onExportCsv?.(); onClose(); }}>
            <span className="context-menu-icon">📄</span>
            <span className="context-menu-label">{t('contextMenu.exportCsv', { encoding: exportEncoding.toUpperCase() })}</span>
          </button>
          <button className="context-menu-item" onClick={() => { onExportTsv?.(); onClose(); }}>
            <span className="context-menu-icon">📋</span>
            <span className="context-menu-label">{t('contextMenu.exportTsv', { encoding: exportEncoding.toUpperCase() })}</span>
          </button>
          <div className="context-menu-separator"></div>
          <button className="context-menu-item" onClick={() => { onChangeEncoding?.('utf8'); onClose(); }}>
            <span className="context-menu-icon">{exportEncoding === 'utf8' ? '✓' : ''}</span>
            <span className="context-menu-label">UTF-8</span>
          </button>
          <button className="context-menu-item" onClick={() => { onChangeEncoding?.('sjis'); onClose(); }}>
            <span className="context-menu-icon">{exportEncoding === 'sjis' ? '✓' : ''}</span>
            <span className="context-menu-label">Shift_JIS</span>
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Backdrop to close menu */}
      <div 
        className="context-menu-backdrop" 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999
        }}
      />
      
      {menuState.type === 'row' && (
        <div 
          className="context-menu" 
          style={{
            position: 'fixed',
            left: adjustedPosition.x,
            top: adjustedPosition.y,
            zIndex: 1000
          }}
        >
          <button className="context-menu-item" onClick={handleAddRowAbove}>
            <span className="context-menu-icon">⬆️</span>
            <span className="context-menu-label">
              {getSelectedRows().size > 1 && isRowFullySelected(menuState.index)
                ? t('contextMenu.addRowsAbove', { count: getSelectedRows().size })
                : t('contextMenu.addRowAbove')}
            </span>
          </button>
          <button className="context-menu-item" onClick={handleAddRowBelow}>
            <span className="context-menu-icon">⬇️</span>
            <span className="context-menu-label">
              {getSelectedRows().size > 1 && isRowFullySelected(menuState.index)
                ? t('contextMenu.addRowsBelow', { count: getSelectedRows().size })
                : t('contextMenu.addRowBelow')}
            </span>
          </button>
          <div className="context-menu-separator"></div>
          <button className="context-menu-item" onClick={handleDeleteRow}>
            <span className="context-menu-icon">🗑️</span>
            <span className="context-menu-label">
              {getSelectedRows().size > 1 && isRowFullySelected(menuState.index)
                ? t('contextMenu.deleteSelectedRows', { count: getSelectedRows().size })
                : t('contextMenu.deleteThisRow')}
            </span>
          </button>
        </div>
      )}

      {menuState.type === 'column' && (
        <div 
          className="context-menu" 
          style={{
            position: 'fixed',
            left: adjustedPosition.x,
            top: adjustedPosition.y,
            zIndex: 1000
          }}
        >
          <button className="context-menu-item" onClick={handleAddColumnLeft}>
            <span className="context-menu-icon">⬅️</span>
            <span className="context-menu-label">
              {getSelectedColumns().size > 1 && isColumnFullySelected(menuState.index)
                ? t('contextMenu.addColumnsLeft', { count: getSelectedColumns().size })
                : t('contextMenu.addColumnLeft')}
            </span>
          </button>
          <button className="context-menu-item" onClick={handleAddColumnRight}>
            <span className="context-menu-icon">➡️</span>
            <span className="context-menu-label">
              {getSelectedColumns().size > 1 && isColumnFullySelected(menuState.index)
                ? t('contextMenu.addColumnsRight', { count: getSelectedColumns().size })
                : t('contextMenu.addColumnRight')}
            </span>
          </button>
          <div className="context-menu-separator"></div>
          <button className="context-menu-item" onClick={handleDeleteColumn}>
            <span className="context-menu-icon">🗑️</span>
            <span className="context-menu-label">
              {getSelectedColumns().size > 1 && getSelectedColumns().has(menuState.index)
                ? t('contextMenu.deleteSelectedColumns', { count: getSelectedColumns().size })
                : t('contextMenu.deleteThisColumn')}
            </span>
          </button>
        </div>
      )}
    </>
  )
}

export type { ContextMenuState }
export default ContextMenu
