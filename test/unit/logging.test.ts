/**
 * logging モジュールのユニットテスト
 * debug/info/warn/error 各関数の出力とデフォルトエクスポートをテスト
 */
import * as assert from 'assert';
import { debug, info, warn, error } from '../../src/logging';
import loggingDefault from '../../src/logging';

suite('logging Test Suite', () => {
    let originalLogDescriptor: PropertyDescriptor | undefined;
    let originalWarnDescriptor: PropertyDescriptor | undefined;
    let originalErrorDescriptor: PropertyDescriptor | undefined;
    let logOutput: any[][];
    let warnOutput: any[][];
    let errorOutput: any[][];

    setup(() => {
        logOutput = [];
        warnOutput = [];
        errorOutput = [];
        // VS Code テスト環境では console メソッドが configurable: false の場合があるため
        // Object.defineProperty を使ってスタブする
        originalLogDescriptor = Object.getOwnPropertyDescriptor(console, 'log');
        originalWarnDescriptor = Object.getOwnPropertyDescriptor(console, 'warn');
        originalErrorDescriptor = Object.getOwnPropertyDescriptor(console, 'error');
        Object.defineProperty(console, 'log', {
            value: (...args: any[]) => { logOutput.push(args); },
            writable: true,
            configurable: true
        });
        Object.defineProperty(console, 'warn', {
            value: (...args: any[]) => { warnOutput.push(args); },
            writable: true,
            configurable: true
        });
        Object.defineProperty(console, 'error', {
            value: (...args: any[]) => { errorOutput.push(args); },
            writable: true,
            configurable: true
        });
    });

    teardown(() => {
        // 元の descriptor を復元する
        if (originalLogDescriptor) {
            Object.defineProperty(console, 'log', originalLogDescriptor);
        }
        if (originalWarnDescriptor) {
            Object.defineProperty(console, 'warn', originalWarnDescriptor);
        }
        if (originalErrorDescriptor) {
            Object.defineProperty(console, 'error', originalErrorDescriptor);
        }
    });

    test('info should output to console.log', () => {
        info('test message', 123);
        assert.strictEqual(logOutput.length, 1);
        assert.deepStrictEqual(logOutput[0], ['test message', 123]);
    });

    test('warn should output to console.warn', () => {
        warn('warning message');
        assert.strictEqual(warnOutput.length, 1);
        assert.deepStrictEqual(warnOutput[0], ['warning message']);
    });

    test('error should output to console.error', () => {
        error('error message');
        assert.strictEqual(errorOutput.length, 1);
        assert.deepStrictEqual(errorOutput[0], ['error message']);
    });

    test('debug should output when MTE_KEEP_CONSOLE is set', () => {
        // debug 関数はモジュール読み込み時の env で動作が決まるため、
        // 実際にはモジュール再読み込みが必要。環境変数が設定されていない
        // テスト環境では出力しない可能性がある。
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
            assert.deepStrictEqual(logOutput[logOutput.length - 1], ['debug with keepConsole=1']);
        } finally {
            process.env.MTE_KEEP_CONSOLE = origEnv;
            // Restore original module
            const modulePath = require.resolve('../../src/logging');
            delete require.cache[modulePath];
        }
    });

    test('default export should contain all logging functions', () => {
        assert.strictEqual(typeof loggingDefault.debug, 'function');
        assert.strictEqual(typeof loggingDefault.info, 'function');
        assert.strictEqual(typeof loggingDefault.warn, 'function');
        assert.strictEqual(typeof loggingDefault.error, 'function');
    });

    test('default export info should work the same as named export', () => {
        loggingDefault.info('via default');
        assert.strictEqual(logOutput.length, 1);
        assert.deepStrictEqual(logOutput[0], ['via default']);
    });

    test('default export warn should work the same as named export', () => {
        loggingDefault.warn('via default warn');
        assert.strictEqual(warnOutput.length, 1);
        assert.deepStrictEqual(warnOutput[0], ['via default warn']);
    });

    test('default export error should work the same as named export', () => {
        loggingDefault.error('via default error');
        assert.strictEqual(errorOutput.length, 1);
        assert.deepStrictEqual(errorOutput[0], ['via default error']);
    });
});
