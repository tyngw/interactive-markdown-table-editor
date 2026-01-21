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

## 列追加・削除検知（仕様）

### 目的

Markdown テーブルにおける列の追加・削除を、git diff 機能で確実に検知するための仕様を定義する。

### 仕様概要

- 列数は「エスケープされていないパイプ文字（`|`）」の数をもとに判定する。
- 前回の列数と現在の列数が異なる場合に、列の追加／削除を検知し `columnDiff` を生成する。
- 判定はヘッダ行（最初の表見出し行）を主要な基準とするが、必要に応じてデータ行も参照できる。

### アルゴリズム（要点）

1. 対象行の抽出
   - テーブルのヘッダ行（および区切り行）を対象とする。複数テーブルがある場合は各テーブルごとに判定する。
   - フェンス付きコードブロック内や、テーブル外の行は無視する。

2. エスケープ & コードスパン処理
   - 逆スラッシュでエスケープされたパイプ（`\|`）は列区切りと見なさない。
   - バッククォートで囲まれたコードスパン（`` `...` ``）内のパイプは無視する。

3. 列数算出（ヘッダ行に対して）
   - ヘッダ行を左からスキャンし、エスケープやコードスパン内でない `|` を検出するたびにカウントを増やす。
   - 列数 = 有効な `|` の数 + 1（ただし、パイプが1つも見つからない場合は 1 列と扱う）。

4. 変化検出
   - 既存データ（直近のコミット／保存時の表）とワークツリー（編集後の表）それぞれで上記算出を行い、列数が異なれば追加/削除を検知する。
   - 変更内容は `columnDiff` として次の情報を含める：
     - `oldColumnCount`: 以前の列数
     - `newColumnCount`: 現在の列数
     - `changeType`: `added` | `removed`
     - `notes` (任意): 追加・削除された列の推定位置やヘッダテキストの差（文字列ベースのヒューリスティック）

### 通信フォーマット（updateGitDiff に含める想定）

例:

```json
{
  "tableIndex": 0,
  "gitDiff": [ /* 既存の行差分 */ ],
  "columnDiff": {
    "oldColumnCount": 3,
    "newColumnCount": 4,
    "changeType": "added",
    "notes": "header: 新しい列 'Tag' を検出"
  }
}
```

Webview 側では受け取った `columnDiff` を `columnDiffMap` に格納し、`currentTableData` の合成ロジックで優先的に使用する。

### 判定タイミング

- `getGitDiffForTable()` 実行時（差分計算フェーズ）で、コミット時の表とワークツリーの表を比較して判定する。
- `updateTableData` を受信した際にも行数を再計測し、即時に列変化があれば短時間で `updateGitDiff` を送ることで UI に反映する。

### テストケース（必須）

- 単純な表: `| a | b | c |` → 列数 3
- 先頭/末尾パイプ省略: `a | b | c` → 列数 3
- エスケープされたパイプ: `a \| b | c` → 列数 2
- コードスパン内のパイプ: `` `a|b` | c`` → 列数 2
- 追加/削除の差分: コミット時列数 3 → ワークツリー列数 4（追加と判定）

上記をカバーするユニットテストを `src/gitDiffUtils.ts` の列カウントロジックに追加することを推奨する。

### 中間列（インサート／削除）検知の強化

目的：既存テーブルの途中（中間）に列が追加または削除された場合でも、正しい位置と変更内容を検知して `columnDiff` を生成する。

方針（要点）

- 単純な列数差だけでなく、ヘッダセル単位のマッチングで「どの位置」に列の増減があったかを特定する。
- ヘッダ名が変更された場合や重複ヘッダがある場合は、複数のヒューリスティックを組み合わせて推定する。

アルゴリズム（推奨実装）

1. ヘッダセルの抽出
   - ヘッダ行をパイプ区切りで分割する際、前節のエスケープ／コードスパン処理を適用して正確なセルテキスト配列 `oldHeaders` / `newHeaders` を得る。
   - 各セルは `trim()` して正規化（連続空白を単一化、全角半角の簡易正規化など）する。

2. 直接マッチング（パス1）
   - 同一文字列のヘッダセルを優先してインデックスをマップする（最左優先でペアリング）。

3. ファジーマッチング（パス2）
   - 残った未マッチセルについては、正規化した小文字比較、類似度（例：レーベンシュタイン距離やトークンの部分一致）でマッチ候補を探す。

4. LCS（最長共通部分列）による挿入位置検出（パス3）
   - `oldHeaders` と `newHeaders` の LCS を計算し、LCS を保持する要素が連続する位置を基準に、LCS に含まれない要素が挿入／削除された範囲として扱う。
   - 例えば old=[A,B,C] new=[A,B,X,C] の場合、LCS=[A,B,C] から X が index=2 に挿入されたと判定する。

