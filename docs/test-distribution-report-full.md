# テスト分布レポート（フル）

作成日: 2026-01-11

概要:
- リポジトリ内のテスト関連ファイルの分布を調査しました。
- 主に次の領域に分かれています: `webview-react/src/__tests__`, `src/test`, ルートの `test/`。

1) `webview-react/src/__tests__/`（Webview フロントエンドのユニットテスト）
- ファイル一覧（18件）:
  - webview-react/src/__tests__/CellEditorClipboard.test.tsx
  - webview-react/src/__tests__/hooks/useClipboard.test.ts
  - webview-react/src/__tests__/hooks/useCSVExport.test.ts
  - webview-react/src/__tests__/hooks/useTableEditor.test.ts
  - webview-react/src/__tests__/hooks/useCommunication.test.ts
  - webview-react/src/__tests__/hooks/useTableEditor.simple.test.ts
  - webview-react/src/__tests__/autofillPatterns.test.ts
  - webview-react/src/__tests__/DragDrop.test.tsx
  - webview-react/src/__tests__/TableBody.gitdiff.test.tsx
  - webview-react/src/__tests__/cssVariables.test.ts
  - webview-react/src/__tests__/EditModeTextboxDynamicHeight.test.tsx
  - webview-react/src/__tests__/ContextMenu.test.tsx
  - webview-react/src/__tests__/DragDrop.simple.test.tsx
  - webview-react/src/__tests__/EditModeTextboxSize.test.tsx
  - webview-react/src/__tests__/ContextMenu.importCSV.test.tsx
  - webview-react/src/__tests__/TableEditor.test.tsx
  - webview-react/src/__tests__/utils/contentConverter.test.ts
  - webview-react/src/__tests__/communication/WebviewCommunicationManager.test.ts

2) `src/test/`（拡張機能側のユニット／統合テスト群）
- 主要ファイル（15件、`src/test/suite/` にまとまっている）:
  - src/test/runTest.ts
  - src/test/suite/fileHandler.test.ts
  - src/test/suite/csp-webview.test.ts
  - src/test/suite/index.ts
  - src/test/suite/csv-export-interface.test.ts
  - src/test/suite/tableDataManager.test.ts
  - src/test/suite/markdownParser.test.ts
  - src/test/suite/protocol-validators.test.ts
  - src/test/suite/csv-exporter-webview.test.ts
  - src/test/suite/coreModule.test.ts
  - src/test/suite/webview-extension-interface.test.ts
  - src/test/suite/webview-interface-mock.test.ts
  - src/test/suite/webviewManager.test.ts
  - src/test/suite/uiux.test.ts
  - src/test/suite/columnDiff.test.ts

3) ルートの `test/`（補助スクリプト・集約テスト・統合テスト）
- 代表的なファイル:
  - test/gitDiffUtils.test.ts
  - test/INTERFACE_TESTS.md
  - test/runIntegrationTests.ts
  - test/interface-demo.js
  - test/comprehensive-test.js
  - test/runIntegrationTests.js
  - test/integration/*.ts (統合テスト群が含まれる)
  - test/e2e/* (E2E ワークフローとスクリプト)

---

## 全テストファイル一覧

以下はワークスペース内で検出した `.test.` / `.e2e.` / `.integration.` / `__tests__` に該当するファイルの一覧です。

- src/test/suite/fileHandler.test.ts
- src/test/suite/csp-webview.test.ts
- src/test/suite/csv-export-interface.test.ts
- src/test/suite/tableDataManager.test.ts
- src/test/suite/markdownParser.test.ts
- src/test/suite/protocol-validators.test.ts
- src/test/suite/csv-exporter-webview.test.ts
- src/test/suite/coreModule.test.ts
- src/test/suite/webview-extension-interface.test.ts
- src/test/suite/webview-interface-mock.test.ts
- src/test/suite/webviewManager.test.ts
- src/test/suite/uiux.test.ts
- test/gitDiffUtils.test.ts
- test/e2e/workflow.e2e.test.js
- test/e2e/workflow.e2e.test.ts
- test/integration/webview-extension-interface.integration.test.ts
- test/integration/extension.integration.test.ts
- test/integration/extension.integration.test.js
- test/integration/csv-export.integration.test.ts
- webview-react/src/__tests__/communication/WebviewCommunicationManager.test.ts
- webview-react/src/__tests__/CellEditorClipboard.test.tsx
- webview-react/src/__tests__/hooks/useClipboard.test.ts
- webview-react/src/__tests__/hooks/useCSVExport.test.ts
- webview-react/src/__tests__/hooks/useTableEditor.test.ts
- webview-react/src/__tests__/hooks/useCommunication.test.ts
- webview-react/src/__tests__/hooks/useTableEditor.simple.test.ts
- webview-react/src/__tests__/autofillPatterns.test.ts
- webview-react/src/__tests__/DragDrop.test.tsx
- webview-react/src/__tests__/cssVariables.test.ts
- webview-react/src/__tests__/utils/contentConverter.test.ts
- webview-react/src/__tests__/EditModeTextboxDynamicHeight.test.tsx
- webview-react/src/__tests__/ContextMenu.test.tsx
- webview-react/src/__tests__/DragDrop.simple.test.tsx
- webview-react/src/__tests__/EditModeTextboxSize.test.tsx
- webview-react/src/__tests__/ContextMenu.importCSV.test.tsx
- webview-react/src/__tests__/TableEditor.test.tsx

---

レポート生成者: 自動調査スクリプト
