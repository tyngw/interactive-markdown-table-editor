# 新しい通信システム

## 概要

WebviewとVSCode Extension間の確実な双方向通信を実現するため、新しい通信アーキテクチャを実装しました。

## 主要な改善点

### 1. メッセージIDとリクエスト/レスポンス管理
- 各メッセージに一意のIDを付与
- リクエストに対するレスポンスを確実に追跡
- タイムアウト処理により、応答がない場合も適切に処理

### 2. 確認応答(ACK)メカニズム
- メッセージ受信時に即座にACKを送信
- 送信側はACKを受け取ることで、メッセージが届いたことを確認

### 3. 型安全な通信
- TypeScriptの型システムを活用
- すべてのメッセージタイプが厳密に定義
- コンパイル時に型エラーを検出

### 4. エラーハンドリングの強化
- エラーコードの標準化
- タイムアウトと再試行ロジック
- エラー時のフォールバック処理

### 5. ハートビートと状態同期
- 定期的なping/pongで接続状態を確認
- 状態の不一致を検出し、自動的に同期

## アーキテクチャ

### プロトコル定義
`src/communication/protocol.ts`

- メッセージタイプの定義
- コマンドの列挙
- データ構造の定義
- 設定パラメータ

### Extension側
`src/communication/ExtensionCommunicationManager.ts`

- Webviewへのメッセージ送信
- Webviewからのメッセージ受信と処理
- リクエスト/レスポンスの追跡
- ハンドラーの登録と管理

### Webview側
`webview-react/src/communication/WebviewCommunicationManager.ts`

- Extensionへのメッセージ送信
- Extensionからのメッセージ受信と処理
- 接続状態の管理

### Reactフック
`webview-react/src/hooks/useCommunication.ts`

- Reactコンポーネントから簡単に使用できるAPI
- 便利メソッドの提供
- 自動的な接続管理

## メッセージフロー

### リクエスト/レスポンス型

```
Webview                          Extension
   |                                 |
   |------- REQUEST (id: 123) ----->|
   |                                 |
   |<------ ACK (requestId: 123) ---|  (即座に確認応答)
   |                                 |
   |                                 |  (処理中)
   |                                 |
   |<---- RESPONSE (requestId: 123)-|  (結果を返す)
   |                                 |
```

### 通知型（レスポンス不要）

```
Extension                        Webview
   |                                 |
   |------ NOTIFICATION ------------>|
   |                                 |
   |                                 |  (ハンドラー実行)
   |                                 |
```

## 使用例

### Extension側

```typescript
const commManager = new ExtensionCommunicationManager(panel);

// ハンドラーの登録
commManager.registerHandler(WebviewCommand.UPDATE_CELL, async (data) => {
  // セル更新処理
  return { success: true };
});

// 通知の送信
commManager.updateTableData(tableData);

// リクエストの送信（必要な場合）
const response = await commManager.sendRequest(
  ExtensionCommand.SYNC_STATE,
  { forceRefresh: true }
);
```

### Webview側(React)

```typescript
const communication = useCommunication({
  onTableData: (data) => {
    setTableData(data);
  },
  onError: (error) => {
    setError(error);
  }
});

// セル更新
communication.updateCell(row, col, value, tableIndex);

// テーブルデータのリクエスト
await communication.requestTableData();
```

## 後方互換性

新しいシステムは既存のメッセージングと並行して動作します：

1. WebviewManagerは両方のシステムでメッセージを送信
2. 既存のコードは引き続き動作
3. 段階的に新しいシステムに移行可能

## 設定

`src/communication/protocol.ts`の`DEFAULT_CONFIG`で調整可能：

- `defaultTimeout`: デフォルトタイムアウト (10秒)
- `maxRetries`: 最大再試行回数 (3回)
- `retryDelay`: 再試行間隔 (1秒)
- `heartbeatInterval`: ハートビート間隔 (30秒)
- `syncInterval`: 状態同期間隔 (60秒)

## 今後の改善案

1. メトリクスとロギングの強化
2. メッセージキューイングシステム
3. より高度な再試行戦略
4. オフライン対応
5. パフォーマンス最適化
