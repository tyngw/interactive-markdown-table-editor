# Git Diff 同期ロジック

## 概要

拡張機能（Extension）から Webview への Git 差分データ同期の実装仕様とタイミング問題に関するドキュメント。

---

## 現在の実装（要約）

- 現在は「案 A: 差分計算の非同期セパレーション」を採用して実装済みです。
- 拡張側はまず差分を含まない `updateTableData` を即時送信し、バックグラウンドで `getGitDiffForTable()` を実行して差分が得られ次第 `updateGitDiff` を送信します。
- Webview 側は `updateGitDiff` を `onGitDiffData` で受け取り `gitDiffMap` / `columnDiffMap` を個別更新して再レンダリングします。
- この構成により UI の応答性を維持しつつ、git 差分情報を遅延更新する形を取っています（差分が空で到着する初動は想定内で、後続の `updateGitDiff` で補完されます）。



## データフロー

### 1. 初期ロード時（`requestTableData` コマンド）

```
Extension                                  Webview
    |                                        |
    | (1) requestTableData 要求             |
    |<--------------------------------------|
    |                                        |
    | (2) updateTableData 送信               |
    | （差分なし、高速初期表示用）           |
    |------------------------------------>  |
    |                                        | handleTableDataMessage
    |                                        | - allTables に保存
    |                                        | - gitDiffMap に保存（空）
    |                                        | - columnDiffMap に保存（空）
    |                                        |
    | (3) 非同期で差分計算開始              |
    | getGitDiffForTable()                  |
    |                                        |
    | (4) updateGitDiff 送信                |
    | （差分がある時のみ）                  |
    |------------------------------------>  |
    |                                        | onGitDiffData
    |                                        | - gitDiffMap 更新
    |                                        | - columnDiffMap 更新
    |                                        | - UI 再レンダリング
```

**タイミング：** 
- (2) すぐ（< 100ms）
- (4) 100ms ～数秒（git 計算待機）

---

### 2. セル編集時（`updateCell` コマンド）

```
Extension                                  Webview
    |                                        |
    | (1) updateCell 通知受信               |
    |<--------------------------------------|
    |                                        |
    | (2) セルを更新                        |
    | (3) ファイルに保存                    |
    | (4) updateTableData に差分を含めて送信 |
    |------------------------------------>  |
    |                                        | handleTableDataMessage
    |                                        | - allTables 更新
    |                                        | - gitDiffMap に保存
    |                                        | - columnDiffMap に保存
    |                                        | - UI 再レンダリング
```

**問題：** 
- (5) の時点で `gitDiff` が空配列 `[]` であることがある
- 初回・2回目の編集では `gitDiffLength: 0`
- 3回目以降で `gitDiffLength: 6` になる

---

### 3. ファイル変更監視時（`onDidChangeTextDocument` イベント）

```
Extension                                  Webview
    |                                        |
    | (1) ファイル変更検知                  |
    | (2) 差分を再計算してから              |
    | (3) updateTableData 送信              |
    |------------------------------------>  |
    |                                        | handleTableDataMessage
    |                                        | - UI 更新
```

---

## Webview 側の State 管理

### State 定義

```typescript
// App.tsx
const [gitDiffMap, setGitDiffMap] = useState<Map<number, any[]>>(new Map())
const [columnDiffMap, setColumnDiffMap] = useState<Map<number, any>>(new Map())
```

### currentTableData 合成ロジック

```typescript
const currentTableData = useMemo(() => {
  const baseTable = allTables[currentTableIndex] || null
  if (!baseTable) return null
  
  let result = { ...baseTable }
  
  // baseTable に含まれていない差分を map から取得
  if (!result.gitDiff) {
    const gitDiff = gitDiffMap.get(currentTableIndex)
    if (gitDiff) result.gitDiff = gitDiff
  }
  
  if (!result.columnDiff) {
    const columnDiff = columnDiffMap.get(currentTableIndex)
    if (columnDiff) result.columnDiff = columnDiff
  }
  
  return result
}, [allTables, currentTableIndex, gitDiffMap, columnDiffMap])
```

### 通知ハンドラー

#### `updateTableData` 受信時

```typescript
const handleTableDataMessage = useCallback((data: TableData | TableData[]) => {
  setAllTables(data)  // テーブルデータ更新
  
  // 受信した gitDiff/columnDiff を map に保存
  setGitDiffMap(prev => {
    const next = new Map(prev)
    if (Array.isArray(data)) {
      data.forEach((tbl: any, idx: number) => {
        if (tbl?.gitDiff) next.set(idx, tbl.gitDiff)
      })
    }
    return next
  })
  
  setColumnDiffMap(prev => {
    const next = new Map(prev)
    if (Array.isArray(data)) {
      data.forEach((tbl: any, idx: number) => {
        if (tbl?.columnDiff) next.set(idx, tbl.columnDiff)
      })
    }
    return next
  })
}, [])
```