5. 行ベースの補正（フォールバック）
   - ヘッダ情報で確定できない場合は、複数のデータ行を参照して各行ごとの列数・セル分割結果の多数決を取り、最も頻度の高い列配置を採用する。

6. 出力（`columnDiff` の拡張）
   - 既存の `oldColumnCount` / `newColumnCount` / `changeType` に加え、以下を含める：
     - `positions`: 変更箇所の配列。各要素は `{ index: number, type: 'added'|'removed', header?: string, confidence: 0.0-1.0 }`。
     - `mapping`: 旧インデックスから新インデックスへの推定マッピング（任意、デバッグ用）。

通信フォーマット 例（拡張）:

```json
{
  "tableIndex": 0,
  "columnDiff": {
    "oldColumnCount": 3,
    "newColumnCount": 4,
    "changeType": "added",
    "positions": [
      { "index": 2, "type": "added", "header": "Tag", "confidence": 0.95 }
    ],
    "mapping": [0,1,3]
  }
}
```

実例パターンと期待される判定

- 例1（中間追加）
  - old header: `| A | B | C |`
  - new header: `| A | B | X | C |`
  - 検知: added at index 2, header `X`

- 例2（中間削除）
  - old header: `| A | B | X | C |`
  - new header: `| A | B | C |`
  - 検知: removed at index 2, header `X`

- 例3（ヘッダ名変更 + 中間挿入）
  - old header: `| A | B | C |`
  - new header: `| A | NewB | X | C |`
  - 検知: added at index 2 (X), and B→NewB はファジーマッチで mapping を検出（confidence 低め）

テストの追加提案

- `src/gitDiffUtils.ts` に下記ユニットテストを追加:
  - LCS を使った挿入/削除検出の複数ケース
  - ファジーマッチングでヘッダ置換を推定するケース
  - 行ベース多数決で不整合なテーブル行を補正するケース

運用注意点

- confidence が低い検知結果は UI 表示で「推定」扱いにするか、ユーザーに確認を促すフローを検討する。
- 複雑な差分では `positions` を詳細表示し、必要に応じて手動マッピングを行える UI 機能を検討する。

### 差分表示時の列揃え（旧データのパディング）

要件：差分ビューで表示する際、変更前（old）のデータは変更後（new）の列数や列配置に合わせて列を追加（パディング）して表示する必要がある。これは、ユーザーが行・列ごとの差分を左右・上下で視認できるようにするためである。

仕様：

- 目的：`columnDiff` によって検出された追加列・削除列の位置情報に基づき、差分レンダリング時に old 側の行にダミーセルを挿入して new 側と列数・列インデックスを揃える。
- ダミーセルの中身は空文字列 `''` を基本とし、レンダリング側では `placeholder` クラス（薄い背景や斜体など）で視覚的に区別する。
- ダミーセルにはメタ情報として `isPlaceholder: true` と `placeholderReason: 'added-column'`（または `alignment`）を付与できるようにする（Webview での装飾・トグル表示に利用）。

アルゴリズム（要点）：

1. `columnDiff` を受け取る（`positions` が存在することを想定）。
2. 各テーブル行（ヘッダ・区切り行・データ行）について、表示用のセル配列を生成する際に下記を実施：
  - もし `positions` に `added` が含まれる場合、`added.index` に対応する位置にダミーセルを挿入する（old 側に存在しない列を補完）。
  - 複数の挿入がある場合は index の昇順で挿入する。
  - `deleted` の場合は、new 側に合わせるために new 側へダミーセルを挿入する（対称的に表示するため）。
3. 各ダミーセルには `placeholderReason`, `originColumnIndex`（元の列インデックス、存在すれば）などを付与しておく。

表示上のルール：

- placeholder は既定で薄いグレー背景とし、ツールチップで `"この列は差分により追加された列のためのプレースホルダです"` を表示する。
- ユーザーが placeholder 列を隠すトグルを用意する（設定で非表示にできる）。
- placeholder セルは編集不可（編集しようとした場合は警告を表示し、必要なら新規列挿入のワークフローへ誘導する）。

例（中間追加）:

- old row: `| A | B | C |` -> 表示用（new に合わせると） `| A | B | '' | C |` ('' は placeholder)
- new row: `| A | B | X | C |` -> 表示用 `| A | B | X | C |`

- 例（中間削除）:

  - old row: `| A | B | X | C |` -> 表示用 `| A | B | X | C |`
  - new row: `| A | B | C |` -> 表示用（old に合わせるため） `| A | B | '' | C |`

