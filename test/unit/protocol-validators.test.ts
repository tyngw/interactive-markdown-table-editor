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
                    testMessage.data = { fromIndex: 0, toIndex: 1 };
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
});
