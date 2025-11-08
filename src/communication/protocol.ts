/**
 * 通信プロトコル定義
 * WebviewとVSCode Extension間の確実なメッセージング
 */

// メッセージID生成
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// メッセージの種類
export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  ACK = 'ack',
  ERROR = 'error'
}

// メッセージの基本構造
export interface BaseProtocolMessage {
  id: string;
  type: MessageType;
  command: string;
  timestamp: number;
}

// リクエストメッセージ
export interface RequestMessage extends BaseProtocolMessage {
  type: MessageType.REQUEST;
  data?: any;
  expectResponse?: boolean;
  timeout?: number; // ms
}

// レスポンスメッセージ
export interface ResponseMessage extends BaseProtocolMessage {
  type: MessageType.RESPONSE;
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

// 通知メッセージ（レスポンス不要）
export interface NotificationMessage extends BaseProtocolMessage {
  type: MessageType.NOTIFICATION;
  data?: any;
}

// 確認応答メッセージ
export interface AckMessage extends BaseProtocolMessage {
  type: MessageType.ACK;
  requestId: string;
}

// エラーメッセージ
export interface ErrorMessage extends BaseProtocolMessage {
  type: MessageType.ERROR;
  requestId?: string;
  error: string;
  code?: string;
}

export type ProtocolMessage =
  | RequestMessage
  | ResponseMessage
  | NotificationMessage
  | AckMessage
  | ErrorMessage;

// コマンド定義（Extension -> Webview）
export enum ExtensionCommand {
  UPDATE_TABLE_DATA = 'updateTableData',
  SET_ACTIVE_TABLE = 'setActiveTable',
  APPLY_THEME_VARIABLES = 'applyThemeVariables',
  CELL_UPDATE_ERROR = 'cellUpdateError',
  HEADER_UPDATE_ERROR = 'headerUpdateError',
  OPERATION_SUCCESS = 'operationSuccess',
  OPERATION_ERROR = 'operationError',
  PING = 'ping',
  SYNC_STATE = 'syncState'
}

// コマンド定義（Webview -> Extension）
export enum WebviewCommand {
  REQUEST_TABLE_DATA = 'requestTableData',
  UPDATE_CELL = 'updateCell',
  BULK_UPDATE_CELLS = 'bulkUpdateCells',
  UPDATE_HEADER = 'updateHeader',
  ADD_ROW = 'addRow',
  DELETE_ROWS = 'deleteRows',
  ADD_COLUMN = 'addColumn',
  DELETE_COLUMNS = 'deleteColumns',
  SORT = 'sort',
  MOVE_ROW = 'moveRow',
  MOVE_COLUMN = 'moveColumn',
  EXPORT_CSV = 'exportCSV',
  SWITCH_TABLE = 'switchTable',
  REQUEST_THEME_VARIABLES = 'requestThemeVariables',
  UNDO = 'undo',
  REDO = 'redo',
  PONG = 'pong',
  REQUEST_SYNC = 'requestSync',
  STATE_UPDATE = 'stateUpdate'
}

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
  tableIndex?: number;
}

export interface SwitchTableData {
  index: number;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  alignment?: string[];
}

export interface SyncStateData {
  tableData: TableData | TableData[];
  activeTableIndex?: number;
  fileInfo?: {
    uri: string;
    fileName: string;
    fileNameWithoutExt: string;
  };
}

// エラーコード
export enum ErrorCode {
  TIMEOUT = 'TIMEOUT',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  HANDLER_NOT_FOUND = 'HANDLER_NOT_FOUND',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNKNOWN = 'UNKNOWN'
}

// 設定
export interface CommunicationConfig {
  defaultTimeout: number; // デフォルトタイムアウト (ms)
  maxRetries: number; // 最大再試行回数
  retryDelay: number; // 再試行間隔 (ms)
  heartbeatInterval: number; // ハートビート間隔 (ms)
  syncInterval: number; // 状態同期間隔 (ms)
}

export const DEFAULT_CONFIG: CommunicationConfig = {
  defaultTimeout: 10000, // 10秒
  maxRetries: 3,
  retryDelay: 1000, // 1秒
  heartbeatInterval: 30000, // 30秒
  syncInterval: 60000 // 60秒
};
