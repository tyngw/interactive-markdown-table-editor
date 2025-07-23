# 長いURL幅制限テスト

このファイルは、長いURLや改行できない文字列がセル幅に与える影響をテストするためのものです。

## 長いURLを含むテーブル

| 名前 | URL | 説明 |
|------|-----|------|
| Google | https://www.google.com | 検索エンジン |
| 非常に長いURL | https://www.example-very-long-domain-name-that-should-not-break-the-table-layout-and-should-wrap-properly-within-the-cell-boundaries.com/path/to/very/long/resource/that/might/cause/width/issues | このURLは改行できない長い文字列の例 |
| GitHub | https://github.com/username/repository-name/blob/main/src/components/VeryLongComponentNameThatMightCauseIssues.tsx | GitHubリポジトリ |
| 通常のサイト | https://example.com | 通常の長さのURL |
| 極端に長い文字列 | ThisIsAnExtremelyLongStringWithoutSpacesOrBreaksThatShouldStillBeContainedWithinTheCellBoundariesAndNotExpandTheColumnWidth | スペースなしの長い文字列 |

## テスト手順

1. VSCodeでこのファイルを開く
2. `Ctrl+Shift+P` → "Markdown Table Editor: Edit Table" を実行
3. 各セルが150pxのデフォルト幅を維持していることを確認
4. 長いURLがセル内で適切に折り返されることを確認
5. カラムリサイズハンドルが正常に動作することを確認
6. リサイズ後も長いコンテンツがセル幅を超えないことを確認

## 期待される動作

- 長いURLや文字列が含まれていても、セル幅は設定値を維持する
- 長いコンテンツはセル内で適切に折り返される
- ユーザーによる幅変更は正常に動作する
- ウィンドウリサイズ時もセル幅が維持される 