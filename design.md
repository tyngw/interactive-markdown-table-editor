# Design Document

## Overview

VSCode拡張機能「Markdown Table Editor」は、Markdownファイル内のテーブルをSpreadsheetライクなUIで編集できる機能を提供します。この拡張機能は、VSCodeのWebview APIを使用してカスタムエディタを実装し、Markdownファイルの解析・更新を行います。

## Architecture

### High-Level Architecture

```mermaid
graph TB
    A[VSCode Extension Host] --> B[Extension Main Process]
    B --> C[Webview Panel]
    B --> D[Enhanced Markdown Parser]
    B --> E[Enhanced File System Handler]
    B --> F[Table Selection Manager]
    C --> G[Table Editor UI]
    G --> H[Grid Component]
    G --> I[Context Menu]
    G --> J[Drag & Drop Handler]
    D --> K[Multi-AST Parser]
    D --> L[Table Position Tracker]
    D --> M[Mixed Content Handler]
    E --> N[Index-Based Updater]
    E --> O[Backup Manager]
    F --> P[Table Selection Dialog]
```

### Component Architecture

1. **Extension Host Layer**
   - VSCode拡張機能のエントリーポイント
   - コマンドの登録とイベントハンドリング

2. **Core Logic Layer**
   - Markdownファイルの解析と更新
   - テーブルデータの管理

3. **UI Layer**
   - Webviewベースのテーブルエディタ
   - Spreadsheetライクなインタラクション

## Components and Interfaces

### 1. Extension Main (`extension.ts`)

```typescript
interface ExtensionContext {
  activate(context: vscode.ExtensionContext): void;
  deactivate(): void;
}

interface CommandHandler {
  openTableEditor(uri: vscode.Uri, position?: vscode.Position): void;
  createNewTable(uri: vscode.Uri, position: vscode.Position): void;
}
```

**責任:**
- 拡張機能の初期化
- コマンドとコンテキストメニューの登録
- Webviewパネルの管理

### 2. Enhanced Extension Main (`extension.ts`)

```typescript
interface EnhancedCommandHandler {
  openTableEditor(uri: vscode.Uri, position?: vscode.Position): void;
  createNewTable(uri: vscode.Uri, position: vscode.Position): void;
  showTableSelectionDialog(tables: TableNode[]): Promise<TableNode | null>;
}

interface TableSelectionItem {
  label: string;
  description: string;
  detail: string;
  table: TableNode;
  index: number;
}
```

### 3. Markdown Parser (`markdownParser.ts`)

```typescript
interface MarkdownParser {
  parseDocument(content: string): MarkdownAST;
  findTablesInDocument(ast: MarkdownAST): TableNode[];
  findTableAtPosition(ast: MarkdownAST, position: Position): TableNode | null;
}

interface TableNode {
  startLine: number;
  endLine: number;
  headers: string[];
  rows: string[][];
  alignment: ('left' | 'center' | 'right')[];
}
```

**責任:**
- Markdownファイルの構文解析
- テーブル要素の抽出と位置特定
- ASTからテーブルデータへの変換

### 4. Enhanced Markdown Parser (`markdownParser.ts`)

```typescript
interface EnhancedMarkdownParser {
  parseDocument(content: string): MarkdownAST;
  findTablesInDocument(ast: MarkdownAST): TableNode[];
  findTableAtPosition(ast: MarkdownAST, position: Position): TableNode | null;
  extractTablePositionsFromTokens(tokens: any[], content: string): TablePosition[];
  validateMixedContent(content: string): ValidationResult;
}

interface TablePosition {
  startLine: number;
  endLine: number;
  tableIndex: number;
}

interface ValidationResult {
  isValid: boolean;
  tables: number;
  codeBlocks: number;
  issues: string[];
}
```

### 5. Table Data Manager (`tableDataManager.ts`)

```typescript
interface TableDataManager {
  loadTable(tableNode: TableNode): TableData;
  updateCell(row: number, col: number, value: string): void;
  addRow(index?: number): void;
  deleteRow(index: number): void;
  addColumn(index?: number, header?: string): void;
  deleteColumn(index: number): void;
  sortByColumn(columnIndex: number, direction: 'asc' | 'desc'): void;
  moveRow(fromIndex: number, toIndex: number): void;
  moveColumn(fromIndex: number, toIndex: number): void;
  serializeToMarkdown(): string;
}

interface TableData {
  headers: string[];
  rows: string[][];
  alignment: ('left' | 'center' | 'right')[];
}
```

**責任:**
- テーブルデータの状態管理
- CRUD操作の実装
- ソートと並び替え機能
- Markdown形式への変換

### 6. Enhanced Table Data Manager (`tableDataManager.ts`)

