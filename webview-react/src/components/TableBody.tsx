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
  getDropProps
}) => {
  const { getStyle } = useTheme()
  // 保存用: 編集開始前に測ったセルの高さを保持
  const savedHeightsRef = useRef<Map<string, { original: number; maxOther: number }>>(new Map())
  // Handle cell click - check if it's clicking on an input field
  const handleCellMouseDown = useCallback((row: number, col: number, event: React.MouseEvent) => {
    // Check if the click target is a cell input field
    if ((event.target as HTMLElement).classList.contains('cell-input')) {
      // Clicking on input field - don't change selection, keep editing
      return
    }
    
    // Otherwise, proceed with normal cell selection
    const extend = event.shiftKey
    const toggle = event.ctrlKey || event.metaKey
    onCellSelect(row, col, extend, toggle)
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
    console.log(`🏁 Starting cell edit for [${row}, ${col}]`)
    
    // 編集開始前に元の高さを保存
    try {
      const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
      console.log('🔍 Found cell element:', cellElement, 'offsetHeight:', (cellElement as HTMLElement)?.offsetHeight)
      
      if (cellElement instanceof HTMLElement) {
        const originalHeight = cellElement.offsetHeight
        cellElement.dataset.originalHeight = originalHeight.toString()
        console.log(`💾 Saved originalHeight: ${originalHeight}`)
        
        // 同じ行の他セルの最大高さも保存
        const rowElement = cellElement.closest('tr')
        let maxOther = 0
        if (rowElement) {
          const rowCells = rowElement.querySelectorAll('td[data-col]')
          console.log(`🔍 Found ${rowCells.length} cells in row`)
          rowCells.forEach((c) => {
            if (c !== cellElement && c instanceof HTMLElement) {
              const height = c.offsetHeight
              maxOther = Math.max(maxOther, height)
              console.log(`🔍 Other cell height: ${height}, maxOther now: ${maxOther}`)
            }
          })
        }
        cellElement.dataset.maxOtherHeight = String(maxOther)
        console.log(`💾 Saved maxOtherHeight: ${maxOther}`)
        
        // Mapにも保存（再描画でdata属性が取れない場合の保険）
        savedHeightsRef.current.set(`${row}-${col}`, { original: originalHeight, maxOther })
        console.log(`💾 Saved to Map: original=${originalHeight}, maxOther=${maxOther}`)
      }
    } catch (error) {
      console.warn('Failed to save original cell height:', error)
    }    onCellEdit({ row, col })
  }, [onCellEdit])

  // セル編集の確定
  const commitCellEdit = useCallback((row: number, col: number, value: string, move?: 'right' | 'left' | 'down' | 'up') => {
    const storageValue = processCellContentForStorage(value)
    onCellUpdate(row, col, storageValue)
    
    // data属性をクリーンアップ
    try {
      const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
      if (cellElement instanceof HTMLElement) {
        if (cellElement.dataset.originalHeight) delete cellElement.dataset.originalHeight
        if (cellElement.dataset.maxOtherHeight) delete cellElement.dataset.maxOtherHeight
        console.log('🧹 Cleaned up height data attributes')
      }
    } catch (error) {
      console.warn('Failed to cleanup original height:', error)
    }
    
    onCellEdit(null)
    // After committing, move selection per legacy behavior
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

  // セル編集のキャンセル
  const cancelCellEdit = useCallback((row: number, col: number) => {
    // data属性をクリーンアップ
    try {
      const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
      if (cellElement instanceof HTMLElement) {
        if (cellElement.dataset.originalHeight) delete cellElement.dataset.originalHeight
        if (cellElement.dataset.maxOtherHeight) delete cellElement.dataset.maxOtherHeight
        console.log('🧹 Cleaned up height data attributes (cancel)')
      }
    } catch (error) {
      console.warn('Failed to cleanup original height:', error)
    }
    
    onCellEdit(null)
  }, [onCellEdit])

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
                onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                onDoubleClick={() => startCellEdit(rowIndex, colIndex)}
                data-row={rowIndex}
                data-col={colIndex}
                style={{...widthStyle, ...selectionStyle}}
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
      
      // カーソルを末尾に移動
      const textLength = textarea.value.length
      textarea.setSelectionRange(textLength, textLength)
      
      // 高さを内容に合わせて調整
      const adjustHeight = () => {
        textarea.style.height = 'auto'
        const contentHeight = textarea.scrollHeight
        
        // 編集対象セルの元の高さ/他セル最大高さを取得（props優先、なければdata属性）
        let editingCellOriginalHeight = originalHeight ?? 0
        let savedMaxOther = maxOtherHeight ?? 0
        
        console.log(`🔍 Initial values - originalHeight prop: ${originalHeight}, maxOtherHeight prop: ${maxOtherHeight}`)
        console.log(`🔍 Initial values - editingCellOriginalHeight: ${editingCellOriginalHeight}, savedMaxOther: ${savedMaxOther}`)
        
        if (typeof rowIndex === 'number' && typeof colIndex === 'number') {
          try {
            const cellElement = document.querySelector(`[data-row="${rowIndex}"][data-col="${colIndex}"]`)
            console.log(`🔍 Found editing cell element:`, cellElement)
            
            if (!editingCellOriginalHeight && cellElement instanceof HTMLElement && cellElement.dataset.originalHeight) {
              editingCellOriginalHeight = parseInt(cellElement.dataset.originalHeight)
              console.log('🔍 Retrieved original cell height from dataset:', editingCellOriginalHeight)
            }
            if (!savedMaxOther && cellElement instanceof HTMLElement && cellElement.dataset.maxOtherHeight) {
              savedMaxOther = parseInt(cellElement.dataset.maxOtherHeight)
              console.log('🔍 Retrieved max other height from dataset:', savedMaxOther)
            }
          } catch (error) {
            console.warn('Failed to get original cell height:', error)
          }
        }
        
        // 同じ行の他のセルの高さを取得
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
            console.warn('Failed to get row cell heights:', error)
          }
        }
        
        // 現在のtextareaの高さも取得（legacy版と同様に）
        const currentTextareaHeight = textarea.offsetHeight
        
        // legacy版の論理：テキスト要求高さ、現在のtextarea高さ、他セル高さ、最小高さの最大値
        // これにより初期設定した高さ（元セルの高さ）が保持される
        const minHeight = 32
        let finalHeight
        
        if (editingCellOriginalHeight > maxOtherCellHeight) {
          // 編集対象セルが最も高い場合：テキスト要求高さ、現在の高さ、元の高さの最大値
          finalHeight = Math.max(contentHeight, currentTextareaHeight, editingCellOriginalHeight, minHeight)
          console.log(`🔍 Cell is tallest, using max(content=${contentHeight}, current=${currentTextareaHeight}, original=${editingCellOriginalHeight}) = ${finalHeight}`)
        } else {
          // 他のセルの方が高い場合：テキスト要求高さ、現在の高さ、他セル高さの最大値  
          finalHeight = Math.max(contentHeight, currentTextareaHeight, maxOtherCellHeight, minHeight)
          console.log(`🔍 Other cells taller, using max(content=${contentHeight}, current=${currentTextareaHeight}, maxOther=${maxOtherCellHeight}) = ${finalHeight}`)
        }

        textarea.style.setProperty('height', finalHeight + 'px', 'important')
        
        // セルの高さも同期（legacy版と同様）
        const cellElement = document.querySelector(`[data-row="${rowIndex}"][data-col="${colIndex}"]`)
        if (cellElement instanceof HTMLElement) {
          cellElement.style.setProperty('height', finalHeight + 'px', 'important')
        }
        
        console.log('🔍 CellEditor height adjustment:', {
          originalCellHeight: editingCellOriginalHeight,
          maxOtherCellHeight,
          contentHeight,
          currentTextareaHeight,
          finalHeight
        })
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      return;
    }
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
      onCommit(currentValue, 'down')
      // 下のセルへ移動は親で処理（onCommit後にフォーカスが戻るため）
    } else if (e.key === 'Enter' && isComposing) {
      // IME入力中のEnterは確定として処理し、編集は継続
      e.stopPropagation()
    } else if (e.key === 'Escape') {
      // Escで編集キャンセル（元の値に戻す）
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onCommit(currentValue, e.shiftKey ? 'left' : 'right')
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