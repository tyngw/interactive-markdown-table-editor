import {
  AddColumnData,
  AddRowData,
  BulkUpdateCellsData,
  DeleteColumnsData,
  DeleteRowsData,
  ExportCSVData,
  ImportCSVData,
  MoveData,
  SortData,
  SwitchTableData,
  UpdateCellData,
  UpdateHeaderData,
  WebviewMessage,
  WebviewCommand,
} from './types';

export const validCommands: WebviewCommand[] = [
  'requestTableData', 'updateCell', 'bulkUpdateCells', 'updateHeader', 'addRow', 'deleteRows',
  'addColumn', 'deleteColumns', 'sort', 'moveRow', 'moveColumn', 'exportCSV', 'importCSV', 'pong', 'switchTable', 'requestThemeVariables', 'requestFontSettings', 'undo', 'redo', 'requestSync', 'stateUpdate',
  'webviewError', 'webviewUnhandledRejection', 'diag'
];

export function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

export function validateBasicMessageStructure(message: any): message is WebviewMessage {
  return isObject(message) && typeof (message as any).command === 'string';
}

export function validateMessageCommand(message: WebviewMessage): boolean {
  return validCommands.includes(message.command);
}

// 柔らかいデータ検証: 安全側（許容）に倒す
export function validateMessageData(message: WebviewMessage): boolean {
  // 診断・ヘルス系は素通し
  if (message.command === 'diag' || message.command === 'webviewError' || message.command === 'webviewUnhandledRejection' || message.command === 'pong' || message.command === 'requestThemeVariables' || message.command === 'requestFontSettings' || message.command === 'undo' || message.command === 'redo' || message.command === 'requestTableData') {
    return true;
  }

  const d = (message as any).data;
  switch (message.command) {
    case 'updateCell': {
      const v = d as UpdateCellData; return isObject(v) && typeof v.row === 'number' && v.row >= 0 && typeof v.col === 'number' && v.col >= 0 && typeof v.value === 'string';
    }
    case 'bulkUpdateCells': {
      const v = d as BulkUpdateCellsData; return isObject(v) && Array.isArray(v.updates) && v.updates.every(u => isObject(u) && typeof (u as any).row === 'number' && typeof (u as any).col === 'number' && typeof (u as any).value === 'string');
    }
    case 'updateHeader': {
      const v = d as UpdateHeaderData; return isObject(v) && typeof v.col === 'number' && v.col >= 0 && typeof v.value === 'string';
    }
    case 'addRow': {
      const v = d as AddRowData; return v === undefined || isObject(v);
    }
    case 'deleteRows': {
      const v = d as DeleteRowsData; return isObject(v) && Array.isArray(v.indices) && v.indices.every(i => typeof i === 'number' && i >= 0);
    }
    case 'addColumn': {
      const v = d as AddColumnData; return v === undefined || isObject(v);
    }
    case 'deleteColumns': {
      const v = d as DeleteColumnsData; return isObject(v) && Array.isArray(v.indices) && v.indices.every(i => typeof i === 'number' && i >= 0);
    }
    case 'sort': {
      const v = d as SortData; return isObject(v) && typeof v.column === 'number' && ['asc', 'desc', 'none'].includes((v as any).direction);
    }
    case 'moveRow':
    case 'moveColumn': {
      const v = d as MoveData; return isObject(v) && typeof v.fromIndex === 'number' && typeof v.toIndex === 'number' && v.fromIndex >= 0 && v.toIndex >= 0;
    }
    case 'exportCSV': {
      const v = d as ExportCSVData;
      if (!isObject(v) || typeof v.csvContent !== 'string') {return false;}
      // csvContent must be non-empty (ignoring surrounding whitespace)
      if (v.csvContent.trim().length === 0) {return false;}
      // if filename is provided, it must be a non-empty string
      if ('filename' in v && (typeof (v as any).filename !== 'string' || (v as any).filename.trim().length === 0)) {return false;}
      return true;
    }
    case 'importCSV': {
      const v = d as ImportCSVData; return v === undefined || isObject(v);
    }
    case 'switchTable': {
      const v = d as SwitchTableData; return isObject(v) && typeof v.index === 'number' && v.index >= 0;
    }
    default:
      return false;
  }
}
