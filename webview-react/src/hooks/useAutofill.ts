import { useState, useCallback, useRef, useEffect } from 'react'
import { CellPosition, SelectionRange } from '../types'
import { detectPattern, generateNextValue } from '../utils/autofillPatterns'

interface UseAutofillProps {
    selectionRange: SelectionRange | null
    onUpdateCells: (updates: Array<{ row: number; col: number; value: string }>) => void
    getCellValue: (row: number, col: number) => string
    onFillComplete?: (fillRange: SelectionRange) => void
}

export function useAutofill({ selectionRange, onUpdateCells, getCellValue, onFillComplete }: UseAutofillProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [fillRange, setFillRange] = useState<SelectionRange | null>(null)
    const dragStartRef = useRef<CellPosition | null>(null)

    // ドラッグ開始
    const handleFillHandleMouseDown = useCallback((event: React.MouseEvent) => {
        if (!selectionRange) return

        event.preventDefault()
        event.stopPropagation()

        setIsDragging(true)
        dragStartRef.current = selectionRange.end
        setFillRange(selectionRange)
    }, [selectionRange])

    // ドラッグ中
    const handleMouseMove = useCallback((event: MouseEvent) => {
        /* istanbul ignore if -- ドラッグ開始前のmousemoveに対する防御的ガード */
        if (!isDragging || !selectionRange || !dragStartRef.current) return

        // マウス位置からセルを特定
        const target = document.elementFromPoint(event.clientX, event.clientY)
        if (!target) return

        const cell = target.closest('[data-row][data-col]') as HTMLElement
        if (!cell) return

        let row = parseInt(cell.dataset.row || '0', 10)
        let col = parseInt(cell.dataset.col || '0', 10)

        // 方向判定と制限
        // 開始位置（ソース選択範囲の終了セル）からの移動量を計算
        const startRow = dragStartRef.current.row
        const startCol = dragStartRef.current.col

        const rowDiff = Math.abs(row - startRow)
        const colDiff = Math.abs(col - startCol)

        // 移動量が大きい方向を優先し、他方は固定する
        if (colDiff > rowDiff) {
            // 横方向移動が主：行を選択範囲の行範囲に制限
            // ただし、selectionRange全体の行範囲を考慮する必要がある
            // ここではシンプルに「ドラッグ開始セル」の行に固定するのではなく、
            // 「ドラッグ開始時の範囲」の行範囲に収めるべき。
            // しかし、Spreadsheetの挙動としては、ソースが複数行の場合、横に引っ張ると
            // その複数行セットで横に増える。
            // 実装簡略化のため、fillRangeのendを操作することで制御する。

            // 縦方向の動きをキャンセルして、元のselectionRangeの境界に合わせる
            // fillRange.endが動くので、endのrowをstartのrowに戻せばよい？
            // selectionRange.end.row を使う
            row = startRow
        } else {
            // 縦方向移動が主：列を固定
            col = startCol
        }

        // 選択範囲の方向を判定して fillRange を更新
        const newFillRange: SelectionRange = {
            start: selectionRange.start,
            end: { row, col }
        }

        setFillRange(newFillRange)
    }, [isDragging, selectionRange])

    // ドラッグ終了
    const handleMouseUp = useCallback(() => {
        if (!isDragging || !selectionRange || !fillRange) {
            setIsDragging(false)
            setFillRange(null)
            return
        }

        // オートフィルを実行
        performAutofill(selectionRange, fillRange)

        // 完了コールバック
        if (onFillComplete) {
            onFillComplete(fillRange)
        }

        setIsDragging(false)
        setFillRange(null)
        dragStartRef.current = null
    }, [isDragging, selectionRange, fillRange, onFillComplete])

    // オートフィル実行
    const performAutofill = useCallback((source: SelectionRange, target: SelectionRange) => {
        const updates: Array<{ row: number; col: number; value: string }> = []

        const sourceStartRow = Math.min(source.start.row, source.end.row)
        const sourceEndRow = Math.max(source.start.row, source.end.row)
        const sourceStartCol = Math.min(source.start.col, source.end.col)
        const sourceEndCol = Math.max(source.start.col, source.end.col)

        const targetStartRow = Math.min(target.start.row, target.end.row)
        const targetEndRow = Math.max(target.start.row, target.end.row)
        const targetStartCol = Math.min(target.start.col, target.end.col)
        const targetEndCol = Math.max(target.start.col, target.end.col)

        // 縦方向のフィル
        if (sourceStartCol === targetStartCol && sourceEndCol === targetEndCol) {
            for (let col = sourceStartCol; col <= sourceEndCol; col++) {
                // 列ごとにパターンを検出
                const sourceValues: string[] = []
                for (let row = sourceStartRow; row <= sourceEndRow; row++) {
                    sourceValues.push(getCellValue(row, col))
                }

                const pattern = detectPattern(sourceValues)

                // 下方向へのフィル
                if (targetEndRow > sourceEndRow) {
                    for (let row = sourceEndRow + 1; row <= targetEndRow; row++) {
                        const step = row - sourceEndRow
                        const sourceIndex = (step - 1) % sourceValues.length
                        const value = generateNextValue(pattern, sourceValues[sourceIndex], step)
                        updates.push({ row, col, value })
                    }
                }
                // 上方向へのフィル
                else if (targetStartRow < sourceStartRow) {
                    for (let row = targetStartRow; row < sourceStartRow; row++) {
                        const step = sourceStartRow - row
                        const sourceIndex = (step - 1) % sourceValues.length
                        const value = generateNextValue(pattern, sourceValues[sourceIndex], -step)
                        updates.push({ row, col, value })
                    }
                }
            }
        }
        // 横方向のフィル
        else if (sourceStartRow === targetStartRow && sourceEndRow === targetEndRow) {
            for (let row = sourceStartRow; row <= sourceEndRow; row++) {
                // 行ごとにパターンを検出
                const sourceValues: string[] = []
                for (let col = sourceStartCol; col <= sourceEndCol; col++) {
                    sourceValues.push(getCellValue(row, col))
                }

                const pattern = detectPattern(sourceValues)

                // 右方向へのフィル
                if (targetEndCol > sourceEndCol) {
                    for (let col = sourceEndCol + 1; col <= targetEndCol; col++) {
                        const step = col - sourceEndCol
                        const sourceIndex = (step - 1) % sourceValues.length
                        const value = generateNextValue(pattern, sourceValues[sourceIndex], step)
                        updates.push({ row, col, value })
                    }
                }
                // 左方向へのフィル
                else if (targetStartCol < sourceStartCol) {
                    for (let col = targetStartCol; col < sourceStartCol; col++) {
                        const step = sourceStartCol - col
                        const sourceIndex = (step - 1) % sourceValues.length
                        const value = generateNextValue(pattern, sourceValues[sourceIndex], -step)
                        updates.push({ row, col, value })
                    }
                }
            }
        }

        if (updates.length > 0) {
            onUpdateCells(updates)
        }
    }, [getCellValue, onUpdateCells])

    // グローバルイベントリスナーの登録
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)

            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    return {
        isDragging,
        fillRange,
        handleFillHandleMouseDown
    }
}
