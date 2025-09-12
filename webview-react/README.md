# Markdown Table Editor - React Webview

このディレクトリには、Markdown Table EditorのwebviewをReactで実装したバージョンが含まれています。

## 開発環境のセットアップ

### 1. 依存関係のインストール

```bash
cd webview-react
npm install
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

これにより、Viteの開発サーバーが起動し、ホットリロードが有効になります。

### 3. プロダクションビルド

```bash
npm run build
```

ビルドされたファイルは `../webview-dist` に出力されます。

## アーキテクチャ

### コンポーネント構造

```
App
├── TableEditor (メインのテーブルエディタ)
│   ├── TableHeader (列ヘッダー)
│   ├── TableBody (テーブル本体)
│   │   └── TableCell (個別のセル)
│   ├── SortActions (ソート操作UI)
│   └── ContextMenu (右クリックメニュー)
└── StatusBar (ステータスバー)
```

### 状態管理

- `useTableEditor`: テーブルデータと編集状態の管理
- `useVSCodeCommunication`: VSCode拡張との通信
- `StatusContext`: アプリケーション全体のステータス管理（Context API使用）
- `useClipboard`: クリップボード操作の管理
- `useKeyboardNavigation`: キーボードナビゲーションの管理
- `useDragDrop`: ドラッグ&ドロップ機能の管理
- `useCSVExport`: CSV/TSVエクスポート機能の管理

### 主な機能

- ✅ セル編集（ダブルクリック、Enter/Escapeキー）
- ✅ 行・列の追加・削除
- ✅ ソート機能
- ✅ セル選択（単一・範囲選択・行選択・列選択・全選択）
- ✅ 列幅リサイズ
- ✅ 動的コンテキストメニュー（正確なインデックス対応）
- ✅ ドラッグ&ドロップによる行・列の移動
- ✅ クリップボード操作（コピー・ペースト・切り取り）
- ✅ CSV/TSVエクスポート機能
- ✅ 一括セル更新（パフォーマンス最適化）
- ✅ Context APIによる状態管理
- ✅ VSCodeテーマ対応
- ✅ IME入力対応

## VSCode拡張との統合

### メッセージ通信

React webviewは以下のメッセージでVSCode拡張と通信します：

#### 送信メッセージ
- `requestTableData`: 初期データの要求
- `updateCell`: セル値の更新
- `bulkUpdateCells`: 複数セルの一括更新
- `updateHeader`: ヘッダーの更新
- `addRow`: 行の追加
- `deleteRows`: 行の削除
- `addColumn`: 列の追加
- `deleteColumns`: 列の削除
- `sort`: ソートの実行
- `exportFile`: CSV/TSVファイルのエクスポート

#### 受信メッセージ
- `updateTableData`: テーブルデータの更新
- `success`: 操作成功の通知
- `error`: エラーの通知
- `cellUpdateError`: セル更新エラー
- `headerUpdateError`: ヘッダー更新エラー

### ビルド統合

拡張のビルドプロセスは以下のように更新されています：

1. `npm run compile` → TypeScript拡張コードのコンパイル
2. `npm run build-webview` → React webviewのビルド
3. ビルド結果を `out/webview` にコピー

## 開発のヒント

### デバッグ

1. VSCode Developer Toolsでwebviewをデバッグ
2. React Developer Toolsが使用可能
3. コンソールログでVSCode通信を確認

### スタイリング

- VSCodeテーマ変数を使用（`var(--vscode-*)`）
- CSSカスタムプロパティでテーマ対応
- レスポンシブデザイン対応

### パフォーマンス

- React.memo()でコンポーネントの再レンダリングを最適化
- useCallback()でイベントハンドラーを最適化
- 大きなテーブルでの仮想化は今後の課題

## 今後の改善点

- [ ] 仮想化による大きなテーブルのパフォーマンス向上
- [ ] より高度な選択機能（Ctrl+クリック等）
- [ ] アンドゥ・リドゥ機能
- [ ] アクセシビリティの向上
- [ ] テストカバレッジの向上
- [ ] エラーハンドリングの強化

## 最近の改善点（v2.0）

### 🔧 修正された問題
- ✅ コンテキストメニューのハードコードされたインデックスを修正
- ✅ 行・列選択機能を完全実装
- ✅ StatusBarのアンチパターン（グローバル状態）をContext APIで解決
- ✅ ドラッグ&ドロップ機能を実装
- ✅ TSVエクスポート機能を追加
- ✅ 一括セル更新によるパフォーマンス改善
- ✅ TypeScript型エラーを修正
- ✅ テストの品質向上（正確なインデックステスト）

### 🏗️ アーキテクチャの改善
- Context APIによる状態管理の導入
- コンポーネントの責務分離
- カスタムフックによる機能分割
- 型安全性の向上