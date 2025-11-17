/**
 * 新しい通信システムを使用するReactフック
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { WebviewCommunicationManager } from '../communication/WebviewCommunicationManager';
import { ExtensionCommand, TableData as ProtocolTableData } from '../../../src/communication/protocol';
import { ensureVsCodeApi } from '../vscodeApi';
import { TableData } from '../types';

interface CommunicationCallbacks {
  onTableData?: (data: TableData | TableData[]) => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  onThemeVariables?: (data: any) => void;
  onFontSettings?: (data: any) => void;
  onSetActiveTable?: (index: number) => void;
}

export function useCommunication(callbacks: CommunicationCallbacks) {
  const { onTableData, onError, onSuccess, onThemeVariables, onFontSettings, onSetActiveTable } = callbacks;
  const commManagerRef = useRef<WebviewCommunicationManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // 通信マネージャーの初期化
  useEffect(() => {
    const vscodeApi = ensureVsCodeApi();
    if (!vscodeApi) {
      console.error('[useCommunication] Failed to acquire VSCode API');
      return;
    }

    const manager = new WebviewCommunicationManager(vscodeApi);
    commManagerRef.current = manager;

    // ハンドラーの登録
    manager.registerNotificationHandler(ExtensionCommand.UPDATE_TABLE_DATA, (data) => {
      console.log('[useCommunication] Received table data update:', data);
      if (onTableData) {
        if (data.data) {
          onTableData(data.data);
        } else {
          onTableData(data);
        }
      }
    });

    manager.registerNotificationHandler(ExtensionCommand.SET_ACTIVE_TABLE, (data) => {
      console.log('[useCommunication] Received set active table:', data);
      if (onSetActiveTable && data && typeof data.index === 'number') {
        onSetActiveTable(data.index);
      }
    });

    manager.registerNotificationHandler(ExtensionCommand.APPLY_THEME_VARIABLES, (data) => {
      console.log('[useCommunication] Received theme variables:', data);
      if (onThemeVariables) {
        onThemeVariables(data);
      }
    });

    manager.registerNotificationHandler(ExtensionCommand.APPLY_FONT_SETTINGS, (data) => {
      console.log('[useCommunication] Received font settings:', data);
      if (onFontSettings) {
        onFontSettings(data);
      }
    });

    manager.registerNotificationHandler(ExtensionCommand.OPERATION_SUCCESS, (data) => {
      console.log('[useCommunication] Received operation success:', data);
      if (onSuccess) {
        onSuccess(data.message || 'Operation successful');
      }
    });

    manager.registerNotificationHandler(ExtensionCommand.OPERATION_ERROR, (data) => {
      console.error('[useCommunication] Received operation error:', data);
      if (onError) {
        onError(data.error || 'Operation failed');
      }
    });

    manager.registerNotificationHandler(ExtensionCommand.CELL_UPDATE_ERROR, (data) => {
      console.error('[useCommunication] Received cell update error:', data);
      if (onError) {
        onError(`Cell update failed at (${data.row}, ${data.col}): ${data.error}`);
      }
    });

    manager.registerNotificationHandler(ExtensionCommand.HEADER_UPDATE_ERROR, (data) => {
      console.error('[useCommunication] Received header update error:', data);
      if (onError) {
        onError(`Header update failed at column ${data.col}: ${data.error}`);
      }
    });

    manager.registerNotificationHandler(ExtensionCommand.PING, (data) => {
      console.log('[useCommunication] Received ping, sending pong');
      manager.sendPong(data.timestamp);
      setIsConnected(true);
    });

    manager.registerNotificationHandler(ExtensionCommand.SYNC_STATE, (data) => {
      console.log('[useCommunication] Received sync state:', data);
      if (onTableData && data.tableData) {
        onTableData(data.tableData);
      }
      if (onSetActiveTable && typeof data.activeTableIndex === 'number') {
        onSetActiveTable(data.activeTableIndex);
      }
    });

    console.log('[useCommunication] Communication manager initialized');

    // 接続確認タイマー
    const connectionCheckInterval = setInterval(() => {
      setIsConnected(manager.isExtensionConnected());
    }, 5000);

    // クリーンアップ
    return () => {
      clearInterval(connectionCheckInterval);
      manager.dispose();
      commManagerRef.current = null;
    };
  }, [onTableData, onError, onSuccess, onThemeVariables, onFontSettings, onSetActiveTable]);

  // メッセージ送信用のメソッド（旧形式との互換性を保つ）
  const sendMessage = useCallback((commandOrMessage: string | { command: string; data?: any }, data?: any) => {
    const manager = commManagerRef.current;
    if (!manager) {
      console.error('[useCommunication] Communication manager not initialized');
      return;
    }

    // 引数が文字列の場合と、オブジェクトの場合の両方に対応
    let command: string;
    let messageData: any;

    if (typeof commandOrMessage === 'string') {
      // 新形式: sendMessage('updateCell', { ... })
      command = commandOrMessage;
      messageData = data;
    } else {
      // 旧形式: sendMessage({ command: 'updateCell', data: { ... } })
      command = commandOrMessage.command;
      messageData = commandOrMessage.data;
    }

    console.log('[useCommunication] Sending message:', command, messageData);

    // コマンドに基づいて適切な通信マネージャーのメソッドを呼び出す
    switch (command) {
      case 'updateCell':
        if (messageData) {
          manager.updateCell(messageData.row, messageData.col, messageData.value, messageData.tableIndex);
        }
        break;
      case 'bulkUpdateCells':
        if (messageData) {
          manager.bulkUpdateCells(messageData.updates, messageData.tableIndex);
        }
        break;
      case 'updateHeader':
        if (messageData) {
          manager.updateHeader(messageData.col, messageData.value, messageData.tableIndex);
        }
        break;
      case 'addRow':
        manager.addRow(messageData?.index, messageData?.count, messageData?.tableIndex);
        break;
      case 'deleteRows':
        if (messageData) {
          manager.deleteRows(messageData.indices, messageData.tableIndex);
        }
        break;
      case 'addColumn':
        manager.addColumn(messageData?.index, messageData?.count, messageData?.tableIndex);
        break;
      case 'deleteColumns':
        if (messageData) {
          manager.deleteColumns(messageData.indices, messageData.tableIndex);
        }
        break;
      case 'sort':
        if (messageData) {
          manager.sort(messageData.column, messageData.direction, messageData.tableIndex);
        }
        break;
      case 'moveRow':
        if (messageData) {
          manager.moveRow(messageData.fromIndex, messageData.toIndex, messageData.tableIndex);
        }
        break;
      case 'moveColumn':
        if (messageData) {
          manager.moveColumn(messageData.fromIndex, messageData.toIndex, messageData.tableIndex);
        }
        break;
      case 'exportCSV':
        if (messageData) {
          manager.exportCSV(messageData.csvContent, messageData.filename, messageData.encoding, messageData.tableIndex);
        }
        break;
      case 'importCSV':
        manager.importCSV(messageData?.tableIndex);
        break;
      case 'switchTable':
        if (messageData) {
          manager.switchTable(messageData.index);
        }
        break;
      case 'undo':
        manager.undo();
        break;
      case 'redo':
        manager.redo();
        break;
      case 'requestTableData':
        manager.requestTableData();
        break;
      case 'requestThemeVariables':
        manager.requestThemeVariables();
        break;
      default:
        // その他のコマンドは通知として送信
        console.warn('[useCommunication] Unknown command, sending as notification:', command);
        manager.sendNotification(command as any, messageData);
    }
  }, []);

  // 便利メソッド
  const requestTableData = useCallback(async () => {
    const manager = commManagerRef.current;
    if (!manager) {
      console.error('[useCommunication] Communication manager not initialized');
      return;
    }
    return manager.requestTableData();
  }, []);

  const updateCell = useCallback((row: number, col: number, value: string, tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.updateCell(row, col, value, tableIndex);
  }, []);

  const bulkUpdateCells = useCallback((updates: Array<{ row: number; col: number; value: string }>, tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.bulkUpdateCells(updates, tableIndex);
  }, []);

  const updateHeader = useCallback((col: number, value: string, tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.updateHeader(col, value, tableIndex);
  }, []);

  const addRow = useCallback((index?: number, count?: number, tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.addRow(index, count, tableIndex);
  }, []);

  const deleteRows = useCallback((indices: number[], tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.deleteRows(indices, tableIndex);
  }, []);

  const addColumn = useCallback((index?: number, count?: number, tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.addColumn(index, count, tableIndex);
  }, []);

  const deleteColumns = useCallback((indices: number[], tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.deleteColumns(indices, tableIndex);
  }, []);

  const sort = useCallback((column: number, direction: 'asc' | 'desc' | 'none', tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.sort(column, direction, tableIndex);
  }, []);

  const moveRow = useCallback((fromIndex: number, toIndex: number, tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.moveRow(fromIndex, toIndex, tableIndex);
  }, []);

  const moveColumn = useCallback((fromIndex: number, toIndex: number, tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.moveColumn(fromIndex, toIndex, tableIndex);
  }, []);

  const exportCSV = useCallback((csvContent: string, filename?: string, encoding?: string, tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.exportCSV(csvContent, filename, encoding, tableIndex);
  }, []);

  const importCSV = useCallback((tableIndex?: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.importCSV(tableIndex);
  }, []);

  const switchTable = useCallback((index: number) => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.switchTable(index);
  }, []);

  const requestThemeVariables = useCallback(async () => {
    const manager = commManagerRef.current;
    if (!manager) return;
    return manager.requestThemeVariables();
  }, []);

  const undo = useCallback(() => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.undo();
  }, []);

  const redo = useCallback(() => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.redo();
  }, []);

  const requestSync = useCallback(() => {
    const manager = commManagerRef.current;
    if (!manager) return;
    manager.requestSync();
  }, []);

  return {
    sendMessage,
    isConnected,
    // 便利メソッド
    requestTableData,
    updateCell,
    bulkUpdateCells,
    updateHeader,
    addRow,
    deleteRows,
    addColumn,
    deleteColumns,
    sort,
    moveRow,
    moveColumn,
    exportCSV,
    importCSV,
    switchTable,
    requestThemeVariables,
    undo,
    redo,
    requestSync
  };
}
