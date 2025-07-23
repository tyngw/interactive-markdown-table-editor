# Requirements Document

## Introduction

VSCode拡張機能として、Markdownファイル内のテーブルをプレビュー表示時に直接編集できる機能を提供します。この機能により、ユーザーはSpreadsheetライクなUIでテーブルの値を編集し、列や行の追加・削除、ソート、ドラッグ&ドロップによる並び替えを行うことができます。編集内容は元のMarkdownファイルに自動的に反映されます。

## Enhanced Features (v0.1.20)

- **Data Synchronization**: VSCode editor and Table Editor are fully synchronized
- **Smart Navigation**: Excel-like Ctrl+Arrow key navigation for efficient cell movement
- **IME Support**: Full Japanese and multi-language input method support
- **Auto-saved Status**: Seamless save status transitions (Saving... → Auto-saved)
- **Column Width Management**: Intelligent column width control with auto-fit functionality
- **Scroll Preservation**: Edit position maintained during operations
- **Multi-Table Support**: Robust handling of multiple tables in single document
- **Enhanced UI/UX**: Bottom status bar, improved focus management, Excel-like interactions

## Requirements

### Requirement 1: Basic Cell Editing

**User Story:** VSCodeユーザーとして、Markdownファイル内のテーブルをプレビューで表示した際に、テーブルの内容を直接編集できるようにしたい。これにより、Markdownの構文を意識せずに効率的にテーブルを編集できる。

#### Acceptance Criteria

1. WHEN ユーザーがMarkdownファイルをプレビュー表示する THEN システムは テーブル要素を編集可能な形式で表示する SHALL
2. WHEN ユーザーがテーブルのセルをクリックする THEN システムは そのセルを編集モードに切り替える SHALL
3. WHEN ユーザーがセルの値を変更して確定する THEN システムは 元のMarkdownファイルの対応する箇所を更新する SHALL
4. WHEN ユーザーがセル編集中にEscキーを押す THEN システムは 編集をキャンセルして元の値に戻す SHALL
5. WHEN ユーザーが入力フィールド内をクリックする THEN システムは 編集モードを継続する SHALL (v0.1.7)

### Requirement 2: Table Structure Manipulation

**User Story:** VSCodeユーザーとして、テーブルに新しい行や列を追加できるようにしたい。これにより、テーブルの構造を動的に拡張できる。

#### Acceptance Criteria

1. WHEN ユーザーが行ヘッダーの追加ボタンをクリックする THEN システムは 新しい行をテーブルに追加する SHALL
2. WHEN ユーザーが列ヘッダーの追加ボタンをクリックする THEN システムは 新しい列をテーブルに追加する SHALL
3. WHEN ユーザーが行を削除する THEN システムは 対応する行をテーブルから削除し、Markdownファイルを更新する SHALL
4. WHEN ユーザーが列を削除する THEN システムは 対応する列をテーブルから削除し、Markdownファイルを更新する SHALL

### Requirement 3: Column Sorting

**User Story:** VSCodeユーザーとして、テーブルの列をクリックしてソートできるようにしたい。これにより、データを整理して表示できる。

#### Acceptance Criteria

1. WHEN ユーザーが列ヘッダーをクリックする THEN システムは その列で昇順ソートを実行する SHALL
2. WHEN ユーザーが同じ列ヘッダーを再度クリックする THEN システムは その列で降順ソートを実行する SHALL
3. WHEN ソートが実行される THEN システムは ソート結果をMarkdownファイルに反映する SHALL
4. WHEN ソート中の列がある THEN システムは ソート方向を視覚的に表示する SHALL
5. WHEN ユーザーがリサイズハンドルをクリックする THEN システムは ソートを実行しない SHALL (v0.1.7)

### Requirement 4: Drag and Drop Operations

**User Story:** VSCodeユーザーとして、行や列をドラッグ&ドロップで並び替えできるようにしたい。これにより、テーブルの構造を直感的に調整できる。

#### Acceptance Criteria

1. WHEN ユーザーが行ヘッダーをドラッグする THEN システムは その行を他の位置に移動できるようにする SHALL
2. WHEN ユーザーが列ヘッダーをドラッグする THEN システムは その列を他の位置に移動できるようにする SHALL
3. WHEN ドラッグ中である THEN システムは ドロップ可能な位置を視覚的に示す SHALL
4. WHEN ドラッグ&ドロップが完了する THEN システムは 新しい順序をMarkdownファイルに反映する SHALL

