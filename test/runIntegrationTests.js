"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const test_electron_1 = require("@vscode/test-electron");
async function main() {
    try {
        console.log('Running integration and E2E tests...');
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../');
        // Run integration tests
        const integrationTestsPath = path.resolve(__dirname, 'integration');
        console.log('Running integration tests...');
        await (0, test_electron_1.runTests)({
            extensionDevelopmentPath,
            extensionTestsPath: integrationTestsPath,
            launchArgs: ['--disable-extensions']
        });
        // Run E2E tests
        const e2eTestsPath = path.resolve(__dirname, 'e2e');
        console.log('Running E2E tests...');
        await (0, test_electron_1.runTests)({
            extensionDevelopmentPath,
            extensionTestsPath: e2eTestsPath,
            launchArgs: ['--disable-extensions']
        });
        console.log('All integration and E2E tests completed successfully!');
    }
    catch (err) {
        console.error('Failed to run integration/E2E tests:', err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=runIntegrationTests.js.map