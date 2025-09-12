import { useState, useCallback, useEffect } from 'react'
import { SortState, ColumnWidths } from '../types'
import { useTheme } from '../contexts/ThemeContext'

interface TableHeaderProps {
  headers: string[]
  columnWidths: ColumnWidths
  sortState: SortState
  onHeaderUpdate: (col: number, value: string) => void
  onSort: (col: number) => void
  onColumnResize: (col: number, width: number) => void
  onAddColumn: (index?: number) => void
  onDeleteColumn: (index: number) => void
  onSelectAll?: () => void
  onColumnSelect?: (col: number, event: React.MouseEvent) => void
  onShowColumnContextMenu?: (event: React.MouseEvent, col: number) => void
  getDragProps?: (type: 'row' | 'column', index: number) => any
  getDropProps?: (type: 'row' | 'column', index: number) => any
}

const TableHeader: React.FC<TableHeaderProps> = ({
  headers,
  columnWidths,
  sortState,
  onHeaderUpdate,
  onSort,
  onColumnResize,
  onSelectAll,
  onColumnSelect,
  onShowColumnContextMenu,
  getDragProps,
  getDropProps
}) => {
  const { getStyle } = useTheme()
  const [editingHeader, setEditingHeader] = useState<number | null>(null)
  const [resizing, setResizing] = useState<{ col: number; startX: number; startWidth: number } | null>(null)

  // ヘッダー編集開始
  const handleHeaderDoubleClick = useCallback((col: number) => {
    setEditingHeader(col)
  }, [])

  // ヘッダー編集完了
  const handleHeaderBlur = useCallback((col: number, value: string) => {
    onHeaderUpdate(col, value)
    setEditingHeader(null)
  }, [onHeaderUpdate])

  // ヘッダーキー入力
  const handleHeaderKeyDown = useCallback((e: React.KeyboardEvent, col: number) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement
      onHeaderUpdate(col, target.value)
      setEditingHeader(null)
    } else if (e.key === 'Escape') {
      setEditingHeader(null)
    }
  }, [onHeaderUpdate])

  // 列リサイズ開始
  const handleResizeStart = useCallback((e: React.MouseEvent, col: number) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = columnWidths[col] || 150
    setResizing({ col, startX, startWidth })
  }, [columnWidths])

  // 列リサイズ中
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return
    
    const deltaX = e.clientX - resizing.startX
    const newWidth = Math.max(50, resizing.startWidth + deltaX)
    onColumnResize(resizing.col, newWidth)
  }, [resizing, onColumnResize])

  // 列リサイズ終了
  const handleMouseUp = useCallback(() => {
    setResizing(null)
  }, [])

  // リサイズイベントリスナーの設定
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [resizing, handleMouseMove, handleMouseUp])

  // Get Excel-style column letter (A, B, C, ..., Z, AA, AB, ...)
  const getColumnLetter = useCallback((index: number) => {
    let result = ''
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result
      index = Math.floor(index / 26) - 1
    }
    return result
  }, [])

  // Auto-fit column width to content (Excel-like double-click behavior)
  const handleAutoFit = useCallback((col: number) => {
    // Simple auto-fit implementation - can be enhanced
    const minWidth = 80
    const maxWidth = 400
    const estimatedWidth = Math.min(maxWidth, Math.max(minWidth, headers[col].length * 8 + 40))
    onColumnResize(col, estimatedWidth)
  }, [headers, onColumnResize])

  // Handle column header click (selection vs sorting)
  const handleColumnHeaderClick = useCallback((col: number, event: React.MouseEvent) => {
    // Check if we're currently resizing - if so, don't handle the click
    if (resizing) {
      return
    }
    
    // Check if the click is on a resize handle - if so, don't handle the click
    if ((event.target as HTMLElement).closest('.resize-handle')) {
      return
    }
    
    // Check if the click is on the sort indicator - if so, handle as sort
    if ((event.target as HTMLElement).closest('.sort-indicator')) {
      onSort(col)
      return
    }
    
    // Normal click on header should select column, not sort
    if (onColumnSelect) {
      onColumnSelect(col, event)
    }
  }, [resizing, onColumnSelect, onSort])

  return (
    <thead>
      <tr>
        {/* Header corner cell (select all) */}
        <th 
          className="header-corner" 
          onClick={onSelectAll}
          title="Select All"
        >
          ⚏
        </th>
        
        {/* Column headers with enhanced styling */}
        {headers.map((header, col) => {
          const sortClass = sortState.column === col ? `sort-${sortState.direction}` : ''
          const sortIndicatorClass = sortState.isViewOnly ? 'view-only' : 'committed'
          const columnLetter = getColumnLetter(col)
          const storedWidth = columnWidths[col] || 150
          const widthStyle = {
            width: `${storedWidth}px`,
            minWidth: `${storedWidth}px`,
            maxWidth: `${storedWidth}px`
          }
          const userResizedClass = columnWidths[col] && columnWidths[col] !== 150 ? 'user-resized' : ''
          
          return (
            <th 
              key={col}
              onClick={(e) => handleColumnHeaderClick(col, e)}
              onMouseDown={(_e) => {
                // Start column drag if needed
                if (getDragProps) {
                  // Handle drag start
                }
              }}
              onDoubleClick={() => handleHeaderDoubleClick(col)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (onShowColumnContextMenu) {
                  onShowColumnContextMenu(e, col)
                }
              }}
              className={`column-header ${sortClass} ${userResizedClass}`}
              data-col={col}
              style={widthStyle}
              title={`Column ${columnLetter}: ${header}`}
              {...(getDragProps ? getDragProps('column', col) : {})}
              {...(getDropProps ? getDropProps('column', col) : {})}
            >
              <div className="header-content">
                <div className="column-letter">{columnLetter}</div>
                {editingHeader === col ? (
                  <input
                    className="header-input"
                    type="text"
                    defaultValue={header}
                    autoFocus
                    onBlur={(e) => handleHeaderBlur(col, e.target.value)}
                    onKeyDown={(e) => handleHeaderKeyDown(e, col)}
                  />
                ) : (
                  <div className="column-title" title="Double-click to edit header">
                    {header}
                  </div>
                )}
                <div 
                  className={`sort-indicator ${sortIndicatorClass}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSort(col)
                  }}
                  title="Sort column"
                >
                  {sortState.column === col ? (
                    sortState.direction === 'asc' ? '▲' : '▼'
                  ) : '↕'}
                </div>
              </div>
              <div 
                className="resize-handle"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  handleAutoFit(col)
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handleResizeStart(e, col)
                }}
              />
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

export default TableHeader