### Requirement 5

**User Story:** VSCodeユーザーとして、編集可能なテーブルがSpreadsheetライクなUIを持つようにしたい。これにより、馴染みのあるインターフェースでテーブルを操作できる。

#### Acceptance Criteria

1. WHEN テーブルが表示される THEN システムは グリッド線、行番号、列ヘッダーを表示する SHALL
2. WHEN テーブルをスクロールする THEN システムは 行番号と列ヘッダーを常に表示し続ける SHALL
3. WHEN ユーザーがキーボードの矢印キーを使用する THEN システムは セル間の移動を可能にする SHALL
4. WHEN ユーザーがTabキーを押す THEN システムは 次のセルに移動する SHALL
5. WHEN ユーザーが未編集時にEnterキーを押す THEN システムは そのセルの編集モードに入る SHALL
6. WHEN ユーザーが編集中にEscキーを押す THEN システムは 変更を確定して編集モードを終了する SHALL
7. WHEN ユーザーが編集中にCtrl+C, Ctrl+V, Ctrl+X等を使用する THEN システムは 標準的なコピー・ペースト・切り取り操作を可能にする SHALL

### Requirement 6

**User Story:** VSCodeユーザーとして、テーブル編集機能がVSCodeの標準的な拡張機能として動作するようにしたい。これにより、既存のワークフローに自然に統合できる。

#### Acceptance Criteria

1. WHEN 拡張機能がインストールされる THEN システムは VSCodeのMarkdownプレビューに統合される SHALL
2. WHEN Markdownファイルが変更される THEN システムは プレビューを自動的に更新する SHALL
3. WHEN 複数のMarkdownファイルが開かれている THEN システムは それぞれのファイルのテーブルを独立して管理する SHALL
4. WHEN VSCodeが再起動される THEN システムは 拡張機能を正常に再読み込みする SHALL

### Requirement 7

**User Story:** VSCodeユーザーとして、Markdownファイルのエディタで右クリックした際に、テーブル編集機能にアクセスできるようにしたい。これにより、コンテキストメニューから簡単に機能を起動できる。

#### Acceptance Criteria

1. WHEN ユーザーがMarkdownファイルのエディタ上で右クリックする THEN システムは コンテキストメニューにテーブル編集オプションを表示する SHALL
2. WHEN ユーザーがコンテキストメニューからテーブル編集を選択する THEN システムは テーブル編集ビューを開く SHALL
3. WHEN カーソルがテーブル内にある THEN システムは そのテーブルを編集対象として選択する SHALL
4. WHEN カーソルがテーブル外にある THEN システムは 新しいテーブルの作成オプションを提供する SHALL

### Requirement 8

**User Story:** VSCodeユーザーとして、複数のテーブルが含まれるMarkdownファイルで、特定のテーブルを選択して編集できるようにしたい。これにより、大きなドキュメントでも効率的にテーブルを管理できる。

#### Acceptance Criteria

1. WHEN ユーザーが複数テーブルを含むファイルでテーブル編集を開始する THEN システムは テーブル選択ダイアログを表示する SHALL
2. WHEN テーブル選択ダイアログが表示される THEN システムは 各テーブルの位置（行番号）、ヘッダー、サイズ、プレビューを表示する SHALL
3. WHEN ユーザーがテーブルを選択する THEN システムは 選択されたテーブルのみを編集対象とする SHALL
4. WHEN テーブルが更新される THEN システムは 他のテーブルや非テーブルコンテンツに影響しない SHALL

### Requirement 9

**User Story:** VSCodeユーザーとして、テーブル、コードブロック、リスト等が混在するMarkdownファイルでも安全にテーブル編集ができるようにしたい。これにより、複雑なドキュメント構造でも正確な編集が可能になる。

#### Acceptance Criteria

1. WHEN ファイルにコードブロック内のテーブル風の文字列がある THEN システムは それを編集対象のテーブルとして認識しない SHALL
2. WHEN ファイルにリスト、引用、見出し等の非テーブル要素がある THEN システムは それらを保持したままテーブルを更新する SHALL
3. WHEN テーブル更新が実行される THEN システムは 正確な行範囲でのみ変更を適用する SHALL
4. WHEN ファイル更新前に THEN システムは 自動的にバックアップを作成する SHALL

