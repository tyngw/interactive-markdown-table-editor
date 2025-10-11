# Repository Guidelines

## エージェントの応答方針
- 本リポジトリに関する会話は常に日本語で簡潔に応答してください。
- 実施したタスクの内容をこまめに報告してください

## プロジェクト構造とモジュール配置
- `src/` にはアクティベーション処理（`extension.ts`）、各種マネージャ、ユーティリティがあり、VS Code API と整合するフレームワークレスな TypeScript を維持します。
- `webview-react/` は React 製のフロントエンドで、ビルド成果物は `webview-dist/` に生成され、`npm run compile` が `out/webview/` へコピーします。
- `test/` は統合テスト補助、ブラウザ相当の `e2e/`, 再利用フィクスチャを持つ `mock/` に分かれます。単体のプレビューサーバーは `dev/start-dev-server.js` が担当します。

## ビルド・テスト・開発コマンド
- `npm run compile` は TypeScript をトランスパイルし、`out/src/mock/` を最新フィクスチャで更新します。テストやパッケージング前に必ず実行してください。
- `npm run dev` は `webview-react/` を `http://localhost:3000/dev/` に配信し、VSIX を作らず UI を反復改善できます。
- `npm test` は Electron ベースの VS Code テストランナーを起動し、コンパイル済みソースを検証します（エントリは `out/src/test/runTest.js`）。
- `npm run test:integration` は再コンパイル後に `out/test/runIntegrationTests.js` を使って上位シナリオを実行します。
- `npm run lint` でコミット前に ESLint ルールを適用します。

## コーディングスタイルと命名規約
- `src/extension.ts` に合わせて 4 スペースインデントとセミコロンを使用し、インポートはモジュールパス順で整理します。
- クラスは PascalCase（例: `WebviewManager`）、関数・変数は camelCase とし、ファイル名は公開する型に揃えます。
- `.eslintrc.json` に定義された `npm run lint` での波括弧必須や厳密等価などのチェックを遵守してください。

## コードスタイルと制約
- 1 ファイルは 300 行以内を目安にし、各モジュールは単一責務で構成してください。
- 各ファイル冒頭に「どこで」「何を」「なぜ」を簡潔に説明するコメントヘッダーを付け、不可解な処理には明快なコメントを追加してください。
- コメントは少なめより多めを意識し、背景・前提・トレードオフまで残してください。
- ランタイム設定値は専用の設定モジュール（例: `src/config.ts` や `webview-react/src/config.ts` を新設）に集約し、コードやテストにマジックナンバーを含めないでください。依存の初期化時は設定から既定値を読み込んでください。
- シンプルさを最優先し、要求された機能だけを正確に実装してください。

## テストガイドライン
- ヘッドレスの新規テストは `test/integration/` へ、エンドツーエンドフローは `test/e2e/` へ追加し、ファイル名は `*.test.ts` に統一します。
- `npm run compile` 実行後に `npm test` を走らせ、`out/src/mock/` の生成物が最新であることを担保します。
- テーブル解析や undo/redo を変更する際は `test/comprehensive-test.js` や Playwright 風ワークフローに回帰テストを追記し、必要な手動手順は対応する `test-*.md` に記録します。

## コミットとプルリクエストの指針
- 件名は Conventional Commits（`feat:`, `fix:`, `docs:` 等）に従い 72 文字以内でまとめ、必要に応じて本文で詳細や破壊的変更を補足します。
- 実行したコマンド（例: ``npm run test:all``）を記載し、UI 変更はスクリーンショットや GIF を添付します。
- ビルド成果物（`out/`, `webview-dist/`）はコミットに含めず、ユーザーに影響がある場合は `CHANGELOG.md` を更新してください。

## versionとCHANGELOG の更新
変更後は、versionを更新する。ただし、例外として修正不備により修正が複数回に及んだ場合は、最初の修正時のみ version を更新し、以降の修正では更新しないこと
version の更新ルールは以下の通り。
また、CHANGELOG.md に変更内容を日本語で記載すること。最新の変更が一番上に来るようにすること

1. bugfix: x.x.x → x.x.x+1
2. minor: x.x.x → x.x+1.0
3. major: x.x.x → x+1.0.0

## Webview 開発のヒント
- デバッグ中は `npm run compile` 前に `MTE_KEEP_CONSOLE=1` を設定してビルド後も詳細ログを残します。
- 開発サーバーの Debug State パネルとブラウザ DevTools でテーブル状態を確認し、本体拡張へ反映する前に挙動を固めてください。
