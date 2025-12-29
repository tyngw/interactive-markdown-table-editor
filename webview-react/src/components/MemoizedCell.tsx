/**
 * MemoizedCell - パフォーマンス最適化されたテーブルセルコンポーネント
 * 
 * 大量データ時の選択操作のパフォーマンスを改善するため、
 * React.memo を使用して不要な再レンダリングを防止する。
 * セルの状態（選択、編集、検索結果など）が変更された場合のみ再レンダリングされる。
 */
import React, { memo, useCallback } from 'react'
import { HeaderConfig } from '../types'
import { processCellContent, processCellContentForEditing } from '../utils/contentConverter'
import { getColumnLetter } from '../utils/tableUtils'
import CellEditor from './CellEditor'

interface SelectionBorders {
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
}

export interface MemoizedCellProps {
  rowIndex: number
  colIndex: number
  cell: string
  isSelected: boolean
  isAnchor: boolean
  isSingleSelection: boolean
  borders: SelectionBorders
  isEditing: boolean
  isInFillRange: boolean
  isSearchResult: boolean
  isCurrentSearchResult: boolean
  showFillHandle: boolean
  storedWidth: number
  userResized: boolean
  displayRowNumber: number
  headerConfig?: HeaderConfig
  initialCellInput?: string | null
  savedHeight?: { original: number; rowMax: number }
  onMouseDown: (row: number, col: number, event: React.MouseEvent) => void
  onDoubleClick: (row: number, col: number) => void
  onCommitEdit: (row: number, col: number, value: string, move?: 'right' | 'left' | 'down' | 'up') => void
  onCancelEdit: (row: number, col: number) => void
  onMouseEnter?: (row: number, col: number) => void
  onFillHandleMouseDown?: (event: React.MouseEvent) => void
}

const MemoizedCell: React.FC<MemoizedCellProps> = ({
  rowIndex,
  colIndex,
  cell,
  isSelected,
  isAnchor,
  isSingleSelection,
  borders,
  isEditing,
  isInFillRange,
  isSearchResult,
  isCurrentSearchResult,
  showFillHandle,
  storedWidth,
  userResized,
  displayRowNumber,
  initialCellInput,
  savedHeight,
  onMouseDown,
  onDoubleClick,
  onCommitEdit,
  onCancelEdit,
  onMouseEnter,
  onFillHandleMouseDown
}) => {
  const cellId = `cell-${rowIndex}-${colIndex}`
  const isEmpty = !cell || cell.trim() === ''
  const cellClass = isEmpty ? 'empty-cell' : ''
  const userResizedClass = userResized ? 'user-resized' : ''

  const widthStyle = {
    width: `${storedWidth}px`,
    minWidth: `${storedWidth}px`,
    maxWidth: `${storedWidth}px`
  }

  // 選択状態のクラス名を構築
  const selectionClass = isSelected
    ? isAnchor
      ? `selected anchor ${isSingleSelection ? 'single-selection' : ''}`
      : `selected ${isSingleSelection ? 'single-selection' : ''} ${borders.top ? 'border-top' : ''} ${borders.bottom ? 'border-bottom' : ''} ${borders.left ? 'border-left' : ''} ${borders.right ? 'border-right' : ''}`.trim()
    : ''

  const className = `data-cell ${cellClass} ${userResizedClass} ${selectionClass} ${isEditing ? 'editing' : ''} ${isInFillRange ? 'fill-range' : ''} ${isSearchResult ? 'search-result' : ''} ${isCurrentSearchResult ? 'current-search-result' : ''}`.trim()

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    onMouseDown(rowIndex, colIndex, e)
  }, [onMouseDown, rowIndex, colIndex])

  const handleDoubleClick = useCallback(() => {
    onDoubleClick(rowIndex, colIndex)
  }, [onDoubleClick, rowIndex, colIndex])

  const handleMouseEnter = useCallback(() => {
    if (onMouseEnter) {
      onMouseEnter(rowIndex, colIndex)
    }
  }, [onMouseEnter, rowIndex, colIndex])

  const handleCommit = useCallback((value: string, move?: 'right' | 'left' | 'down' | 'up') => {
    onCommitEdit(rowIndex, colIndex, value, move)
  }, [onCommitEdit, rowIndex, colIndex])

  const handleCancel = useCallback(() => {
    onCancelEdit(rowIndex, colIndex)
  }, [onCancelEdit, rowIndex, colIndex])

  return (
    <td
      id={cellId}
      className={className}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onDoubleClick={handleDoubleClick}
      data-row={rowIndex}
      data-col={colIndex}
      style={{
        ...widthStyle,
        ...(isEditing
          ? {
            minHeight: (savedHeight?.rowMax || 32) + 'px',
            height: 'auto',
            maxHeight: 'none'
          }
          : {})
      }}
      title={`Cell ${getColumnLetter(colIndex)}${displayRowNumber}`}
    >
      {isEditing ? (
        <CellEditor
          value={initialCellInput ?? processCellContentForEditing(cell || '')}
          onCommit={handleCommit}
          onCancel={handleCancel}
          rowIndex={rowIndex}
          colIndex={colIndex}
          originalHeight={savedHeight?.original}
          rowMaxHeight={savedHeight?.rowMax}
        />
      ) : (
        <>
          <div className="cell-content">
            {cell && cell.trim() !== '' ? (
              <span dangerouslySetInnerHTML={{ __html: processCellContent(cell) }} />
            ) : (
              <span className="empty-cell-placeholder">&nbsp;</span>
            )}
          </div>
          {showFillHandle && onFillHandleMouseDown && (
            <div
              className="fill-handle"
              onMouseDown={onFillHandleMouseDown}
              title="ドラッグしてオートフィル"
            />
          )}
        </>
      )}
    </td>
  )
}

