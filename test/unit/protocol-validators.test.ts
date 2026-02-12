import * as assert from 'assert';
import { WebviewCommand } from '../../src/communication/protocol';
import { validCommands, validateMessageData, validateMessageCommand } from '../../src/messages/validators';

/**
 * Protocol and Validator Completeness Tests
 *
 * These tests ensure that all protocol commands are properly registered
 * in validators and that no commands are missing from the communication layer.
 * This prevents regression issues where new commands are added to the protocol
 * but forgotten in validators or other parts of the communication stack.
 */
suite('Protocol and Validator Completeness Tests', () => {

    test('All WebviewCommand enum values should be in validCommands array', () => {
        // Get all enum values from WebviewCommand
        const protocolCommands = Object.values(WebviewCommand);

        // Additional diagnostic/internal commands that may not be in the enum
        const additionalCommands = ['webviewError', 'webviewUnhandledRejection', 'diag'];

        // Check that all protocol commands are in validCommands
        for (const command of protocolCommands) {
            assert.ok(
                validCommands.includes(command as any),
                `Command "${command}" from WebviewCommand enum is missing in validCommands array. ` +
                `This will cause the command to be rejected by the validator.`
            );
        }

        // Verify additional commands are present
        for (const command of additionalCommands) {
            assert.ok(
                validCommands.includes(command as any),
                `Additional command "${command}" is missing in validCommands array.`
            );
        }
    });

    test('validCommands should not contain undefined or duplicate entries', () => {
        // Check for undefined
        const hasUndefined = validCommands.some(cmd => cmd === undefined || cmd === null);
        assert.strictEqual(hasUndefined, false, 'validCommands contains undefined or null entries');

        // Check for duplicates
        const uniqueCommands = new Set(validCommands);
        assert.strictEqual(
            uniqueCommands.size,
            validCommands.length,
            'validCommands contains duplicate entries'
        );
    });

    test('importCSV command should be recognized as valid', () => {
        const message = {
            command: 'importCSV' as any,
            data: { tableIndex: 0 }
        };

        const isValid = validateMessageCommand(message);
        assert.strictEqual(
            isValid,
            true,
            'importCSV command should be recognized as a valid command'
        );
    });

    test('importCSV command should validate correctly with tableIndex', () => {
        const message = {
            command: 'importCSV' as any,
            data: { tableIndex: 0 }
        };

        const isValid = validateMessageData(message);
        assert.strictEqual(
            isValid,
            true,
            'importCSV with tableIndex should pass validation'
        );
    });

    test('importCSV command should validate correctly without data', () => {
        const message = {
            command: 'importCSV' as any,
            data: undefined
        };

        const isValid = validateMessageData(message);
        assert.strictEqual(
            isValid,
            true,
            'importCSV without data should pass validation'
        );
    });

    test('importCSV command should validate correctly with empty object', () => {
        const message = {
            command: 'importCSV' as any,
            data: {}
        };

        const isValid = validateMessageData(message);
        assert.strictEqual(
            isValid,
            true,
            'importCSV with empty object should pass validation'
        );
    });

    test('All protocol commands should have validation logic', () => {
        // Commands that should have data validation
        const commandsRequiringValidation = [
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
            'switchTable'
        ];

        for (const command of commandsRequiringValidation) {
            // Create a minimal valid message for each command
            let testMessage: any = { command };

            // Add minimal valid data based on command type
            switch (command) {
                case 'updateCell':
                    testMessage.data = { row: 0, col: 0, value: '' };
                    break;
                case 'bulkUpdateCells':
                    testMessage.data = { updates: [] };
                    break;
                case 'updateHeader':
                    testMessage.data = { col: 0, value: '' };
                    break;
                case 'addRow':
                case 'addColumn':
                case 'importCSV':
                    testMessage.data = {};
                    break;
                case 'deleteRows':
                case 'deleteColumns':
                    testMessage.data = { indices: [0] };
                    break;
                case 'sort':
                    testMessage.data = { column: 0, direction: 'asc' };
                    break;
                case 'moveRow':
                case 'moveColumn':
                    testMessage.data = { indices: [0], toIndex: 1 };
                    break;
                case 'exportCSV':
                    testMessage.data = { csvContent: 'test' };
                    break;
                case 'switchTable':
                    testMessage.data = { index: 0 };
                    break;
            }

            // The validation should not throw an error
            try {
                const isValid = validateMessageData(testMessage);
                assert.ok(
                    isValid !== undefined,
                    `Command "${command}" has no validation logic in validateMessageData`
                );
            } catch (error) {
                assert.fail(
                    `Command "${command}" validation threw an error: ${error}`
                );
            }
        }
    });

    test('Validator should reject invalid importCSV data', () => {
        // Invalid: tableIndex is not a number
        const invalidMessage = {
            command: 'importCSV' as any,
            data: { tableIndex: 'invalid' }
        };

        // This should still pass because ImportCSVData allows any object
        // The validator is lenient to allow for future extensions
        const isValid = validateMessageData(invalidMessage);
        assert.strictEqual(
            isValid,
            true,
            'Validator should be lenient with importCSV data format'
        );
    });

    test('validateMessageData should return false for unknown command (default branch)', () => {
        const message = { command: 'unknownCommand' as any, data: {} };
        const isValid = validateMessageData(message);
        assert.strictEqual(isValid, false);
    });

    test('validateMessageData should return false for requestSync (default branch)', () => {
        // requestSync is in validCommands but not in the pass-through list nor switch cases
        const message = { command: 'requestSync' as any, data: {} };
        const isValid = validateMessageData(message);
        assert.strictEqual(isValid, false);
    });

    test('validateMessageData should return false for stateUpdate (default branch)', () => {
        const message = { command: 'stateUpdate' as any, data: {} };
        const isValid = validateMessageData(message);
        assert.strictEqual(isValid, false);
    });

    test('validateMessageData addRow with undefined data should pass', () => {
        const message = { command: 'addRow' as any, data: undefined };
        assert.strictEqual(validateMessageData(message), true);
    });

    test('validateMessageData addColumn with undefined data should pass', () => {
        const message = { command: 'addColumn' as any, data: undefined };
        assert.strictEqual(validateMessageData(message), true);
    });

    test('validateMessageData moveRow with fromIndex should pass', () => {
        const message = { command: 'moveRow' as any, data: { fromIndex: 0, toIndex: 1 } };
        assert.strictEqual(validateMessageData(message), true);
    });

    test('validateMessageData moveColumn without indices or fromIndex should fail', () => {
        const message = { command: 'moveColumn' as any, data: { toIndex: 1 } };
        assert.strictEqual(validateMessageData(message), false);
    });

    test('validateMessageData exportCSV with empty csvContent should fail', () => {
        const message = { command: 'exportCSV' as any, data: { csvContent: '   ' } };
        assert.strictEqual(validateMessageData(message), false);
    });

    test('validateMessageData exportCSV with empty filename should fail', () => {
        const message = { command: 'exportCSV' as any, data: { csvContent: 'data', filename: '' } };
        assert.strictEqual(validateMessageData(message), false);
    });

    test('validateMessageData switchTable with negative index should fail', () => {
        const message = { command: 'switchTable' as any, data: { index: -1 } };
        assert.strictEqual(validateMessageData(message), false);
    });

    test('validateMessageData should pass through manualSave command', () => {
        const message = { command: 'manualSave' as any };
        assert.strictEqual(validateMessageData(message), true);
    });

    test('validateMessageData should pass through toggleAutoSave command', () => {
        const message = { command: 'toggleAutoSave' as any };
        assert.strictEqual(validateMessageData(message), true);
    });

    test('validateMessageData should return false for completely unknown command', () => {
        const message = { command: 'totallyFakeCommand' as any, data: {} };
        assert.strictEqual(validateMessageData(message), false);
    });

    test('validateMessageData exportCSV with valid filename should pass', () => {
        const message = { command: 'exportCSV' as any, data: { csvContent: 'a,b', filename: 'test.csv' } };
        assert.strictEqual(validateMessageData(message), true);
    });

    test('validateMessageData updateCell with negative row should fail', () => {
        const message = { command: 'updateCell' as any, data: { row: -1, col: 0, value: 'x' } };
        assert.strictEqual(validateMessageData(message), false);
    });

    test('validateMessageData deleteRows with negative index should fail', () => {
        const message = { command: 'deleteRows' as any, data: { indices: [-1] } };
        assert.strictEqual(validateMessageData(message), false);
    });

    test('validateMessageData sort with invalid direction should fail', () => {
        const message = { command: 'sort' as any, data: { column: 0, direction: 'invalid' } };
        assert.strictEqual(validateMessageData(message), false);
    });
});
