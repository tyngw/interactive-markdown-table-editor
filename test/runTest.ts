// @vscode/test-electron メインエントリポイント

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {


        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../');

        // Minimal launch args for testing
        const launchArgs = ['--disable-extensions'];

        // Download VS Code, unzip it and run the integration test
        // Note: VS Code test runtime will be cached in ~/.vscode-test/ by default
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath: path.resolve(__dirname, '../test/vscode-tests'),
            launchArgs,
            version: 'stable',
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
