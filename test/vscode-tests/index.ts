// test/vscode-tests/index.ts
// @vscode/test-electron テスト実行エントリポイント

import * as path from 'path';
import Mocha from 'mocha';
import { GlobSync } from 'glob';

export function run(): Promise<void> {
    // NYC coverage instrumentation hook
    // Load NYC's wrap module to instrument code coverage for the extension tests
    const isCI = process.env.CI === 'true' || process.env.CI === 'github';
    
    // Try to load NYC instrumentation if running under coverage
    // First, check NODE_OPTIONS environment variable
    const nodeOptions = process.env.NODE_OPTIONS || '';
    const hasnycInNodeOptions = nodeOptions.includes('wrap.js') || nodeOptions.includes('nyc');
    
    // Try to load NYC instrumentation - check environment variables that NYC sets
    // NYC sets NODE_PRELOAD_* variables when using node-preload
    const nycPreloadKeys = Object.keys(process.env).filter(k => k.startsWith('NODE_PRELOAD_'));
    
    let nycLoaded = false;
    
    // Attempt 1: Try loading from NODE_OPTIONS
    if (hasnycInNodeOptions) {
        try {
            const nycWrap = require.resolve('nyc/lib/wrap.js');
            require(nycWrap);
            nycLoaded = true;
        } catch (err) {
            // Failed to load, will try fallback
        }
    }
    
    // Attempt 2: Try loading directly if NYC preload env vars are set
    // This is the fallback when extensionTestsEnv NODE_OPTIONS is lost in Electron
    if (!nycLoaded && nycPreloadKeys.length > 0) {
        try {
            const nycWrap = require.resolve('nyc/lib/wrap.js');
            require(nycWrap);
            nycLoaded = true;
        } catch (err) {
            // Failed to load, will try fallback
        }
    }
    
    // Attempt 3: If we're in CI but no NYC signals, try unconditionally
    // This ensures we get coverage even if NYC setup is different
    if (!nycLoaded && isCI) {
        try {
            const nycWrap = require.resolve('nyc/lib/wrap.js');
            require(nycWrap);
            nycLoaded = true;
        } catch (err) {
            // Failed to load NYC wrap, coverage will not be instrumented
        }
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
