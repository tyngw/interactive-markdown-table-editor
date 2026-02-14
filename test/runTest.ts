// @vscode/test-electron メインエントリポイント

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {


        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../');

        // Minimal launch args for testing
        const launchArgs = ['--disable-extensions'];
        
        // If NODE_OPTIONS contains NYC, pass the environment through
        // This enables coverage measurement when running under NYC instrumentation
        // Also pass NODE_PATH if set to ensure module resolution works correctly
        const extensionTestsEnv = process.env.NODE_OPTIONS && (
            process.env.NODE_OPTIONS.includes('nyc') || 
            process.env.NODE_OPTIONS.includes('wrap.js')
        )
            ? { 
                NODE_OPTIONS: process.env.NODE_OPTIONS,
                ...(process.env.NODE_PATH && { NODE_PATH: process.env.NODE_PATH })
            }
            : undefined;
        
        // Debug: Log coverage instrumentation status
        if (process.env.CI === 'true' || process.env.CI === 'github') {
            console.log('[runTest] Coverage enabled:', !!extensionTestsEnv);
            console.log('[runTest] NODE_OPTIONS:', process.env.NODE_OPTIONS);
        }

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
