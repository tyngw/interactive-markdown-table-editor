# Implementation Plan

- [x] 1. プロジェクト準備とインフラストラクチャ構築
  - ✅ webview/js/ ディレクトリを作成し、JavaScriptファイル分割の基盤を準備
  - ✅ webviewManager.tsにスクリプトURI生成機能を実装し、vscode-resourcesスキーマでの安全な読み込みを確保
  - ✅ Content Security Policyを更新してvscode-resource:からのスクリプト読み込みを許可
  - ✅ HTMLファイルにモジュールローダーを追加し、段階的な読み込み機能を実装
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. コアモジュールシステムの実装
  - ✅ webview/js/core.jsを作成し、グローバル状態管理とモジュール登録システムを実装
  - ✅ TableEditorオブジェクトにstate管理、vscode API初期化、モジュール登録機能を実装
  - ✅ モジュール読み込みエラーハンドリングとフォールバック機能を実装
  - ✅ VSCodeメッセージハンドリングとモジュール間通信機能を実装
  - _Requirements: 3.3, 3.4, 7.1, 7.2_

- [x] 3. テーブルレンダリングモジュールの分割
  - ✅ webview/js/table-renderer.jsを作成し、テーブル表示関連の全機能を移行
  - ✅ renderTable, renderTableContent, getColumnLetter, processCellContent等の関数を分離
  - ✅ HTML エスケープ処理と列幅管理機能を含める
  - ✅ セル内容処理機能（<br>タグ処理、HTMLエスケープ）を含める
  - ⏳ tableEditor.htmlからレンダリング関連コードを削除し、モジュール呼び出しに置換
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4_

- [x] 4. セル編集モジュールの分割
  - ✅ webview/js/cell-editor.jsを作成し、セル編集関連の全機能を移行
  - ✅ startCellEdit, commitCellEdit, cancelCellEdit, handleCellClick等の関数を分離
  - ✅ 適応的入力フィールド機能（single-line/multi-line判定、サイズ調整）を含める
  - ✅ HTML タグ処理機能（<br/>タグの変換）を含める
  - ✅ IME対応とバリデーション機能を含める
  - ⏳ tableEditor.htmlからセル編集関連コードを削除し、モジュール呼び出しに置換
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. セル選択管理モジュールの分割
  - ✅ webview/js/selection.jsを作成し、セル選択関連の全機能を移行
  - ✅ selectCell, selectRange, selectRow, selectColumn, selectAll等の関数を分離
  - ✅ 複数選択、範囲選択、選択状態の視覚的表示機能を含める
  - ✅ 選択状態のヘルパー関数（isRowFullySelected, isColumnFullySelected）を含める
  - ✅ キーボードショートカット（Ctrl/Cmd, Shift）による選択拡張機能を含める
  - ⏳ tableEditor.htmlから選択関連コードを削除し、モジュール呼び出しに置換
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_
  - 適応的入力フィールド機能（single-line/multi-line判定、サイズ調整）を含める
  - HTML タグ処理機能（<br/>タグの変換）を含める
  - tableEditor.htmlからセル編集関連コードを削除し、モジュール呼び出しに置換
  - セル編集機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5. セル選択管理モジュールの分割
  - webview/js/selection.jsを作成し、セル選択関連の全機能を移行
  - selectCell, selectRange, selectRow, selectColumn, selectAll等の関数を分離
  - 複数選択、範囲選択、選択状態の視覚的表示機能を含める
  - 選択状態のヘルパー関数（isRowFullySelected, isColumnFullySelected）を含める
  - tableEditor.htmlから選択関連コードを削除し、モジュール呼び出しに置換
  - セル選択機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6. ソート機能モジュールの分割
  - webview/js/sorting.jsを作成し、ソート関連の全機能を移行
  - handleColumnHeaderClick, applySortView, restoreOriginalView, commitSortToFile等の関数を分離
  - ビューオンリーソート機能とソート状態管理を含める
  - ソートアクションパネルの表示・非表示制御を含める
  - tableEditor.htmlからソート関連コードを削除し、モジュール呼び出しに置換
  - ソート機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 7. ドラッグ&ドロップモジュールの分割
  - webview/js/drag-drop.jsを作成し、ドラッグ&ドロップ関連の全機能を移行
  - setupDragAndDrop, startRowDrag, startColumnDrag, handleDragOver, handleDrop等の関数を分離
  - ドロップ位置の視覚的フィードバック機能を含める
  - ドラッグ中の状態管理とイベントハンドリングを含める
  - tableEditor.htmlからドラッグ&ドロップ関連コードを削除し、モジュール呼び出しに置換
  - ドラッグ&ドロップ機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 8. コンテキストメニューモジュールの分割
  - webview/js/context-menu.jsを作成し、コンテキストメニュー関連の全機能を移行
  - showRowContextMenu, showColumnContextMenu, hideContextMenus等の関数を分離
  - 行・列操作のメニュー項目（追加・削除）機能を含める
  - メニューの位置計算とイベントハンドリングを含める
  - tableEditor.htmlからコンテキストメニュー関連コードを削除し、モジュール呼び出しに置換
  - コンテキストメニュー機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 9. 列リサイズモジュールの分割
  - webview/js/column-resize.jsを作成し、列リサイズ関連の全機能を移行
  - startColumnResize, handleColumnResize, stopColumnResize, autoFitColumn等の関数を分離
  - リサイズ中の視覚的フィードバックと状態管理を含める
  - 列幅の永続化機能を含める
  - tableEditor.htmlから列リサイズ関連コードを削除し、モジュール呼び出しに置換
  - 列リサイズ機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 10. キーボードナビゲーションモジュールの分割
  - webview/js/keyboard-navigation.jsを作成し、キーボードナビゲーション関連の全機能を移行
  - handleKeyDown, navigateCell, navigateCellSmart, navigateToNextCell等の関数を分離
  - スマートナビゲーション（Ctrl+矢印キー）機能を含める
  - キーボードショートカットとセル間移動ロジックを含める
  - tableEditor.htmlからキーボードナビゲーション関連コードを削除し、モジュール呼び出しに置換
  - キーボードナビゲーション機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 11. クリップボード管理モジュールの分割
  - webview/js/clipboard.jsを作成し、クリップボード関連の全機能を移行
  - copySelectedCells, pasteToSelectedCells, cutSelectedCells等の関数を分離
  - 複数セルのコピー・ペースト処理とデータ形式変換を含める
  - フォールバック機能付きクリップボードアクセスを含める
  - tableEditor.htmlからクリップボード関連コードを削除し、モジュール呼び出しに置換
  - クリップボード機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 12. CSVエクスポートモジュールの分割
  - webview/js/csv-export.jsを作成し、CSVエクスポート関連の全機能を移行
  - exportToCSV, generateCSVContent, escapeCSVField, getDefaultCSVFilename等の関数を分離
  - CSVフィールドのエスケープ処理とファイルダウンロード機能を含める
  - ファイル名生成とMIMEタイプ処理を含める
  - tableEditor.htmlからCSVエクスポート関連コードを削除し、モジュール呼び出しに置換
  - CSVエクスポート機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 13. ステータスバー管理モジュールの分割
  - webview/js/status-bar.jsを作成し、ステータスバー関連の全機能を移行
  - showError, showSuccess, showInfo, hide等の関数を分離
  - テーブル情報表示とソート状態表示機能を含める
  - メッセージの自動非表示とタイマー管理を含める
  - tableEditor.htmlからステータスバー関連コードを削除し、モジュール呼び出しに置換
  - ステータスバー機能の動作確認テストを実行
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 14. HTMLファイルの最終クリーンアップ
  - tableEditor.htmlから残りのインラインJavaScriptコードを削除
  - 必要最小限の初期化コードのみを残す
  - スクリプトタグの読み込み順序を最適化
  - HTMLファイルのサイズ削減を確認（目標：500行以下）
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 6.1, 6.2, 6.3, 6.4_

