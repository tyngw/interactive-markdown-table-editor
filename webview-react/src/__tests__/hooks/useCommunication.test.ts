import { renderHook, waitFor } from '@testing-library/react';
import { useCommunication } from '../../hooks/useCommunication';

/**
 * useCommunication Hook Tests
 *
 * These tests ensure that the useCommunication hook properly routes
 * all commands including importCSV through the communication manager.
 */

// Mock the vscodeApi
const mockVSCodeApi = {
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn()
};

// Mock the ensureVsCodeApi function
jest.mock('../../vscodeApi', () => ({
  ensureVsCodeApi: jest.fn(() => mockVSCodeApi)
}));

describe('useCommunication Hook', () => {
  let sentMessages: any[];

  beforeEach(() => {
    sentMessages = [];
    mockVSCodeApi.postMessage.mockImplementation((message: any) => {
      sentMessages.push(message);
    });
    jest.clearAllMocks();
  });

  describe('Command Method Routing', () => {
    test('should have importCSV method in returned object', () => {
      const { result } = renderHook(() => useCommunication({}));

      expect(result.current.importCSV).toBeDefined();
      expect(typeof result.current.importCSV).toBe('function');
    });

    test('importCSV method should send correct message', async () => {
      const { result } = renderHook(() => useCommunication({}));

      // Wait for communication manager to initialize
      await waitFor(() => {
        expect(result.current.isConnected).toBeDefined();
      });

      // Call importCSV
      result.current.importCSV(1);

      // Wait for message to be sent
      await waitFor(() => {
        expect(sentMessages.length).toBeGreaterThan(0);
      });

      // Find the importCSV message
      const importCsvMessage = sentMessages.find(m => m.command === 'importCSV');
      expect(importCsvMessage).toBeDefined();
      expect(importCsvMessage.data).toEqual({ tableIndex: 1 });
    });

    test('sendMessage should route importCSV command correctly', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await waitFor(() => {
        expect(result.current.isConnected).toBeDefined();
      });

      // Call sendMessage with importCSV command
      result.current.sendMessage({ command: 'importCSV', data: { tableIndex: 2 } });

      await waitFor(() => {
        expect(sentMessages.length).toBeGreaterThan(0);
      });

      const importCsvMessage = sentMessages.find(m => m.command === 'importCSV');
      expect(importCsvMessage).toBeDefined();
      expect(importCsvMessage.data.tableIndex).toBe(2);
    });

    test('sendMessage should handle importCSV without tableIndex', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await waitFor(() => {
        expect(result.current.isConnected).toBeDefined();
      });

      result.current.sendMessage({ command: 'importCSV', data: {} });

      await waitFor(() => {
        expect(sentMessages.length).toBeGreaterThan(0);
      });

      const importCsvMessage = sentMessages.find(m => m.command === 'importCSV');
      expect(importCsvMessage).toBeDefined();
    });
  });

  describe('All Command Methods Should Be Available', () => {
    test('should have all required command methods', () => {
      const { result } = renderHook(() => useCommunication({}));

      const requiredMethods = [
        'sendMessage',
        'requestTableData',
        'updateCell',
        'bulkUpdateCells',
        'updateHeader',
        'addRow',
        'deleteRows',
        'addColumn',
        'deleteColumns',
        'sort',
        'moveRow',
        'moveColumn',
        'exportCSV',
        'importCSV',  // This is the key method we're testing
        'switchTable',
        'requestThemeVariables',
        'undo',
        'redo',
        'requestSync'
      ];

      for (const method of requiredMethods) {
        expect(result.current[method as keyof typeof result.current]).toBeDefined();
        expect(typeof result.current[method as keyof typeof result.current]).toBe('function');
      }
    });
  });

  describe('Command Routing Consistency', () => {
    test('importCSV should route the same way as exportCSV', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await waitFor(() => {
        expect(result.current.isConnected).toBeDefined();
      });

      // Call both methods
      result.current.importCSV(1);
      result.current.exportCSV('test,data', 'test.csv', 'utf8', 1);

      await waitFor(() => {
        expect(sentMessages.length).toBeGreaterThan(1);
      });

      const importMsg = sentMessages.find(m => m.command === 'importCSV');
      const exportMsg = sentMessages.find(m => m.command === 'exportCSV');

      // Both should have similar structure
      expect(importMsg).toBeDefined();
      expect(exportMsg).toBeDefined();
      expect(importMsg.type).toBe(exportMsg.type);
      expect(importMsg.id).toBeDefined();
      expect(exportMsg.id).toBeDefined();
      expect(importMsg.timestamp).toBeDefined();
      expect(exportMsg.timestamp).toBeDefined();
    });
  });

  describe('Switch Statement Coverage', () => {
    test('importCSV case should be handled in sendMessage switch', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await waitFor(() => {
        expect(result.current.isConnected).toBeDefined();
      });

      // This tests that the switch statement has a case for importCSV
      // If it doesn't, it will fall through to the default case and log a warning
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      result.current.sendMessage('importCSV', { tableIndex: 0 });

      await waitFor(() => {
        expect(sentMessages.length).toBeGreaterThan(0);
      });

      // Should NOT log a warning about unknown command
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Unknown command'),
        'importCSV'
      );

      consoleWarnSpy.mockRestore();
    });

    test('all WebviewCommand values should have switch cases', async () => {
      const { result } = renderHook(() => useCommunication({}));

      await waitFor(() => {
        expect(result.current.isConnected).toBeDefined();
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Test key commands that should have switch cases
      const commandsToTest = [
        { command: 'updateCell', data: { row: 0, col: 0, value: 'test' } },
        { command: 'addRow', data: { index: 0 } },
        { command: 'addColumn', data: { index: 0 } },
        { command: 'deleteRows', data: { indices: [0] } },
        { command: 'deleteColumns', data: { indices: [0] } },
        { command: 'sort', data: { column: 0, direction: 'asc' } },
        { command: 'moveRow', data: { fromIndex: 0, toIndex: 1 } },
        { command: 'moveColumn', data: { fromIndex: 0, toIndex: 1 } },
        { command: 'exportCSV', data: { csvContent: 'test' } },
        { command: 'importCSV', data: { tableIndex: 0 } },
        { command: 'switchTable', data: { index: 0 } },
        { command: 'undo', data: undefined },
        { command: 'redo', data: undefined }
      ];

      for (const { command, data } of commandsToTest) {
        sentMessages = [];
        result.current.sendMessage({ command, data });

        await waitFor(() => {
          // Message should be sent (not fall through to default case)
          expect(sentMessages.length).toBeGreaterThan(0);
        });
      }

      // None should have logged unknown command warning
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Unknown command')
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