// カスタム比較関数：パフォーマンス最適化のため、重要なプロパティのみを比較
function arePropsEqual(prevProps: MemoizedCellProps, nextProps: MemoizedCellProps): boolean {
  // 基本的なプロパティの比較
  if (
    prevProps.rowIndex !== nextProps.rowIndex ||
    prevProps.colIndex !== nextProps.colIndex ||
    prevProps.cell !== nextProps.cell ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isAnchor !== nextProps.isAnchor ||
    prevProps.isSingleSelection !== nextProps.isSingleSelection ||
    prevProps.isEditing !== nextProps.isEditing ||
    prevProps.isInFillRange !== nextProps.isInFillRange ||
    prevProps.isSearchResult !== nextProps.isSearchResult ||
    prevProps.isCurrentSearchResult !== nextProps.isCurrentSearchResult ||
    prevProps.showFillHandle !== nextProps.showFillHandle ||
    prevProps.storedWidth !== nextProps.storedWidth ||
    prevProps.userResized !== nextProps.userResized ||
    prevProps.displayRowNumber !== nextProps.displayRowNumber ||
    prevProps.initialCellInput !== nextProps.initialCellInput ||
    prevProps.onMouseEnter !== nextProps.onMouseEnter
  ) {
    return false
  }

  // borders オブジェクトの比較
  if (
    prevProps.borders.top !== nextProps.borders.top ||
    prevProps.borders.bottom !== nextProps.borders.bottom ||
    prevProps.borders.left !== nextProps.borders.left ||
    prevProps.borders.right !== nextProps.borders.right
  ) {
    return false
  }

  // savedHeight の比較
  if (prevProps.savedHeight !== nextProps.savedHeight) {
    if (!prevProps.savedHeight || !nextProps.savedHeight) {
      return false
    }
    if (
      prevProps.savedHeight.original !== nextProps.savedHeight.original ||
      prevProps.savedHeight.rowMax !== nextProps.savedHeight.rowMax
    ) {
      return false
    }
  }

  return true
}

export default memo(MemoizedCell, arePropsEqual)
