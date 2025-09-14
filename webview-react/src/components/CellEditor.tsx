import React, { useRef, useState, useEffect, useCallback } from 'react'

export interface CellEditorProps {
  value: string
  onCommit: (value: string, move?: 'right' | 'left' | 'down' | 'up') => void
  onCancel: () => void
  rowIndex?: number
  colIndex?: number
  originalHeight?: number
  maxOtherHeight?: number
}

const CellEditor: React.FC<CellEditorProps> = ({ 
  value, 
  onCommit, 
  onCancel, 
  rowIndex, 
  colIndex, 
  originalHeight, 
  maxOtherHeight 
}) => {
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
  }, [rowIndex, colIndex, originalHeight, maxOtherHeight, isComposing])

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

export default CellEditor
