import { useCallback, useState, useRef, useEffect } from 'react'
import { EditorState, CellPosition } from '../types'
import { processCellContent, processCellContentForEditing, processCellContentForStorage } from '../utils/contentConverter'
import { useTheme } from '../contexts/ThemeContext'

interface TableBodyProps {
  headers: string[]
  rows: string[][]
  editorState: EditorState
  onCellUpdate: (row: number, col: number, value: string) => void
  onCellSelect: (row: number, col: number, extend?: boolean) => void
  onCellEdit: (position: CellPosition | null) => void
  onAddRow: (index?: number) => void
  onDeleteRow: (index: number) => void
  onRowSelect?: (row: number, event: React.MouseEvent) => void
  onShowRowContextMenu?: (event: React.MouseEvent, row: number) => void
  getDragProps?: (type: 'row' | 'column', index: number) => any
  getDropProps?: (type: 'row' | 'column', index: number) => any
}

const TableBody: React.FC<TableBodyProps> = ({
  rows,
  editorState,
  onCellUpdate,
  onCellSelect,
  onCellEdit,
  onRowSelect,
  onShowRowContextMenu,
  getDragProps,
  getDropProps
}) => {
  const { getStyle } = useTheme()
  // Handle cell click - check if it's clicking on an input field
  const handleCellClick = useCallback((row: number, col: number, event: React.MouseEvent) => {
    // Check if the click target is a cell input field
    if ((event.target as HTMLElement).classList.contains('cell-input')) {
      // Clicking on input field - don't change selection, keep editing
      return
    }
    
    // Otherwise, proceed with normal cell selection
    const extend = event.shiftKey
    onCellSelect(row, col, extend)
  }, [onCellSelect])

  // Handle cell mouse down for selection
  const handleCellMouseDown = useCallback((row: number, col: number) => {
    // Start cell selection
    onCellSelect(row, col)
  }, [onCellSelect])

  // 行番号右クリック処理
  const handleRowContextMenu = useCallback((e: React.MouseEvent, rowIndex: number) => {
    e.preventDefault()
    if (onShowRowContextMenu) {
      onShowRowContextMenu(e, rowIndex)
    }
  }, [onShowRowContextMenu])

  // Get Excel-style column letter (A, B, C, ..., Z, AA, AB, ...)
  const getColumnLetter = useCallback((index: number) => {
    let result = ''
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result
      index = Math.floor(index / 26) - 1
    }
    return result
  }, [])

  // セルが選択されているかチェック
  const isCellSelected = useCallback((row: number, col: number) => {
    return editorState.selectedCells.has(`${row}-${col}`)
  }, [editorState.selectedCells])

  // セルが編集中かチェック
  const isCellEditing = useCallback((row: number, col: number) => {
    return editorState.currentEditingCell?.row === row && 
           editorState.currentEditingCell?.col === col
  }, [editorState.currentEditingCell])

  // セル編集の開始
  const startCellEdit = useCallback((row: number, col: number) => {
    onCellEdit({ row, col })
  }, [onCellEdit])

  // セル編集の確定
  const commitCellEdit = useCallback((row: number, col: number, value: string) => {
    const storageValue = processCellContentForStorage(value)
    onCellUpdate(row, col, storageValue)
    onCellEdit(null)
  }, [onCellUpdate, onCellEdit])

  return (
    <tbody>
      {/* Data rows with enhanced styling */}
      {rows.map((row, rowIndex) => (
        <tr key={rowIndex} data-row={rowIndex}>
          {/* Row number with selection capability */}
          <td 
            className="row-number"
            onClick={(e) => {
              if (onRowSelect) {
                onRowSelect(rowIndex, e)
              }
            }}
            onMouseDown={(_e) => {
              // Start row drag if needed
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
          
          {/* Data cells with enhanced interaction */}
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
            
            // Only apply selection styles via JavaScript, let CSS handle the rest
            const selectionStyle = isSelected ? {
              backgroundColor: getStyle('list.activeSelectionBackground', '#0078d4'),
              color: getStyle('list.activeSelectionForeground', '#ffffff')
            } : {}
            const userResizedClass = editorState.columnWidths[colIndex] && editorState.columnWidths[colIndex] !== 150 ? 'user-resized' : ''
            
            return (
              <td 
                key={colIndex}
                id={cellId}
                className={`data-cell ${cellClass} ${userResizedClass} ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
                onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                onDoubleClick={() => startCellEdit(rowIndex, colIndex)}
                onMouseDown={() => handleCellMouseDown(rowIndex, colIndex)}
                data-row={rowIndex}
                data-col={colIndex}
                style={{...widthStyle, ...selectionStyle}}
                title={`Cell ${getColumnLetter(colIndex)}${rowIndex + 1}`}
              >
                {isEditing ? (
                  <CellEditor
                    value={processCellContentForEditing(cell || '')}
                    onCommit={(value) => commitCellEdit(rowIndex, colIndex, value)}
                    onCancel={() => onCellEdit(null)}
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
  onCommit: (value: string) => void
  onCancel: () => void
}

const CellEditor: React.FC<CellEditorProps> = ({ value, onCommit, onCancel }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [currentValue, setCurrentValue] = useState(value)
  const [isComposing, setIsComposing] = useState(false)

  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      
      // カーソルを末尾に移動
      const textLength = textarea.value.length
      textarea.setSelectionRange(textLength, textLength)
      
      // 高さを内容に合わせて調整
      const adjustHeight = () => {
        textarea.style.height = 'auto'
        const contentHeight = textarea.scrollHeight
        const minHeight = Math.max(contentHeight, 32)
        textarea.style.height = minHeight + 'px'
      }
      
      adjustHeight()
      
      // 入力時の高さ調整
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
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+Enter / Cmd+Enter で編集確定
      e.preventDefault()
      onCommit(currentValue)
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter で改行
      e.stopPropagation()
    } else if (e.key === 'Enter' && !isComposing) {
      // Enter で編集確定（IME入力中でない場合のみ）
      e.preventDefault()
      onCommit(currentValue)
    } else if (e.key === 'Enter' && isComposing) {
      // IME入力中のEnterは確定として処理し、編集は継続
      e.stopPropagation()
    } else if (e.key === 'Escape') {
      // Escで編集キャンセル（元の値に戻す）
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onCommit(currentValue)
    }
    // Stop propagation to prevent other keyboard handlers
    e.stopPropagation()
  }, [currentValue, onCommit, onCancel, isComposing])

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true)
  }, [])

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false)
  }, [])

  const handleBlur = useCallback(() => {
    // Small delay to check if we're refocusing on the same input
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