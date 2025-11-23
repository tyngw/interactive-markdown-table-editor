import { useCallback, useEffect, useRef, useMemo } from 'react'
import { EditorState, CellPosition, HeaderConfig } from '../types'
import { processCellContent, processCellContentForEditing, processCellContentForStorage } from '../utils/contentConverter'
import CellEditor from './CellEditor'
import { getColumnLetter } from '../utils/tableUtils'
import { cleanupCellVisualArtifacts, queryCellElement } from '../utils/cellDomUtils'

interface TableBodyProps {
  headers: string[]
  rows: string[][]
  editorState: EditorState
  onCellUpdate: (row: number, col: number, value: string) => void
  onHeaderUpdate?: (col: number, value: string) => void
  onCellSelect: (row: number, col: number, extend?: boolean, toggle?: boolean) => void
  onCellEdit: (position: CellPosition | null) => void
  initialCellInput?: string | null
  onAddRow: (index?: number) => void
  onDeleteRow: (index: number) => void
  onRowSelect?: (row: number, event: React.MouseEvent) => void
  onShowRowContextMenu?: (event: React.MouseEvent, row: number) => void
  getDragProps?: (type: 'row' | 'column', index: number) => any
  getDropProps?: (type: 'row' | 'column', index: number) => any
  selectedRows?: Set<number>
  fillRange?: { start: CellPosition; end: CellPosition } | null
  onFillHandleMouseDown?: (event: React.MouseEvent) => void
  headerConfig?: HeaderConfig
  isSearchResult?: (row: number, col: number) => boolean
  isCurrentSearchResult?: (row: number, col: number) => boolean
}

