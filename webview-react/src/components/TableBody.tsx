import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorState, CellPosition, HeaderConfig } from '../types'
import { processCellContent, processCellContentForEditing, processCellContentForStorage } from '../utils/contentConverter'
import CellEditor from './CellEditor'
import { getColumnLetter } from '../utils/tableUtils'

interface TableBodyProps {
  headers: string[]
  rows: string[][]
  editorState: EditorState
  onCellUpdate: (row: number, col: number, value: string) => void
  onHeaderUpdate?: (col: number, value: string) => void
  onCellSelect: (row: number, col: number, extend?: boolean, toggle?: boolean) => void
  onCellEdit: (position: CellPosition | null) => void
  onAddRow: (index?: number) => void
  onDeleteRow: (index: number) => void
  onRowSelect?: (row: number, event: React.MouseEvent) => void
  onShowRowContextMenu?: (event: React.MouseEvent, row: number) => void
  getDragProps?: (type: 'row' | 'column', index: number) => any
  getDropProps?: (type: 'row' | 'column', index: number) => any
  selectedRows?: Set<number>
  fillRange?: { start: CellPosition; end: CellPosition } | null
  onFillHandleMouseDown?: (event: React.MouseEvent) => void
  onRowResize?: (row: number, height: number) => void
  headerConfig?: HeaderConfig
}