### Requirement 10

**User Story:** VSCodeユーザーとして、テーブル編集中にエラーが発生した場合に、適切なエラーメッセージと回復オプションを提供してほしい。これにより、データの損失を防ぎ、問題を迅速に解決できる。

#### Acceptance Criteria

1. WHEN ファイル更新でエラーが発生する THEN システムは 詳細なエラーメッセージを表示する SHALL
2. WHEN エラーが発生する THEN システムは バックアップファイルの存在を通知し、復元オプションを提供する SHALL
3. WHEN 無効なテーブル構造が検出される THEN システムは 警告メッセージと修正提案を表示する SHALL
4. WHEN ファイルアクセス権限の問題がある THEN システムは 別名保存オプションを提供する SHALL

### Requirement 11

**User Story:** VSCodeユーザーとして、ユーザーインターフェースがより洗練され、直感的であることを望む。これにより、より効率的で快適なテーブル編集体験を得られる。

#### Acceptance Criteria

1. WHEN ステータスメッセージやエラーメッセージが表示される THEN システムは それらを画面下部に表示する SHALL
2. WHEN テーブルエディタが表示される THEN システムは 不要なツールバーボタンを削除し、シンプルなUIを提供する SHALL
3. WHEN ユーザーがセルを編集中である THEN 他のセルが選択された場合 編集モードを自動的に終了する SHALL
4. WHEN ユーザーがセル編集中にテキストボックス内をクリックする THEN システムは 適切にカーソル位置を変更し、選択状態を解除する SHALL

### Requirement 12: Excel-like Copy/Paste Operations

**User Story:** VSCodeユーザーとして、Excelと同様のコピー・ペースト操作でセルデータを効率的に編集したい。これにより、馴染みのある操作でテーブルを素早く編集できる。

#### Acceptance Criteria

1. WHEN ユーザーが未編集時にCtrl+Cを押す THEN システムは 選択されたセルの内容をクリップボードにコピーする SHALL
2. WHEN ユーザーが未編集時にCtrl+Vを押す THEN システムは クリップボードの内容を選択されたセルにペーストする SHALL
3. WHEN ユーザーが未編集時にCtrl+Xを押す THEN システムは 選択されたセルの内容を切り取りクリップボードにコピーする SHALL
4. WHEN ユーザーが複数セルを選択してコピーする THEN システムは 選択範囲全体をタブ区切りでクリップボードにコピーする SHALL
5. WHEN ユーザーが複数セルデータをペーストする THEN システムは タブ区切りデータを適切な範囲にペーストする SHALL

### Requirement 13: CSV Export Functionality

**User Story:** VSCodeユーザーとして、テーブルデータをCSV形式でエクスポートして他のアプリケーションで利用したい。これにより、データの再利用性と互換性を向上できる。

#### Acceptance Criteria

1. WHEN ユーザーがCSVエクスポート機能を選択する THEN システムは 現在のテーブルデータをCSV形式で保存する SHALL
2. WHEN CSVエクスポートが実行される THEN システムは ファイル保存ダイアログを表示する SHALL
3. WHEN CSVファイルが保存される THEN システムは ヘッダー行を含む完全なテーブルデータを出力する SHALL
4. WHEN セル内に改行やカンマがある THEN システムは 適切にエスケープ処理を行う SHALL
5. WHEN エクスポートが完了する THEN システムは 成功メッセージと保存場所を表示する SHALL

## Implementation Requirements

### Multi-Table Support
- テーブル位置の正確な追跡（インデックスベース）
- 複数テーブルの同時管理
- テーブル選択UI（QuickPick）の実装

### Mixed Content Compatibility
- マークダウンAST解析による正確なテーブル識別
- 非テーブルコンテンツの保持
- 正確な行範囲計算

### Error Handling & Recovery
- 自動バックアップシステム
- 包括的な入力検証
- ユーザーフレンドリーなエラーメッセージ
- データ復旧機能

### Testing Requirements
- 複数テーブルシナリオのテストカバレッジ
- 混在コンテンツでのテストケース
- エラー条件とエッジケースのテスト
- ファイルシステム操作のテスト