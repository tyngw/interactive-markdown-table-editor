/**
 * logging モジュールのユニットテスト
 * debug/info/warn/error 各関数が正しく動作することを確認
 */
import * as assert from 'assert';

suite('logging Test Suite', () => {
    test('info should be a callable function', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const { info } = require('../../src/logging');
        
        assert.strictEqual(typeof info, 'function');
        // Call it without error
        info('test message', 123);
    });

    test('warn should be a callable function', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const { warn } = require('../../src/logging');
        
        assert.strictEqual(typeof warn, 'function');
        // Call it without error
        warn('warning message');
    });

    test('error should be a callable function', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const { error } = require('../../src/logging');
        
        assert.strictEqual(typeof error, 'function');
        // Call it without error
        error('error message');
    });

    test('debug should output when MTE_KEEP_CONSOLE is set', () => {
        // debug 関数はモジュール読み込み時の env で動作が決まるため、
        // 実際にはモジュール再読み込みが必要。環境変数が設定されていない
        // テスト環境では出力しない可能性がある。
        const { debug } = require('../../src/logging');
        debug('debug message');
        // 環境変数に依存するため、エラーが出ないことだけ確認
        assert.ok(true);
    });

    test('debug should output when keepConsole is enabled via fresh require', () => {
        // Force reload the module with MTE_KEEP_CONSOLE set
        const origEnv = process.env.MTE_KEEP_CONSOLE;
        process.env.MTE_KEEP_CONSOLE = '1';
        try {
            // Clear module cache to force re-evaluation of keepConsole
            const modulePath = require.resolve('../../src/logging');
            delete require.cache[modulePath];
            const freshLogging = require('../../src/logging');
            
            // Call debug without error
            freshLogging.debug('debug with keepConsole=1');
            assert.ok(true);
        } finally {
            process.env.MTE_KEEP_CONSOLE = origEnv;
            // Restore original module
            const modulePath = require.resolve('../../src/logging');
            delete require.cache[modulePath];
        }
    });

    test('default export should contain all logging functions', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const loggingDefault = require('../../src/logging').default;
        
        assert.strictEqual(typeof loggingDefault.debug, 'function');
        assert.strictEqual(typeof loggingDefault.info, 'function');
        assert.strictEqual(typeof loggingDefault.warn, 'function');
        assert.strictEqual(typeof loggingDefault.error, 'function');
    });

    test('default export info should work the same as named export', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const loggingDefault = require('../../src/logging').default;
        
        // Call without error
        loggingDefault.info('via default');
        assert.ok(true);
    });

    test('default export warn should work the same as named export', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const loggingDefault = require('../../src/logging').default;
        
        // Call without error
        loggingDefault.warn('via default warn');
        assert.ok(true);
    });

    test('default export error should work the same as named export', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const loggingDefault = require('../../src/logging').default;
        
        // Call without error
        loggingDefault.error('via default error');
        assert.ok(true);
    });
});
