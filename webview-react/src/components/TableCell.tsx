import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ContentConverter } from '../utils/contentConverter'

interface TableCellProps {
  value: string
  row: number
  col: number
  isSelected: boolean
  isEditing: boolean
  columnWidth?: number
  onClick: (row: number, col: number, event: React.MouseEvent) => void
  onDoubleClick: (row: number, col: number) => void
  onUpdate: (row: number, col: number, value: string) => void
  onEditComplete: () => void
  isSearchResult?: boolean
  isCurrentSearchResult?: boolean
}

const TableCell: React.FC<TableCellProps> = ({
  value,
  row,
  col,
  isSelected,
  isEditing,
  columnWidth,
  onClick,
  onDoubleClick,
  onUpdate,
  onEditComplete,
  isSearchResult = false,
  isCurrentSearchResult = false
}) => {
  const [editValue, setEditValue] = useState(value)
  const [isComposing, setIsComposing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 編集モードに入った時の処理
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
      // <br>タグを改行に変換して編集用に設定
      setEditValue(ContentConverter.processForEditing(value))
    }
  }, [isEditing, value])

  // 値が外部から変更された時の処理
  useEffect(() => {
    if (!isEditing) {
      setEditValue(ContentConverter.processForEditing(value))
    }
  }, [value, isEditing])

  // セルクリック処理
  const handleClick = useCallback((e: React.MouseEvent) => {
    onClick(row, col, e)
  }, [onClick, row, col])

  // セルダブルクリック処理
  const handleDoubleClick = useCallback(() => {
    onDoubleClick(row, col)
  }, [onDoubleClick, row, col])

  // 編集完了処理
  const handleEditComplete = useCallback(() => {
    const processedValue = ContentConverter.processForStorage(editValue)
    if (processedValue !== value) {
      onUpdate(row, col, processedValue)
    }
    onEditComplete()
  }, [editValue, value, row, col, onUpdate, onEditComplete])

  // キーボード入力処理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isComposing) return

    switch (e.key) {
      case 'Enter':
        if (e.shiftKey) {
          // Shift+Enter: 改行を挿入
          return
        } else {
          // Enter: 編集完了
          e.preventDefault()
          handleEditComplete()
        }
        break
      case 'Escape':
        // Escape: 編集キャンセル
        e.preventDefault()
        setEditValue(value)
        onEditComplete()
        break
      case 'Tab':
        // Tab: 編集完了して次のセルへ
        e.preventDefault()
        handleEditComplete()
        // TODO: 次のセルにフォーカスを移動
        break
    }
  }, [isComposing, handleEditComplete, value, onEditComplete])

  // IME入力開始
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true)
  }, [])

  // IME入力終了
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false)
  }, [])

  // フォーカス離脱時の処理
  const handleBlur = useCallback(() => {
    handleEditComplete()
  }, [handleEditComplete])

  // 入力値変更処理
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value)
  }, [])

  // テキストエリアの高さを自動調整
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [])

  // 編集値が変更された時にテキストエリアの高さを調整
  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight()
    }
  }, [editValue, isEditing, adjustTextareaHeight])

  const cellStyle: React.CSSProperties = {
    width: columnWidth || 150,
    minWidth: 100,
    position: 'relative'
  }

  const cellClassName = `table-cell ${isSelected ? 'selected' : ''} ${isSearchResult ? 'search-result' : ''} ${isCurrentSearchResult ? 'current-search-result' : ''}`

  if (isEditing) {
    return (
      <td className={cellClassName} style={cellStyle}>
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={handleBlur}
          style={{
            width: '100%',
            minHeight: '20px',
            border: '2px solid var(--vscode-focusBorder)',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            padding: '4px',
            resize: 'none',
            overflow: 'hidden'
          }}
        />
      </td>
    )
  }

  return (
    <td 
      className={cellClassName}
      style={cellStyle}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div 
        className="cell-content"
        style={{
          minHeight: '20px',
          padding: '4px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
        dangerouslySetInnerHTML={{
          __html: value ? ContentConverter.brTagsToNewlines(value).replace(/\n/g, '<br/>') : '\u00A0'
        }}
      />
    </td>
  )
}

export default TableCell