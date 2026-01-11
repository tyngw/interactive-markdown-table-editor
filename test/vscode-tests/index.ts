// test/vscode-tests/index.ts
// @vscode/test-electron テスト実行エントリポイント

import * as path from 'path';
import Mocha from 'mocha';
import { GlobSync } from 'glob';

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000,
    });

    const testsRoot = path.resolve(__dirname);

    return new Promise((c, e) => {
        try {
            // Get all test files
            const globber = new GlobSync('**/**.test.js', { cwd: testsRoot });
            const files = globber.found;

            // Add files to the test suite
            files.forEach((f: string) =>
                mocha.addFile(path.resolve(testsRoot, f))
            );

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
