// test/vscode-tests/index.ts
// @vscode/test-electron テスト実行エントリポイント

import * as path from 'path';
import Mocha from 'mocha';
import { GlobSync } from 'glob';

export function run(): Promise<void> {
    // NYC coverage instrumentation hook
    // Load NYC's wrap module to instrument code coverage for the extension tests
    const isCI = process.env.CI === 'true' || process.env.CI === 'github';
    if (isCI) {
        console.log('[vscode-tests] Starting test runner, CI env detected');
        console.log('[vscode-tests] NODE_OPTIONS:', process.env.NODE_OPTIONS);
    }
    
    // Try to load NYC instrumentation if running under coverage
    if (process.env.NODE_OPTIONS && process.env.NODE_OPTIONS.includes('wrap.js')) {
        try {
            const nycWrap = require.resolve('nyc/lib/wrap.js');
            require(nycWrap);
            if (isCI) {
                console.log('[vscode-tests] NYC instrumentation loaded from require.resolve');
            }
        } catch (err) {
            if (isCI) {
                console.error('[vscode-tests] Failed to load NYC wrap:', err);
            }
        }
    } else if (isCI) {
        console.log('[vscode-tests] NODE_OPTIONS does not include wrap.js');
    }
    
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
