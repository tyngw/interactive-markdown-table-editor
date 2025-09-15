import { useCallback, useRef } from 'react'
import { EditorState, CellPosition } from '../types'
import { processCellContent, processCellContentForEditing, processCellContentForStorage } from '../utils/contentConverter'
import CellEditor from './CellEditor'
import { getColumnLetter } from '../utils/tableUtils'

interface TableBodyProps {
  headers: string[]
  rows: string[][]
  editorState: EditorState
  onCellUpdate: (row: number, col: number, value: string) => void
  onCellSelect: (row: number, col: number, extend?: boolean, toggle?: boolean) => void
  onCellEdit: (position: CellPosition | null) => void
  onAddRow: (index?: number) => void
  onDeleteRow: (index: number) => void
  onRowSelect?: (row: number, event: React.MouseEvent) => void
  onShowRowContextMenu?: (event: React.MouseEvent, row: number) => void
  getDragProps?: (type: 'row' | 'column', index: number) => any
  getDropProps?: (type: 'row' | 'column', index: number) => any
  selectedRows?: Set<number>
  virtualization?:
    | { enabled: false }
    | { enabled: true; startIndex: number; endIndex: number; topPadding: number; bottomPadding: number }
}

const TableBody: React.FC<TableBodyProps> = ({
  headers,
  rows,
  editorState,
  onCellUpdate,
  onCellSelect,
  onCellEdit,
  onRowSelect,
  onShowRowContextMenu,
  getDragProps,
  getDropProps,
  selectedRows,
  virtualization
}) => {
  const savedHeightsRef = useRef<Map<string, { original: number; maxOther: number }>>(new Map())
  const v = virtualization && virtualization.enabled ? virtualization : null
  const visibleRows = v ? rows.slice(v.startIndex, v.endIndex) : rows

  const handleCellMouseDown = useCallback((row: number, col: number, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).classList.contains('cell-input')) {
      return
    }
    const extend = event.shiftKey
    const toggle = event.ctrlKey || event.metaKey
    onCellSelect(row, col, extend, toggle)
  }, [onCellSelect])

  const handleRowContextMenu = useCallback((e: React.MouseEvent, rowIndex: number) => {
    e.preventDefault()
    if (onShowRowContextMenu) {
      onShowRowContextMenu(e, rowIndex)
    }
  }, [onShowRowContextMenu])

  // 列記号はユーティリティから提供

  const isCellSelected = useCallback((row: number, col: number) => {
    return editorState.selectedCells.has(`${row}-${col}`)
  }, [editorState.selectedCells])

  const isCellEditing = useCallback((row: number, col: number) => {
    return editorState.currentEditingCell?.row === row && 
           editorState.currentEditingCell?.col === col
  }, [editorState.currentEditingCell])

  const startCellEdit = useCallback((row: number, col: number) => {
    try {
      const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
      if (cellElement instanceof HTMLElement) {
        const originalHeight = cellElement.offsetHeight
        cellElement.dataset.originalHeight = originalHeight.toString()
        const rowElement = cellElement.closest('tr')
        let maxOther = 0
        if (rowElement) {
          const rowCells = rowElement.querySelectorAll('td[data-col]')
          rowCells.forEach((c) => {
            if (c !== cellElement && c instanceof HTMLElement) {
              const height = c.offsetHeight
              maxOther = Math.max(maxOther, height)
            }
          })
        }
        cellElement.dataset.maxOtherHeight = String(maxOther)
        savedHeightsRef.current.set(`${row}-${col}`, { original: originalHeight, maxOther })
      }
    } catch (error) {
      // console.warn('Failed to save original cell height:', error)
    }
    onCellEdit({ row, col })
  }, [onCellEdit])

  const commitCellEdit = useCallback((row: number, col: number, value: string, move?: 'right' | 'left' | 'down' | 'up') => {
    const storageValue = processCellContentForStorage(value)
    onCellUpdate(row, col, storageValue)
    
    try {
      const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
      if (cellElement instanceof HTMLElement) {
        if (cellElement.dataset.originalHeight) delete cellElement.dataset.originalHeight
        if (cellElement.dataset.maxOtherHeight) delete cellElement.dataset.maxOtherHeight
      }
    } catch (error) {
      // console.warn('Failed to cleanup original height:', error)
    }
    
    onCellEdit(null)
    if (typeof move !== 'undefined') {
      let nextRow = row
      let nextCol = col
      const maxRow = rows.length - 1
      const maxCol = headers.length - 1
      switch (move) {
        case 'right':
          if (nextCol < maxCol) { nextCol += 1 } else if (nextRow < maxRow) { nextRow += 1; nextCol = 0 }
          break
        case 'left':
          if (nextCol > 0) { nextCol -= 1 } else if (nextRow > 0) { nextRow -= 1; nextCol = maxCol }
          break
        case 'down':
          if (nextRow < maxRow) { nextRow += 1 }
          break
        case 'up':
          if (nextRow > 0) { nextRow -= 1 }
          break
      }
      onCellSelect(nextRow, nextCol, false)
    }
  }, [onCellUpdate, onCellEdit, onCellSelect, rows.length, headers.length])

  const cancelCellEdit = useCallback((row: number, col: number) => {
    try {
      const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
      if (cellElement instanceof HTMLElement) {
        if (cellElement.dataset.originalHeight) delete cellElement.dataset.originalHeight
        if (cellElement.dataset.maxOtherHeight) delete cellElement.dataset.maxOtherHeight
      }
    } catch (error) {
      // console.warn('Failed to cleanup original height:', error)
    }
    
    onCellEdit(null)
  }, [onCellEdit])

  return (
    <tbody>
      {v && v.topPadding > 0 && (
        <tr className="spacer-row top" aria-hidden="true">
          <td colSpan={headers.length + 1} style={{ height: v.topPadding }} />
        </tr>
      )}
      {visibleRows.map((row, visIndex) => {
        const rowIndex = v ? v.startIndex + visIndex : visIndex
        return (
        <tr key={rowIndex} data-row={rowIndex}>
          <td 
            className={`row-number ${selectedRows?.has(rowIndex) ? 'highlighted' : ''}`}
            onClick={(e) => {
              if (onRowSelect) {
                onRowSelect(rowIndex, e)
              }
            }}
            onMouseDown={(_e) => {
              if (getDragProps) {
                // Handle drag start
              }
            }}
            onContextMenu={(e) => handleRowContextMenu(e, rowIndex)}
            title={`Row ${rowIndex + 1}`}
            {...(getDragProps ? getDragProps('row', rowIndex) : {})}
            {...(getDropProps ? getDropProps('row', rowIndex) : {})}
          >
            {rowIndex + 1}
          </td>
          
          {row.map((cell, colIndex) => {
            const cellId = `cell-${rowIndex}-${colIndex}`
            const isEmpty = !cell || cell.trim() === ''
            const cellClass = isEmpty ? 'empty-cell' : ''
            const storedWidth = editorState.columnWidths[colIndex] || 150
            const isEditing = isCellEditing(rowIndex, colIndex)
            const isSelected = isCellSelected(rowIndex, colIndex)
            const widthStyle = {
              width: `${storedWidth}px`,
              minWidth: `${storedWidth}px`,
              maxWidth: `${storedWidth}px`
            }
            
            const userResizedClass = editorState.columnWidths[colIndex] && editorState.columnWidths[colIndex] !== 150 ? 'user-resized' : ''
            
            return (
              <td 
                key={colIndex}
                id={cellId}
                className={`data-cell ${cellClass} ${userResizedClass} ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
                onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                onDoubleClick={() => startCellEdit(rowIndex, colIndex)}
                data-row={rowIndex}
                data-col={colIndex}
                style={{...widthStyle}}
                title={`Cell ${getColumnLetter(colIndex)}${rowIndex + 1}`}
              >
                {isEditing ? (
                  <CellEditor
                    value={processCellContentForEditing(cell || '')}
                    onCommit={(value, move) => commitCellEdit(rowIndex, colIndex, value, move)}
                    onCancel={() => {
                      if (editorState.currentEditingCell) {
                        cancelCellEdit(editorState.currentEditingCell.row, editorState.currentEditingCell.col)
                      } else {
                        onCellEdit(null)
                      }
                    }}
                    rowIndex={rowIndex}
                    colIndex={colIndex}
                    originalHeight={savedHeightsRef.current.get(`${rowIndex}-${colIndex}`)?.original}
                    maxOtherHeight={savedHeightsRef.current.get(`${rowIndex}-${colIndex}`)?.maxOther}
                  />
                ) : (
                  <div className="cell-content">
                    {cell && cell.trim() !== '' ? (
                      <span dangerouslySetInnerHTML={{ __html: processCellContent(cell) }} />
                    ) : (
                      <span className="empty-cell-placeholder">&nbsp;</span>
                    )}
                  </div>
                )}
              </td>
            )
          })}
        </tr>
        )
      })}
      {v && v.bottomPadding > 0 && (
        <tr className="spacer-row bottom" aria-hidden="true">
          <td colSpan={headers.length + 1} style={{ height: v.bottomPadding }} />
        </tr>
      )}
    </tbody>
  )
}

export default TableBody