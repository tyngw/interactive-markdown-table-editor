import { WebviewCommunicationManager } from '../../communication/WebviewCommunicationManager';
import { WebviewCommand, MessageType } from '../../../../src/communication/protocol';

/**
 * WebviewCommunicationManager Tests
 *
 * These tests ensure that the WebviewCommunicationManager properly implements
 * all necessary methods for webview-extension communication, including importCSV.
 */
describe('WebviewCommunicationManager', () => {
    let manager: WebviewCommunicationManager;
    let mockVSCodeApi: any;
    let sentMessages: any[];

    beforeEach(() => {
        // Reset sent messages
        sentMessages = [];

        // Create mock VSCode API
        mockVSCodeApi = {
            postMessage: jest.fn((message: any) => {
                sentMessages.push(message);
            }),
            getState: jest.fn(),
            setState: jest.fn()
        };

        // Create communication manager
        manager = new WebviewCommunicationManager(mockVSCodeApi);
    });

    afterEach(() => {
        manager.dispose();
    });

    describe('Command Methods Existence', () => {
        test('should have importCSV method', () => {
            expect(manager.importCSV).toBeDefined();
            expect(typeof manager.importCSV).toBe('function');
        });

        test('should have exportCSV method', () => {
            expect(manager.exportCSV).toBeDefined();
            expect(typeof manager.exportCSV).toBe('function');
        });

        test('should have all required command methods', () => {
            const requiredMethods = [
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
                'importCSV',
                'switchTable',
                'undo',
                'redo',
                'requestTableData',
                'requestThemeVariables',
                'requestSync'
            ];

            for (const method of requiredMethods) {
                expect((manager as any)[method]).toBeDefined();
                expect(typeof (manager as any)[method]).toBe('function');
            }
        });
    });

    describe('importCSV Method', () => {
        test('should send IMPORT_CSV notification without tableIndex', () => {
            manager.importCSV();

            expect(mockVSCodeApi.postMessage).toHaveBeenCalledTimes(1);
            const message = sentMessages[0];

            expect(message.type).toBe(MessageType.NOTIFICATION);
            expect(message.command).toBe(WebviewCommand.IMPORT_CSV);
            expect(message.data).toEqual({ tableIndex: undefined });
            expect(message.id).toBeDefined();
            expect(message.timestamp).toBeDefined();
        });

        test('should send IMPORT_CSV notification with tableIndex', () => {
            const tableIndex = 2;
            manager.importCSV(tableIndex);

            expect(mockVSCodeApi.postMessage).toHaveBeenCalledTimes(1);
            const message = sentMessages[0];

            expect(message.type).toBe(MessageType.NOTIFICATION);
            expect(message.command).toBe(WebviewCommand.IMPORT_CSV);
            expect(message.data).toEqual({ tableIndex: 2 });
            expect(message.id).toBeDefined();
            expect(message.timestamp).toBeDefined();
        });

        test('should send IMPORT_CSV notification with tableIndex 0', () => {
            manager.importCSV(0);

            expect(mockVSCodeApi.postMessage).toHaveBeenCalledTimes(1);
            const message = sentMessages[0];

            expect(message.data).toEqual({ tableIndex: 0 });
        });
    });

    describe('exportCSV Method', () => {
        test('should send EXPORT_CSV notification with all parameters', () => {
            const csvContent = 'Name,Age\nJohn,30';
            const filename = 'test.csv';
            const encoding = 'utf8';
            const tableIndex = 1;

            manager.exportCSV(csvContent, filename, encoding, tableIndex);

            expect(mockVSCodeApi.postMessage).toHaveBeenCalledTimes(1);
            const message = sentMessages[0];

            expect(message.type).toBe(MessageType.NOTIFICATION);
            expect(message.command).toBe(WebviewCommand.EXPORT_CSV);
            expect(message.data).toEqual({
                csvContent,
                filename,
                encoding,
                tableIndex
            });
        });
    });

    describe('Message Structure', () => {
        test('all notification messages should have required fields', () => {
            // Test various command methods
            manager.importCSV();
            manager.exportCSV('test', 'file.csv');
            manager.undo();
            manager.redo();

            expect(sentMessages.length).toBe(4);

            for (const message of sentMessages) {
                expect(message.id).toBeDefined();
                expect(message.type).toBe(MessageType.NOTIFICATION);
                expect(message.command).toBeDefined();
                expect(message.timestamp).toBeDefined();
                expect(typeof message.timestamp).toBe('number');
            }
        });

        test('message IDs should be unique', () => {
            manager.importCSV();
            manager.importCSV();
            manager.importCSV();

            const ids = sentMessages.map(m => m.id);
            const uniqueIds = new Set(ids);

            expect(uniqueIds.size).toBe(ids.length);
        });
    });

    describe('Integration with Protocol', () => {
        test('importCSV should use correct WebviewCommand enum value', () => {
            manager.importCSV();

            const message = sentMessages[0];
            expect(message.command).toBe(WebviewCommand.IMPORT_CSV);
            expect(message.command).toBe('importCSV');
        });

        test('importCSV data structure should match ImportCSVData interface', () => {
            manager.importCSV(5);

            const message = sentMessages[0];
            const data = message.data;

            // Should have tableIndex property (or undefined)
            expect('tableIndex' in data).toBe(true);

            // If tableIndex is provided, it should be a number
            if (data.tableIndex !== undefined) {
                expect(typeof data.tableIndex).toBe('number');
            }
        });
    });

    describe('Error Handling', () => {
        test('should handle VSCode API failures gracefully', () => {
            // Make postMessage throw an error
            mockVSCodeApi.postMessage.mockImplementation(() => {
                throw new Error('VSCode API error');
            });

            // Should throw the error (not swallow it)
            expect(() => {
                manager.importCSV();
            }).toThrow('VSCode API error');
        });

        test('should work after VSCode API is unavailable', () => {
            // Create manager with null API (should still be set in constructor)
            const nullManager = new WebviewCommunicationManager(null as any);

            // Should not throw, but log error
            expect(() => {
                nullManager.importCSV();
            }).not.toThrow();

            nullManager.dispose();
        });
    });
});
