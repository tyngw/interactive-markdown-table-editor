import { useState, useCallback, useEffect } from 'react'
import { SortState, ColumnWidths, HeaderConfig, ColumnDiffInfo } from '../types'
import { getColumnLetter } from '../utils/tableUtils'
import { isImeConfirmingEnter } from '../utils/imeUtils'

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
  getDragProps?: (type: 'row' | 'column', index: number, selectedIndices?: number[]) => any
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
    // キーイベントがテーブル全体に伝播しないようにする
    e.stopPropagation()

    if (e.key === 'Enter') {
      // IME（日本語入力など）確定中の場合は、Enterキーを入力の一部として処理
      if (isImeConfirmingEnter(e)) {
        return
      }
      const target = e.target as HTMLInputElement
      onHeaderUpdate(col, target.value)
      setEditingHeader(null)
    } else if (e.key === 'Escape') {
      setEditingHeader(null)
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      // Ctrl+A (または Cmd+A on Mac)：テーブル全体の選択を防ぎ、入力フィールドのテキスト全選択を許可
      e.preventDefault()
      const target = e.target as HTMLInputElement
      target.select()
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      // BackspaceやDeleteキー：テーブル全体の削除処理に伝播しないようにする
      e.preventDefault()
      // ブラウザのデフォルト動作を避けるため防止した後、手動で削除処理を実行
      const target = e.target as HTMLInputElement
      const start = target.selectionStart || 0
      const end = target.selectionEnd || 0
      const value = target.value

      if (e.key === 'Backspace') {
        if (start === end && start > 0) {
          // カーソル位置で1文字削除
          target.value = value.slice(0, start - 1) + value.slice(start)
          target.setSelectionRange(start - 1, start - 1)
        } else if (start !== end) {
          // 選択範囲を削除
          target.value = value.slice(0, start) + value.slice(end)
          target.setSelectionRange(start, start)
        }
      } else if (e.key === 'Delete') {
        if (start === end && start < value.length) {
          // カーソル位置の次の文字を削除
          target.value = value.slice(0, start) + value.slice(start + 1)
          target.setSelectionRange(start, start)
        } else if (start !== end) {
          // 選択範囲を削除
          target.value = value.slice(0, start) + value.slice(end)
          target.setSelectionRange(start, start)
        }
      }
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
          // 列差分情報がある場合は mapping / positions を用いた表示を優先
          if (columnDiff && (
            (columnDiff.deletedColumns && columnDiff.deletedColumns.length > 0) ||
            (columnDiff.positions && columnDiff.positions.length > 0) ||
            (columnDiff.mapping && columnDiff.mapping.length > 0)
          )) {
            const hasMapping = !!(columnDiff.mapping && columnDiff.mapping.length > 0)

            // 旧列基準で一旦ヘッダセル配列を構築し、追加された列は positions を使って挿入する
            // まずヘッダのメタ情報（descriptor）を作成し、追加列は positions で挿入する
            type Hd = {
              kind: 'deleted' | 'existing' | 'added'
              key: string
              dataCol: number
              header: string
              width: number
              isSelected?: boolean
              isFullySelected?: boolean
              userResizedClass?: string
              confidenceLabel?: string
              oldHeader?: string
              renamed?: boolean
            }

            const descriptors: Hd[] = []

            for (let oldColIdx = 0; oldColIdx < columnDiff.oldColumnCount; oldColIdx++) {
              const isDeletedColumn = columnDiff.deletedColumns.includes(oldColIdx)

              if (isDeletedColumn) {
                const storedWidth = columnWidths[oldColIdx] || 150
                const deletedHeaderName = columnDiff.oldHeaders && columnDiff.oldHeaders[oldColIdx]
                  ? columnDiff.oldHeaders[oldColIdx]
                  : '(Deleted)'

                const positionInfo = columnDiff.positions?.find(
                  p => p.type === 'removed' && p.index === oldColIdx
                )
                const confidence = positionInfo?.confidence ?? 0.5
                const confidenceLabel = confidence >= 0.85 ? '' : ' (推定)'

                descriptors.push({
                  kind: 'deleted',
                  key: `deleted-${oldColIdx}`,
                  dataCol: oldColIdx,
                  header: deletedHeaderName,
                  width: storedWidth,
                  confidenceLabel
                })
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
              const oldHeaderName = columnDiff.oldHeaders && columnDiff.oldHeaders[oldColIdx]
              const renamed = !!(oldHeaderName && header && oldHeaderName !== header)
              const storedWidth = columnWidths[newColIdx] || 150
              const userResizedClass = columnWidths[newColIdx] && columnWidths[newColIdx] !== 150 ? 'user-resized' : ''
              const isSelected = selectedCols?.has(newColIdx)
              const isFullySelected = fullySelectedCols?.has(newColIdx)

              descriptors.push({
                kind: 'existing',
                key: `existing-${oldColIdx}`,
                dataCol: newColIdx,
                header,
                width: storedWidth,
                isSelected,
                isFullySelected,
                userResizedClass,
                oldHeader: oldHeaderName,
                renamed
              })
            }

            // positions を使って追加列を descriptor に挿入（added の newIndex を優先）
            if (columnDiff.positions && columnDiff.positions.length > 0) {
              const addedPositions = columnDiff.positions.filter(p => p.type === 'added')
              addedPositions.forEach(pos => {
                const insertIdx = pos.newIndex ?? pos.index
                const addedColWidth = columnWidths[insertIdx] || 150
                const headerContent = headers[insertIdx] || ''
                const userResizedClassAdded = columnWidths[insertIdx] && columnWidths[insertIdx] !== 150 ? 'user-resized' : ''
                const isSelectedAdded = selectedCols?.has(insertIdx)
                const isFullySelectedAdded = fullySelectedCols?.has(insertIdx)

                const hd: Hd = {
                  kind: 'added',
                  key: `added-${insertIdx}-${Math.random().toString(36).slice(2,7)}`,
                  dataCol: insertIdx,
                  header: headerContent,
                  width: addedColWidth,
                  isSelected: isSelectedAdded,
                  isFullySelected: isFullySelectedAdded,
                  userResizedClass: userResizedClassAdded
                }

                // splice を使って descriptor を挿入
                descriptors.splice(insertIdx, 0, hd)
              })
            }

            // 最後に descriptor を表示用の JSX に変換
            const displayHeaders = descriptors.map((d, displayIdx) => {
              // 表示インデックスは削除された列を除外して数える
              const visibleIndex = descriptors.slice(0, displayIdx).filter(x => x.kind !== 'deleted').length
              const columnLetter = getColumnLetter(visibleIndex)
              const widthStyle = {
                width: `${d.width}px`,
                minWidth: `${d.width}px`,
                maxWidth: `${d.width}px`
              }

              if (d.kind === 'deleted') {
                return (
                  <th
                    key={d.key}
                    className="column-header git-diff-column-not-exist"
                    data-col={d.dataCol}
                    style={widthStyle}
                    title={`${d.header}${d.confidenceLabel ?? ''}`}
                  >
                    <div className="header-content">
                      <div className="column-title">{d.header}</div>
                    </div>
                  </th>
                )
              }

              const col = d.dataCol
              const userResized = d.userResizedClass || ''

              const title = d.renamed && d.oldHeader
                ? `Column ${columnLetter}: ${d.header} → ${d.oldHeader}`
                : `Column ${columnLetter}: ${d.header}`

              return (
                <th
                  key={d.key}
                  onClick={(e) => handleColumnHeaderClick(col, e)}
                  onDoubleClick={() => handleHeaderDoubleClick(col)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (onShowColumnContextMenu) {
                      onShowColumnContextMenu(e, col)
                    }
                  }}
                  className={`column-header ${userResized} ${d.isFullySelected ? 'selected' : (d.isSelected ? 'highlighted' : '')}`}
                  data-col={col}
                  style={widthStyle}
                  title={title}
                  {...(getDragProps ? getDragProps('column', col, selectedCols ? Array.from(selectedCols) : undefined) : {})}
                  {...(getDropProps ? getDropProps('column', col) : {})}
                >
                  <div className="header-content">
                    <div className="column-letter">{columnLetter}</div>
                    {headerConfig?.hasColumnHeaders !== false && (
                      editingHeader === col ? (
                        <input
                          className="header-input"
                          type="text"
                          defaultValue={d.header}
                          autoFocus
                          onBlur={(e) => handleHeaderBlur(col, e.target.value)}
                          onKeyDown={(e) => handleHeaderKeyDown(e, col)}
                        />
                      ) : (
                        <div className="column-title" title="Double-click to edit header">
                          {d.renamed && d.oldHeader ? (
                            <>
                              <span className="header-rename-new">{d.header}</span>
                              <span className="header-rename-old">{d.oldHeader}</span>
                            </>
                          ) : d.header}
                        </div>
                      )
                    )}
                    <div
                      className="sort-indicator"
                      onClick={(e) => { e.stopPropagation(); onSort(col) }}
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
                    onDoubleClick={(e) => { e.stopPropagation(); handleAutoFit(col) }}
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, col) }}
                  />
                </th>
              )
            })

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
                {...(getDragProps ? getDragProps('column', col, selectedCols ? Array.from(selectedCols) : undefined) : {})}
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