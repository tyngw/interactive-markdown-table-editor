# タブ切り替え時の無限ループ問題の修正

## 問題の概要

Markdown Table Editorにおいて、テーブルタブを切り替える際に以下の問題が発生していました：

1. **無限ループ**: `onTableUpdate`コールバックの副作用により、状態更新が連鎖的に発生
2. **React Error #310**: Hooksルール違反による起動失敗
3. **パフォーマンス問題**: 不要な再レンダリングによるUIの不安定化

## 根本原因の分析

### 1. onTableUpdateコールバックの副作用ループ

```typescript
// 問題のあったコード
const onTableUpdate = (updatedData: TableData) => {
  const newTables = [...allTables]
  newTables[currentTableIndex] = updatedData
  setAllTables(newTables) // これが新しいrenderを引き起こす
}
```

- `TableEditor`からの更新 → `setAllTables` → `allTables`変更 → `TableEditor`再レンダー → 更新検知 → 無限ループ

### 2. Hooksルール違反

```typescript
// 問題のあったコード
if (loading) {
  return <div>Loading...</div>
}

// ❌ 条件分岐の後でHooksを使用
const handleTableUpdate = useCallback(...)
```

- React Hooksは条件分岐やループの外側（コンポーネントのトップレベル）で呼び出す必要がある
- 違反によりReact Error #310が発生

## 解決策の実装

### 1. useCallbackによるコールバック安定化

```typescript
// 修正後のコード
const handleTableUpdate = useCallback((updatedData: TableData) => {
  // refから最新の値を取得（依存配列から除外してコールバックを安定化）
  const currentTables = allTablesRef.current
  const currentIdx = currentIndexRef.current
  
  // データが実際に変更されているかチェック（無限ループ防止）
  const currentData = currentTables[currentIdx]
  if (currentData && JSON.stringify(currentData) === JSON.stringify(updatedData)) {
    console.log('[App] Skipping table update - no actual changes')
    return
  }
  
  console.log('[App] Applying table update - changes detected')
  const newTables = [...currentTables]
  newTables[currentIdx] = updatedData
  setAllTables(newTables)
}, []) // 空の依存配列でコールバックを完全に安定化
```

**キーポイント:**
- `useCallback`で関数を安定化
- `useRef`で最新の状態を参照（依存配列の問題を回避）
- データ比較による不要な更新のスキップ

### 2. refを使った最新状態の同期

```typescript
// 最新の状態をrefで追跡
const allTablesRef = useRef<TableData[]>([])
const currentIndexRef = useRef<number>(0)

// 状態変更時にrefを同期
useEffect(() => {
  allTablesRef.current = allTables
}, [allTables])

useEffect(() => {
  currentIndexRef.current = currentTableIndex
}, [currentTableIndex])
```

### 3. Hooksルールの遵守

```typescript
// ✅ 条件分岐の前でHooksを定義
const handleTableUpdate = useCallback(...)

// 条件分岐は後で
if (loading) {
  return <div>Loading...</div>
}
```

## 技術的な詳細

### データフロー最適化

1. **TableEditor** → `onTableUpdate` → **App**
2. **App**: データ比較 → 変更なし = スキップ
3. **App**: 変更あり → `setAllTables` → 再レンダー
4. **TableEditor**: 新しいpropsを受信 → 更新反映

### パフォーマンス改善

- 不要な再レンダリングの削減
- JSON.stringifyによる深い比較（軽量なデータのため許容）
- コールバック関数の安定化による子コンポーネントの最適化

## 検証方法

1. **無限ループテスト**: 
   - テーブルタブの切り替えを連続実行
   - コンソールログで更新回数を確認

2. **React Error確認**:
   - 開発者ツールでReactエラーがないことを確認
   - アプリケーションが正常に起動することを確認

3. **機能テスト**:
   - テーブル編集機能の正常動作
   - データの保存・復元

## 今後の改善点

1. **より効率的なデータ比較**: 
   - 深い比較の代わりにimmutable dataやversioningの活用
   
2. **状態管理の改善**:
   - Redux ToolkitやZustandの導入検討
   
3. **TypeScript型安全性の強化**:
   - より厳密な型定義によるランタイムエラーの防止

## 関連ファイル

- `webview-react/src/App.tsx`: メインの修正箇所
- `webview-react/src/components/TableEditor.tsx`: データフロー最適化
- `webview-react/src/hooks/useTableEditor.ts`: フック関連の調整