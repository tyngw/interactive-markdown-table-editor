# パブリッシュガイド

VS Code 拡張機能 「Interactive Markdown Table Editor」をバージョンアップして、Visual Studio Marketplace と OpenVSX にアップロードするまでの手順をまとめています。

## 前提条件

- Node.js 14 以上がインストールされていること
- `vsce`（Visual Studio Code Extension CLI）がインストールされていること
  ```bash
  npm install -g vsce
  ```
- `ovsx`（OpenVSX CLI）がインストールされていること
  ```bash
  npm install -g ovsx
  ```
- Visual Studio Marketplace の公開者アカウント（PAT: Personal Access Token）を取得していること
- OpenVSX の公開者アカウント（API Token）を取得していること
- GitHub のアカウントを持っていること

## ステップ 1: リリース用ブランチの作成と準備

```bash
# ブランチを作成
git checkout -b tyngw/bump-version-to-X.X.X

# package.json のバージョン番号を更新
# （例：1.3.1 → 1.3.2）
```

## ステップ 2: CHANGELOG.md を更新

`CHANGELOG.md` の最上部に新バージョンセクションを追加し、変更内容を日本語で記載します。

```markdown
## X.X.X
- 新機能
  - xxxxxx
- 改善
  - xxxxxx
- バグ修正
  - xxxxxx
```

**重要な記録事項：**
- `npm run compile` を実行してビルド成果物が最新であることを確認
- `npm test` でテストがすべて成功することを確認
- テストカバレッジが 100% を維持していることを確認

## ステップ 3: ローカルでテストとビルドを実行

```bash
# 依存関係をインストール
npm install

# TypeScript をコンパイル
npm run compile

# ユニットテスト＋カバレッジ計測を実行
npm test

# 統合テストを実行
npm run test:integration

# ESLint でコード品質をチェック
npm run lint
```

**すべてのテストが成功し、カバレッジが 100% であることを確認してください。**

## ステップ 4: ブランチをコミット＋プッシュ

```bash
# ファイルをステージング
git add package.json CHANGELOG.md

# コミットを作成
git commit -m "chore: bump version to X.X.X

- CHANGELOG.md にバージョン X.X.X の変更内容を記載
- package.json を更新"

# ブランチをプッシュ
git push origin tyngw/bump-version-to-X.X.X
```

## ステップ 5: GitHub で Pull Request を作成

1. GitHub リポジトリにアクセス
2. 「Compare & pull request」ボタンをクリック
3. PR のタイトルと説明を記入
   - タイトル例：`chore: bump version to X.X.X and update CHANGELOG`
   - 説明に変更内容の要約を記載
4. レビュアーを指定および/またはセルフレビューを実施
5. 「Squash and merge」で main ブランチにマージ

## ステップ 6: Git タグを作成

```bash
# main ブランチに切り替え
git checkout main

# 最新の変更を取得
git pull origin main

# バージョンタグを作成（アノテーション付き）
git tag -a vX.X.X -m "Release version X.X.X"

# タグをプッシュ
git push origin vX.X.X
```

## ステップ 7: VSIX ファイルをパッケージング

```bash
# VSIX ファイルを生成（package.json の version に基づいて命名される）
vsce package

# 生成されたファイルを確認
ls -lh *.vsix
```

例：
```
interactive-markdown-table-editor-1.3.2.vsix
```

### VSIX ファイルの検証（オプション）

```bash
# VSIX ファイルの内容を確認
unzip -l interactive-markdown-table-editor-X.X.X.vsix | head -20

# または VS Code でローカルインストールしてテスト
code --install-extension interactive-markdown-table-editor-X.X.X.vsix
```

## ステップ 8: Visual Studio Marketplace にパブリッシュ

### 認証トークンの設定

