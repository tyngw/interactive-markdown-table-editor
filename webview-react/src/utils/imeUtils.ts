/**
 * IME（入力メソッドエディタ）ユーティリティ
 * 日本語などのIME入力確定時のキーイベント処理を提供
 */

/**
 * IME 確定中かどうかを判定
 * @param event - React のキーボードイベント
 * @returns true の場合、IME確定中（Enterキーを入力の一部として処理すべき）
 */
export const isImeComposing = (event: React.KeyboardEvent): boolean => {
  return (event.nativeEvent as any).isComposing === true
}

/**
 * Enter キーが IME 確定によるものかどうかを判定
 * @param event - React のキーボードイベント
 * @returns true の場合、IME確定中（この場合、Enter を処理すべきではない）
 */
export const isImeConfirmingEnter = (event: React.KeyboardEvent): boolean => {
  return event.key === 'Enter' && isImeComposing(event)
}
