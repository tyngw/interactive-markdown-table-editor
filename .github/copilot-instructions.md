
# Markdown Table Editor VSCode 拡張機能

最初に必ずこの指示を参照してください。ここに記載された情報と一致しない予期せぬ情報に遭遇した場合のみ、検索やシェルコマンドにフォールバックしてください。

## 効率的な作業方法

**重要: ビルドやテストコマンドを絶対に中断しないでください。** ビルドは10分以上、テストは15分以上かかることがあります。適切なタイムアウトを設定してください。

### Bootstrap and Build
- 依存関係をインストール: `npm install` -- ネットワーク状況によるが 30〜45 秒かかります
- TypeScript をコンパイルしてファイルをコピー: `npm run compile` -- 5〜10 秒かかります。絶対に中断しないでください。タイムアウトを 60 秒以上に設定してください。
- コードのリンティング: `npm run lint` -- 2〜5 秒かかります。警告が表示されることがありますが、エラーは発生しないはずです
- 拡張機能をパッケージ化: `npx vsce package` -- 8〜15 秒かかります。絶対に中断しないでください。タイムアウトを 60 秒以上に設定してください。

### Development Workflow 
- **FASTEST DEVELOPMENT**: `npm run dev` を使うと HTML/CSS/JS の変更を即座に確認できます
  - サーバ起動: `npm run dev` -- 即時に開始されます
  - ブラウザを開く: `http://localhost:3000/`（`/dev/` ではなく `http://localhost:3000/` を開いてください。`/dev/` は 404 を返します）
  - `webview/` フォルダ内のファイルを編集し、ブラウザをリロードして変更を確認します
  - 代替: ファイル監視付きでの開発は `npm run dev:watch`
- **VSCode 拡張機能の開発**: VSCode 上で F5 を押して Extension Development Host を起動します
  - VSCode が起動している必要があります
  - 反復サイクルは遅くなりますが、実際の VSCode 統合をテストできます

### Testing
**注記: 標準的なテストコマンドは、この環境では VSCode のダウンロード制限により失敗します**
- ユニットテスト: `npm test` -- VSCode のテスト環境要件により失敗します
- 統合テスト: `npm run test:integration` -- ネットワーク制限のため失敗します  
- **動作確認できるテスト**:
  - Interface demo: `node test/interface-demo.js` -- テスト基盤を検証します
  - Core module verification: `node verify-core-module.js` -- モジュールシステムをチェックします

## Validation

**必ず開発サーバーを使って手動で変更を検証してください:**

1. **開発サーバーを起動**: `npm run dev`
2. **ブラウザを開く**: `http://localhost:3000/` にアクセス
3. **基本機能のテスト**:
  - 「Load Sample」ボタンをクリックしてテストデータを読み込む
  - テーブルが 3 行 3 列でレンダリングされることを確認する
  - セルをクリックして編集機能をテストする
  - 行/列操作（行番号の右クリック、列ヘッダーの右クリック）をテストする
  - 列ヘッダーをクリックしてソートをテストする
  - CSV エクスポート機能をテストする
4. **開発用コントロールのテスト**:
  - 「Sample Data」ドロップダウンで異なるテーブルタイプを試す
  - 「Debug State」をクリックしてコンソール出力を確認する
  - コンソールにエラーや警告が出ていないか監視する

**検証シナリオ**: 変更を加えたら必ず以下のユーザーフローをテストしてください:
- **テーブル読み込み**: サンプルデータを読み込み、正しくレンダリングされることを確認
- **セル編集**: セルをクリックし、新しい内容を入力して Enter で確定
- **行操作**: 行番号を右クリックして行の追加/削除を試す
- **列操作**: 列ヘッダーを右クリックして列の追加/削除を試す  
- **ソート**: 列ヘッダーをクリックしてソートされることを確認
- **エクスポート**: 「Export CSV」をクリックしてダウンロードが動作することを確認

### Code Quality
- Always run `npm run lint` before committing changes
- Fix any new linting errors (warnings are acceptable)
- The codebase has 17 existing linting warnings - do not worry about these unless you're editing the affected files

