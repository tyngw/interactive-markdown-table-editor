import { CellPosition } from '../types'

const CELL_SELECTOR = (position: CellPosition) => `td[data-row="${position.row}"][data-col="${position.col}"]`

export function queryCellElement(position?: CellPosition | null): HTMLElement | null {
  if (!position) {
    return null
  }
  return document.querySelector(CELL_SELECTOR(position)) as HTMLElement | null
}

export function markCellAsTemporarilyEmpty(position: CellPosition): boolean {
  const cellElement = queryCellElement(position)
  if (!cellElement) {
    return false
  }
  cellElement.dataset.tempEmpty = 'true'
  return true
}

export function clearCellTemporaryMarker(position: CellPosition): void {
  const cellElement = queryCellElement(position)
  if (!cellElement) {
    return
  }
  delete cellElement.dataset.tempEmpty
}

function cleanupRowVisualState(rowElement: HTMLElement | null): void {
  // cleanupCellVisualArtifacts経由で呼ばれるため、セルがDOMにある限りnullにならない防御的チェック
  /* istanbul ignore if */
  if (!rowElement) {
    return
  }
  // スペーサーDIVを削除（もう使用していないが、過去のものが残っている可能性があるため）
  rowElement.querySelectorAll('.height-spacer').forEach((el) => {
    const parent = el.parentElement
    if (parent) {
      parent.removeChild(el)
    }
  })

  // 編集終了後は行の高さをリセット（通常の自動高さに戻す）
  rowElement.querySelectorAll('td[data-col]').forEach((td) => {
    if (td instanceof HTMLElement) {
      td.style.minHeight = ''
    }
  })
}

export function cleanupCellVisualArtifacts(position: CellPosition): void {
  const cellElement = queryCellElement(position)
  if (!cellElement) {
    return
  }

  delete cellElement.dataset.tempEmpty
  delete cellElement.dataset.originalHeight
  delete cellElement.dataset.rowMaxHeight
  delete cellElement.dataset.maxOtherHeight
  cellElement.style.minHeight = ''

  cleanupRowVisualState(cellElement.parentElement as HTMLElement | null)
}
