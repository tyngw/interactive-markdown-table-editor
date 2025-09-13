
# Markdown Table Editor VSCode 拡張機能

##　基本原則
- 応答は日本語で親しみやすい口調で行なってください
- タスクを指示された場合は、はじめにタスクの概要を簡潔に述べてください
- 複雑な問題は、小さなステップに分割して進めてください
- 原因が特定できていないまま推測で修正してはいけません。問題の根本原因を特定し、修正内容がその原因に対処していることを確認してください

## パッケージ化の手順
挙動に変更を加えた場合は、次のコマンドを実行してください。
1. `vsce package`
2. `code --uninstall extension tyngw.markdown-table-editor`
3. `code --install-extension markdown-table-editor-<version>.vsix`