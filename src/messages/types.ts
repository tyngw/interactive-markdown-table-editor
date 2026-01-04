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
  | 'webviewError'
  | 'webviewUnhandledRejection'
  | 'diag';

export interface BaseMessage {
  command: WebviewCommand;
  data?: any;
  timestamp?: number;
  responseTime?: number;
}

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
  tableIndex?: number;
}

export interface DeleteRowsData {
  indices: number[];
  tableIndex?: number;
}

export interface AddColumnData {
  index?: number;
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
  fromIndex: number;
  toIndex: number;
  tableIndex?: number;
}

export interface ExportCSVData {
  csvContent: string;
  filename?: string;
  encoding?: string;
}

export interface ImportCSVData {
  tableIndex?: number;
}

export interface SwitchTableData { index: number }

export type WebviewMessage = BaseMessage;
