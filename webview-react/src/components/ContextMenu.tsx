import { useTheme } from '../contexts/ThemeContext'

interface ContextMenuState {
  type: 'row' | 'column' | null
  index: number
  position: { x: number; y: number }
}

interface ContextMenuProps {
  menuState: ContextMenuState
  onAddRow: (index?: number) => void
  onDeleteRow: (index: number) => void
  onDeleteRows?: (indices: number[]) => void
  onAddColumn: (index?: number) => void
  onDeleteColumn: (index: number) => void
  onDeleteColumns?: (indices: number[]) => void
  onClose: () => void
  selectedCells?: Set<string>
  tableData?: { headers: string[]; rows: string[][] }
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
  tableData
}) => {
  const { getStyle } = useTheme()
  if (!menuState.type) return null

  const handleAddRowAbove = () => {
    onAddRow(menuState.index)
    onClose()
  }

  const handleAddRowBelow = () => {
    onAddRow(menuState.index + 1)
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
    onAddColumn(menuState.index)
    onClose()
  }

  const handleAddColumnRight = () => {
    onAddColumn(menuState.index + 1)
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

  // Adjust menu position to keep it in viewport
  const adjustedPosition = {
    x: Math.min(menuState.position.x, window.innerWidth - 200), // Assume menu width ~200px
    y: Math.min(menuState.position.y, window.innerHeight - 150) // Assume menu height ~150px
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
            <span className="context-menu-label">この上に行を追加</span>
          </button>
          <button className="context-menu-item" onClick={handleAddRowBelow}>
            <span className="context-menu-icon">⬇️</span>
            <span className="context-menu-label">この下に行を追加</span>
          </button>
          <div className="context-menu-separator"></div>
          <button className="context-menu-item" onClick={handleDeleteRow}>
            <span className="context-menu-icon">🗑️</span>
            <span className="context-menu-label">
              {getSelectedRows().size > 1 && isRowFullySelected(menuState.index) 
                ? `選択した${getSelectedRows().size}行を削除` 
                : 'この行を削除'}
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
            <span className="context-menu-label">この左に列を追加</span>
          </button>
          <button className="context-menu-item" onClick={handleAddColumnRight}>
            <span className="context-menu-icon">➡️</span>
            <span className="context-menu-label">この右に列を追加</span>
          </button>
          <div className="context-menu-separator"></div>
          <button className="context-menu-item" onClick={handleDeleteColumn}>
            <span className="context-menu-icon">🗑️</span>
            <span className="context-menu-label">
              {getSelectedColumns().size > 1 && getSelectedColumns().has(menuState.index)
                ? `選択した${getSelectedColumns().size}列を削除`
                : 'この列を削除'}
            </span>
          </button>
        </div>
      )}
    </>
  )
}

export type { ContextMenuState }
export default ContextMenu