/**
 * どこで: VS Code拡張（エクスポート前の整形）
 * 何を: Shift_JIS へエンコードする際の近似変換（波ダッシュなど）
 * なぜ: エクスポート時に文字化け・欠落を防止し、必要時はユーザーに確認を促すため
 */

// jaconv を使用して正規化を行う（要: 依存導入済み）
// 型定義は同梱されていない場合があるため any とする
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jaconv: any = require('jaconv')

export interface ReplacementInfo {
  index: number
  from: string
  to: string
}

export function normalizeForShiftJisExport(content: string): { normalized: string; replacements: ReplacementInfo[] } {
  // jaconv で NFKC 正規化。第二引数をとる実装が一般的だが念のため可変に対応
  const normalized: string = typeof jaconv.normalize === 'function'
    ? (jaconv.normalize.length >= 2 ? jaconv.normalize(content, 'NFKC') : jaconv.normalize(content))
    : content

  // 置換箇所を検出（正規化で変わった位置を列挙）
  const replacements: ReplacementInfo[] = []
  const max = Math.max(content.length, normalized.length)
  for (let i = 0; i < max; i++) {
    const from = content[i] ?? ''
    const to = normalized[i] ?? ''
    if (from !== to) {
      replacements.push({ index: i, from, to })
    }
  }

  return { normalized, replacements }
}

export function normalizeForImport(content: string): { normalized: string; replacements: ReplacementInfo[] } {
  // インポート時も同様に NFKC 正規化を適用し、差分を返す
  const normalized: string = typeof jaconv.normalize === 'function'
    ? (jaconv.normalize.length >= 2 ? jaconv.normalize(content, 'NFKC') : jaconv.normalize(content))
    : content

  const replacements: ReplacementInfo[] = []
  const max = Math.max(content.length, normalized.length)
  for (let i = 0; i < max; i++) {
    const from = content[i] ?? ''
    const to = normalized[i] ?? ''
    if (from !== to) {
      replacements.push({ index: i, from, to })
    }
  }
  return { normalized, replacements }
}