## Common Tasks

### Repository Structure
```
├── .github/                  # GitHub の設定（現在このファイルがある場所）
├── .vscode/                  # VSCode の設定と起動構成
├── dev/                      # 開発サーバー用ファイル
│   ├── start-dev-server.js   # 開発サーバー起動スクリプト
│   └── index.html            # 開発用ページのテンプレート
├── out/                      # コンパイル出力（`npm run compile` によって生成）
├── src/                      # TypeScript のソースコード
│   ├── extension.ts          # メインの拡張機能エントリポイント
│   ├── webviewManager.ts     # Webview の管理
│   ├── tableDataManager.ts   # テーブルデータの処理
│   └── ...                   # その他の TypeScript モジュール
├── test/                     # テストファイルとモック
├── webview/                  # フロントエンド（HTML/CSS/JS）
│   ├── tableEditor.html      # テーブルエディタのメイン HTML
  │   ├── style.css             # Styles
│   └── js/                   # JavaScript モジュール
├── package.json              # NPM の設定とスクリプト
└── tsconfig.json             # TypeScript の設定
```

### Key Files to Know
- **package.json**: すべての npm スクリプトと依存関係を含みます
- **src/extension.ts**: VSCode 拡張機能のメインエントリポイント
- **src/webviewManager.ts**: webview のライフサイクルと通信を管理します
- **webview/tableEditor.html**: テーブル編集 UI のメインファイル
- **webview/js/core.js**: テーブルエディタのコアモジュールシステム
- **DEVELOPMENT.md**: 開発セットアップの簡易ガイド
- **README.md**: 開発セクションを含むユーザー向けドキュメント

### NPM Scripts Reference
```bash
npm run compile        # Compile TS + copy webview files (5-10s)
npm run watch          # Watch mode for development 
npm run lint           # Run ESLint (2-5s)
npm run dev            # Start development server (instant)
npm run dev:watch      # Development server with file watching
npm test               # Run unit tests (FAILS in this environment)
npm run test:integration  # Integration tests (FAILS in this environment)
npm run vscode:prepublish # Pre-publish build step
```

### Development Tips
- **Edit HTML/CSS/JS**: `npm run dev` を使いブラウザをリロードすると最速で反映されます
- **Edit TypeScript**: VSCode 拡張機能に変更を反映するには `npm run compile` を実行する必要があります
- **Debugging**: 開発サーバーでのテスト時はブラウザの DevTools を使用してください
- **Module System**: このコードベースはカスタムのモジュールアーキテクチャを使用しています - 詳細は `webview/js/core.js` を参照してください
- **Error Handling**: 詳細なエラーメッセージやログはブラウザコンソールを確認してください

### Build Timing Expectations
- **npm install**: 30-45 秒 (ネットワーク依存) - 絶対に中断しないでください
- **npm run compile**: 5-10 秒 - 絶対に中断しないでください  
- **npm run lint**: 2-5 秒
- **npx vsce package**: 8-15 秒 - 絶対に中断しないでください
- **npm run dev**: 即時で起動します

### Known Issues and Workarounds
- VSCode のテスト環境はこのサンドボックス環境ではダウンロードできません
- 総合的なテストには開発サーバー（`npm run dev`）を使用してください
- Lint は 17 件の警告を表示しますが、エラーはありません — これは通常の状態です
- 開発サーバーはルートを `http://localhost:3000/` で提供します。`/dev/` ではありません

### When Things Go Wrong
1. **Compilation Errors**: `src/` 内の TypeScript 構文を確認してください
2. **Runtime Errors**: 開発サーバーでテストし、ブラウザコンソールを確認してください
3. **Module Issues**: モジュールシステムをチェックするには `node verify-core-module.js` を実行してください
4. **Build Failures**: 依存関係がインストールされていることを `npm install` で確認してください

開発環境で変更が正常に動作することを必ず確認してから、VSCode 拡張機能のテストを進めてください。