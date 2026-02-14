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
        console.log('[vscode-tests] Current process.pid:', process.pid);
        console.log('[vscode-tests] NODE_OPTIONS:', process.env.NODE_OPTIONS);
        console.log('[vscode-tests] NODE_OPTIONS type:', typeof process.env.NODE_OPTIONS);
        console.log('[vscode-tests] All NODE_* env vars:', Object.keys(process.env).filter(k => k.startsWith('NODE')).map(k => `${k}=${process.env[k]}`).join(', '));
    }
    
    // Try to load NYC instrumentation if running under coverage
    // First, check NODE_OPTIONS environment variable
    const nodeOptions = process.env.NODE_OPTIONS || '';
    const hasnycInNodeOptions = nodeOptions.includes('wrap.js') || nodeOptions.includes('nyc');
    
    if (isCI) {
        console.log('[vscode-tests] NODE_OPTIONS contains wrap.js:', hasnycInNodeOptions);
        console.log('[vscode-tests] NODE_OPTIONS value (length=' + nodeOptions.length + '):', nodeOptions);
    }
    
    // Try to load NYC instrumentation - check environment variables that NYC sets
    // NYC sets NODE_PRELOAD_* variables when using node-preload
    const nycPreloadKeys = Object.keys(process.env).filter(k => k.startsWith('NODE_PRELOAD_'));
    if (isCI) {
        console.log('[vscode-tests] NODE_PRELOAD_* env vars found:', nycPreloadKeys);
    }
    
    let nycLoaded = false;
    
    // Attempt 1: Try loading from NODE_OPTIONS
    if (hasnycInNodeOptions) {
        try {
            const nycWrap = require.resolve('nyc/lib/wrap.js');
            if (isCI) {
                console.log('[vscode-tests] Loading NYC from NODE_OPTIONS at:', nycWrap);
            }
            require(nycWrap);
            nycLoaded = true;
            if (isCI) {
                console.log('[vscode-tests] NYC instrumentation loaded successfully from NODE_OPTIONS');
            }
        } catch (err) {
            if (isCI) {
                console.error('[vscode-tests] Failed to load NYC wrap from NODE_OPTIONS:', err);
            }
        }
    }
    
    // Attempt 2: Try loading directly if NYC preload env vars are set
    // This is the fallback when extensionTestsEnv NODE_OPTIONS is lost in Electron
    if (!nycLoaded && nycPreloadKeys.length > 0) {
        try {
            if (isCI) {
                console.log('[vscode-tests] Attempting direct NYC load (Attempt 2)');
            }
            const nycWrap = require.resolve('nyc/lib/wrap.js');
            if (isCI) {
                console.log('[vscode-tests] Loading NYC directly at:', nycWrap);
            }
            require(nycWrap);
            nycLoaded = true;
            if (isCI) {
                console.log('[vscode-tests] NYC instrumentation loaded successfully (direct)');
            }
        } catch (err) {
            if (isCI) {
                console.error('[vscode-tests] Failed to load NYC wrap (direct):', err);
            }
        }
    }
    
    // Attempt 3: If we're in CI but no NYC signals, try unconditionally
    // This ensures we get coverage even if NYC setup is different
    if (!nycLoaded && isCI) {
        try {
            if (isCI) {
                console.log('[vscode-tests] Attempting unconditional NYC load (Attempt 3)');
            }
            const nycWrap = require.resolve('nyc/lib/wrap.js');
            if (isCI) {
                console.log('[vscode-tests] Loading NYC unconditionally at:', nycWrap);
            }
            require(nycWrap);
            nycLoaded = true;
            if (isCI) {
                console.log('[vscode-tests] NYC instrumentation loaded successfully (unconditional)');
            }
        } catch (err) {
            if (isCI) {
                console.error('[vscode-tests] Failed to load NYC wrap (unconditional):', err);
            }
        }
    }
    
    if (isCI) {
        console.log('[vscode-tests] NYC loading complete, nycLoaded:', nycLoaded);
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