#### `updateGitDiff` 受信時

```typescript
const onGitDiffData = useCallback((diffData: Array<{tableIndex: number, gitDiff: any[], columnDiff?: any}>) => {
  // 差分情報を個別に state 更新
  setGitDiffMap(prevMap => {
    const newMap = new Map(prevMap)
    diffData.forEach(diff => newMap.set(diff.tableIndex, diff.gitDiff))
    return newMap
  })
  
  setColumnDiffMap(prevMap => {
    const newMap = new Map(prevMap)
    diffData.forEach(diff => {
      if (diff.columnDiff) newMap.set(diff.tableIndex, diff.columnDiff)
    })
    return newMap
  })
}, [])
```

---

## 過去に観測された問題点（経緯）

### 問題 1: セル編集直後の差分検出が遅い/空になる

**現象：**
- 1 回目・2 回目の編集：`gitDiffLength: 0`（表示されない）
- 3 回目の編集：`gitDiffLength: 6`（表示される）

**原因の仮説：**
1. `getGitDiffForTable()` の計算タイミングが短い（< 50ms）
2. ファイル保存直後に git のステージング状態がまだ更新されていない

**ログ証拠：**
```
[handleTableDataMessage] table 0: {
  hasGitDiff: true,
  hasColumnDiff: true,
  gitDiffLength: 0,  ← 空！
  columnDiffKeys: Array(5)
}
```

`columnDiffKeys` は存在するが `gitDiffLength: 0` という矛盾が発生。

### 問題 2: 複数の `updateTableData` 通知

**現象：**
- セル編集 1 回につき `updateTableData` が複数回（通常 2 回）送信される

**理由：**
```typescript
// extension.ts の updateCellCommand
webviewManager.updateTableData(panel, tablesWithGitDiff, uri);  // 1 回目（差分計算後）

// その後、必要に応じて再送
webviewManager.updateTableData(panel, tablesWithGitDiff, uri);  // 2 回目
```

---

## 改善案

### 案 A: 差分計算の非同期セパレーション

セル編集フロー内で差分計算を分離：

```typescript
// 1. まずテーブルデータのみを送信（差分なし）
webviewManager.updateTableData(panel, tablesWithoutDiff, uri);

// 2. 非同期で差分を計算
(async () => {
  const tablesWithDiff = await Promise.all(
    allTableData.map(async (tbl, idx) => {
      const diff = await getGitDiffForTable(...)
      return { ...tbl, gitDiff: diff, columnDiff: detectColumnDiff(diff) }
    })
  )
  
  // 3. 差分のみを通知で送信
  const diffsPayload = tablesWithDiff.map((tbl, idx) => ({
    tableIndex: idx,
    gitDiff: tbl.gitDiff,
    columnDiff: tbl.columnDiff
  }))
  webviewManager.updateGitDiff(panel, diffsPayload)
})()
```

**利点：**
- Webview が即座に テーブル表示可能（UX 向上）
- 差分計算の遅延を隠蔽

**欠点：**
- 通知が 2 回になる

### 案 B: 差分計算の待機

セル編集フロー内で差分計算を待つ：

```typescript
const tablesWithGitDiff = await Promise.all(
  allTableData.map(async (tbl, idx) => {
    const diff = await getGitDiffForTable(...)
    return { ...tbl, gitDiff: diff, columnDiff: detectColumnDiff(diff) }
  })
)

// 差分を含めて一度だけ送信
webviewManager.updateTableData(panel, tablesWithGitDiff, uri)
```

**利点：**
- シンプル（通知 1 回）
- 差分が確実に含まれる

**欠点：**
- テーブル表示が遅延（差分計算待機）

## 推奨実装方針

**短期（現在の運用）：**
- 案 A を採用（実装済み）：初回送信（差分なし）→ 差分計算後に `updateGitDiff` 送信。Webview は `onGitDiffData` で差分を受け取り更新します。
- 実装面では `columnDiffMap` / `gitDiffMap` による差分の個別管理で既知のタイミング問題に対応しています。

**長期（安定性向上）：**
- 差分計算の単体テストを拡充
- E2E テストで git diff 表示の回帰を担保

---

## テスト方針

### 1. 初期ロード時の同期確認

```
1. ファイルを開く
2. Extension Host ログで:
   - updateTableData（差分なし）
   - updateGitDiff（差分あり）
   が順序通り出ることを確認
3. Webview で [handleTableDataMessage] gitDiffLength: 0 → 6 の遷移を確認
```

### 2. セル編集時の同期確認

```
1. セルを編集 → 保存
2. Webview ログで [handleTableDataMessage] gitDiffLength を確認
   - 初回編集で 0 ならば問題あり
   - 0 → (後続通知で) 6 に変われば案 A 実装で解決
3. git diff 表示されるか確認
```