const TableBody: React.FC<TableBodyProps> = ({
  headers,
  rows,
  editorState,
  onCellUpdate,
  onHeaderUpdate,
  onCellSelect,
  onCellEdit,
  onRowSelect,
  onShowRowContextMenu,
  getDragProps,
  getDropProps,
  selectedRows,
  fillRange,
  onFillHandleMouseDown,
  onRowResize,
  headerConfig
}) => {
  const savedHeightsRef = useRef<Map<string, { original: number; rowMax: number }>>(new Map())
  const [resizingRow, setResizingRow] = useState<{ row: number; startY: number; startHeight: number } | null>(null)

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

  // 行リサイズ開始
  const handleRowResizeStart = useCallback((e: React.MouseEvent, row: number) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = editorState.rowHeights[row] || 32
    setResizingRow({ row, startY, startHeight })
  }, [editorState.rowHeights])

  // 行リサイズ中
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRow) return

    const deltaY = e.clientY - resizingRow.startY
    const newHeight = Math.max(24, resizingRow.startHeight + deltaY)
    if (onRowResize) {
      onRowResize(resizingRow.row, newHeight)
    }
  }, [resizingRow, onRowResize])

  // 行リサイズ終了
  const handleMouseUp = useCallback(() => {
    setResizingRow(null)
  }, [])

  // リサイズイベントリスナーの設定
  useEffect(() => {
    if (resizingRow) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [resizingRow, handleMouseMove, handleMouseUp])

  // 列記号はユーティリティから提供

  const isCellSelected = useCallback((row: number, col: number) => {
    return editorState.selectedCells.has(`${row}-${col}`)
  }, [editorState.selectedCells])

  const isCellEditing = useCallback((row: number, col: number) => {
    return editorState.currentEditingCell?.row === row && 
           editorState.currentEditingCell?.col === col
  }, [editorState.currentEditingCell])

  const startCellEdit = useCallback((row: number, col: number) => {
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
        const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
        if (cellElement instanceof HTMLElement) {
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

    try {
      const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
        if (cellElement instanceof HTMLElement) {
        if (cellElement.dataset.originalHeight) delete cellElement.dataset.originalHeight
        if (cellElement.dataset.rowMaxHeight) delete cellElement.dataset.rowMaxHeight
        // 不可視のスペーサーを除去
        try {
          const rowElement = cellElement.parentElement
          if (rowElement) {
            rowElement.querySelectorAll('.height-spacer').forEach((el) => el.parentElement?.removeChild(el))
          }
        } catch (_) { /* noop */ }
        // インライン minHeight をリセット
        try {
          const rowElement = cellElement.parentElement
          if (rowElement) {
            rowElement.querySelectorAll('td[data-col]').forEach((td) => {
              if (td instanceof HTMLElement) td.style.minHeight = ''
            })
          }
        } catch (_) { /* noop */ }
      }
    } catch (error) {
      // console.warn('Failed to cleanup original height:', error)
    }
    // 保存していた測定データもクリーンアップ
    try {
  savedHeightsRef.current.delete(`${row}-${col}`)
    } catch (_) { /* noop */ }

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
    try {
      const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
      if (cellElement instanceof HTMLElement) {
        if (cellElement.dataset.originalHeight) delete cellElement.dataset.originalHeight
        if (cellElement.dataset.maxOtherHeight) delete cellElement.dataset.maxOtherHeight
        // 不可視スペーサーを除去し、min-height を元に戻す
        try {
          const rowElement = cellElement.parentElement
          if (rowElement) {
            rowElement.querySelectorAll('.height-spacer').forEach((el) => el.parentElement?.removeChild(el))
            rowElement.querySelectorAll('td[data-col]').forEach((td) => {
              if (td instanceof HTMLElement) td.style.minHeight = ''
            })
          }
        } catch (_) { /* noop */ }
      }
    } catch (error) {
      // console.warn('Failed to cleanup original height:', error)
    }
    // 保存していた測定データもクリーンアップ
    try {
      savedHeightsRef.current.delete(`${row}-${col}`)
    } catch (_) { /* noop */ }
    
    onCellEdit(null)
  }, [onCellEdit])

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
    const startRow = Math.min(editorState.selectionRange.start.row, editorState.selectionRange.end.row)
    const endRow = Math.max(editorState.selectionRange.start.row, editorState.selectionRange.end.row)
    const startCol = Math.min(editorState.selectionRange.start.col, editorState.selectionRange.end.col)
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

  return (
    <tbody>
      {/* hasColumnHeaders が false の場合、ヘッダー行を0行目として通常のデータセルと同様に表示 */}
      {headerConfig?.hasColumnHeaders === false && (
        <tr key={-1} data-row={-1}>
          <td
            className="row-number"
            style={editorState.rowHeights[-1] ? { height: `${editorState.rowHeights[-1]}px`, minHeight: `${editorState.rowHeights[-1]}px` } : {}}
            onClick={(e) => {
              if (onRowSelect) {
                onRowSelect(-1, e)
              }
            }}
            title="Row 0"
          >
            0
            <div
              className="resize-handle-row"
              onMouseDown={(e) => handleRowResizeStart(e, -1)}
            />
          </td>
          {headers.map((header, colIndex) => {
            // 行ヘッダーONの場合、先頭列をスキップ
            if (headerConfig?.hasRowHeaders && colIndex === 0) {
              return null
            }
            const cellId = `cell--1-${colIndex}`
            const isEmpty = !header || header.trim() === ''
            const cellClass = isEmpty ? 'empty-cell' : ''
            const storedWidth = editorState.columnWidths[colIndex] || 150
            const storedHeight = editorState.rowHeights[-1]
            const isEditing = isCellEditing(-1, colIndex)
            const isSelected = isCellSelected(-1, colIndex)
            const isInFillRange = isCellInFillRange(-1, colIndex)
            const showFillHandle = isBottomRightCell(-1, colIndex) && !isEditing
            const widthStyle = {
              width: `${storedWidth}px`,
              minWidth: `${storedWidth}px`,
              maxWidth: `${storedWidth}px`
            }
            const heightStyle = storedHeight ? { height: `${storedHeight}px`, minHeight: `${storedHeight}px` } : {}

            const userResizedClass = editorState.columnWidths[colIndex] && editorState.columnWidths[colIndex] !== 150 ? 'user-resized' : ''

            return (
              <td
                key={colIndex}
                id={cellId}
                data-row={-1}
                data-col={colIndex}
                className={`data-cell ${cellClass} ${userResizedClass} ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''} ${isInFillRange ? 'fill-range' : ''}`}
                style={{
                  ...widthStyle,
                  ...heightStyle,
                  ...(isEditing
                    ? {
                        minHeight: (savedHeightsRef.current.get(`-1-${colIndex}`)?.rowMax || storedHeight || 32) + 'px'
                      }
                    : {})
                }}
                onMouseDown={(e) => handleCellMouseDown(-1, colIndex, e)}
                onDoubleClick={() => startCellEdit(-1, colIndex)}
                title={`Cell ${getColumnLetter(colIndex)}0`}
              >
                {isEditing ? (
                  <CellEditor
                    value={processCellContentForEditing(header)}
                    onCommit={(value, move) => commitCellEdit(-1, colIndex, value, move)}
                    onCancel={() => cancelCellEdit(-1, colIndex)}
                    rowIndex={-1}
                    colIndex={colIndex}
                    originalHeight={savedHeightsRef.current.get(`-1-${colIndex}`)?.original}
                    rowMaxHeight={savedHeightsRef.current.get(`-1-${colIndex}`)?.rowMax}
                  />
                ) : (
                  <>
                    <div className="cell-content">
                      {header && header.trim() !== '' ? (
                        <span dangerouslySetInnerHTML={{ __html: processCellContent(header) }} />
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
      )}

      {rows.map((row, rowIndex) => {
        const rowHeaderValue = headerConfig?.hasRowHeaders ? (row[0] || '') : ''
        // hasColumnHeaders が false の場合、表示行番号を +1 する
        const displayRowNumber = headerConfig?.hasColumnHeaders === false ? rowIndex + 1 : rowIndex + 1
        const storedHeight = editorState.rowHeights[rowIndex]
        const cellHeightStyle = storedHeight ? { height: `${storedHeight}px`, minHeight: `${storedHeight}px` } : {}
        return (
        <tr key={rowIndex} data-row={rowIndex}>
          <td
            className={`row-number ${selectedRows?.has(rowIndex) ? 'highlighted' : ''} ${headerConfig?.hasRowHeaders ? 'row-header-with-value' : ''}`}
            style={cellHeightStyle}
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
            <div
              className="resize-handle-row"
              onMouseDown={(e) => handleRowResizeStart(e, rowIndex)}
            />
          </td>

          {row.map((cell, colIndex) => {
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
            const isInFillRange = isCellInFillRange(rowIndex, colIndex)
            const showFillHandle = isBottomRightCell(rowIndex, colIndex) && !isEditing
            const widthStyle = {
              width: `${storedWidth}px`,
              minWidth: `${storedWidth}px`,
              maxWidth: `${storedWidth}px`
            }

            const userResizedClass = editorState.columnWidths[colIndex] && editorState.columnWidths[colIndex] !== 150 ? 'user-resized' : ''

            return (
              <td
                key={colIndex}
                id={cellId}
                className={`data-cell ${cellClass} ${userResizedClass} ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''} ${isInFillRange ? 'fill-range' : ''}`}
                onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                onDoubleClick={() => startCellEdit(rowIndex, colIndex)}
                data-row={rowIndex}
                data-col={colIndex}
                style={{
                  ...widthStyle,
                  ...cellHeightStyle,
                  ...(isEditing
                    ? {
                        // startCellEdit で事前に style.minHeight を同期済みだが、
                        // SSR/JSDOM 環境や初回描画でも確実に適用されるよう二重化
                        minHeight: (savedHeightsRef.current.get(`${rowIndex}-${colIndex}`)?.rowMax || storedHeight || 32) + 'px'
                      }
                    : {})
                }}
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