// 共通テーブルユーティリティ
// Excel風の列記号生成 (A, B, ..., Z, AA, AB, ...)
export function getColumnLetter(index: number): string {
  let result = ''
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result
    index = Math.floor(index / 26) - 1
  }
  return result
}

// 指定した列のセル内容の最大文字数を取得
export function getColumnMaxContentLength(rows: string[][], colIndex: number): number {
  let maxLength = 0
  for (const row of rows) {
    if (row[colIndex]) {
      maxLength = Math.max(maxLength, row[colIndex].length)
    }
  }
  return maxLength
}
