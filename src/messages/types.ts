/**
 * messages・通信型定義
 * 
 * Webviewからの各種コマンドとそのデータ型、メッセージ構造を集約定義
 * protocol.ts もこれらの型を import して使用
 */

// Webviewからのコマンド（protocol.ts のenumに加えて、診断・内部コマンドも含む）
export type WebviewCommand =
  | 'requestTableData'
  | 'updateCell'
  | 'bulkUpdateCells'
  | 'updateHeader'
  | 'addRow'
  | 'deleteRows'
  | 'addColumn'
  | 'deleteColumns'
  | 'sort'
  | 'moveRow'
  | 'moveColumn'
  | 'exportCSV'
  | 'importCSV'
  | 'pong'
  | 'switchTable'
  | 'requestThemeVariables'
  | 'requestFontSettings'
  | 'undo'
  | 'redo'
  | 'requestSync'
  | 'stateUpdate'
  | 'toggleAutoSave'
  | 'manualSave'
  | 'webviewError'
  | 'webviewUnhandledRejection'
  | 'diag';

// データ型定義
export interface UpdateCellData {
  row: number;
  col: number;
  value: string;
  tableIndex?: number;
}

export interface BulkUpdateCellsData {
  updates: Array<{ row: number; col: number; value: string }>;
  tableIndex?: number;
}

export interface UpdateHeaderData {
  col: number;
  value: string;
  tableIndex?: number;
}

export interface AddRowData {
  index?: number;
  count?: number; // Number of rows to add (default: 1)
  tableIndex?: number;
}

export interface DeleteRowsData {
  indices: number[];
  tableIndex?: number;
}

export interface AddColumnData {
  index?: number;
  count?: number; // Number of columns to add (default: 1)
  header?: string;
  tableIndex?: number;
}

export interface DeleteColumnsData {
  indices: number[];
  tableIndex?: number;
}

export interface SortData {
  column: number;
  direction: 'asc' | 'desc' | 'none';
  tableIndex?: number;
}

export interface MoveData {
  fromIndex?: number;
  toIndex: number;
  indices?: number[];
  tableIndex?: number;
}

export interface ExportCSVData {
  csvContent: string;
  filename?: string;
  encoding?: string;
  tableIndex?: number;
}

export interface ImportCSVData {
  tableIndex?: number;
}

export interface SwitchTableData {
  index: number;
}

export interface BaseMessage {
  command: WebviewCommand;
  data?: any;
  timestamp?: number;
  responseTime?: number;
}

export type WebviewMessage = BaseMessage;



