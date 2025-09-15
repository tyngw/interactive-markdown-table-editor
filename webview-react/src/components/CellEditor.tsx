import React, { useRef, useState, useEffect, useCallback } from 'react'

export interface CellEditorProps {
  value: string
  onCommit: (value: string, move?: 'right' | 'left' | 'down' | 'up') => void
  onCancel: () => void
  rowIndex?: number
  colIndex?: number
  // 親からレイアウト情報を受け取る
  originalHeight?: number
  maxOtherHeight?: number
}

const CellEditor: React.FC<CellEditorProps> = ({ 
  value, 
  onCommit, 
  onCancel, 
  // 位置情報は親が保持（ここでは使用しない）
  rowIndex: _rowIndex, 
  colIndex: _colIndex, 
  originalHeight, 
  maxOtherHeight 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [currentValue, setCurrentValue] = useState(value)
  const [isComposing, setIsComposing] = useState(false)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.focus()
    const textLength = textarea.value.length
    textarea.setSelectionRange(textLength, textLength)

    const adjustHeight = () => {
      textarea.style.height = 'auto'
      const contentHeight = textarea.scrollHeight
      const minHeight = 32

      const baseOriginal = originalHeight ?? 0
      const baseMaxOther = maxOtherHeight ?? 0
      const finalHeight = Math.max(contentHeight, baseOriginal, baseMaxOther, minHeight)
      textarea.style.height = `${finalHeight}px`
    }

    adjustHeight()
    const handleInput = () => { if (!isComposing) adjustHeight() }
    textarea.addEventListener('input', handleInput)
    return () => textarea.removeEventListener('input', handleInput)
  }, [originalHeight, maxOtherHeight, isComposing])

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
