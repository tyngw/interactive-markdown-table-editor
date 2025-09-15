import { useCallback, useRef, forwardRef, CSSProperties } from 'react'
import * as ReactWindow from 'react-window'
import { EditorState, CellPosition } from '../types'
import { processCellContent, processCellContentForEditing, processCellContentForStorage } from '../utils/contentConverter'
import CellEditor from './CellEditor'
import { getColumnLetter } from '../utils/tableUtils'

interface VirtualizedTableBodyProps {
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

interface VirtualRowProps {
  index: number
  style: CSSProperties
  data: {
    headers: string[]
    rows: string[][]
    editorState: EditorState
    onCellUpdate: (row: number, col: number, value: string) => void
    onCellSelect: (row: number, col: number, extend?: boolean, toggle?: boolean) => void
    onCellEdit: (position: CellPosition | null) => void
    onRowSelect?: (row: number, event: React.MouseEvent) => void
    onShowRowContextMenu?: (event: React.MouseEvent, row: number) => void
    getDragProps?: (type: 'row' | 'column', index: number) => any
    getDropProps?: (type: 'row' | 'column', index: number) => any
    selectedRows?: Set<number>
    startCellEdit: (row: number, col: number) => void
    commitCellEdit: (row: number, col: number, value: string, move?: 'right' | 'left' | 'down' | 'up') => void
    cancelCellEdit: (row: number, col: number) => void
    isCellSelected: (row: number, col: number) => boolean
    isCellEditing: (row: number, col: number) => boolean
    handleCellMouseDown: (row: number, col: number, event: React.MouseEvent) => void
    handleRowContextMenu: (e: React.MouseEvent, rowIndex: number) => void
  }
}

const VirtualRow = forwardRef<HTMLDivElement, VirtualRowProps>(({ index: rowIndex, style, data }, ref) => {
  const {
    headers,
    rows,
    editorState,
    onRowSelect,
    getDragProps,
    getDropProps,
    selectedRows,
    startCellEdit,
    commitCellEdit,
    cancelCellEdit,
    isCellSelected,
    isCellEditing,
    handleCellMouseDown,
    handleRowContextMenu
  } = data

  const row = rows[rowIndex]
  if (!row) return null

  return (
    <div 
      ref={ref} 
      style={{
        ...style,
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--vscode-editorWidget-border, #ccc)'
      }} 
      className="virtual-table-row" 
      data-row={rowIndex}
    >
      <div 
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
        style={{
          width: '40px',
          minWidth: '40px',
          maxWidth: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--vscode-editorGroupHeader-tabsBackground)',
          borderRight: '1px solid var(--vscode-editorWidget-border, #ccc)',
          fontWeight: 'bold',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        {rowIndex + 1}
      </div>
      
      {row.map((cell, colIndex) => {
        const cellId = `cell-${rowIndex}-${colIndex}`
        const isEmpty = !cell || cell.trim() === ''
        const storedWidth = editorState.columnWidths[colIndex] || 150
        const isEditing = isCellEditing(rowIndex, colIndex)
        const isSelected = isCellSelected(rowIndex, colIndex)
        
        return (
          <div 
            key={colIndex}
            id={cellId}
            className={`data-cell ${isEmpty ? 'empty-cell' : ''} ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
            onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
            onDoubleClick={() => startCellEdit(rowIndex, colIndex)}
            data-row={rowIndex}
            data-col={colIndex}
            title={`Cell ${getColumnLetter(colIndex)}${rowIndex + 1}`}
            style={{
              width: `${storedWidth}px`,
              minWidth: `${storedWidth}px`,
              maxWidth: `${storedWidth}px`,
              borderRight: '1px solid var(--vscode-editorWidget-border, #ccc)',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isSelected ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: isSelected ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-editor-foreground)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {isEditing ? (
              <CellEditor
                value={processCellContentForEditing(cell || '')}
                onCommit={(value, move) => commitCellEdit(rowIndex, colIndex, value, move)}
                onCancel={() => cancelCellEdit(rowIndex, colIndex)}
                rowIndex={rowIndex}
                colIndex={colIndex}
              />
            ) : (
              <div className="cell-content" style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cell && cell.trim() !== '' ? (
                  <span dangerouslySetInnerHTML={{ __html: processCellContent(cell) }} />
                ) : (
                  <span className="empty-cell-placeholder" style={{ color: 'var(--vscode-descriptionForeground)' }}>&nbsp;</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})

VirtualRow.displayName = 'VirtualRow'

const VirtualizedTableBody: React.FC<VirtualizedTableBodyProps> = ({
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
  const savedHeightsRef = useRef<Map<string, { original: number; maxOther: number }>>(new Map())
  const listRef = useRef<any>(null) // FixedSizeList と VariableSizeList の両方に対応

  // セルサイズ変更時にリストを更新
  const resetListCache = useCallback(() => {
    if (listRef.current && typeof listRef.current.resetAfterIndex === 'function') {
      // VariableSizeListの場合、キャッシュをリセット
      listRef.current.resetAfterIndex(0, true)
    }
  }, [])

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

  const isCellSelected = useCallback((row: number, col: number) => {
    return editorState.selectedCells.has(`${row}-${col}`)
  }, [editorState.selectedCells])

  const isCellEditing = useCallback((row: number, col: number) => {
    return editorState.currentEditingCell?.row === row && 
           editorState.currentEditingCell?.col === col
  }, [editorState.currentEditingCell])

  const startCellEdit = useCallback((row: number, col: number) => {
    onCellEdit({ row, col })
    
    // 編集開始時にリストのキャッシュをリセット
    resetListCache()
    
    // 編集するセルが見えるようにスクロール
    if (listRef.current) {
      listRef.current.scrollToItem(row, 'smart')
    }
  }, [onCellEdit, resetListCache])

  const commitCellEdit = useCallback((row: number, col: number, value: string, move?: 'right' | 'left' | 'down' | 'up') => {
    const storageValue = processCellContentForStorage(value)
    onCellUpdate(row, col, storageValue)
    
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
      
      // 次のセルが見えるようにスクロール
      if (listRef.current && (nextRow !== row)) {
        listRef.current.scrollToItem(nextRow, 'smart')
      }
    }
  }, [onCellUpdate, onCellEdit, onCellSelect, rows.length, headers.length])

  const cancelCellEdit = useCallback((row: number, col: number) => {
    onCellEdit(null)
    // 編集終了時にもリストのキャッシュをリセット
    resetListCache()
  }, [onCellEdit, resetListCache])

  // データをVirtualRowに渡すためのオブジェクト
  const itemData = {
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
    startCellEdit,
    commitCellEdit,
    cancelCellEdit,
    isCellSelected,
    isCellEditing,
    handleCellMouseDown,
    handleRowContextMenu
  }

  // 行の高さを動的に計算
  const getItemSize = useCallback((index: number) => {
    // 編集中のセルがある場合は高さを拡張
    const isEditingRow = editorState.currentEditingCell?.row === index
    // 編集中の行は少し高めに設定
    return isEditingRow ? 60 : 32
  }, [editorState.currentEditingCell])

  // 動的な高さ計算のため、useVariableSizeListに変更するかの判定
  const hasEditingCell = editorState.currentEditingCell !== null
  const listHeight = Math.min(400, Math.max(200, rows.length * 32))

  return (
    <div className="virtualized-table-body" style={{ 
      border: '1px solid var(--vscode-editorWidget-border, #ccc)',
      borderTop: 'none'
    }}>
      {hasEditingCell ? (
        <ReactWindow.VariableSizeList
          ref={listRef}
          height={listHeight}
          itemCount={rows.length}
          itemSize={getItemSize}
          itemData={itemData}
          width="100%"
        >
          {VirtualRow}
        </ReactWindow.VariableSizeList>
      ) : (
        <ReactWindow.FixedSizeList
          ref={listRef}
          height={listHeight}
          itemCount={rows.length}
          itemSize={32}
          itemData={itemData}
          width="100%"
        >
          {VirtualRow}
        </ReactWindow.FixedSizeList>
      )}
    </div>
  )
}

export default VirtualizedTableBody