const TableBody: React.FC<TableBodyProps> = ({
  headers,
  rows,
  editorState,
  onCellUpdate,
  onHeaderUpdate,
  onCellSelect,
  onCellEdit,
  initialCellInput,
  onRowSelect,
  onShowRowContextMenu,
  getDragProps,
  getDropProps,
  selectedRows,
  fillRange,
  onFillHandleMouseDown,
  headerConfig,
  isSearchResult,
  isCurrentSearchResult
}) => {
  const savedHeightsRef = useRef<Map<string, { original: number; rowMax: number }>>(new Map())
  void onHeaderUpdate

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

  // 列記号はユーティリティから提供

  const isCellSelected = useCallback((row: number, col: number) => {
    return editorState.selectedCells.has(`${row}-${col}`)
  }, [editorState.selectedCells])

  // アンカーセルかどうかを判定
  const isAnchorCell = useCallback((row: number, col: number) => {
    if (!editorState.selectionRange) return false
    return editorState.selectionRange.start.row === row && editorState.selectionRange.start.col === col
  }, [editorState.selectionRange])

  // 単一セル選択かどうかを判定
  const isSingleCellSelection = useCallback(() => {
    return editorState.selectedCells.size === 1
  }, [editorState.selectedCells])

  // 選択範囲の境界にあるかどうかを判定
  const getSelectionBorders = useCallback((row: number, col: number) => {
    if (!editorState.selectionRange || !isCellSelected(row, col)) {
      return { top: false, bottom: false, left: false, right: false }
    }

    const { start, end } = editorState.selectionRange
    const minRow = Math.min(start.row, end.row)
    const maxRow = Math.max(start.row, end.row)
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)

    return {
      top: row === minRow,
      bottom: row === maxRow,
      left: col === minCol,
      right: col === maxCol
    }
  }, [editorState.selectionRange, isCellSelected])

  const isCellEditing = useCallback((row: number, col: number) => {
    return editorState.currentEditingCell?.row === row && 
           editorState.currentEditingCell?.col === col
  }, [editorState.currentEditingCell])

  const cleanupCellVisualState = useCallback((row: number, col: number) => {
    cleanupCellVisualArtifacts({ row, col })
    try {
      savedHeightsRef.current.delete(`${row}-${col}`)
    } catch (_) { /* noop */ }
  }, [])

  const startCellEdit = useCallback((row: number, col: number) => {
    console.debug('[TableBody] startCellEdit called', { row, col })
    // 編集開始前に行全体の高さ情報を測定
  const measuredHeights = { original: 0, maxInRow: 0, rowCellHeights: [] as number[] }
    
    try {
      const rowElement = document.querySelector(`tr[data-row="${row}"]`)
      if (rowElement) {
        const rowCells = rowElement.querySelectorAll('td[data-col]')
        const cellHeights: number[] = []
        
        rowCells.forEach((cellElement) => {
          if (cellElement instanceof HTMLElement) {
            const cellCol = parseInt(cellElement.dataset.col || '0', 10)
            // 高さ測定の信頼性を高める（offsetHeight が 0 になる環境があるため）
            let cellHeight = cellElement.offsetHeight
            if (!cellHeight || cellHeight <= 0) {
              const rect = cellElement.getBoundingClientRect()
              if (rect && rect.height) {
                cellHeight = Math.ceil(rect.height)
              } else {
                // それでも 0/NaN の場合は clientHeight を試し、最終的に 32px にフォールバック
                cellHeight = cellElement.clientHeight || 32
              }
            }
            cellHeights.push(cellHeight)
            
            // 編集対象のセルの元の高さを記録
            if (cellCol === col) {
              measuredHeights.original = cellHeight
            }
          }
        })
        
        // 行内の最大高さを取得
        measuredHeights.maxInRow = Math.max(...cellHeights, 32) // 最小32px
        // original が 0/未測定になりうるケースに備えフォールバック（ログや初回反映の安定化）
        if (!measuredHeights.original || measuredHeights.original <= 0) {
          measuredHeights.original = Math.max(32, measuredHeights.maxInRow)
        }
        measuredHeights.rowCellHeights = cellHeights
        
        console.log('TableBody height measurement before edit:', {
          row,
          col,
          originalCellHeight: measuredHeights.original,
          maxInRow: measuredHeights.maxInRow,
          allCellHeights: cellHeights,
          cellContent: rows[row]?.[col] || ''
        })

        // 編集モード突入前に、行内のセルへ min-height を同期（初期ちらつき防止）
        try {
          rowCells.forEach((cellElement) => {
            if (cellElement instanceof HTMLElement) {
              cellElement.style.minHeight = `${measuredHeights.maxInRow}px`
              // 対象セルには dataset も事前に付与
              const cellCol = parseInt(cellElement.dataset.col || '0', 10)
              if (cellCol === col) {
                cellElement.dataset.originalHeight = measuredHeights.original.toString()
                cellElement.dataset.rowMaxHeight = measuredHeights.maxInRow.toString()
              }
            }
          })
        } catch (_) { /* noop */ }

        // 初回レンダリングで参照されるよう、先に保存
        try {
          savedHeightsRef.current.set(`${row}-${col}`, { 
            original: measuredHeights.original, 
            rowMax: measuredHeights.maxInRow 
          })
        } catch (_) { /* noop */ }
      }
    } catch (error) {
      console.error('Error measuring cell heights:', error)
      // エラー時はデフォルト値を使用
      measuredHeights.original = 32
      measuredHeights.maxInRow = 32
    }
    
    // 編集モードに移行
    onCellEdit({ row, col })
    
    // DOM更新後にデータを保存
    requestAnimationFrame(() => {
      try {
  const cellElement = queryCellElement({ row, col })
  if (cellElement) {
          // 測定した高さ情報を保存
          cellElement.dataset.originalHeight = measuredHeights.original.toString()
          cellElement.dataset.rowMaxHeight = measuredHeights.maxInRow.toString()
          savedHeightsRef.current.set(`${row}-${col}`, { 
            original: measuredHeights.original, 
            rowMax: measuredHeights.maxInRow 
          })
          
          // エディターに高さ更新を通知
          const editorTextarea = cellElement.querySelector('textarea')
          if (editorTextarea instanceof HTMLTextAreaElement) {
            const event = new CustomEvent('heightUpdate', {
              detail: {
                originalHeight: measuredHeights.original,
                rowMaxHeight: measuredHeights.maxInRow
              }
            })
            editorTextarea.dispatchEvent(event)
          }
        }
      } catch (error) {
        console.error('Error setting up cell editor height data:', error)
      }
    })
  }, [onCellEdit, rows])

  const commitCellEdit = useCallback((row: number, col: number, value: string, move?: 'right' | 'left' | 'down' | 'up') => {
    const storageValue = processCellContentForStorage(value)
    onCellUpdate(row, col, storageValue)

    cleanupCellVisualState(row, col)

    onCellEdit(null)
    if (typeof move !== 'undefined') {
      let nextRow = row
      let nextCol = col
      const maxRow = rows.length - 1
      const maxCol = headers.length - 1
      // 列ヘッダーOFF時は0行目（row=-1）が最小行
      const minRow = (headerConfig?.hasColumnHeaders === false) ? -1 : 0
      switch (move) {
        case 'right':
          if (nextCol < maxCol) { nextCol += 1 } else if (nextRow < maxRow) { nextRow += 1; nextCol = 0 }
          break
        case 'left':
          if (nextCol > 0) { nextCol -= 1 } else if (nextRow > minRow) { nextRow -= 1; nextCol = maxCol }
          break
        case 'down':
          if (nextRow < maxRow) { nextRow += 1 }
          break
        case 'up':
          if (nextRow > minRow) { nextRow -= 1 }
          break
      }
      onCellSelect(nextRow, nextCol, false)
    }
  }, [onCellUpdate, onCellEdit, onCellSelect, rows.length, headers.length, headerConfig])

  const cancelCellEdit = useCallback((row: number, col: number) => {
    cleanupCellVisualState(row, col)
    onCellEdit(null)
  }, [cleanupCellVisualState, onCellEdit])

  // フィル範囲内のセルかどうかを判定
  const isCellInFillRange = useCallback((row: number, col: number) => {
    if (!fillRange) return false
    const startRow = Math.min(fillRange.start.row, fillRange.end.row)
    const endRow = Math.max(fillRange.start.row, fillRange.end.row)
    const startCol = Math.min(fillRange.start.col, fillRange.end.col)
    const endCol = Math.max(fillRange.start.col, fillRange.end.col)
    return row >= startRow && row <= endRow && col >= startCol && col <= endCol
  }, [fillRange])

  // 選択範囲の右下セルかどうかを判定
  const isBottomRightCell = useCallback((row: number, col: number) => {
    if (!editorState.selectionRange) return false
    const endRow = Math.max(editorState.selectionRange.start.row, editorState.selectionRange.end.row)
    const endCol = Math.max(editorState.selectionRange.start.col, editorState.selectionRange.end.col)
    return row === endRow && col === endCol
  }, [editorState.selectionRange])

  // すべての編集開始経路（ダブルクリック/キーボード/F2/Enter）に対して行高さ測定を保証
  useEffect(() => {
    const pos = editorState.currentEditingCell
    if (!pos) return

    const { row, col } = pos
    const key = `${row}-${col}`

    const measureAndNotify = () => {
      const measured = { original: 0, rowMax: 32 }
      try {
        const rowElement = document.querySelector(`tr[data-row="${row}"]`)
        if (rowElement) {
          const rowCells = rowElement.querySelectorAll('td[data-col]')
          const otherHeights: number[] = []
          let existingRowMaxFromDataset = 32
          rowCells.forEach((el) => {
            if (el instanceof HTMLElement) {
              const c = parseInt(el.dataset.col || '0', 10)
              // 信頼性の高い高さを取得（0 を避ける）
              let h = el.offsetHeight
              if (!h || h <= 0) {
                const r = el.getBoundingClientRect()
                h = (r && r.height) ? Math.ceil(r.height) : (el.clientHeight || 32)
              }
              if (c === col) {
                measured.original = h
              } else {
                otherHeights.push(h)
              }
              // dataset 由来の既存行最大も拾って最大化（ダウングレード防止）
              const ds = el.dataset.rowMaxHeight ? parseInt(el.dataset.rowMaxHeight, 10) : undefined
              if (typeof ds === 'number' && !Number.isNaN(ds)) {
                existingRowMaxFromDataset = Math.max(existingRowMaxFromDataset, ds)
              }
            }
          })
          measured.rowMax = Math.max(32, ...otherHeights, measured.original, existingRowMaxFromDataset)
        }
      } catch (e) {
        // フォールバック既定値
        measured.original = measured.original || 32
        measured.rowMax = measured.rowMax || 32
      }

      // 保存 & dataset へ反映（既存より小さい値で上書きしない）
      savedHeightsRef.current.set(key, { original: measured.original, rowMax: measured.rowMax })
      try {
        const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
        if (cellElement instanceof HTMLElement) {
          const currentRowMax = cellElement.dataset.rowMaxHeight ? parseInt(cellElement.dataset.rowMaxHeight, 10) : undefined
          const effectiveRowMax = typeof currentRowMax === 'number' && !Number.isNaN(currentRowMax)
            ? Math.max(currentRowMax, measured.rowMax)
            : measured.rowMax
          cellElement.dataset.originalHeight = String(measured.original)
          cellElement.dataset.rowMaxHeight = String(effectiveRowMax)

          // textarea に高さ更新イベントを通知
          const editorTextarea = cellElement.querySelector('textarea')
          if (editorTextarea instanceof HTMLTextAreaElement) {
            const ev = new CustomEvent('heightUpdate', { detail: { originalHeight: measured.original, rowMaxHeight: effectiveRowMax } })
            editorTextarea.dispatchEvent(ev)
          }
        }
      } catch (_) { /* noop */ }
    }

    // 既に測定済みでも、textarea 側の再計算を促すため heightUpdate は投げる
    // 初回は layout 反映後のフレームで実施
    requestAnimationFrame(() => {
      measureAndNotify()
    })
  // rows / headers が変わると行高さも変わり得るため依存に含める
  }, [editorState.currentEditingCell, rows, headers])

  // 表示する行を統一形式で作成（列ヘッダーOFF時はheadersをrow=-1として先頭に追加）
  const allRows = useMemo(() => {
    const result: Array<{ rowIndex: number; cells: string[] }> = []

    // 列ヘッダーがOFFの場合、headersを先頭行（row=-1）として追加
    if (headerConfig?.hasColumnHeaders === false) {
      result.push({ rowIndex: -1, cells: headers })
    }

    // データ行を追加
    rows.forEach((row, index) => {
      result.push({ rowIndex: index, cells: row })
    })

    return result
  }, [headerConfig?.hasColumnHeaders, headers, rows])

  return (
    <tbody>
      {allRows.map(({ rowIndex, cells }) => {
        const rowHeaderValue = headerConfig?.hasRowHeaders ? (cells[0] || '') : ''
        // 表示行番号を計算（row=-1の場合は0、それ以外は1始まり）
        const displayRowNumber = rowIndex === -1 ? 0 : rowIndex + 1

        return (
          <tr key={rowIndex} data-row={rowIndex}>
            <td
              className={`row-number ${selectedRows?.has(rowIndex) ? 'highlighted' : ''} ${headerConfig?.hasRowHeaders ? 'row-header-with-value' : ''}`}
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
              title={headerConfig?.hasRowHeaders ? `Row ${displayRowNumber}: ${rowHeaderValue}` : `Row ${displayRowNumber}`}
              {...(getDragProps ? getDragProps('row', rowIndex) : {})}
              {...(getDropProps ? getDropProps('row', rowIndex) : {})}
            >
              {headerConfig?.hasRowHeaders ? (
                <div className="row-header-content">
                  <div className="row-number-label">{displayRowNumber}</div>
                  <div className="row-header-title">{rowHeaderValue}</div>
                </div>
              ) : (
                displayRowNumber
              )}
            </td>

            {cells.map((cell, colIndex) => {
              // 行ヘッダーONの場合、先頭列をスキップ
              if (headerConfig?.hasRowHeaders && colIndex === 0) {
                return null
              }
              const cellId = `cell-${rowIndex}-${colIndex}`
              const isEmpty = !cell || cell.trim() === ''
              const cellClass = isEmpty ? 'empty-cell' : ''
              const storedWidth = editorState.columnWidths[colIndex] || 150
              const isEditing = isCellEditing(rowIndex, colIndex)
              const isSelected = isCellSelected(rowIndex, colIndex)
              const isAnchor = isAnchorCell(rowIndex, colIndex)
              const borders = getSelectionBorders(rowIndex, colIndex)
              const isInFillRange = isCellInFillRange(rowIndex, colIndex)
              const showFillHandle = isBottomRightCell(rowIndex, colIndex) && !isEditing
              const isSResult = isSearchResult ? isSearchResult(rowIndex, colIndex) : false
              const isCSResult = isCurrentSearchResult ? isCurrentSearchResult(rowIndex, colIndex) : false
              const widthStyle = {
                width: `${storedWidth}px`,
                minWidth: `${storedWidth}px`,
                maxWidth: `${storedWidth}px`
              }

              const userResizedClass = editorState.columnWidths[colIndex] && editorState.columnWidths[colIndex] !== 150 ? 'user-resized' : ''
              const isSingleSelection = isSingleCellSelection()

              return (
                <td
                  key={colIndex}
                  id={cellId}
                  className={`data-cell ${cellClass} ${userResizedClass} ${isSelected ? (isAnchor ? `selected anchor ${isSingleSelection ? 'single-selection' : ''}` : `selected ${isSingleSelection ? 'single-selection' : ''} ${borders.top ? 'border-top' : ''} ${borders.bottom ? 'border-bottom' : ''} ${borders.left ? 'border-left' : ''} ${borders.right ? 'border-right' : ''}`.trim()) : ''} ${isEditing ? 'editing' : ''} ${isInFillRange ? 'fill-range' : ''} ${isSResult ? 'search-result' : ''} ${isCSResult ? 'current-search-result' : ''}`}
                  onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                  onDoubleClick={() => startCellEdit(rowIndex, colIndex)}
                  data-row={rowIndex}
                  data-col={colIndex}
                  style={{
                    ...widthStyle,
                    ...(isEditing
                      ? {
                          // 編集時はmaxHeightを解除して自由に拡張できるようにする
                          minHeight: (savedHeightsRef.current.get(`${rowIndex}-${colIndex}`)?.rowMax || 32) + 'px',
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
                      rowMaxHeight={savedHeightsRef.current.get(`${rowIndex}-${colIndex}`)?.rowMax}
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
            })}
          </tr>
        )
      })}
    </tbody>
  )
}

export default TableBody