### 3. ファイル変更検知時の確認

```
1. VSCode エディタで直接テーブルを編集
2. Webview が同期できるか確認
3. git diff 表示されるか確認
```

---

## 参考実装ファイル

- **拡張側：**
  - `src/extension.ts` - `updateCellCommand` など操作コマンド処理
  - `src/gitDiffUtils.ts` - `getGitDiffForTable()` 差分計算
  - `src/communication/ExtensionCommunicationManager.ts` - `updateTableData()`, `updateGitDiff()` 通知送信
  
- **Webview 側：**
  - `webview-react/src/App.tsx` - `handleTableDataMessage`, `onGitDiffData` state 更新
  - `webview-react/src/hooks/useCommunication.ts` - 通知ハンドラ登録
  - `webview-react/src/components/TableBody.tsx` - git diff レンダリング

---

## 備考

- **ColumnDiff vs RowGitDiff：** 
  - `columnDiff`: ヘッダ（列）の追加/削除情報
  - `rowGitDiff`: 行の追加/削除/変更情報
  - 両者を合わせて完全な diff ビュー
  
- **Webview の memoization：**
  - `currentTableData` は依存配列に `gitDiffMap`, `columnDiffMap` を含めているため、map 更新で自動再計算
  - これにより UI 遅延を最小化

---

## 実装状況（Plan A - 非同期差分分離）

### 実装内容

2024年 git diff 表示遅延問題を解決するため、**案 A（非同期差分計算分離）** を採択・実装しました。

#### 修正対象のコマンド

1. **updateCellCommand** (`src/extension.ts` line 674~)
   - セル値を保存した直後、差分計算を背景でスケジュール
   - 即座に UI 応答（バックグラウンド計算待機なし）

2. **bulkUpdateCellsCommand** (`src/extension.ts` line 848~)
   - 複数セル更新時も同じパターン適用

3. **updateHeaderCommand** (`src/extension.ts` line 1025~)
   - ヘッダ更新後の非同期差分計算

4. **runTableEdit（汎用ヘルパー）** (`src/extension.ts` line 351~)
   - addRow/deleteRow/addColumn/deleteColumn など複数コマンドが利用
   - 全て非同期差分パターンに統一

5. **sortCommand** (`src/extension.ts` line 1254~)
   - テーブルソート後の非同期差分計算

6. **moveRowCommand** (`src/extension.ts` line 1354~)
   - 行移動後の非同期差分計算

7. **moveColumnCommand** (`src/extension.ts` line 1461~)
   - 列移動後の非同期差分計算

#### 実装パターン

```typescript
// 従来（同期計算）
const tablesWithGitDiff = await Promise.all(...計算...);
webviewManager.updateTableData(panel, tablesWithGitDiff, uri);

// 新規（非同期分離）
// 差分計算を背景でスケジュール
(async () => {
    try {
        // ... 非同期で全テーブルの差分計算 ...
        const tablesWithGitDiff = await Promise.all(...);
        
        // 計算完了時のみ通知（差分のみ）
        webviewManager.updateGitDiff(panel, tablesWithGitDiff);
    } catch (diffError) {
        // diff 計算失敗は非致命的
        warn('[Extension] Failed to calculate git diff:', diffError);
    }
})();
```

**利点：**
- ファイル保存直後に UI がすぐ応答（ユーザー体感向上）
- git diff 計算が完了しても UI がフリーズしない（非ブロッキング）
- 計算失敗時も UI は動作継続（安定性向上）

### Webview 側の対応

`webview-react/src/App.tsx` では以下を実装済み：

1. **columnDiffMap 状態管理** 
   - 列差分情報を map で個別管理

2. **onGitDiffData ハンドラ**
   - `updateGitDiff` 通知を処理
   - gitDiffMap / columnDiffMap を個別更新

3. **currentTableData memoization**
   - 依存配列に gitDiffMap / columnDiffMap を含意
   - map 更新で自動再計算・再レンダリング

4. **一時的なデバッグログ削除**
   - handleTableDataMessage の詳細ログを削除（問題診断完了後）

### テスト結果

**ビルド：** ✓ 成功
```
npm run compile
> TypeScript コンパイル: OK
> Webview ビルド: OK (378.35 kB)
```

**期待動作：**
1. セル編集 → 保存
2. Webview `handleTableDataMessage` gitDiffLength: 0 で初期受信
3. 100ms～数秒後 `onGitDiffData` で gitDiffLength: 6 に更新
4. UI に git diff が表示される

### 今後の確認項目

- [ ] 実装コードのテスト実行（npm run test）
- [ ] E2E テストで git diff 表示確認
- [ ] 複数テーブルファイルでの動作確認
- [ ] undo/redo との連携確認
