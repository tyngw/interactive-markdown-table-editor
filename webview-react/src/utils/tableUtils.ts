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
