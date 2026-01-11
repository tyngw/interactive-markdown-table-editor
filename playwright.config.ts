// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright テスト設定
 * VS Code Electron アプリの Webview をテストするための設定
 * 
 * ElectronApp API を使用して VS Code アプリをテストホストとして起動します。
 */
export default defineConfig({
    testDir: './test/playwright-tests',
    fullyParallel: false, // Electron は単一プロセスのため並列実行不可
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1, // Electron テストは単一ワーカー
    reporter: 'html',
    timeout: 60000, // Electron 起動に時間がかかるため
    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'electron-chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],

    // Electron アプリは ElectronApp API で管理
});