- [ ] 15. 統合テストと動作確認
  - 全モジュールが正常に読み込まれることを確認
  - すべてのテーブル編集機能が正常に動作することを確認
  - セル編集、ソート、ドラッグ&ドロップ、コンテキストメニュー等の統合テストを実行
  - キーボードナビゲーション、クリップボード操作、CSVエクスポートの統合テストを実行
  - 既存のテストスイートを実行してリグレッションがないことを確認
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 16. パフォーマンス最適化と検証
  - スクリプト読み込み時間を測定し、元の実装と比較
  - テーブル操作の応答性を測定し、パフォーマンス劣化がないことを確認
  - メモリ使用量を監視し、メモリリークがないことを確認
  - 大きなテーブルでのパフォーマンステストを実行
  - ブラウザキャッシュの効果を確認
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 17. エラーハンドリングとフォールバック機能の検証
  - モジュール読み込み失敗時のエラーハンドリングをテスト
  - ネットワークエラー時のフォールバック機能をテスト
  - 個別モジュールの例外処理をテスト
  - ユーザーフレンドリーなエラーメッセージ表示をテスト
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 18. ドキュメント更新と開発者体験向上
  - 各モジュールのJSDocコメントを追加
  - モジュール間の依存関係を文書化
  - 新しいファイル構造をREADME.mdに反映
  - 開発者向けのデバッグガイドを作成
  - コードレビューのためのチェックリストを作成
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 19. 最終検証とリリース準備
  - 全機能の最終動作確認を実行
  - 異なるVSCodeバージョンでの互換性テスト
  - 異なるOS（Windows, macOS, Linux）での動作確認
  - パッケージサイズの確認と最適化
  - リリースノートの作成
  - _Requirements: 1.1, 1.2, 1.3, 1.4_