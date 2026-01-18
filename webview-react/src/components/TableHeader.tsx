import { useState, useCallback, useEffect } from 'react'
import { SortState, ColumnWidths, HeaderConfig, ColumnDiffInfo } from '../types'
import { getColumnLetter } from '../utils/tableUtils'

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
  // 旧仕様ではヘッダークリック=ソートのため未使用
  onColumnSelect?: (col: number, event: React.MouseEvent) => void
  onShowColumnContextMenu?: (event: React.MouseEvent, col: number) => void
  getDragProps?: (type: 'row' | 'column', index: number) => any
  getDropProps?: (type: 'row' | 'column', index: number) => any
  selectedCols?: Set<number>
  fullySelectedCols?: Set<number>
  headerConfig?: HeaderConfig
  columnDiff?: ColumnDiffInfo  // 列の差分情報
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
  getDropProps,
  selectedCols,
  fullySelectedCols,
  headerConfig,
  columnDiff
}) => {
  // theme context はここでは未使用
  const [editingHeader, setEditingHeader] = useState<number | null>(null)
  const [resizing, setResizing] = useState<{ col: number; startX: number; startWidth: number } | null>(null)
  const [clickTimer, setClickTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  // ヘッダー編集開始（ダブルクリック時）
  const handleHeaderDoubleClick = useCallback((col: number) => {
    // クリックタイマーをキャンセル（シングルクリックの処理を防ぐ）
    if (clickTimer) {
      clearTimeout(clickTimer)
      setClickTimer(null)
    }

    // 列ヘッダがONの場合のみ編集可能
    if (headerConfig?.hasColumnHeaders !== false) {
      setEditingHeader(col)
    }
  }, [clickTimer, headerConfig])

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

  // クリックタイマーのクリーンアップ
  useEffect(() => {
    return () => {
      if (clickTimer) {
        clearTimeout(clickTimer)
      }
    }
  }, [clickTimer])

  // 列記号はユーティリティから提供

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
    // リサイズ中やハンドル上のクリックは無視
    if (resizing) return
    if ((event.target as HTMLElement).closest('.resize-handle')) return
    if ((event.target as HTMLElement).closest('.sort-indicator')) return

    // React合成イベントのプロパティを先に取得（イベントプーリングのため）
    const shiftKey = event.shiftKey
    const ctrlKey = event.ctrlKey
    const metaKey = event.metaKey

    // 既存のタイマーがあればキャンセル
    if (clickTimer) {
      clearTimeout(clickTimer)
    }

    // シングルクリックの処理を遅延させる（ダブルクリック検出のため）
    // ダブルクリックが発生した場合、このタイマーはキャンセルされる
    const timer = setTimeout(() => {
      // 列ヘッダークリックで列全体を選択（Shift押下で範囲選択）
      if (onColumnSelect) {
        // イベントオブジェクトを再構築
        const syntheticEvent = {
          shiftKey,
          ctrlKey,
          metaKey,
          preventDefault: () => { },
          stopPropagation: () => { }
        } as React.MouseEvent
        onColumnSelect(col, syntheticEvent)
      }
      setClickTimer(null)
    }, 250) // 250ms待機してダブルクリックを検出

    setClickTimer(timer)
  }, [resizing, onColumnSelect, clickTimer])

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
        {(() => {
          // 列が削除された場合は、削除前の列構造に基づいてレンダリング
          // 新しいmappingを活用して中間列の追加/削除を正確に処理
          if (columnDiff && columnDiff.deletedColumns && columnDiff.deletedColumns.length > 0) {
            const hasMapping = !!(columnDiff.mapping && columnDiff.mapping.length > 0)

            // 旧列基準で一旦ヘッダセル配列を構築し、追加された列は positions を使って挿入する
            const displayHeaders: Array<JSX.Element> = []

            for (let oldColIdx = 0; oldColIdx < columnDiff.oldColumnCount; oldColIdx++) {
              const isDeletedColumn = columnDiff.deletedColumns.includes(oldColIdx)

              if (isDeletedColumn) {
                const columnLetter = getColumnLetter(oldColIdx)
                const storedWidth = columnWidths[oldColIdx] || 150
                const widthStyle = {
                  width: `${storedWidth}px`,
                  minWidth: `${storedWidth}px`,
                  maxWidth: `${storedWidth}px`
                }
                const deletedHeaderName = columnDiff.oldHeaders && columnDiff.oldHeaders[oldColIdx]
                  ? columnDiff.oldHeaders[oldColIdx]
                  : '(Deleted)'

                const positionInfo = columnDiff.positions?.find(
                  p => p.type === 'removed' && p.index === oldColIdx
                )
                const confidence = positionInfo?.confidence ?? 0.5
                const confidenceLabel = confidence >= 0.85 ? '' : ' (推定)'

                displayHeaders.push(
                  <th
                    key={`deleted-header-${oldColIdx}`}
                    className="column-header git-diff-column-not-exist"
                    data-col={oldColIdx}
                    style={widthStyle}
                    title={`Column ${columnLetter}: ${deletedHeaderName}${confidenceLabel}`}
                  >
                    <div className="header-content">
                      <div className="column-letter">{columnLetter}</div>
                      <div className="column-title">{deletedHeaderName}</div>
                    </div>
                  </th>
                )
                continue
              }

              // 削除されていない列：mapping または削除前考慮で新インデックスを算出してヘッダ名を取得
              let newColIdx: number
              if (hasMapping && columnDiff.mapping![oldColIdx] !== -1) {
                newColIdx = columnDiff.mapping![oldColIdx]
              } else {
                const deletedBeforeThisCol = columnDiff.deletedColumns.filter(dc => dc < oldColIdx).length
                newColIdx = oldColIdx - deletedBeforeThisCol
              }

              const header = headers[newColIdx] || ''
              const col = newColIdx

              const columnLetter = getColumnLetter(oldColIdx)
              const storedWidth = columnWidths[newColIdx] || 150
              const widthStyle = {
                width: `${storedWidth}px`,
                minWidth: `${storedWidth}px`,
                maxWidth: `${storedWidth}px`
              }
              const userResizedClass = columnWidths[newColIdx] && columnWidths[newColIdx] !== 150 ? 'user-resized' : ''
              const isSelected = selectedCols?.has(newColIdx)
              const isFullySelected = fullySelectedCols?.has(newColIdx)

              displayHeaders.push(
                <th
                  key={col}
                  onClick={(e) => handleColumnHeaderClick(col, e)}
                  onMouseDown={(_e) => {
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
                  className={`column-header ${userResizedClass} ${isFullySelected ? 'selected' : (isSelected ? 'highlighted' : '')}`}
                  data-col={col}
                  style={widthStyle}
                  title={`Column ${columnLetter}: ${header}`}
                  {...(getDragProps ? getDragProps('column', col) : {})}
                  {...(getDropProps ? getDropProps('column', col) : {})}
                >
                  <div className="header-content">
                    <div className="column-letter">{columnLetter}</div>
                    {headerConfig?.hasColumnHeaders !== false && (
                      <>
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
                      </>
                    )}
                    <div
                      className="sort-indicator"
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('🔧 Sort icon clicked for column:', col)
                        console.log('🔧 Current sortState:', sortState)
                        onSort(col)
                      }}
                      title="Sort column"
                      style={{ visibility: columnDiff ? 'hidden' : 'visible' }}
                    >
                      {sortState?.column === col && sortState?.direction !== 'none' ? (
                        sortState?.direction === 'asc' ? '↑' : '↓'
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
            }

            // positions を使って追加列をヘッダに挿入（追加列は newIndex / index を使用）
            if (columnDiff.positions && columnDiff.positions.length > 0) {
              const addedPositions = columnDiff.positions.filter(p => p.type === 'added')
              addedPositions.forEach(pos => {
                const insertIdx = pos.newIndex ?? pos.index
                const addedColWidth = columnWidths[insertIdx] || 150
                const headerContent = headers[insertIdx] || ''
                // ヘッダを通常ヘッダと同様の構造で生成してスタイル差を無くす
                const userResizedClassAdded = columnWidths[insertIdx] && columnWidths[insertIdx] !== 150 ? 'user-resized' : ''
                const isSelectedAdded = selectedCols?.has(insertIdx)
                const isFullySelectedAdded = fullySelectedCols?.has(insertIdx)

                const headerCell = (
                  <th
                    key={`header-added-${insertIdx}`}
                    data-col={insertIdx}
                    className={`column-header ${userResizedClassAdded} ${isFullySelectedAdded ? 'selected' : (isSelectedAdded ? 'highlighted' : '')}`}
                    style={{
                      width: `${addedColWidth}px`,
                      minWidth: `${addedColWidth}px`,
                      maxWidth: `${addedColWidth}px`
                    }}
                    onClick={(e) => handleColumnHeaderClick(insertIdx, e)}
                    onMouseDown={(_e) => { if (getDragProps) { /* noop */ } }}
                    onDoubleClick={() => handleHeaderDoubleClick(insertIdx)}
                    onContextMenu={(e) => { e.preventDefault(); if (onShowColumnContextMenu) { onShowColumnContextMenu(e, insertIdx) } }}
                    {...(getDragProps ? getDragProps('column', insertIdx) : {})}
                    {...(getDropProps ? getDropProps('column', insertIdx) : {})}
                  >
                    <div className="header-content">
                      <div className="column-letter">{getColumnLetter(insertIdx)}</div>
                      {headerConfig?.hasColumnHeaders !== false && (
                        editingHeader === insertIdx ? (
                          <input
                            className="header-input"
                            type="text"
                            defaultValue={headerContent}
                            autoFocus
                            onBlur={(e) => handleHeaderBlur(insertIdx, e.target.value)}
                            onKeyDown={(e) => handleHeaderKeyDown(e, insertIdx)}
                          />
                        ) : (
                          <div className="column-title" title="Double-click to edit header">{headerContent}</div>
                        )
                      )}
                      <div
                        className="sort-indicator"
                        onClick={(e) => { e.stopPropagation(); onSort(insertIdx) }}
                        title="Sort column"
                        style={{ visibility: columnDiff ? 'hidden' : 'visible' }}
                      >
                        {sortState?.column === insertIdx && sortState?.direction !== 'none' ? (
                          sortState?.direction === 'asc' ? '↑' : '↓'
                        ) : '↕'}
                      </div>
                    </div>
                    <div
                      className="resize-handle"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => { e.stopPropagation(); handleAutoFit(insertIdx) }}
                      onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, insertIdx) }}
                    />
                  </th>
                )

                // 配列長を超える場合は末尾に追加される（splice の挙動）
                displayHeaders.splice(insertIdx, 0, headerCell)
              })
            }

            return displayHeaders
          }
          
          // 通常行：削除がない場合、既存ロジックでヘッダをレンダリング
          return headers.map((header, col) => {
            const columnLetter = getColumnLetter(col)
            const storedWidth = columnWidths[col] || 150
            const widthStyle = {
              width: `${storedWidth}px`,
              minWidth: `${storedWidth}px`,
              maxWidth: `${storedWidth}px`
            }
            const userResizedClass = columnWidths[col] && columnWidths[col] !== 150 ? 'user-resized' : ''
            const isSelected = selectedCols?.has(col)
            const isFullySelected = fullySelectedCols?.has(col)

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
                className={`column-header ${userResizedClass} ${isFullySelected ? 'selected' : (isSelected ? 'highlighted' : '')}`}
                data-col={col}
                style={widthStyle}
                title={`Column ${columnLetter}: ${header}`}
                {...(getDragProps ? getDragProps('column', col) : {})}
                {...(getDropProps ? getDropProps('column', col) : {})}
              >
                <div className="header-content">
                  <div className="column-letter">{columnLetter}</div>
                  {headerConfig?.hasColumnHeaders !== false && (
                    <>
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
                    </>
                  )}
                  <div
                    className="sort-indicator"
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log('🔧 Sort icon clicked for column:', col)
                      console.log('🔧 Current sortState:', sortState)
                      onSort(col)
                    }}
                    title="Sort column"
                    style={{ visibility: columnDiff ? 'hidden' : 'visible' }}
                  >
                    {sortState?.column === col && sortState?.direction !== 'none' ? (
                      sortState?.direction === 'asc' ? '↑' : '↓'
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
          })
        })()}
      </tr>
    </thead>
  )
}
export default TableHeader