注: 削除時は new 側にダミー列を追加して old/new の列インデックスを揃えるか、表示側で対称的に placeholder を入れて比較しやすくしてください。

実装上の注意点：

- `columnDiff.mapping` を利用して old->new のインデックス対応がある場合は、それを優先してダミー挿入位置を決定する。
- 並列に複数の `updateGitDiff` が到着するケースを想定して、差分の適用は最終的にマージ可能な方法（受信時に最新の `columnDiff` と `gitDiff` を比較して再整列）で行う。
- Webview 側でのパフォーマンスを考慮し、ダミー挿入処理は O(r * c + p)（r=行数, c=列数, p=追加列数）程度の複雑度に抑える。

テストケース（追加）:

- old: `| A | B | C |` , new: `| A | B | X | C |` -> old の表示に placeholder が挿入されること
- old 行複数行で placeholder が一貫して挿入されること（サンプル多数行で検証）
- placeholder を編集不可として扱うこと（UI 振る舞いは統合テストで確認）


### アルゴリズム（詳細）

以下は中間列の追加／削除を高精度で検知するための具体アルゴリズムです。実装は `src/gitDiffUtils.ts` に関数群として切り出すことを想定しています。

1) 行トークン化: `tokenizeRow(row: string): string[]`
  - 文字列を左から走査し、次を追跡する状態機械を使う。
    - `escaped` (直前が `\\` か)
    - `inCodeSpan` (バッククォートペア内か)
  - エスケープされておらずコードスパン外の `|` を見つけたらセル境界として分割する。
  - 各セルは `trim()` して返す。

2) 正規化: `normalizeHeader(s: string): string`
  - 連続空白を単一スペースへ、先頭末尾の空白除去、全角/半角の軽微正規化、必要に応じ小文字化を行う。

3) ヘッダ配列取得
  - `oldHeaders = tokenizeRow(oldHeaderLine).map(normalizeHeader)`
  - `newHeaders = tokenizeRow(newHeaderLine).map(normalizeHeader)`

4) 直接マッチングパス（Exact）
  - 左から順に同一文字列のセルを最左優先でペアリングし、ペア済み要素は除外する。
  - ペアリング成功の要素は `mapping` に oldIndex→newIndex を登録、`positions` に変更なしとして扱う。

5) LCS による差分境界検出
  - 残った `oldRemaining` と `newRemaining` に対し、文字列等価を用いて LCS（最長共通部分列）を求める（DP、O(n*m)）。
  - LCS に含まれない `newRemaining` 要素は `added`、`oldRemaining` の LCS 非含有要素は `removed` と判定する。
  - 連続する追加/削除はまとめてレンジとして扱う。

6) ファジーマッチ（Rename 推定）
  - LCS で解決できない未マッチ要素に対して、レーベンシュタイン比率やトークン一致率で候補を評価。
  - 類似度が閾値（推奨: 0.7）以上なら `renamed` と推定し、低めの `confidence` を付与して `mapping` を作る。

7) データ行による補正（フォールバック）
  - ヘッダだけで位置が不確かな場合は、上位 N 行のデータ行を tokenize して列インデックスの多数決を取る。
  - 例えば多くの行で新列が右端に存在しないなら中間追加の可能性が高いと判断する。

8) 出力構造の組立て
  - `columnDiff`:
    - `oldColumnCount`, `newColumnCount`, `changeType` (`added`/`removed`/`mixed`)
    - `positions`: [{ index: number, type: 'added'|'removed'|'renamed', header?: string, confidence: number }]
    - `mapping`: number[] (oldIndex -> newIndex or -1)
    - `heuristics`: string[] (適用した手法のメモ、デバッグ用)

9) 信頼度設計（推奨値）
  - exact match: confidence = 1.0
  - LCS-inferred: confidence = 0.85
  - fuzzy rename: confidence = 0.6〜0.8（類似度に比例）
  - ファイル保存直後や git の状態が不安定な場合は confidence を自動的に減衰させるオプションを用意する。

10) 疑似コード（要点）

```typescript
function detectColumnDiff(oldLine: string, newLine: string, dataRows: string[]): ColumnDiff {
  const oldH = tokenizeRow(oldLine).map(normalizeHeader);
  const newH = tokenizeRow(newLine).map(normalizeHeader);

  const mapping = new Array(oldH.length).fill(-1);
  const positions: any[] = [];

  // exact match pass
  for (let i=0;i<oldH.length;i++){
   for (let j=0;j<newH.length;j++){
    if (mapping[i]===-1 && oldH[i]===newH[j]){ mapping[i]=j; markMatched(j); break; }
   }
  }

  // LCS pass on unmatched
  const lcs = computeLCS(getUnmatched(oldH), getUnmatched(newH));
  inferAddsRemovesFromLCS(lcs, oldH, newH, mapping, positions);

  // fuzzy for remaining
  fuzzyMatchRemaining(oldH, newH, mapping, positions);

  // fallback using dataRows if ambiguity
  if (isAmbiguous(mapping)) { majorityVoteByRows(dataRows, mapping, positions); }

  return buildColumnDiff(oldH.length, newH.length, mapping, positions);
}
```

