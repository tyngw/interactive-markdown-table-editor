# Requirements Document

## Introduction

VSCode拡張機能「Markdown Table Editor」の`webview/tableEditor.html`ファイルが2400行を超える巨大なファイルとなっており、保守性とコードの可読性が低下しています。このファイルに含まれる大量のJavaScriptコードを機能別に外部ファイルに分割し、VSCodeのwebviewセキュリティ要件（vscode-resourcesスキーマ）に準拠した形で安全に読み込める構造にリファクタリングします。

過去に何度かこの問題に取り組んだがリグレッションが発生して中断した経緯があるため、段階的なアプローチで確実に実装し、各段階で動作確認を行いながら進めます。

## Requirements

### Requirement 1: 段階的ファイル分割

**User Story:** 開発者として、巨大なHTMLファイルを段階的に分割して、各段階で動作確認ができるようにしたい。これにより、リグレッションを早期に発見し、問題の切り分けを容易にできる。

#### Acceptance Criteria

1. WHEN ファイル分割を開始する THEN システムは 1つずつファイルを分割する SHALL
2. WHEN 各ファイル分割が完了する THEN システムは 動作確認を可能にする SHALL
3. WHEN リグレッションが発生する THEN システムは 前の段階に戻れる SHALL
4. WHEN 分割が完了する THEN システムは 元の機能と同等の動作を保証する SHALL

### Requirement 2: VSCodeセキュリティ準拠

**User Story:** 開発者として、分割されたJavaScriptファイルがVSCodeのwebviewセキュリティ要件に準拠して安全に読み込まれるようにしたい。これにより、拡張機能のセキュリティを維持できる。

#### Acceptance Criteria

1. WHEN JavaScriptファイルを読み込む THEN システムは vscode-resourcesスキーマを使用する SHALL
2. WHEN ファイルパスを生成する THEN システムは webview.asWebviewUri()を使用する SHALL
3. WHEN Content Security Policyが適用される THEN システムは 適切に動作する SHALL
4. WHEN 外部ファイルが読み込まれる THEN システムは セキュリティエラーを発生させない SHALL

### Requirement 3: 機能別モジュール分割

**User Story:** 開発者として、JavaScriptコードを機能別に論理的なモジュールに分割したい。これにより、コードの保守性と可読性を向上できる。

#### Acceptance Criteria

1. WHEN コードを分割する THEN システムは 機能別にファイルを作成する SHALL
2. WHEN モジュールを作成する THEN システムは 単一責任の原則に従う SHALL
3. WHEN ファイル間の依存関係がある THEN システムは 適切な読み込み順序を保証する SHALL
4. WHEN グローバル変数を使用する THEN システムは 名前空間の衝突を防ぐ SHALL

### Requirement 4: 既存機能の完全保持

**User Story:** 開発者として、リファクタリング後も既存のすべての機能が正常に動作することを保証したい。これにより、ユーザーエクスペリエンスを損なわずに改善できる。

#### Acceptance Criteria

1. WHEN リファクタリングが完了する THEN システムは すべてのテーブル編集機能を保持する SHALL
2. WHEN セル編集を行う THEN システムは 元と同じ動作をする SHALL
3. WHEN ソート機能を使用する THEN システムは 元と同じ動作をする SHALL
4. WHEN ドラッグ&ドロップを行う THEN システムは 元と同じ動作をする SHALL
5. WHEN キーボードナビゲーションを使用する THEN システムは 元と同じ動作をする SHALL
6. WHEN コンテキストメニューを使用する THEN システムは 元と同じ動作をする SHALL
7. WHEN CSVエクスポートを行う THEN システムは 元と同じ動作をする SHALL

### Requirement 5: パフォーマンス維持

**User Story:** 開発者として、ファイル分割後もパフォーマンスが維持または向上することを確認したい。これにより、ユーザーの作業効率を損なわずに改善できる。

#### Acceptance Criteria

1. WHEN ファイルが分割される THEN システムは 読み込み時間を増加させない SHALL
2. WHEN 複数のJSファイルを読み込む THEN システムは 適切にキャッシュを活用する SHALL
3. WHEN テーブル操作を行う THEN システムは 元と同等以上の応答性を保つ SHALL
4. WHEN 大きなテーブルを処理する THEN システムは パフォーマンスを維持する SHALL

### Requirement 6: 開発者体験の向上

**User Story:** 開発者として、分割されたコードが理解しやすく、デバッグしやすい構造になっていることを確認したい。これにより、今後の機能追加や修正を効率的に行える。

#### Acceptance Criteria

1. WHEN コードを読む THEN システムは 各ファイルの責任が明確である SHALL
2. WHEN デバッグを行う THEN システムは 問題の箇所を特定しやすい SHALL
3. WHEN 新機能を追加する THEN システムは 適切なファイルに配置できる SHALL
4. WHEN コードレビューを行う THEN システムは 変更の影響範囲が明確である SHALL

### Requirement 7: エラーハンドリングの保持

**User Story:** 開発者として、既存のエラーハンドリング機能がリファクタリング後も正常に動作することを確認したい。これにより、ユーザーに安定した体験を提供できる。

#### Acceptance Criteria

1. WHEN JavaScriptエラーが発生する THEN システムは 適切にエラーを処理する SHALL
2. WHEN ファイル読み込みエラーが発生する THEN システムは フォールバック機能を提供する SHALL
3. WHEN 通信エラーが発生する THEN システムは 適切にリトライする SHALL
4. WHEN 予期しないエラーが発生する THEN システムは ユーザーに分かりやすいメッセージを表示する SHALL

## Implementation Requirements

### ファイル分割戦略
- 段階的分割：1つずつファイルを分割し、各段階で動作確認
- 機能別分割：関連する機能をまとめてモジュール化
- 依存関係管理：適切な読み込み順序の確保

### セキュリティ要件
- vscode-resourcesスキーマの使用
- webview.asWebviewUri()による安全なパス生成
- Content Security Policy準拠

### テスト要件
- 各分割段階での動作確認
- 既存テストスイートの実行
- 新しいモジュール構造でのテスト

### パフォーマンス要件
- 読み込み時間の維持
- 実行時パフォーマンスの維持
- メモリ使用量の最適化