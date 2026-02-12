/**
 * validators のユニットテスト
 * メッセージ構造・コマンド・データのバリデーションをテスト
 */
import * as assert from 'assert';
import {
    isObject,
    validateBasicMessageStructure,
    validateMessageCommand,
    validateMessageData,
    validCommands
} from '../../src/messages/validators';

suite('validators Test Suite', () => {
    suite('isObject', () => {
        test('should return true for plain object', () => {
            assert.strictEqual(isObject({ a: 1 }), true);
        });
        test('should return false for null', () => {
            assert.strictEqual(isObject(null), false);
        });
        test('should return false for undefined', () => {
            assert.strictEqual(isObject(undefined), false);
        });
        test('should return false for string', () => {
            assert.strictEqual(isObject('hello'), false);
        });
        test('should return false for number', () => {
            assert.strictEqual(isObject(42), false);
        });
        test('should return true for array', () => {
            assert.strictEqual(isObject([1, 2]), true);
        });
    });

    suite('validateBasicMessageStructure', () => {
        test('should return true for valid message', () => {
            assert.strictEqual(validateBasicMessageStructure({ command: 'test' }), true);
        });
        test('should return false for null', () => {
            assert.strictEqual(validateBasicMessageStructure(null), false);
        });
        test('should return false for non-object', () => {
            assert.strictEqual(validateBasicMessageStructure('string'), false);
        });
        test('should return false for missing command', () => {
            assert.strictEqual(validateBasicMessageStructure({ data: 123 }), false);
        });
        test('should return false for non-string command', () => {
            assert.strictEqual(validateBasicMessageStructure({ command: 123 }), false);
        });
    });

    suite('validateMessageCommand', () => {
        test('should return true for valid command', () => {
            assert.strictEqual(validateMessageCommand({ command: 'requestTableData' } as any), true);
        });
        test('should return false for invalid command', () => {
            assert.strictEqual(validateMessageCommand({ command: 'unknownCommand' } as any), false);
        });
        test('should validate all known commands', () => {
            for (const cmd of validCommands) {
                assert.strictEqual(validateMessageCommand({ command: cmd } as any), true, `Command ${cmd} should be valid`);
            }
        });
    });

    suite('validateMessageData', () => {
        // Pass-through commands (no data validation needed)
        test('should pass diag command', () => {
            assert.strictEqual(validateMessageData({ command: 'diag' } as any), true);
        });
        test('should pass webviewError command', () => {
            assert.strictEqual(validateMessageData({ command: 'webviewError' } as any), true);
        });
        test('should pass pong command', () => {
            assert.strictEqual(validateMessageData({ command: 'pong' } as any), true);
        });
        test('should pass requestThemeVariables command', () => {
            assert.strictEqual(validateMessageData({ command: 'requestThemeVariables' } as any), true);
        });
        test('should pass requestFontSettings command', () => {
            assert.strictEqual(validateMessageData({ command: 'requestFontSettings' } as any), true);
        });
        test('should pass undo command', () => {
            assert.strictEqual(validateMessageData({ command: 'undo' } as any), true);
        });
        test('should pass redo command', () => {
            assert.strictEqual(validateMessageData({ command: 'redo' } as any), true);
        });
        test('should pass requestTableData command', () => {
            assert.strictEqual(validateMessageData({ command: 'requestTableData' } as any), true);
        });
        test('should pass toggleAutoSave command', () => {
            assert.strictEqual(validateMessageData({ command: 'toggleAutoSave' } as any), true);
        });
        test('should pass manualSave command', () => {
            assert.strictEqual(validateMessageData({ command: 'manualSave' } as any), true);
        });
        test('should pass webviewUnhandledRejection command', () => {
            assert.strictEqual(validateMessageData({ command: 'webviewUnhandledRejection' } as any), true);
        });

        // updateCell
        test('should validate updateCell with valid data', () => {
            assert.strictEqual(validateMessageData({ command: 'updateCell', data: { row: 0, col: 0, value: 'test' } } as any), true);
        });
        test('should reject updateCell with missing row', () => {
            assert.strictEqual(validateMessageData({ command: 'updateCell', data: { col: 0, value: 'test' } } as any), false);
        });
        test('should reject updateCell with negative row', () => {
            assert.strictEqual(validateMessageData({ command: 'updateCell', data: { row: -1, col: 0, value: 'test' } } as any), false);
        });

        // bulkUpdateCells
        test('should validate bulkUpdateCells with valid data', () => {
            assert.strictEqual(validateMessageData({ command: 'bulkUpdateCells', data: { updates: [{ row: 0, col: 0, value: 'v' }] } } as any), true);
        });
        test('should reject bulkUpdateCells with non-array updates', () => {
            assert.strictEqual(validateMessageData({ command: 'bulkUpdateCells', data: { updates: 'bad' } } as any), false);
        });

        // updateHeader
        test('should validate updateHeader with valid data', () => {
            assert.strictEqual(validateMessageData({ command: 'updateHeader', data: { col: 0, value: 'Header' } } as any), true);
        });
        test('should reject updateHeader with missing col', () => {
            assert.strictEqual(validateMessageData({ command: 'updateHeader', data: { value: 'Header' } } as any), false);
        });

        // addRow
        test('should validate addRow with undefined data', () => {
            assert.strictEqual(validateMessageData({ command: 'addRow' } as any), true);
        });
        test('should validate addRow with object data', () => {
            assert.strictEqual(validateMessageData({ command: 'addRow', data: { position: 0 } } as any), true);
        });

        // deleteRows
        test('should validate deleteRows with valid data', () => {
            assert.strictEqual(validateMessageData({ command: 'deleteRows', data: { indices: [0, 1] } } as any), true);
        });
        test('should reject deleteRows with negative indices', () => {
            assert.strictEqual(validateMessageData({ command: 'deleteRows', data: { indices: [-1] } } as any), false);
        });

        // addColumn
        test('should validate addColumn with undefined data', () => {
            assert.strictEqual(validateMessageData({ command: 'addColumn' } as any), true);
        });

        // deleteColumns
        test('should validate deleteColumns with valid data', () => {
            assert.strictEqual(validateMessageData({ command: 'deleteColumns', data: { indices: [0] } } as any), true);
        });

        // sort
        test('should validate sort with valid data', () => {
            assert.strictEqual(validateMessageData({ command: 'sort', data: { column: 0, direction: 'asc' } } as any), true);
        });
        test('should reject sort with invalid direction', () => {
            assert.strictEqual(validateMessageData({ command: 'sort', data: { column: 0, direction: 'invalid' } } as any), false);
        });

        // moveRow
        test('should validate moveRow with indices', () => {
            assert.strictEqual(validateMessageData({ command: 'moveRow', data: { indices: [0, 1], toIndex: 3 } } as any), true);
        });
        test('should validate moveRow with fromIndex', () => {
            assert.strictEqual(validateMessageData({ command: 'moveRow', data: { fromIndex: 0, toIndex: 2 } } as any), true);
        });
        test('should reject moveRow with no indices or fromIndex', () => {
            assert.strictEqual(validateMessageData({ command: 'moveRow', data: { toIndex: 2 } } as any), false);
        });
        test('should reject moveRow with missing toIndex', () => {
            assert.strictEqual(validateMessageData({ command: 'moveRow', data: { indices: [0] } } as any), false);
        });
        test('should reject moveRow with negative toIndex', () => {
            assert.strictEqual(validateMessageData({ command: 'moveRow', data: { indices: [0], toIndex: -1 } } as any), false);
        });
        test('should reject moveRow with non-object data', () => {
            assert.strictEqual(validateMessageData({ command: 'moveRow', data: 'bad' } as any), false);
        });
        test('should reject moveRow with empty indices', () => {
            assert.strictEqual(validateMessageData({ command: 'moveRow', data: { indices: [], toIndex: 1 } } as any), false);
        });
        test('should reject moveRow with negative indices', () => {
            assert.strictEqual(validateMessageData({ command: 'moveRow', data: { indices: [-1], toIndex: 1 } } as any), false);
        });

        // moveColumn
        test('should validate moveColumn with indices', () => {
            assert.strictEqual(validateMessageData({ command: 'moveColumn', data: { indices: [1], toIndex: 0 } } as any), true);
        });
        test('should validate moveColumn with fromIndex', () => {
            assert.strictEqual(validateMessageData({ command: 'moveColumn', data: { fromIndex: 1, toIndex: 0 } } as any), true);
        });
        test('should reject moveColumn with no move data', () => {
            assert.strictEqual(validateMessageData({ command: 'moveColumn', data: { toIndex: 0 } } as any), false);
        });
        test('should reject moveColumn with non-object data', () => {
            assert.strictEqual(validateMessageData({ command: 'moveColumn', data: null } as any), false);
        });

        // exportCSV
        test('should validate exportCSV with valid data', () => {
            assert.strictEqual(validateMessageData({ command: 'exportCSV', data: { csvContent: 'a,b\n1,2' } } as any), true);
        });
        test('should reject exportCSV with empty csvContent', () => {
            assert.strictEqual(validateMessageData({ command: 'exportCSV', data: { csvContent: '  ' } } as any), false);
        });
        test('should reject exportCSV with missing csvContent', () => {
            assert.strictEqual(validateMessageData({ command: 'exportCSV', data: {} } as any), false);
        });
        test('should reject exportCSV with non-string csvContent', () => {
            assert.strictEqual(validateMessageData({ command: 'exportCSV', data: { csvContent: 123 } } as any), false);
        });
        test('should reject exportCSV with empty filename', () => {
            assert.strictEqual(validateMessageData({ command: 'exportCSV', data: { csvContent: 'a,b', filename: '' } } as any), false);
        });
        test('should accept exportCSV with valid filename', () => {
            assert.strictEqual(validateMessageData({ command: 'exportCSV', data: { csvContent: 'a,b', filename: 'test.csv' } } as any), true);
        });

        // importCSV
        test('should validate importCSV with undefined data', () => {
            assert.strictEqual(validateMessageData({ command: 'importCSV' } as any), true);
        });

        // switchTable
        test('should validate switchTable with valid data', () => {
            assert.strictEqual(validateMessageData({ command: 'switchTable', data: { index: 0 } } as any), true);
        });
        test('should reject switchTable with negative index', () => {
            assert.strictEqual(validateMessageData({ command: 'switchTable', data: { index: -1 } } as any), false);
        });

        // requestSync / stateUpdate
        test('should return false for requestSync (falls through to default)', () => {
            assert.strictEqual(validateMessageData({ command: 'requestSync' } as any), false);
        });
        test('should return false for stateUpdate (falls through to default)', () => {
            assert.strictEqual(validateMessageData({ command: 'stateUpdate' } as any), false);
        });

        // Unknown command
        test('should return false for unknown command', () => {
            assert.strictEqual(validateMessageData({ command: 'totallyUnknown' } as any), false);
        });
    });
});
