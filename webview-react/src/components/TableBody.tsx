import { useCallback, useState, useRef, useEffect } from 'react'
import { EditorState, CellPosition } from '../types'
import { processCellContent, processCellContentForEditing, processCellContentForStorage } from '../utils/contentConverter'
import { useTheme } from '../contexts/ThemeContext'

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
  selectedRows
}) => {
  const { getStyle } = useTheme()
  const savedHeightsRef = useRef<Map<string, { original: number; maxOther: number }>>(new Map())

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

  const getColumnLetter = useCallback((index: number) => {
    let result = ''
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result
      index = Math.floor(index / 26) - 1
    }
    return result
  }, [])

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
      {rows.map((row, rowIndex) => (
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
      ))}
    </tbody>
  )
}

export default TableBody

interface CellEditorProps {
  value: string
  onCommit: (value: string, move?: 'right' | 'left' | 'down' | 'up') => void
  onCancel: () => void
  rowIndex?: number
  colIndex?: number
  originalHeight?: number
  maxOtherHeight?: number
}

const CellEditor: React.FC<CellEditorProps> = ({ value, onCommit, onCancel, rowIndex, colIndex, originalHeight, maxOtherHeight }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [currentValue, setCurrentValue] = useState(value)
  const [isComposing, setIsComposing] = useState(false)

  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      
      const textLength = textarea.value.length
      textarea.setSelectionRange(textLength, textLength)
      
      const adjustHeight = () => {
        textarea.style.height = 'auto'
        const contentHeight = textarea.scrollHeight
        
        let editingCellOriginalHeight = originalHeight ?? 0
        let savedMaxOther = maxOtherHeight ?? 0
        
        if (typeof rowIndex === 'number' && typeof colIndex === 'number') {
          try {
            const cellElement = document.querySelector(`[data-row="${rowIndex}"][data-col="${colIndex}"]`)
            
            if (!editingCellOriginalHeight && cellElement instanceof HTMLElement && cellElement.dataset.originalHeight) {
              editingCellOriginalHeight = parseInt(cellElement.dataset.originalHeight)
            }
            if (!savedMaxOther && cellElement instanceof HTMLElement && cellElement.dataset.maxOtherHeight) {
              savedMaxOther = parseInt(cellElement.dataset.maxOtherHeight)
            }
          } catch (error) {
            // console.warn('Failed to get original cell height:', error)
          }
        }
        
        let maxOtherCellHeight = savedMaxOther || 0
        if (!savedMaxOther && typeof rowIndex === 'number') {
          try {
            const rowCells = document.querySelectorAll(`[data-row="${rowIndex}"]`)
            rowCells.forEach((cell) => {
              if (cell instanceof HTMLElement && !cell.classList.contains('editing')) {
                const cellHeight = cell.offsetHeight
                if (cellHeight > maxOtherCellHeight) {
                  maxOtherCellHeight = cellHeight
                }
              }
            })
          } catch (error) {
            // console.warn('Failed to get row cell heights:', error)
          }
        }
        
        const currentTextareaHeight = textarea.offsetHeight
        
        const minHeight = 32
        let finalHeight
        
        if (editingCellOriginalHeight > maxOtherCellHeight) {
          finalHeight = Math.max(contentHeight, currentTextareaHeight, editingCellOriginalHeight, minHeight)
        } else {
          finalHeight = Math.max(contentHeight, currentTextareaHeight, maxOtherCellHeight, minHeight)
        }

        textarea.style.setProperty('height', finalHeight + 'px', 'important')
        
        const cellElement = document.querySelector(`[data-row="${rowIndex}"][data-col="${colIndex}"]`)
        if (cellElement instanceof HTMLElement) {
          cellElement.style.setProperty('height', finalHeight + 'px', 'important')
        }
      }
      
      adjustHeight()
      
      const handleInput = () => {
        if (!isComposing) {
          adjustHeight()
        }
      }
      
      textarea.addEventListener('input', handleInput)
      
      return () => {
        textarea.removeEventListener('input', handleInput)
      }
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onCommit(currentValue)
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.stopPropagation()
    } else if (e.key === 'Enter' && !isComposing) {
      e.preventDefault()
      onCommit(currentValue, 'down')
    } else if (e.key === 'Enter' && isComposing) {
      e.stopPropagation()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onCommit(currentValue, e.shiftKey ? 'left' : 'right')
    }
    e.stopPropagation()
  }, [currentValue, onCommit, onCancel, isComposing])

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true)
  }, [])

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false)
  }, [])

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (document.activeElement !== textareaRef.current) {
        onCommit(currentValue)
      }
    }, 10)
  }, [currentValue, onCommit])

  return (
    <textarea
      ref={textareaRef}
      className="cell-input"
      value={currentValue}
      onChange={(e) => setCurrentValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
      style={{
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        outline: 'none',
        resize: 'none',
        boxSizing: 'border-box',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        overflow: 'hidden',
        lineHeight: '1.2',
        verticalAlign: 'top',
        textAlign: 'left',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 5,
        padding: '4px 6px'
      }}
    />
  )
}