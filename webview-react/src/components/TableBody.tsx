import { useCallback, useEffect, useRef, useMemo } from 'react'
import { EditorState, CellPosition, HeaderConfig, RowGitDiff, GitDiffStatus, ColumnDiffInfo } from '../types'
import { processCellContentForStorage, convertBrTagsToNewlines } from '../utils/contentConverter'
import { cleanupCellVisualArtifacts, queryCellElement } from '../utils/cellDomUtils'
import MemoizedCell from './MemoizedCell'

/**
 * マークダウンテーブル行をセルに分割
 * 例: "| a | b |" -> ["a", "b"]
 */
function parseTableRowCells(rowContent: string): string[] {
    /* istanbul ignore next -- 呼び出し元で空/undefined チェック済みのため到達しない防御的ガード */
    if (!rowContent) return []
    // 先頭と末尾の | を削除し、| で分割してトリムする
    return rowContent
        .replace(/^\s*\|\s*/, '')
        .replace(/\s*\|\s*$/, '')
        .split('|')
        .map(cell => cell.trim())
}

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
  onDragStart?: (row: number, col: number) => void
  onDragEnter?: (row: number, col: number) => void
  getDragProps?: (type: 'row' | 'column', index: number, selectedIndices?: number[]) => any
  getDropProps?: (type: 'row' | 'column', index: number) => any
  selectedRows?: Set<number>
  fullySelectedRows?: Set<number>
  fillRange?: { start: CellPosition; end: CellPosition } | null
  onFillHandleMouseDown?: (event: React.MouseEvent) => void
  headerConfig?: HeaderConfig
  isSearchResult?: (row: number, col: number) => boolean
  isCurrentSearchResult?: (row: number, col: number) => boolean
  gitDiff?: RowGitDiff[]  // Git差分情報
  columnDiff?: ColumnDiffInfo  // 列の差分情報
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
  onDragStart,
  onDragEnter,
  getDragProps,
  getDropProps,
  selectedRows,
  fullySelectedRows,
  fillRange,
  onFillHandleMouseDown,
  headerConfig,
  isSearchResult,
  isCurrentSearchResult,
  gitDiff,
  columnDiff
}) => {
  const savedHeightsRef = useRef<Map<string, { original: number; rowMax: number }>>(new Map())
  void onHeaderUpdate

  const handleCellMouseDown = useCallback((row: number, col: number, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).classList.contains('cell-input')) {
      return
    }
    const extend = event.shiftKey
    const toggle = event.ctrlKey || event.metaKey

    if (extend || toggle) {
      onCellSelect(row, col, extend, toggle)
    } else {
      if (onDragStart) {
        onDragStart(row, col)
      } else {
        onCellSelect(row, col, false, false)
      }
    }
  }, [onCellSelect, onDragStart])

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (onDragEnter) {
      onDragEnter(row, col)
    }
  }, [onDragEnter])

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
    /* istanbul ignore next -- Map.delete は例外を投げないため到達不能 */
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
            /* istanbul ignore next -- dataset.col は DOM テンプレートで常に設定されるためフォールバック不到達 */
            const cellCol = parseInt(cellElement.dataset.col || '0', 10)
            // 高さ測定の信頼性を高める（offsetHeight が 0 になる環境があるため）
            let cellHeight = cellElement.offsetHeight
            /* istanbul ignore next -- jsdom では offsetHeight=0 のためフォールバック分岐のテスト不可 */
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
        /* istanbul ignore next -- jsdom では DOM 高さが常に 0 のためフォールバック検証不可 */
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
          cellContent: /* istanbul ignore next -- ログ出力内の防御的フォールバック */ (rows[row]?.[col] || '')
        })

        // 編集モード突入前に、行内のセルへ min-height を同期（初期ちらつき防止）
        /* istanbul ignore next -- jsdom では DOM スタイル操作の検証が限定的 */
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
        /* istanbul ignore next -- Map.set は例外を投げないため到達不能 */
        try {
          savedHeightsRef.current.set(`${row}-${col}`, {
            original: measuredHeights.original,
            rowMax: measuredHeights.maxInRow
          })
        } catch (_) { /* noop */ }
      }
    } catch (_outerError) { // istanbul ignore next line
      /* istanbul ignore next */
      console.error('Error measuring cell heights:', _outerError)
      /* istanbul ignore next */
      measuredHeights.original = 32
      /* istanbul ignore next */
      measuredHeights.maxInRow = 32
    }

    // 編集モードに移行
    onCellEdit({ row, col })

    // DOM更新後にデータを保存
    /* istanbul ignore next -- requestAnimationFrame コールバックは jsdom では非同期実行されない */
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

    /* istanbul ignore next -- measureAndNotifyはrequestAnimationFrame内でのみ呼ばれるためjsdomでは到達不能 */
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
              /* istanbul ignore next -- jsdom では offsetHeight=0 のためフォールバック分岐のテスト不可 */
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
        /* istanbul ignore next -- DOM 操作全体が失敗するケースは実行環境依存 */
        // フォールバック既定値
        measured.original = measured.original || 32
        measured.rowMax = measured.rowMax || 32
      }

      // 保存 & dataset へ反映（既存より小さい値で上書きしない）
      savedHeightsRef.current.set(key, { original: measured.original, rowMax: measured.rowMax })
      /* istanbul ignore next -- DOM 要素への dataset 反映は jsdom では検証困難 */
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
    /* istanbul ignore next -- requestAnimationFrame コールバックは jsdom では非同期実行されない */
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

      // 削除行のマップを作成（row番号 -> 削除行の配列）
      const deletedRowsMap = useMemo(() => {
        const map = new Map<number, Array<{ diff: RowGitDiff; index: number }>>()
        if (!gitDiff || !Array.isArray(gitDiff)) {
          return map
        }
        
        gitDiff.forEach((d, index) => {
          if (d && d.status === GitDiffStatus.DELETED && d.isDeletedRow) {
            const existing = map.get(d.row) || []
            existing.push({ diff: d, index })
            map.set(d.row, existing)
          }
        })
        
        return map
      }, [gitDiff])
    
      return (
        <tbody>
          {allRows.flatMap(({ rowIndex, cells }) => {
            const renderedRows = []
            
            const rowHeaderValue = headerConfig?.hasRowHeaders ? (cells[0] || '') : ''
            // 表示行番号を計算（row=-1の場合は0、それ以外は1始まり）
            const displayRowNumber = rowIndex === -1 ? 0 : rowIndex + 1
            const isRowSelected = selectedRows?.has(rowIndex)
            const isRowFullySelected = fullySelectedRows?.has(rowIndex)
            // 交互網掛け用のフラグ。Git差分の削除行はカウントに含めない。
            const isStripedRow = rowIndex >= 0 && (rowIndex % 2 === 1)

            // この行に対応する削除行を直前に表示
            const deletedRowsForThisRow = deletedRowsMap.get(rowIndex)
            if (deletedRowsForThisRow && deletedRowsForThisRow.length > 0) {
              deletedRowsForThisRow.forEach(({ diff, index }) => {
                const deletedCells = diff.oldContent ? parseTableRowCells(diff.oldContent) : []
                // 現在の列数（追加された列を含む）
                const currentColumnCount = headers.length
                
                // 対応する追加行のセルを取得（内容比較用）
                const addedCells = rowIndex >= 0 ? cells : []
                
                // positions/mapping ベースで表示セル配列を構築
                const displayCells: Array<JSX.Element | null> = []
                
                // mapping が利用可能な場合はそれを使用
                if (columnDiff && columnDiff.mapping && columnDiff.mapping.length > 0) {
                  // 旧テーブルの各列について処理
                  for (let oldColIdx = 0; oldColIdx < columnDiff.mapping.length; oldColIdx++) {
                    const newColIdx = columnDiff.mapping[oldColIdx]
                    const cellContent = deletedCells[oldColIdx] || ''
                    
                    if (headerConfig?.hasRowHeaders && oldColIdx === 0) {
                      continue
                    }
                    
                    if (newColIdx === -1) {
                      // この列は削除された → 通常セルとして表示（ハッチングなし）
                      const cellLines = convertBrTagsToNewlines(cellContent).split('\n')
                      displayCells.push(
                        <td key={`deleted-cell-${diff.row}-${index}-${oldColIdx}`} className="git-diff-deleted-cell">
                          <span className="git-diff-deleted-content">
                            {cellLines.map((line, lineIndex) => (
                              <div key={lineIndex}>{line}</div>
                            ))}
                          </span>
                        </td>
                      )
                    } else {
                      // この列は残存 → 内容比較してスタイル決定
                      const addedCellContent = addedCells[newColIdx] || ''
                      const isSameContent = cellContent.trim() === addedCellContent.trim()
                      const cellClassName = ['git-diff-deleted-cell', isSameContent ? 'git-diff-same-content' : ''].filter(Boolean).join(' ')
                      const cellLines = convertBrTagsToNewlines(cellContent).split('\n')
                      
                      displayCells.push(
                        <td key={`deleted-cell-${diff.row}-${index}-${oldColIdx}`} className={cellClassName}>
                          <span className="git-diff-deleted-content">
                            {cellLines.map((line, lineIndex) => (
                              <div key={lineIndex}>{line}</div>
                            ))}
                          </span>
                        </td>
                      )
                    }
                  }
                  
                  // positions を使って追加列のプレースホルダを適切な位置に挿入
                  if (columnDiff.positions && columnDiff.positions.length > 0) {
                    const addedPositions = columnDiff.positions.filter(p => p.type === 'added')
                    addedPositions.forEach(pos => {
                      const insertIdx = pos.newIndex ?? pos.index
                      const addedColWidth = editorState.columnWidths[insertIdx] || 150
                      const placeholder = (
                        <td 
                          key={`deleted-hatched-${diff.row}-${index}-${insertIdx}`} 
                          className="git-diff-deleted-cell git-diff-column-not-exist"
                          data-is-placeholder={true}
                          data-placeholder-reason="added-column"
                          style={{ width: `${addedColWidth}px`, minWidth: `${addedColWidth}px`, maxWidth: `${addedColWidth}px` }}
                        >
                          <span className="git-diff-deleted-content"></span>
                        </td>
                      )
                      // 正しい位置に挿入
                      displayCells.splice(insertIdx, 0, placeholder)
                    })
                  }
                } else {
                  // mapping がない場合は従来のロジック（フォールバック）
                  deletedCells.forEach((cellContent, cellIndex) => {
                    if (headerConfig?.hasRowHeaders && cellIndex === 0) {
                      return
                    }
                    
                    const addedCellContent = addedCells[cellIndex] || ''
                    const isSameContent = cellContent.trim() === addedCellContent.trim()
                    const cellClassName = ['git-diff-deleted-cell', isSameContent ? 'git-diff-same-content' : ''].filter(Boolean).join(' ')
                    const cellLines = convertBrTagsToNewlines(cellContent).split('\n')
                    
                    displayCells.push(
                      <td key={`deleted-cell-${diff.row}-${index}-${cellIndex}`} className={cellClassName}>
                        <span className="git-diff-deleted-content">
                          {cellLines.map((line, lineIndex) => (
                            <div key={lineIndex}>{line}</div>
                          ))}
                        </span>
                      </td>
                    )
                  })
                  
                  // 末尾パディング（フォールバック）
                  if (currentColumnCount > deletedCells.length) {
                    Array.from({ length: currentColumnCount - deletedCells.length }).forEach((_, i) => {
                      const addedColIndex = deletedCells.length + i
                      const addedColWidth = editorState.columnWidths[addedColIndex] || 150
                      displayCells.push(
                        <td 
                          key={`deleted-hatched-${diff.row}-${index}-${addedColIndex}`} 
                          className="git-diff-deleted-cell git-diff-column-not-exist"
                          style={{ width: `${addedColWidth}px`, minWidth: `${addedColWidth}px`, maxWidth: `${addedColWidth}px` }}
                        >
                          <span className="git-diff-deleted-content"></span>
                        </td>
                      )
                    })
                  }
                }
                
                const deletedRowIndicator = (
                  <tr
                    key={`deleted-${diff.row}-${index}`}
                    className={isStripedRow ? 'git-diff-deleted-row striped-row' : 'git-diff-deleted-row'}
                    style={{ backgroundColor: 'color-mix(in srgb,var(--vscode-gitDecoration-deletedResourceForeground, #c74e39) 12%,var(--vscode-editor-background, #1e1e1e))' }}
                  >
                    <td className="row-number git-diff-deleted">
                      <span className="git-diff-icon git-diff-deleted">-</span>
                    </td>
                    {displayCells}
                  </tr>
                )
                renderedRows.push(deletedRowIndicator)
              })
            }
    
            let gitDiffIcon: React.ReactNode = null
            let gitDiffStatus: GitDiffStatus | undefined = undefined
    
            if (rowIndex >= 0 && gitDiff && Array.isArray(gitDiff)) {
              // この行に関連する追加行の差分情報を取得
              const rowGitDiff = gitDiff.find(d => d && typeof d === 'object' && d.row === rowIndex && !d.isDeletedRow)
              gitDiffStatus = rowGitDiff?.status
              if (rowIndex === 0) {
                console.log('[TableBody] rowIndex:', rowIndex, 'rowGitDiff:', rowGitDiff, 'gitDiffStatus:', gitDiffStatus, 'columnDiff:', columnDiff)
              }
              if (gitDiffStatus && gitDiffStatus !== GitDiffStatus.UNCHANGED) {
                switch (gitDiffStatus) {
                  case GitDiffStatus.ADDED:
                    gitDiffIcon = <span className="git-diff-icon git-diff-added">+</span>
                    break
                  case GitDiffStatus.DELETED:
                    gitDiffIcon = <span className="git-diff-icon git-diff-deleted">-</span>
                    break
                }
              }
            }
    
            const rowNumberClassName = [
              'row-number',
              isRowFullySelected ? 'selected' : (isRowSelected ? 'highlighted' : ''),
              headerConfig?.hasRowHeaders ? 'row-header-with-value' : '',
              gitDiffStatus ? `git-diff-${gitDiffStatus}` : ''
            ].filter(Boolean).join(' ')
            
            const currentRow = (
              <tr key={rowIndex} data-row={rowIndex} className={isStripedRow ? 'striped-row' : undefined}>
                <td
                  className={rowNumberClassName}
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
                  {...(getDragProps ? getDragProps('row', rowIndex, selectedRows ? Array.from(selectedRows) : undefined) : {})}
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
                  {gitDiffIcon}
                </td>
    
                {(() => {
                  const hasColumnChanges = columnDiff && (
                    (columnDiff.deletedColumns && columnDiff.deletedColumns.length > 0) ||
                    (columnDiff.positions && columnDiff.positions.some(p => p.type === 'added'))
                  )
                  const shouldUseDeletedBeforeColumns = (gitDiffStatus === GitDiffStatus.ADDED || rowIndex === -1) && hasColumnChanges
                  if (rowIndex === -1) {
                    console.log('[TableBody] ヘッダ行チェック:', { rowIndex, gitDiffStatus, columnDiff: columnDiff ? { deletedColumns: columnDiff.deletedColumns, oldColumnCount: columnDiff.oldColumnCount, positions: columnDiff.positions } : null, shouldUseDeletedBeforeColumns })
                  }
                  return shouldUseDeletedBeforeColumns
                })() && columnDiff ? (
                  // positions/mapping ベースで表示セル配列を構築（追加行またはヘッダ行）
                  (() => {
                    const displayCells: Array<JSX.Element | null> = []
                    
                    // mapping が利用可能な場合
                    if (columnDiff.mapping && columnDiff.mapping.length > 0) {
                      // 旧テーブルの各列について処理
                      for (let oldColIdx = 0; oldColIdx < columnDiff.mapping.length; oldColIdx++) {
                        if (headerConfig?.hasRowHeaders && oldColIdx === 0) {
                          continue
                        }
                        
                        const newColIdx = columnDiff.mapping[oldColIdx]
                        
                        if (newColIdx === -1) {
                          // この列は削除された
                          if (rowIndex === -1) {
                            // ヘッダ行：削除列のヘッダ名を旧テーブルから表示
                            const headerContent = columnDiff.oldHeaders?.[oldColIdx] || ''
                            displayCells.push(
                              <td 
                                key={`header-deleted-${oldColIdx}`}
                                className="column-header git-diff-column-not-exist"
                                data-is-placeholder={true}
                                data-placeholder-reason="deleted-column"
                                title="この列は削除されました"
                                style={{ 
                                  width: `${editorState.columnWidths[oldColIdx] || 150}px`,
                                  minWidth: `${editorState.columnWidths[oldColIdx] || 150}px`,
                                  maxWidth: `${editorState.columnWidths[oldColIdx] || 150}px`
                                }}
                              >
                                <div className="column-header-content">{headerContent}</div>
                              </td>
                            )
                          } else {
                            // データ行：ハッチングプレースホルダを表示
                            const positionInfo = columnDiff.positions?.find(
                              p => p.type === 'removed' && p.index === oldColIdx
                            )
                            const confidence = positionInfo?.confidence ?? 0.5
                            const placeholderTitle = confidence >= 0.85 
                              ? 'この列は削除されました'
                              : 'この列は削除されました（推定）'
                            
                            displayCells.push(
                              <td 
                                key={`added-hatched-deleted-${rowIndex}-${oldColIdx}`}
                                className="git-diff-column-not-exist"
                                data-is-placeholder={true}
                                data-placeholder-reason="deleted-column"
                                title={placeholderTitle}
                                style={{ 
                                  width: `${editorState.columnWidths[oldColIdx] || 150}px`,
                                  minWidth: `${editorState.columnWidths[oldColIdx] || 150}px`,
                                  maxWidth: `${editorState.columnWidths[oldColIdx] || 150}px`
                                }}
                              />
                            )
                          }
                        } else {
                          // この列は残存 → 実際のセルを表示
                          let cellContent = ''
                          if (rowIndex === -1) {
                            // ヘッダ行：残存列のヘッダ名を新しいテーブルから取得
                            cellContent = headers[newColIdx] || ''
                          } else {
                            // データ行：セル内容を取得
                            cellContent = cells[newColIdx] || ''
                          }
                          
                          const storedWidth = editorState.columnWidths[newColIdx] || 150
                          
                          // ヘッダ行の場合
                          if (rowIndex === -1) {
                            displayCells.push(
                              <td
                                key={newColIdx}
                                data-col={newColIdx}
                                className="column-header"
                                style={{
                                  width: `${storedWidth}px`,
                                  minWidth: `${storedWidth}px`,
                                  maxWidth: `${storedWidth}px`
                                }}
                              >
                                <div className="column-header-content">{cellContent}</div>
                              </td>
                            )
                          } else {
                            // 通常行の場合
                            const isEditing = isCellEditing(rowIndex, newColIdx)
                            const isSelected = isCellSelected(rowIndex, newColIdx)
                            const isAnchor = isAnchorCell(rowIndex, newColIdx)
                            const borders = getSelectionBorders(rowIndex, newColIdx)
                            const isInFillRange = isCellInFillRange(rowIndex, newColIdx)
                            /* istanbul ignore next -- isEditing=true 時は fillHandle 不要で到達困難 */
                            const showFillHandle = isBottomRightCell(rowIndex, newColIdx) && !isEditing
                            const isSResult = isSearchResult ? isSearchResult(rowIndex, newColIdx) : false
                            const isCSResult = isCurrentSearchResult ? isCurrentSearchResult(rowIndex, newColIdx) : false
                            const userResized = !!(editorState.columnWidths[newColIdx] && editorState.columnWidths[newColIdx] !== 150)
                            const isSingleSelection = isSingleCellSelection()
                            const savedHeight = savedHeightsRef.current.get(`${rowIndex}-${newColIdx}`)
                            
                            displayCells.push(
                              <MemoizedCell
                                key={newColIdx}
                                rowIndex={rowIndex}
                                colIndex={newColIdx}
                                cell={cellContent}
                                isSelected={isSelected}
                                isAnchor={isAnchor}
                                isSingleSelection={isSingleSelection}
                                borders={borders}
                                isEditing={isEditing}
                                isInFillRange={isInFillRange}
                                isSearchResult={isSResult}
                                isCurrentSearchResult={isCSResult}
                                showFillHandle={showFillHandle}
                                storedWidth={storedWidth}
                                userResized={userResized}
                                displayRowNumber={displayRowNumber}
                                headerConfig={headerConfig}
                                initialCellInput={isEditing ? initialCellInput : null}
                                savedHeight={savedHeight}
                                onMouseDown={handleCellMouseDown}
                                onMouseEnter={handleCellMouseEnter}
                                onDoubleClick={startCellEdit}
                                onCommitEdit={commitCellEdit}
                                onCancelEdit={cancelCellEdit}
                                onFillHandleMouseDown={onFillHandleMouseDown}
                                isColumnNotExist={false}
                              />
                            )
                          }
                        }
                      }
                      
                      // positions を使って追加列を適切な位置に挿入
                      if (columnDiff.positions && columnDiff.positions.length > 0) {
                        const addedPositions = columnDiff.positions.filter(p => p.type === 'added')
                        addedPositions.forEach(pos => {
                          const insertIdx = pos.newIndex ?? pos.index
                          const addedColWidth = editorState.columnWidths[insertIdx] || 150
                          
                          // ヘッダ行の場合は実際のヘッダ名を表示
                          if (rowIndex === -1) {
                            const headerContent = headers[insertIdx] || ''
                            const headerCell = (
                              <td
                                key={`header-added-${insertIdx}`}
                                data-col={insertIdx}
                                className="column-header"
                                style={{
                                  width: `${addedColWidth}px`,
                                  minWidth: `${addedColWidth}px`,
                                  maxWidth: `${addedColWidth}px`
                                }}
                              >
                                <div className="column-header-content">{headerContent}</div>
                              </td>
                            )
                            // DELETED行と同じロジック：新テーブルのインデックスで挿入
                            displayCells.splice(insertIdx, 0, headerCell)
                          /* istanbul ignore next -- ADDED行でのcolumnDiff追加列パスは統合テストでカバー */
                          /* istanbul ignore else -- shouldUseDeletedBeforeColumns は ADDED || rowIndex===-1 でのみ true のため else は到達不能 */
                          } else if (gitDiffStatus === GitDiffStatus.ADDED) {
                            // ADDED行：追加列は通常セル（編集可能）
                            const cellContent = cells[insertIdx] || ''
                            const isEditing = isCellEditing(rowIndex, insertIdx)
                            const isSelected = isCellSelected(rowIndex, insertIdx)
                            const isAnchor = isAnchorCell(rowIndex, insertIdx)
                            const borders = getSelectionBorders(rowIndex, insertIdx)
                            const isInFillRange = isCellInFillRange(rowIndex, insertIdx)
                            /* istanbul ignore next -- ADDED行でのfillHandle/columnWidths防御的分岐 */
                            const showFillHandle = isBottomRightCell(rowIndex, insertIdx) && !isEditing
                            const isSResult = isSearchResult ? isSearchResult(rowIndex, insertIdx) : false
                            const isCSResult = isCurrentSearchResult ? isCurrentSearchResult(rowIndex, insertIdx) : false
                            /* istanbul ignore next -- ADDED行でのcolumnWidths防御的チェック */
                            const userResized = !!(editorState.columnWidths[insertIdx] && editorState.columnWidths[insertIdx] !== 150)
                            const isSingleSelection = isSingleCellSelection()
                            const savedHeight = savedHeightsRef.current.get(`${rowIndex}-${insertIdx}`)
                            
                            const addedCell = (
                              <MemoizedCell
                                key={`added-cell-${rowIndex}-${insertIdx}`}
                                rowIndex={rowIndex}
                                colIndex={insertIdx}
                                cell={cellContent}
                                isSelected={isSelected}
                                isAnchor={isAnchor}
                                isSingleSelection={isSingleSelection}
                                borders={borders}
                                isEditing={isEditing}
                                isInFillRange={isInFillRange}
                                isSearchResult={isSResult}
                                isCurrentSearchResult={isCSResult}
                                showFillHandle={showFillHandle}
                                storedWidth={addedColWidth}
                                userResized={userResized}
                                displayRowNumber={displayRowNumber}
                                headerConfig={headerConfig}
                                initialCellInput={isEditing ? initialCellInput : null}
                                savedHeight={savedHeight}
                                onMouseDown={handleCellMouseDown}
                                onMouseEnter={handleCellMouseEnter}
                                onDoubleClick={startCellEdit}
                                onCommitEdit={commitCellEdit}
                                onCancelEdit={cancelCellEdit}
                                onFillHandleMouseDown={onFillHandleMouseDown}
                                isColumnNotExist={false}
                              />
                            )
                            displayCells.splice(insertIdx, 0, addedCell)
                          }
                        })
                      }
                      
                      return displayCells
                    } else {
                      // mapping がない場合はフォールバック（従来のロジック）
                      return Array.from({ length: columnDiff.oldColumnCount }).map((_, oldColIdx) => {
                        if (headerConfig?.hasRowHeaders && oldColIdx === 0) {
                          return null
                        }
                        
                        const isDeletedColumn = columnDiff.deletedColumns.includes(oldColIdx)
                        
                        if (isDeletedColumn) {
                          const positionInfo = columnDiff.positions?.find(
                            p => p.type === 'removed' && p.index === oldColIdx
                          )
                          const confidence = positionInfo?.confidence ?? 0.5
                          const placeholderTitle = confidence >= 0.85 
                            ? 'この列は削除されました'
                            : 'この列は削除されました（推定）'
                          
                          return (
                            <td 
                              key={`added-hatched-fb-${rowIndex}-${oldColIdx}`}
                              className="git-diff-column-not-exist"
                              data-is-placeholder={true}
                              data-placeholder-reason="deleted-column"
                              title={placeholderTitle}
                              style={{ 
                                width: `${editorState.columnWidths[oldColIdx] || 150}px`,
                                minWidth: `${editorState.columnWidths[oldColIdx] || 150}px`,
                                maxWidth: `${editorState.columnWidths[oldColIdx] || 150}px`
                              }}
                            />
                          )
                        }
                        
                        const deletedBeforeThisCol = columnDiff.deletedColumns.filter(dc => dc < oldColIdx).length
                        const newColIdx = oldColIdx - deletedBeforeThisCol
                        
                        let cellContent = ''
                        if (rowIndex === -1 && columnDiff.oldHeaders && columnDiff.oldHeaders[oldColIdx]) {
                          cellContent = columnDiff.oldHeaders[oldColIdx]
                        } else {
                          cellContent = cells[newColIdx] || ''
                        }
                        
                        const storedWidth = editorState.columnWidths[newColIdx] || 150
                        
                        if (rowIndex === -1) {
                          return (
                            <td
                              key={newColIdx}
                              data-col={newColIdx}
                              className="column-header"
                              style={{
                                width: `${storedWidth}px`,
                                minWidth: `${storedWidth}px`,
                                maxWidth: `${storedWidth}px`
                              }}
                            >
                              <div className="column-header-content">{cellContent}</div>
                            </td>
                          )
                        }
                        
                        const isEditing = isCellEditing(rowIndex, newColIdx)
                        const isSelected = isCellSelected(rowIndex, newColIdx)
                        const isAnchor = isAnchorCell(rowIndex, newColIdx)
                        const borders = getSelectionBorders(rowIndex, newColIdx)
                        const isInFillRange = isCellInFillRange(rowIndex, newColIdx)
                        /* istanbul ignore next -- isEditing=true 時は fillHandle 不要で到達困難 */
                        const showFillHandle = isBottomRightCell(rowIndex, newColIdx) && !isEditing
                        const isSResult = isSearchResult ? isSearchResult(rowIndex, newColIdx) : false
                        const isCSResult = isCurrentSearchResult ? isCurrentSearchResult(rowIndex, newColIdx) : false
                        const userResized = !!(editorState.columnWidths[newColIdx] && editorState.columnWidths[newColIdx] !== 150)
                        const isSingleSelection = isSingleCellSelection()
                        const savedHeight = savedHeightsRef.current.get(`${rowIndex}-${newColIdx}`)
                        
                        return (
                          <MemoizedCell
                            key={newColIdx}
                            rowIndex={rowIndex}
                            colIndex={newColIdx}
                            cell={cellContent}
                            isSelected={isSelected}
                            isAnchor={isAnchor}
                            isSingleSelection={isSingleSelection}
                            borders={borders}
                            isEditing={isEditing}
                            isInFillRange={isInFillRange}
                            isSearchResult={isSResult}
                            isCurrentSearchResult={isCSResult}
                            showFillHandle={showFillHandle}
                            storedWidth={storedWidth}
                            userResized={userResized}
                            displayRowNumber={displayRowNumber}
                            headerConfig={headerConfig}
                            initialCellInput={isEditing ? initialCellInput : null}
                            savedHeight={savedHeight}
                            onMouseDown={handleCellMouseDown}
                            onMouseEnter={handleCellMouseEnter}
                            onDoubleClick={startCellEdit}
                            onCommitEdit={commitCellEdit}
                            onCancelEdit={cancelCellEdit}
                            onFillHandleMouseDown={onFillHandleMouseDown}
                            isColumnNotExist={false}
                          />
                        )
                      })
                    }
                  })()
                ) : (
                  // 通常行：削除がない場合、既存ロジックでセルをレンダリング
                  cells.map((cell, colIndex) => {
                    // 行ヘッダーONの場合、先頭列をスキップ
                    if (headerConfig?.hasRowHeaders && colIndex === 0) {
                      return null
                    }
                    const storedWidth = editorState.columnWidths[colIndex] || 150
                    const isEditing = isCellEditing(rowIndex, colIndex)
                    const isSelected = isCellSelected(rowIndex, colIndex)
                    const isAnchor = isAnchorCell(rowIndex, colIndex)
                    const borders = getSelectionBorders(rowIndex, colIndex)
                    const isInFillRange = isCellInFillRange(rowIndex, colIndex)
                    const showFillHandle = isBottomRightCell(rowIndex, colIndex) && !isEditing
                    const isSResult = isSearchResult ? isSearchResult(rowIndex, colIndex) : false
                    const isCSResult = isCurrentSearchResult ? isCurrentSearchResult(rowIndex, colIndex) : false
                    const userResized = !!(editorState.columnWidths[colIndex] && editorState.columnWidths[colIndex] !== 150)
                    const isSingleSelection = isSingleCellSelection()
                    const savedHeight = savedHeightsRef.current.get(`${rowIndex}-${colIndex}`)
                    
                    return (
                      <MemoizedCell
                        key={colIndex}
                        rowIndex={rowIndex}
                        colIndex={colIndex}
                        cell={cell}
                        isSelected={isSelected}
                        isAnchor={isAnchor}
                        isSingleSelection={isSingleSelection}
                        borders={borders}
                        isEditing={isEditing}
                        isInFillRange={isInFillRange}
                        isSearchResult={isSResult}
                        isCurrentSearchResult={isCSResult}
                        showFillHandle={showFillHandle}
                        storedWidth={storedWidth}
                        userResized={userResized}
                        displayRowNumber={displayRowNumber}
                        headerConfig={headerConfig}
                        initialCellInput={isEditing ? initialCellInput : null}
                        savedHeight={savedHeight}
                        onMouseDown={handleCellMouseDown}
                        onMouseEnter={handleCellMouseEnter}
                        onDoubleClick={startCellEdit}
                        onCommitEdit={commitCellEdit}
                        onCancelEdit={cancelCellEdit}
                        onFillHandleMouseDown={onFillHandleMouseDown}
                        isColumnNotExist={false}
                      />
                    )
                  })
                )}
              </tr>
            )
            renderedRows.push(currentRow)
            
            return renderedRows
          })}
        </tbody>
      )
    }
    
    export default TableBody
    