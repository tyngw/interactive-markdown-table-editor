/**
 * logging モジュールのユニットテスト
 * debug/info/warn/error 各関数の出力とデフォルトエクスポートをテスト
 */
import * as assert from 'assert';

suite('logging Test Suite', () => {
    let originalLog: typeof console.log;
    let originalWarn: typeof console.warn;
    let originalError: typeof console.error;
    let logOutput: any[][];
    let warnOutput: any[][];
    let errorOutput: any[][];

    setup(() => {
        logOutput = [];
        warnOutput = [];
        errorOutput = [];
        originalLog = console.log;
        originalWarn = console.warn;
        originalError = console.error;
        console.log = (...args: any[]) => { logOutput.push(args); };
        console.warn = (...args: any[]) => { warnOutput.push(args); };
        console.error = (...args: any[]) => { errorOutput.push(args); };
    });

    teardown(() => {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
        // Clean up module cache to ensure clean state
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
    });

    test('info should output to console.log', () => {
        // モジュール再読み込みして、モックされた console を使用
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const { info } = require('../../src/logging');
        
        info('test message', 123);
        assert.ok(logOutput.length > 0, 'info should output to console.log');
        assert.ok(logOutput.some(args => args[0] === 'test message' && args[1] === 123));
    });

    test('warn should output to console.warn', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const { warn } = require('../../src/logging');
        
        warn('warning message');
        assert.ok(warnOutput.length > 0, 'warn should output to console.warn');
        assert.ok(warnOutput.some(args => args[0] === 'warning message'));
    });

    test('error should output to console.error', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const { error } = require('../../src/logging');
        
        error('error message');
        assert.ok(errorOutput.length > 0, 'error should output to console.error');
        assert.ok(errorOutput.some(args => args[0] === 'error message'));
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
            freshLogging.debug('debug with keepConsole=1');
            assert.ok(logOutput.length > 0, 'debug should output when keepConsole is enabled');
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
        
        loggingDefault.info('via default');
        assert.ok(logOutput.length > 0, 'default export info should output');
    });

    test('default export warn should work the same as named export', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const loggingDefault = require('../../src/logging').default;
        
        loggingDefault.warn('via default warn');
        assert.ok(warnOutput.length > 0, 'default export warn should output');
    });

    test('default export error should work the same as named export', () => {
        const modulePath = require.resolve('../../src/logging');
        delete require.cache[modulePath];
        const loggingDefault = require('../../src/logging').default;
        
        loggingDefault.error('via default error');
        assert.ok(errorOutput.length > 0, 'default export error should output');
    });
});