事前に Azure DevOps Organization の Personal Access Token（PAT）を取得しておきます。
[此処から取得可能](https://dev.azure.com/_usersSettings/tokens)

```bash
# 対話的にトークンを入力してログイン
vsce login tyngw

# プロンプトで PAT を貼り付け
```

### パブリッシュ実行

```bash
# Marketplace にパブリッシュ
vsce publish

# または VSIX ファイルから直接パブリッシュ
vsce publish -i interactive-markdown-table-editor-X.X.X.vsix
```

**成功時の出力例：**
```
Publishing tyngw.interactive-markdown-table-editor v1.3.2...
 DONE  Published to https://marketplace.visualstudio.com/...
```

## ステップ 9: OpenVSX にパブリッシュ

### 認証の設定

事前に OpenVSX Publisher Platform から API Token を取得しておきます。
[此処から取得可能](https://open-vsx.org/user-settings/tokens)

```bash
# オプション 1: 環境変数で指定
export OVSX_PAT=your_api_token_here

# オプション 2: コマンドラインで指定（下記のステップで実行）
```

### パブリッシュ実行

```bash
# OpenVSX にパブリッシュ
ovsx publish interactive-markdown-table-editor-X.X.X.vsix -p your_api_token_here

# または環境変数を使用
ovsx publish interactive-markdown-table-editor-X.X.X.vsix
```

**成功時の出力例：**
```
Publishing tyngw.interactive-markdown-table-editor v1.3.2 to https://open-vsx.org ...
 DONE  Published successfully.
```

## ステップ 10: GitHub Releases を作成（オプション）

```bash
# GitHub CLI を使用（推奨）
gh release create vX.X.X --title "Release X.X.X" --notes "$(cat CHANGELOG.md | sed -n '/^## X.X.X/,/^## [0-9]/p' | head -n -1)"

# または Web UI から手動作成
# 1. GitHub リポジトリ → Releases
# 2. "Create a new release" をクリック
# 3. タグを選択（vX.X.X）
# 4. タイトルと説明を入力
# 5. VSIX ファイルをアップロード
# 6. "Publish release" をクリック
```

## ステップ 11: パブリッシュの確認

### Visual Studio Marketplace での確認

1. [Extensions: Interactive Markdown Table Editor](https://marketplace.visualstudio.com/items?itemName=tyngw.interactive-markdown-table-editor)
2. バージョンが正しく表示されているか確認
3. インストール数や評価を確認

### OpenVSX での確認

1. [OpenVSX: Interactive Markdown Table Editor](https://open-vsx.org/extension/tyngw/interactive-markdown-table-editor)
2. バージョンが正しく表示されているか確認

### VS Code での確認

```bash
# 拡張機能をアンインストール
code --uninstall-extension tyngw.interactive-markdown-table-editor

# Marketplace から再インストール
code --install-extension tyngw.interactive-markdown-table-editor
```

## トラブルシューティング

### VSCE でログインしたトークンを忘れた場合

```bash
# ログアウト
vsce logout tyngw

# 再度ログイン
vsce login tyngw
```

### VSIX ファイルが生成されない

```bash
# 以下を確認
1. npm が最新バージョンであること
2. package.json が正しいこと（version フィールドが存在）
3. .vscodeignore ファイルが正しく設定されていること

# デバッグ出力
vsce package --verbose
```

### OpenVSX でパブリッシュ失敗時

```bash
# API Token の有効性確認
curl -H "Authorization: Bearer <API_TOKEN>" https://open-vsx.org/api/user

# VSIX ファイルの検証
unzip -t interactive-markdown-table-editor-X.X.X.vsix
```

## 参考資料

- [vsce（Visual Studio Code Extension CLI）- npm](https://www.npmjs.com/package/vsce)
- [ovsx（OpenVSX CLI）- npm](https://www.npmjs.com/package/ovsx)
- [Publishing Extensions - VS Code 公式ドキュメント](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Open VSX Registry - Documentation](https://github.com/EclipseFoundation/open-vsx/wiki)

## チェックリスト

各ステップの実施を確認するためのチェックリスト：

- [ ] ブランチを作成（`tyngw/bump-version-to-X.X.X`）
- [ ] `package.json` のバージョンを更新
- [ ] `CHANGELOG.md` に変更内容を記載
- [ ] `npm run compile` でビルド実行
- [ ] `npm test` でテスト全て成功・カバレッジ 100% 確認
- [ ] `npm run test:integration` で統合テスト成功
- [ ] `npm run lint` で ESLint パス
- [ ] PR を作成してレビュー＆マージ
- [ ] Git タグを作成＆プッシュ（vX.X.X）
- [ ] VSIX ファイルを生成
- [ ] Visual Studio Marketplace にパブリッシュ
- [ ] OpenVSX にパブリッシュ
- [ ] GitHub Releases を作成
- [ ] Marketplace・OpenVSX での表示を確認
- [ ] VS Code で新バージョンをインストール＆動作確認