```typescript
interface EnhancedTableDataManager {
  constructor(tableNode: TableNode, sourceUri: string, tableIndex: number);
  loadTable(tableNode: TableNode, sourceUri: string, tableIndex: number): TableData;
  getTableIndex(): number;
  updateCell(row: number, col: number, value: string): void;
  // ... existing methods ...
}

interface EnhancedTableData {
  id: string;
  headers: string[];
  rows: string[][];
  alignment: ('left' | 'center' | 'right')[];
  metadata: EnhancedTableMetadata;
}

interface EnhancedTableMetadata {
  sourceUri: string;
  startLine: number;
  endLine: number;
  tableIndex: number;  // New: Index of table in document
  lastModified: Date;
  columnCount: number;
  rowCount: number;
  isValid: boolean;
  validationIssues: string[];
}
```

### 7. Webview Panel Manager (`webviewManager.ts`)

```typescript
interface WebviewManager {
  createTableEditorPanel(tableData: TableData, uri: vscode.Uri): vscode.WebviewPanel;
  updateTableData(panel: vscode.WebviewPanel, tableData: TableData): void;
  handleMessage(message: WebviewMessage): void;
}

interface WebviewMessage {
  command: 'updateCell' | 'addRow' | 'deleteRow' | 'addColumn' | 'deleteColumn' | 'sort' | 'move';
  data: any;
}
```

**責任:**
- Webviewパネルの作成と管理
- UIとの双方向通信
- メッセージハンドリング

### 8. Table Editor UI (`webview/tableEditor.html` + `webview/tableEditor.js`)

```typescript
interface TableEditorUI {
  renderTable(tableData: TableData): void;
  enableCellEditing(): void;
  setupDragAndDrop(): void;
  setupSorting(): void;
  setupContextMenu(): void;
}

interface CellEditor {
  startEdit(cell: HTMLElement): void;
  commitEdit(): void;
  cancelEdit(): void;
}
```

**責任:**
- テーブルのレンダリング
- セル編集機能
- ドラッグ&ドロップ操作
- ソート機能のUI
- コンテキストメニュー

### 9. File System Handler (`fileHandler.ts`)

```typescript
interface FileHandler {
  readMarkdownFile(uri: vscode.Uri): Promise<string>;
  writeMarkdownFile(uri: vscode.Uri, content: string): Promise<void>;
  updateTableInFile(uri: vscode.Uri, tableNode: TableNode, newContent: string): Promise<void>;
}
```

**責任:**
- ファイルの読み書き
- テーブル部分の置換
- ファイル変更の通知

### 10. Enhanced File Handler (`fileHandler.ts`)

```typescript
interface EnhancedFileHandler {
  readMarkdownFile(uri: vscode.Uri): Promise<string>;
  writeMarkdownFile(uri: vscode.Uri, content: string): Promise<void>;
  updateTableInFile(uri: vscode.Uri, startLine: number, endLine: number, newTableContent: string): Promise<void>;
  updateTableByIndex(uri: vscode.Uri, tableIndex: number, newTableContent: string): Promise<void>;  // New
  updateMultipleTablesInFile(uri: vscode.Uri, updates: TableUpdate[]): Promise<void>;
  createBackup(uri: vscode.Uri): Promise<string>;
  extractTablePositionsFromTokens(tokens: any[], content: string): TablePosition[];  // New
}

interface TableUpdate {
  tableIndex: number;
  startLine: number;
  endLine: number;
  newContent: string;
}
```

### 11. Table Selection Manager (New Component)

```typescript
interface TableSelectionManager {
  showSelectionDialog(tables: TableNode[]): Promise<TableSelectionResult>;
  formatTablePreview(table: TableNode): string;
  createSelectionItems(tables: TableNode[]): TableSelectionItem[];
}

interface TableSelectionResult {
  selectedTable: TableNode;
  selectedIndex: number;
  cancelled: boolean;
}
```

## Data Models

### TableData Model

```typescript
interface TableData {
  id: string;
  headers: string[];
  rows: string[][];
  alignment: ColumnAlignment[];
  metadata: TableMetadata;
}

interface ColumnAlignment {
  type: 'left' | 'center' | 'right';
}

interface TableMetadata {
  sourceUri: string;
  startLine: number;
  endLine: number;
  lastModified: Date;
}
```

### WebviewMessage Model

```typescript
type WebviewMessage = 
  | { command: 'updateCell'; data: { row: number; col: number; value: string } }
  | { command: 'addRow'; data: { index?: number } }
  | { command: 'deleteRow'; data: { index: number } }
  | { command: 'addColumn'; data: { index?: number; header?: string } }
  | { command: 'deleteColumn'; data: { index: number } }
  | { command: 'sort'; data: { column: number; direction: 'asc' | 'desc' } }
  | { command: 'moveRow'; data: { from: number; to: number } }
  | { command: 'moveColumn'; data: { from: number; to: number } };
```

## Error Handling

### 1. File System Errors

- **ファイル読み込みエラー**: ユーザーに通知し、再試行オプションを提供
- **ファイル書き込みエラー**: 変更を一時保存し、手動保存を促す
- **権限エラー**: 適切なエラーメッセージを表示

### 2. Parsing Errors

- **不正なMarkdown**: エラー位置を特定し、修正提案を表示
- **テーブル構造エラー**: 自動修正機能を提供
- **文字エンコーディングエラー**: UTF-8での再読み込みを試行

### 3. UI Errors

