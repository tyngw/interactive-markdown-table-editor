import { renderHook, act, waitFor } from '@testing-library/react';
import { useCommunication } from '../../hooks/useCommunication';
import { MessageType } from '../../../../src/communication/protocol';

/**
 * useCommunication Hook Tests
 *
 * useCommunication フックの包括的テスト。
 * 初期化、通知ハンドラー、sendMessage のルーティング、便利メソッド、
 * ガード処理、クリーンアップをすべてカバーする。
 */

// --- モック設定 ---
const mockVSCodeApi = {
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn(),
};

jest.mock('../../vscodeApi', () => ({
  ensureVsCodeApi: jest.fn(() => mockVSCodeApi),
}));

// テスト用のプロトコル通知メッセージを構築するヘルパー
function createNotification(command: string, data: any) {
  return {
    type: MessageType.NOTIFICATION,
    id: `test-${Date.now()}-${Math.random()}`,
    command,
    data,
    timestamp: Date.now(),
  };
}

describe('useCommunication Hook', () => {
  let sentMessages: any[];
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    sentMessages = [];
    mockVSCodeApi.postMessage.mockImplementation((message: any) => {
      sentMessages.push(message);
    });
    jest.clearAllMocks();
    // コンソール出力を抑制
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // ===========================================================================
  // 初期化とクリーンアップ
  // ===========================================================================
  describe('Initialization and Cleanup', () => {
    test('should initialize and return all methods', () => {
      const { result } = renderHook(() => useCommunication({}));

      const requiredMethods = [
        'sendMessage', 'requestTableData', 'updateCell', 'bulkUpdateCells',
        'updateHeader', 'addRow', 'deleteRows', 'addColumn', 'deleteColumns',
        'sort', 'moveRow', 'moveColumn', 'exportCSV', 'importCSV',
        'switchTable', 'requestThemeVariables', 'requestFontSettings',
        'undo', 'redo', 'requestSync', 'toggleAutoSave', 'manualSave', 'notifyReady',
      ];
      for (const method of requiredMethods) {
        expect(typeof result.current[method as keyof typeof result.current]).toBe('function');
      }
      expect(result.current.isConnected).toBe(false);
    });

    test('should initialize communication manager on mount', async () => {
      renderHook(() => useCommunication({}));
      const { ensureVsCodeApi } = require('../../vscodeApi');
      expect(ensureVsCodeApi).toHaveBeenCalled();
    });

    test('should clean up on unmount (dispose manager, clear interval)', () => {
      jest.useFakeTimers();
      const { unmount } = renderHook(() => useCommunication({}));

      unmount();

      // dispose 後にタイマーが進んでもエラーにならない
      jest.advanceTimersByTime(10000);
      jest.useRealTimers();
    });

    test('should handle ensureVsCodeApi returning null', () => {
      const { ensureVsCodeApi } = require('../../vscodeApi');
      ensureVsCodeApi.mockReturnValueOnce(null);

      const { result } = renderHook(() => useCommunication({}));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to acquire VSCode API')
      );
      // 便利メソッドはガードされているので安全に呼べる
      result.current.updateCell(0, 0, 'test');
    });

    test('connectionCheckInterval should update isConnected periodically', () => {
      jest.useFakeTimers();
      renderHook(() => useCommunication({}));

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      jest.useRealTimers();
    });
  });

  // ===========================================================================
  // 通知ハンドラー
  // ===========================================================================
  describe('Notification Handlers', () => {
    function dispatchNotification(command: string, data: any) {
      const event = new MessageEvent('message', {
        data: createNotification(command, data),
      });
      window.dispatchEvent(event);
    }

    test('UPDATE_TABLE_DATA - should call onTableData with data.data when present', async () => {
      const onTableData = jest.fn();
      renderHook(() => useCommunication({ onTableData }));

      await act(async () => {
        dispatchNotification('updateTableData', { data: { headers: ['A'], rows: [] } });
      });

      expect(onTableData).toHaveBeenCalledWith({ headers: ['A'], rows: [] });
    });

    test('UPDATE_TABLE_DATA - should call onTableData with data directly when data.data is absent', async () => {
      const onTableData = jest.fn();
      renderHook(() => useCommunication({ onTableData }));

      await act(async () => {
        dispatchNotification('updateTableData', { headers: ['B'], rows: [] });
      });

      expect(onTableData).toHaveBeenCalledWith({ headers: ['B'], rows: [] });
    });

    test('UPDATE_TABLE_DATA - should not crash when onTableData is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('updateTableData', { headers: ['C'], rows: [] });
      });
    });

    test('UPDATE_GIT_DIFF - should unwrap data.data when present', async () => {
      const onGitDiffData = jest.fn();
      renderHook(() => useCommunication({ onGitDiffData }));

      await act(async () => {
        dispatchNotification('updateGitDiff', { data: { diff: 'abc' } });
      });

      expect(onGitDiffData).toHaveBeenCalledWith({ diff: 'abc' });
    });

    test('UPDATE_GIT_DIFF - should pass data directly when no nested data', async () => {
      const onGitDiffData = jest.fn();
      renderHook(() => useCommunication({ onGitDiffData }));

      await act(async () => {
        dispatchNotification('updateGitDiff', { diff: 'xyz' });
      });

      expect(onGitDiffData).toHaveBeenCalledWith({ diff: 'xyz' });
    });

    test('UPDATE_GIT_DIFF - should not crash when onGitDiffData is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('updateGitDiff', { diff: 'test' });
      });
    });

    test('SET_ACTIVE_TABLE - should call onSetActiveTable when index is a number', async () => {
      const onSetActiveTable = jest.fn();
      renderHook(() => useCommunication({ onSetActiveTable }));

      await act(async () => {
        dispatchNotification('setActiveTable', { index: 2 });
      });

      expect(onSetActiveTable).toHaveBeenCalledWith(2);
    });

    test('SET_ACTIVE_TABLE - should NOT call onSetActiveTable when index is not a number', async () => {
      const onSetActiveTable = jest.fn();
      renderHook(() => useCommunication({ onSetActiveTable }));

      await act(async () => {
        dispatchNotification('setActiveTable', { index: 'invalid' });
      });

      expect(onSetActiveTable).not.toHaveBeenCalled();
    });

    test('SET_ACTIVE_TABLE - should NOT call when onSetActiveTable is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('setActiveTable', { index: 0 });
      });
    });

    test('APPLY_THEME_VARIABLES - should call onThemeVariables', async () => {
      const onThemeVariables = jest.fn();
      renderHook(() => useCommunication({ onThemeVariables }));

      const themeData = { '--bg-color': '#fff' };
      await act(async () => {
        dispatchNotification('applyThemeVariables', themeData);
      });

      expect(onThemeVariables).toHaveBeenCalledWith(themeData);
    });

    test('APPLY_THEME_VARIABLES - should not crash when onThemeVariables is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('applyThemeVariables', { color: 'red' });
      });
    });

    test('APPLY_FONT_SETTINGS - should call onFontSettings', async () => {
      const onFontSettings = jest.fn();
      renderHook(() => useCommunication({ onFontSettings }));

      const fontData = { fontFamily: 'monospace', fontSize: 14 };
      await act(async () => {
        dispatchNotification('applyFontSettings', fontData);
      });

      expect(onFontSettings).toHaveBeenCalledWith(fontData);
    });

    test('APPLY_FONT_SETTINGS - should not crash when onFontSettings is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('applyFontSettings', { fontSize: 12 });
      });
    });

    test('OPERATION_SUCCESS - should call onSuccess with full data', async () => {
      const onSuccess = jest.fn();
      renderHook(() => useCommunication({ onSuccess }));

      const successData = { message: 'Saved', phase: 'complete' };
      await act(async () => {
        dispatchNotification('operationSuccess', successData);
      });

      expect(onSuccess).toHaveBeenCalledWith(successData);
    });

    test('OPERATION_SUCCESS - should not crash when onSuccess is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('operationSuccess', { ok: true });
      });
    });

    test('OPERATION_ERROR - should call onError with data.error', async () => {
      const onError = jest.fn();
      renderHook(() => useCommunication({ onError }));

      await act(async () => {
        dispatchNotification('operationError', { error: 'Something went wrong' });
      });

      expect(onError).toHaveBeenCalledWith('Something went wrong');
    });

    test('OPERATION_ERROR - should use fallback message when data.error is absent', async () => {
      const onError = jest.fn();
      renderHook(() => useCommunication({ onError }));

      await act(async () => {
        dispatchNotification('operationError', {});
      });

      expect(onError).toHaveBeenCalledWith('Operation failed');
    });

    test('OPERATION_ERROR - should not crash when onError is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('operationError', { error: 'err' });
      });
    });

    test('CELL_UPDATE_ERROR - should call onError with formatted message', async () => {
      const onError = jest.fn();
      renderHook(() => useCommunication({ onError }));

      await act(async () => {
        dispatchNotification('cellUpdateError', { row: 1, col: 2, error: 'invalid value' });
      });

      expect(onError).toHaveBeenCalledWith('Cell update failed at (1, 2): invalid value');
    });

    test('CELL_UPDATE_ERROR - should not crash when onError is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('cellUpdateError', { row: 0, col: 0, error: 'err' });
      });
    });

    test('HEADER_UPDATE_ERROR - should call onError with formatted message', async () => {
      const onError = jest.fn();
      renderHook(() => useCommunication({ onError }));

      await act(async () => {
        dispatchNotification('headerUpdateError', { col: 3, error: 'bad header' });
      });

      expect(onError).toHaveBeenCalledWith('Header update failed at column 3: bad header');
    });

    test('HEADER_UPDATE_ERROR - should not crash when onError is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('headerUpdateError', { col: 0, error: 'err' });
      });
    });

    test('PING - should send pong and set isConnected to true', async () => {
      const { result } = renderHook(() => useCommunication({}));

      const ts = Date.now();
      await act(async () => {
        dispatchNotification('ping', { timestamp: ts });
      });

      const pongMsg = sentMessages.find(m => m.command === 'pong');
      expect(pongMsg).toBeDefined();
      expect(pongMsg.data.timestamp).toBe(ts);

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    test('SYNC_STATE - should call onTableData and onSetActiveTable', async () => {
      const onTableData = jest.fn();
      const onSetActiveTable = jest.fn();
      renderHook(() => useCommunication({ onTableData, onSetActiveTable }));

      await act(async () => {
        dispatchNotification('syncState', {
          tableData: { headers: ['X'], rows: [['1']] },
          activeTableIndex: 1,
        });
      });

      expect(onTableData).toHaveBeenCalledWith({ headers: ['X'], rows: [['1']] });
      expect(onSetActiveTable).toHaveBeenCalledWith(1);
    });

    test('SYNC_STATE - should not call callbacks when data fields are missing', async () => {
      const onTableData = jest.fn();
      const onSetActiveTable = jest.fn();
      renderHook(() => useCommunication({ onTableData, onSetActiveTable }));

      await act(async () => {
        dispatchNotification('syncState', {});
      });

      expect(onTableData).not.toHaveBeenCalled();
      expect(onSetActiveTable).not.toHaveBeenCalled();
    });

    test('SYNC_STATE - should not call when callbacks are not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('syncState', { tableData: { headers: [], rows: [] } });
      });
    });

    test('AUTO_SAVE_STATE_CHANGED - should call onAutoSaveStateChanged when enabled is boolean', async () => {
      const onAutoSaveStateChanged = jest.fn();
      renderHook(() => useCommunication({ onAutoSaveStateChanged }));

      await act(async () => {
        dispatchNotification('autoSaveStateChanged', { enabled: true });
      });

      expect(onAutoSaveStateChanged).toHaveBeenCalledWith(true);
    });

    test('AUTO_SAVE_STATE_CHANGED - should call with false', async () => {
      const onAutoSaveStateChanged = jest.fn();
      renderHook(() => useCommunication({ onAutoSaveStateChanged }));

      await act(async () => {
        dispatchNotification('autoSaveStateChanged', { enabled: false });
      });

      expect(onAutoSaveStateChanged).toHaveBeenCalledWith(false);
    });

    test('AUTO_SAVE_STATE_CHANGED - should not call when enabled is not boolean', async () => {
      const onAutoSaveStateChanged = jest.fn();
      renderHook(() => useCommunication({ onAutoSaveStateChanged }));

      await act(async () => {
        dispatchNotification('autoSaveStateChanged', { enabled: 'yes' });
      });

      expect(onAutoSaveStateChanged).not.toHaveBeenCalled();
    });

    test('AUTO_SAVE_STATE_CHANGED - should not crash when callback is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('autoSaveStateChanged', { enabled: false });
      });
    });

    test('DIRTY_STATE_CHANGED - should call onDirtyStateChanged when isDirty is boolean', async () => {
      const onDirtyStateChanged = jest.fn();
      renderHook(() => useCommunication({ onDirtyStateChanged }));

      await act(async () => {
        dispatchNotification('dirtyStateChanged', { isDirty: true });
      });

      expect(onDirtyStateChanged).toHaveBeenCalledWith(true);
    });

    test('DIRTY_STATE_CHANGED - should call with false', async () => {
      const onDirtyStateChanged = jest.fn();
      renderHook(() => useCommunication({ onDirtyStateChanged }));

      await act(async () => {
        dispatchNotification('dirtyStateChanged', { isDirty: false });
      });

      expect(onDirtyStateChanged).toHaveBeenCalledWith(false);
    });

    test('DIRTY_STATE_CHANGED - should not call when isDirty is not boolean', async () => {
      const onDirtyStateChanged = jest.fn();
      renderHook(() => useCommunication({ onDirtyStateChanged }));

      await act(async () => {
        dispatchNotification('dirtyStateChanged', { isDirty: 1 });
      });

      expect(onDirtyStateChanged).not.toHaveBeenCalled();
    });

    test('DIRTY_STATE_CHANGED - should not crash when callback is not provided', async () => {
      renderHook(() => useCommunication({}));
      await act(async () => {
        dispatchNotification('dirtyStateChanged', { isDirty: false });
      });
    });
  });

  // ===========================================================================
  // sendMessage ルーティング
  // ===========================================================================
  describe('sendMessage Routing', () => {
    test('should handle string form: sendMessage("updateCell", data)', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('updateCell', { row: 0, col: 1, value: 'hello' });
      });

      const msg = sentMessages.find(m => m.command === 'updateCell');
      expect(msg).toBeDefined();
      expect(msg.data.row).toBe(0);
      expect(msg.data.col).toBe(1);
      expect(msg.data.value).toBe('hello');
    });

    test('should handle object form: sendMessage({ command, data })', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage({ command: 'updateCell', data: { row: 1, col: 2, value: 'world' } });
      });

      const msg = sentMessages.find(m => m.command === 'updateCell');
      expect(msg).toBeDefined();
    });

    test('should route bulkUpdateCells command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('bulkUpdateCells', {
          updates: [{ row: 0, col: 0, value: 'a' }],
          tableIndex: 0,
        });
      });

      const msg = sentMessages.find(m => m.command === 'bulkUpdateCells');
      expect(msg).toBeDefined();
    });

    test('should route updateHeader command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('updateHeader', { col: 0, value: 'Name', tableIndex: 0 });
      });

      const msg = sentMessages.find(m => m.command === 'updateHeader');
      expect(msg).toBeDefined();
    });

    test('should route addRow command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('addRow', { index: 1, count: 2, tableIndex: 0 });
      });

      const msg = sentMessages.find(m => m.command === 'addRow');
      expect(msg).toBeDefined();
    });

    test('should route addRow command without data', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('addRow');
      });

      const msg = sentMessages.find(m => m.command === 'addRow');
      expect(msg).toBeDefined();
    });

    test('should route deleteRows command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('deleteRows', { indices: [0, 1], tableIndex: 0 });
      });

      const msg = sentMessages.find(m => m.command === 'deleteRows');
      expect(msg).toBeDefined();
    });

    test('should route addColumn command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('addColumn', { index: 2, count: 1, tableIndex: 0 });
      });

      const msg = sentMessages.find(m => m.command === 'addColumn');
      expect(msg).toBeDefined();
    });

    test('should route addColumn command without data', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('addColumn');
      });

      const msg = sentMessages.find(m => m.command === 'addColumn');
      expect(msg).toBeDefined();
    });

    test('should route deleteColumns command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('deleteColumns', { indices: [0], tableIndex: 0 });
      });

      const msg = sentMessages.find(m => m.command === 'deleteColumns');
      expect(msg).toBeDefined();
    });

    test('should route sort command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('sort', { column: 0, direction: 'asc', tableIndex: 0 });
      });

      const msg = sentMessages.find(m => m.command === 'sort');
      expect(msg).toBeDefined();
    });

    test('should route moveRow command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('moveRow', { fromIndex: 0, toIndex: 2, tableIndex: 0, indices: [0] });
      });

      const msg = sentMessages.find(m => m.command === 'moveRow');
      expect(msg).toBeDefined();
    });

    test('should route moveColumn command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('moveColumn', { fromIndex: 1, toIndex: 3, tableIndex: 0, indices: [1] });
      });

      const msg = sentMessages.find(m => m.command === 'moveColumn');
      expect(msg).toBeDefined();
    });

    test('should route exportCSV command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('exportCSV', {
          csvContent: 'a,b\nc,d',
          filename: 'test.csv',
          encoding: 'utf8',
          tableIndex: 0,
        });
      });

      const msg = sentMessages.find(m => m.command === 'exportCSV');
      expect(msg).toBeDefined();
    });

    test('should route importCSV command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('importCSV', { tableIndex: 1 });
      });

      const msg = sentMessages.find(m => m.command === 'importCSV');
      expect(msg).toBeDefined();
    });

    test('should route switchTable command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('switchTable', { index: 2 });
      });

      const msg = sentMessages.find(m => m.command === 'switchTable');
      expect(msg).toBeDefined();
    });

    test('should route undo command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('undo');
      });

      const msg = sentMessages.find(m => m.command === 'undo');
      expect(msg).toBeDefined();
    });

    test('should route redo command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('redo');
      });

      const msg = sentMessages.find(m => m.command === 'redo');
      expect(msg).toBeDefined();
    });

    test('should route requestTableData command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('requestTableData');
        // sendRequest が内部で生成した pending request を解決するために
        // レスポンスメッセージを送り返す
        const requestMsg = sentMessages.find(m => m.command === 'requestTableData');
        if (requestMsg) {
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: 'response',
              id: `resp-${requestMsg.id}`,
              command: 'response',
              requestId: requestMsg.id,
              success: true,
              data: {},
              timestamp: Date.now(),
            },
          }));
        }
      });

      const msg = sentMessages.find(m => m.command === 'requestTableData');
      expect(msg).toBeDefined();
    });

    test('should route requestThemeVariables command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('requestThemeVariables');
        const requestMsg = sentMessages.find(m => m.command === 'requestThemeVariables');
        if (requestMsg) {
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: 'response',
              id: `resp-${requestMsg.id}`,
              command: 'response',
              requestId: requestMsg.id,
              success: true,
              data: {},
              timestamp: Date.now(),
            },
          }));
        }
      });

      const msg = sentMessages.find(m => m.command === 'requestThemeVariables');
      expect(msg).toBeDefined();
    });

    test('should route toggleAutoSave command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('toggleAutoSave', { enabled: true });
      });

      const msg = sentMessages.find(m => m.command === 'toggleAutoSave');
      expect(msg).toBeDefined();
    });

    test('should route manualSave command', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('manualSave');
      });

      const msg = sentMessages.find(m => m.command === 'manualSave');
      expect(msg).toBeDefined();
    });

    test('should fallback to sendNotification for unknown commands', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('unknownCommand', { foo: 'bar' });
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown command'),
        expect.anything()
      );
      const msg = sentMessages.find(m => m.command === 'unknownCommand');
      expect(msg).toBeDefined();
    });

    test('should log error when manager is not initialized', () => {
      const { ensureVsCodeApi } = require('../../vscodeApi');
      ensureVsCodeApi.mockReturnValueOnce(null);

      const { result } = renderHook(() => useCommunication({}));

      act(() => {
        result.current.sendMessage('updateCell', { row: 0, col: 0, value: 'x' });
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Communication manager not initialized')
      );
    });

    test('should skip updateCell when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('updateCell');
      });

      const msg = sentMessages.find(m => m.command === 'updateCell');
      expect(msg).toBeUndefined();
    });

    test('should skip bulkUpdateCells when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('bulkUpdateCells');
      });

      const msg = sentMessages.find(m => m.command === 'bulkUpdateCells');
      expect(msg).toBeUndefined();
    });

    test('should skip updateHeader when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('updateHeader');
      });

      const msg = sentMessages.find(m => m.command === 'updateHeader');
      expect(msg).toBeUndefined();
    });

    test('should skip deleteRows when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('deleteRows');
      });

      const msg = sentMessages.find(m => m.command === 'deleteRows');
      expect(msg).toBeUndefined();
    });

    test('should skip deleteColumns when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('deleteColumns');
      });

      const msg = sentMessages.find(m => m.command === 'deleteColumns');
      expect(msg).toBeUndefined();
    });

    test('should skip sort when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('sort');
      });

      const msg = sentMessages.find(m => m.command === 'sort');
      expect(msg).toBeUndefined();
    });

    test('should skip moveRow when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('moveRow');
      });

      const msg = sentMessages.find(m => m.command === 'moveRow');
      expect(msg).toBeUndefined();
    });

    test('should skip moveColumn when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('moveColumn');
      });

      const msg = sentMessages.find(m => m.command === 'moveColumn');
      expect(msg).toBeUndefined();
    });

    test('should skip exportCSV when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('exportCSV');
      });

      const msg = sentMessages.find(m => m.command === 'exportCSV');
      expect(msg).toBeUndefined();
    });

    test('should skip switchTable when messageData is undefined', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sendMessage('switchTable');
      });

      const msg = sentMessages.find(m => m.command === 'switchTable');
      expect(msg).toBeUndefined();
    });
  });

  // ===========================================================================
  // 便利メソッド
  // ===========================================================================
  describe('Convenience Methods', () => {
    test('requestTableData should call manager.requestTableData', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.requestTableData().catch(() => { /* expected timeout */ });
        const requestMsg = sentMessages.find(m => m.command === 'requestTableData');
        if (requestMsg) {
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: 'response',
              id: `resp-${requestMsg.id}`,
              command: 'response',
              requestId: requestMsg.id,
              success: true,
              data: {},
              timestamp: Date.now(),
            },
          }));
        }
      });

      const msg = sentMessages.find(m => m.command === 'requestTableData');
      expect(msg).toBeDefined();
    });

    test('updateCell should call manager.updateCell', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.updateCell(1, 2, 'value', 0);
      });

      const msg = sentMessages.find(m => m.command === 'updateCell');
      expect(msg).toBeDefined();
      expect(msg.data.row).toBe(1);
      expect(msg.data.col).toBe(2);
      expect(msg.data.value).toBe('value');
    });

    test('bulkUpdateCells should call manager.bulkUpdateCells', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.bulkUpdateCells([{ row: 0, col: 0, value: 'a' }], 0);
      });

      const msg = sentMessages.find(m => m.command === 'bulkUpdateCells');
      expect(msg).toBeDefined();
    });

    test('updateHeader should call manager.updateHeader', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.updateHeader(0, 'Header', 0);
      });

      const msg = sentMessages.find(m => m.command === 'updateHeader');
      expect(msg).toBeDefined();
    });

    test('addRow should call manager.addRow', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.addRow(1, 2, 0);
      });

      const msg = sentMessages.find(m => m.command === 'addRow');
      expect(msg).toBeDefined();
    });

    test('deleteRows should call manager.deleteRows', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.deleteRows([0, 1], 0);
      });

      const msg = sentMessages.find(m => m.command === 'deleteRows');
      expect(msg).toBeDefined();
    });

    test('addColumn should call manager.addColumn', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.addColumn(1, 1, 0);
      });

      const msg = sentMessages.find(m => m.command === 'addColumn');
      expect(msg).toBeDefined();
    });

    test('deleteColumns should call manager.deleteColumns', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.deleteColumns([0], 0);
      });

      const msg = sentMessages.find(m => m.command === 'deleteColumns');
      expect(msg).toBeDefined();
    });

    test('sort should call manager.sort', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.sort(0, 'asc', 0);
      });

      const msg = sentMessages.find(m => m.command === 'sort');
      expect(msg).toBeDefined();
    });

    test('moveRow should call manager.moveRow', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.moveRow(0, 1, 0, [0]);
      });

      const msg = sentMessages.find(m => m.command === 'moveRow');
      expect(msg).toBeDefined();
    });

    test('moveColumn should call manager.moveColumn', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.moveColumn(0, 1, 0, [0]);
      });

      const msg = sentMessages.find(m => m.command === 'moveColumn');
      expect(msg).toBeDefined();
    });

    test('exportCSV should call manager.exportCSV', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.exportCSV('a,b', 'file.csv', 'utf8', 0);
      });

      const msg = sentMessages.find(m => m.command === 'exportCSV');
      expect(msg).toBeDefined();
    });

    test('importCSV should call manager.importCSV', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.importCSV(1);
      });

      const msg = sentMessages.find(m => m.command === 'importCSV');
      expect(msg).toBeDefined();
    });

    test('switchTable should call manager.switchTable', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.switchTable(2);
      });

      const msg = sentMessages.find(m => m.command === 'switchTable');
      expect(msg).toBeDefined();
    });

    test('requestThemeVariables should call manager.requestThemeVariables', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.requestThemeVariables()?.catch(() => { /* expected */ });
        const requestMsg = sentMessages.find(m => m.command === 'requestThemeVariables');
        if (requestMsg) {
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: 'response',
              id: `resp-${requestMsg.id}`,
              command: 'response',
              requestId: requestMsg.id,
              success: true,
              data: {},
              timestamp: Date.now(),
            },
          }));
        }
      });

      const msg = sentMessages.find(m => m.command === 'requestThemeVariables');
      expect(msg).toBeDefined();
    });

    test('requestFontSettings should call manager.requestFontSettings', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.requestFontSettings()?.catch(() => { /* expected */ });
        const requestMsg = sentMessages.find(m => m.command === 'requestFontSettings');
        if (requestMsg) {
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: 'response',
              id: `resp-${requestMsg.id}`,
              command: 'response',
              requestId: requestMsg.id,
              success: true,
              data: {},
              timestamp: Date.now(),
            },
          }));
        }
      });

      const msg = sentMessages.find(m => m.command === 'requestFontSettings');
      expect(msg).toBeDefined();
    });

    test('notifyReady should send stateUpdate notification', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.notifyReady();
      });

      const msg = sentMessages.find(m => m.command === 'stateUpdate');
      expect(msg).toBeDefined();
      expect(msg.data).toEqual({ ready: true });
    });

    test('undo should call manager.undo', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.undo();
      });

      const msg = sentMessages.find(m => m.command === 'undo');
      expect(msg).toBeDefined();
    });

    test('redo should call manager.redo', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.redo();
      });

      const msg = sentMessages.find(m => m.command === 'redo');
      expect(msg).toBeDefined();
    });

    test('requestSync should call manager.requestSync', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.requestSync();
      });

      const msg = sentMessages.find(m => m.command === 'requestSync');
      expect(msg).toBeDefined();
    });

    test('toggleAutoSave should call manager.toggleAutoSave', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.toggleAutoSave(true);
      });

      const msg = sentMessages.find(m => m.command === 'toggleAutoSave');
      expect(msg).toBeDefined();
      expect(msg.data.enabled).toBe(true);
    });

    test('manualSave should call manager.manualSave', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await act(async () => {
        result.current.manualSave();
      });

      const msg = sentMessages.find(m => m.command === 'manualSave');
      expect(msg).toBeDefined();
    });
  });

  // ===========================================================================
  // 便利メソッドのガード（manager が null のとき）
  // ===========================================================================
  describe('Convenience Methods Guard (manager is null)', () => {
    let ensureVsCodeApiMock: jest.Mock;

    beforeEach(() => {
      ensureVsCodeApiMock = require('../../vscodeApi').ensureVsCodeApi;
      ensureVsCodeApiMock.mockReturnValue(null);
    });

    afterEach(() => {
      ensureVsCodeApiMock.mockReturnValue(mockVSCodeApi);
    });

    test('requestTableData should return early when manager is null', async () => {
      const { result } = renderHook(() => useCommunication({}));
      await act(async () => {
        const ret = await result.current.requestTableData();
        expect(ret).toBeUndefined();
      });
    });

    test('updateCell should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.updateCell(0, 0, 'x');
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('bulkUpdateCells should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.bulkUpdateCells([{ row: 0, col: 0, value: 'x' }]);
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('updateHeader should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.updateHeader(0, 'x');
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('addRow should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.addRow();
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('deleteRows should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.deleteRows([0]);
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('addColumn should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.addColumn();
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('deleteColumns should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.deleteColumns([0]);
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('sort should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.sort(0, 'asc');
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('moveRow should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.moveRow(0, 1);
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('moveColumn should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.moveColumn(0, 1);
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('exportCSV should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.exportCSV('a,b');
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('importCSV should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.importCSV();
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('switchTable should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.switchTable(0);
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('requestThemeVariables should return early when manager is null', async () => {
      const { result } = renderHook(() => useCommunication({}));
      await act(async () => {
        const ret = await result.current.requestThemeVariables();
        expect(ret).toBeUndefined();
      });
    });

    test('requestFontSettings should return early when manager is null', async () => {
      const { result } = renderHook(() => useCommunication({}));
      await act(async () => {
        const ret = await result.current.requestFontSettings();
        expect(ret).toBeUndefined();
      });
    });

    test('notifyReady should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.notifyReady();
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('undo should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.undo();
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('redo should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.redo();
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('requestSync should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.requestSync();
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('toggleAutoSave should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.toggleAutoSave(true);
      });
      expect(sentMessages).toHaveLength(0);
    });

    test('manualSave should return early when manager is null', () => {
      const { result } = renderHook(() => useCommunication({}));
      act(() => {
        result.current.manualSave();
      });
      expect(sentMessages).toHaveLength(0);
    });
  });

  // ===========================================================================
  // エッジケース: 到達困難な分岐のカバレッジ
  // ===========================================================================
  describe('Edge Cases', () => {
    function dispatchNotification(command: string, data: any) {
      const event = new MessageEvent('message', {
        data: createNotification(command, data),
      });
      window.dispatchEvent(event);
    }

    test('UPDATE_GIT_DIFF - catch branch when console.log throws', async () => {
      // 行75: console.log が例外を投げた場合の catch ブロック
      const onGitDiffData = jest.fn();
      renderHook(() => useCommunication({ onGitDiffData }));

      // console.log を一時的に差し替え:
      // 最初の git diff ログ呼び出しだけ例外を投げ、catch 内の呼び出しは通す
      consoleLogSpy.mockRestore();
      let throwCount = 0;
      const throwingLogSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        const firstArg = args[0];
        if (typeof firstArg === 'string' && firstArg.includes('Received git diff update (raw):') && throwCount === 0) {
          throwCount++;
          throw new Error('log failed');
        }
        // catch ブロック内の console.log や他の呼び出しはそのまま通す
      });

      await act(async () => {
        dispatchNotification('updateGitDiff', { diff: 'test-catch' });
      });

      // catch ブロック内の console.log が呼ばれたことを確認
      expect(throwingLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('could not stringify')
      );
      // コールバックも正常に呼ばれる
      expect(onGitDiffData).toHaveBeenCalledWith({ diff: 'test-catch' });

      throwingLogSpy.mockRestore();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    test('requestFontSettings - returns undefined when manager has no requestFontSettings', async () => {
      // 行405: manager.requestFontSettings が存在しない場合 undefined を返す
      // WebviewCommunicationManager は常に requestFontSettings を持つため
      // 通常は到達しない。プロトタイプから一時的に削除してテストする。
      const { result } = renderHook(() => useCommunication({}));

      // WebviewCommunicationManager のプロトタイプからメソッドを一時削除
      const WCMProto = require('../../communication/WebviewCommunicationManager').WebviewCommunicationManager.prototype;
      const originalMethod = WCMProto.requestFontSettings;
      delete WCMProto.requestFontSettings;

      let ret: any;
      await act(async () => {
        ret = await result.current.requestFontSettings();
      });

      expect(ret).toBeUndefined();

      // 復元
      WCMProto.requestFontSettings = originalMethod;
    });
  });
});
