import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        console.log('Running integration and E2E tests...');
        
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../');

        // Run integration tests
        const integrationTestsPath = path.resolve(__dirname, 'integration');
        console.log('Running integration tests...');
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath: integrationTestsPath,
            launchArgs: ['--disable-extensions'] 
        });

        // Run E2E tests
        const e2eTestsPath = path.resolve(__dirname, 'e2e');
        console.log('Running E2E tests...');
        await runTests({ 
            extensionDevelopmentPath, 
            extensionTestsPath: e2eTestsPath,
            launchArgs: ['--disable-extensions'] 
        });

        console.log('All integration and E2E tests completed successfully!');
    } catch (err) {
        console.error('Failed to run integration/E2E tests:', err);
        process.exit(1);
    }
}

main();
