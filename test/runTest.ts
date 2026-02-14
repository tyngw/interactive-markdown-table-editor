// @vscode/test-electron メインエントリポイント

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../');

        // Minimal launch args for testing
        const launchArgs = ['--disable-extensions'];
        
        // Check if we're running under NYC coverage instrumentation
        const isNYCEnabled = process.env.NODE_OPTIONS && (
            process.env.NODE_OPTIONS.includes('nyc') || 
            process.env.NODE_OPTIONS.includes('wrap.js')
        );
        
        // If NYC is enabled, we need to ensure the Electron extension-host
        // inherits the coverage instrumentation by keeping NODE_OPTIONS in the parent process
        // The Electron process will spawn child processes that inherit from this process's environment
        const extensionTestsEnv = isNYCEnabled
            ? { 
                NODE_OPTIONS: process.env.NODE_OPTIONS,
                ...(process.env.NODE_PATH && { NODE_PATH: process.env.NODE_PATH }),
                // Pass CI flag to extension tests so they know coverage is being measured
                CI: process.env.CI,
            }
            : undefined;

        // Download VS Code, unzip it and run the integration test
        // Note: VS Code test runtime will be cached in ~/.vscode-test/ by default
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath: path.resolve(__dirname, '../test/vscode-tests'),
            launchArgs,
            version: 'stable',
            extensionTestsEnv
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();