- **Webview通信エラー**: 接続の再確立を試行
- **レンダリングエラー**: フォールバック表示を提供
- **操作競合**: 楽観的ロックによる競合解決

### Error Recovery Strategy

```typescript
interface ErrorHandler {
  handleFileSystemError(error: FileSystemError): Promise<void>;
  handleParsingError(error: ParsingError): Promise<void>;
  handleUIError(error: UIError): Promise<void>;
  showErrorNotification(message: string, actions?: string[]): void;
}
```

## Testing Strategy

### 1. Unit Tests

- **Markdown Parser**: 各種テーブル形式の解析テスト
- **Table Data Manager**: CRUD操作とデータ変換のテスト
- **File Handler**: ファイル操作のモックテスト

### 2. Integration Tests

- **Extension Activation**: 拡張機能の初期化テスト
- **Webview Communication**: メッセージ送受信のテスト
- **File System Integration**: 実際のファイル操作テスト

### 3. E2E Tests

- **Table Editing Workflow**: 完全な編集フローのテスト
- **Multiple Files**: 複数ファイル同時編集のテスト
- **Error Scenarios**: エラー処理のテスト

### Test Structure

```typescript
// Unit Test Example
describe('TableDataManager', () => {
  describe('updateCell', () => {
    it('should update cell value correctly', () => {
      // テスト実装
    });
  });
});

// Integration Test Example
describe('Extension Integration', () => {
  it('should open table editor from context menu', async () => {
    // テスト実装
  });
});
```

### Test Data

- **Sample Markdown Files**: 様々なテーブル形式のサンプル
- **Edge Cases**: 空のテーブル、不正な形式、特殊文字
- **Performance Tests**: 大きなテーブルでの性能テスト

## Implementation Notes

### VSCode Extension Structure

```
markdown-table-editor/
├── package.json
├── src/
│   ├── extension.ts
│   ├── markdownParser.ts
│   ├── tableDataManager.ts
│   ├── webviewManager.ts
│   └── fileHandler.ts
├── webview/
│   ├── tableEditor.html
│   ├── tableEditor.js
│   └── tableEditor.css
└── test/
    ├── unit/
    └── integration/
```

### Key Dependencies

- **@types/vscode**: VSCode API型定義
- **markdown-it**: Markdown解析
- **sortablejs**: ドラッグ&ドロップ機能
- **mocha**: テストフレームワーク

### Performance Considerations

- **Large Tables**: 仮想スクロールによる最適化
- **File Watching**: 効率的なファイル変更監視
- **Memory Management**: Webviewの適切な破棄

## Multi-Table Support

### Enhanced Architecture for Multi-Table Support

```mermaid
graph TB
    A[VSCode Extension Host] --> B[Extension Main Process]
    B --> C[Webview Panel]
    B --> D[Enhanced Markdown Parser]
    B --> E[Enhanced File System Handler]
    B --> F[Table Selection Manager]
    C --> G[Table Editor UI]
    G --> H[Grid Component]
    G --> I[Context Menu]
    G --> J[Drag & Drop Handler]
    D --> K[Multi-AST Parser]
    D --> L[Table Position Tracker]
    D --> M[Mixed Content Handler]
    E --> N[Index-Based Updater]
    E --> O[Backup Manager]
    F --> P[Table Selection Dialog]
```

### Multi-Table Architecture Features

1. **Table Index Tracking**
   - Each table is assigned a unique index within the document
   - TableDataManager maintains `tableIndex` for precise identification
   - FileHandler uses `updateTableByIndex()` for accurate updates

2. **Mixed Content Support**
   - Advanced AST parsing distinguishes between actual tables and table-like content in code blocks
   - Preserves all non-table content during updates
   - Accurate line range calculation prevents corruption

3. **Enhanced Error Handling**
   - Automatic backup creation before any file modification
   - Comprehensive validation with detailed error messages
   - Recovery options for failed operations

4. **Table Selection UI**
   - QuickPick dialog for multi-table scenarios
   - Shows table location, headers, size, and content preview
   - Intuitive table identification for users

## Data Flow for Multi-Table Operations

1. **Table Selection Flow:**
   ```
   User triggers "Open Table Editor" 
   → Parse document and find all tables
   → If multiple tables: show selection dialog
   → User selects table → Create TableDataManager with tableIndex
   → Open editor for selected table
   ```

2. **Table Update Flow:**
   ```
   User modifies table in editor
   → TableDataManager updates internal data
   → Extension calls FileHandler.updateTableByIndex()
   → FileHandler re-parses document to get current positions
   → Updates only the specified table by index
   → Preserves all other content
   ```

3. **Error Recovery Flow:**
   ```
   Error occurs during update
   → Show detailed error message to user
   → Offer backup restoration option
   → Log error details for debugging
   → Provide alternative save options
   ```

## Implementation Benefits

1. **Accuracy**: Index-based tracking prevents table mix-ups
2. **Safety**: Automatic backups protect against data loss
3. **Robustness**: Handles complex document structures gracefully
4. **User Experience**: Intuitive table selection for multi-table documents
5. **Maintainability**: Clear separation of concerns and error handling