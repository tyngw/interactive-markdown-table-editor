// test/vscode-tests/index.ts
// @vscode/test-electron テスト実行エントリポイント

import * as path from 'path';
import Mocha from 'mocha';
import { GlobSync } from 'glob';

// Debug: Check what environment variables we have at the start
const isCI = process.env.CI === 'true' || process.env.CI === 'github';
if (isCI) {
    console.log('[vscode-tests] Starting test runner');
    console.log('[vscode-tests] NODE_OPTIONS:', process.env.NODE_OPTIONS);
    console.log('[vscode-tests] NODE_PATH:', process.env.NODE_PATH);
    console.log('[vscode-tests] CI:', process.env.CI);
}

// NYC coverage instrumentation hook
// If running under NYC coverage, require the NYC wrap module to instrument this process
// This is necessary because Electron doesn't inherit NODE_OPTIONS from the parent process
if (process.env.NODE_OPTIONS && process.env.NODE_OPTIONS.includes('wrap.js')) {
    try {
        // Try to require NYC wrap module - this will instrument the current process
        const nycWrap = require.resolve('nyc/lib/wrap.js');
        require(nycWrap);
        if (isCI) {
            console.log('[vscode-tests] NYC instrumentation hook loaded');
        }
    }
    catch (err) {
        if (isCI) {
            console.error('[vscode-tests] Failed to load NYC wrap:', err);
        }
    }
} else {
    if (isCI) {
        console.log('[vscode-tests] NODE_OPTIONS does not contain wrap.js, skipping NYC hook');
    }
}

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 30000, // Increase timeout to prevent premature failures
        bail: false,    // Continue running tests even if one fails
    });

    const testsRoot = path.resolve(__dirname);

    return new Promise((c, e) => {
        try {
            // Get all test files under vscode-tests
            const globber = new GlobSync('**/**.test.js', { cwd: testsRoot });
            const files = globber.found;

            // Also include unit tests (compiled JS) so unit tests run inside the
            // VS Code extension test host where `vscode` module is available.
            const unitRoot = path.resolve(__dirname, '..', 'unit');
            const unitGlobber = new GlobSync('**/**.test.js', { cwd: unitRoot });
            const unitFiles = unitGlobber.found.map((f: string) => path.resolve(unitRoot, f));

            // Add files to the test suite (vscode-tests first, then unit tests)
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));
            unitFiles.forEach((f: string) => mocha.addFile(f));

            // Run the mocha test
            mocha.run((failures: number) => {
                if (failures > 0) {
                    e(new Error(`${failures} tests failed`));
                } else {
                    c();
                }
            });
        } catch (err) {
            console.error(err);
            e(err);
        }
    });
}