実装注意点:
- `tokenizeRow` は必ずテストで網羅する（エスケープ、コードスパン、先頭/末尾パイプ、省略表記など）。
- LCS はヘッダ数が小さい（通常 < 50）ため性能問題になりにくいが、極端な大規模ヘッダ列を想定する場合は最適化を検討する。

単体テスト（推奨）:
- 単一追加・単一削除・連続追加・連続削除・ヘッダ名変更＋挿入・エスケープ/コードスパン混在 の各ケースを `unit` テストに追加する。

### 採用アルゴリズム：サンプリング＋マッチ数最小列を対象にする手法

目的：計算コストを抑えつつ、ヘッダ名変更やノイズの影響を軽減して中間列（挿入/削除）を高確度で検出する。

概要（要点）

- 全行を比較する代わりに、データ行をサンプリングして各列の「セル一致数」を集計する。
- サンプルごとに oldColumns と newColumns を token 化し、セル値の単純一致でマッチをカウントする。
- 各列ペアの類似度行列を作らず、代わりに「ある列が何回マッチしたか（match count）」を基準に、マッチ数が最も低い列を変更候補とする。

アルゴリズム手順

1. サンプリング
  - テーブルのデータ行から最大 `K` 行（推奨: 8〜12）を均等に抽出する（先頭、中間、末尾を含める）。

2. トークン化・正規化
  - 各サンプル行を `tokenizeRow` で分割し、セルを `normalizeHeader` 相当で正規化する（空白正規化、小文字化など）。

3. マッチ集計
  - サンプルごとに、new 列 j に対して old 列 i がセル文字列で一致するかを判定し、一致した場合に `matchCount[i]++` および `matchCountNew[j]++` をインクリメントする。
  - 完全一致のみをカウントし、必要に応じてファジー一致を別レイヤーで扱う（confidence 降下）。

4. 変化候補選定（マッチ数最小）
  - old 側で `matchCount` が最も低いインデックスを `removed` 候補とする。同様に new 側で最小の `matchCountNew` を `added` 候補とする。
  - 複数列が最小値を共有する場合は LCS/順序情報で絞り込むか、データ行多数決で補正する。

5. 出力構築
  - 検出結果を `columnDiff.positions` として出力し、`confidence` を `matches / K`（単純割合）で算出して付与する。

疑似コード（重点）

```typescript
function detectByMatchCount(oldHeaders, newHeaders, dataSamples){
  const K = dataSamples.length;
  const oldN = oldHeaders.length, newN = newHeaders.length;
  const matchCountOld = new Array(oldN).fill(0);
  const matchCountNew = new Array(newN).fill(0);

  for (const row of dataSamples) {
   const oldCells = tokenizeRow(row.old).map(normalizeHeader);
   const newCells = tokenizeRow(row.new).map(normalizeHeader);
   for (let i=0;i<oldN;i++) for (let j=0;j<newN;j++){
    if (oldCells[i] && newCells[j] && oldCells[i] === newCells[j]){
      matchCountOld[i]++;
      matchCountNew[j]++;
    }
   }
  }

  const removedIdx = argMin(matchCountOld);
  const addedIdx = argMin(matchCountNew);

  return buildColumnDiffFromCandidates(removedIdx, addedIdx, matchCountOld[removedIdx]/K);
}
```

設計上の注意点

- K を小さくしすぎるとノイズに弱くなる（少なくとも 4〜8 を推奨）。
- ヘッダ名が完全に変わった場合、サンプルの一致が得られず low-match 列と判定されるのは望む挙動（追加/削除の候補）だが、rename の可能性を示すためにファジー比較を副次的に実施することを推奨する。
- matchCount が全てゼロに近い場合は `confidence` が低く UI で「推定」と表示する。

メリット

- 計算が単純で実装コスト・CPU負荷が低い（O(K * n * m) の簡単集計）。
- 類似度行列やハンガリアン法を使わないためロジックが理解しやすい。

テスト

- サンプリング数 `K` を変えて安定性を確認するテスト。
- old/new の中間追加・削除ケースで `removedIdx` / `addedIdx` が想定通りになることを検証。




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
