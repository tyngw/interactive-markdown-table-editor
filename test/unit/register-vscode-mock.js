/**
 * スタンドアロンテスト用のvscodeモジュールフック
 * Node.jsのModule._resolveFilenameをオーバーライドして、
 * 'vscode'モジュールの要求をモックに差し替える
 */
const Module = require('module');
const path = require('path');

const originalResolveFilename = Module._resolveFilename;

// out/test/unit/vscode-mock.js を指すようにする（tscのコンパイル出力先）
const projectRoot = path.resolve(__dirname, '..', '..');
const mockPath = path.resolve(projectRoot, 'out', 'test', 'unit', 'vscode-mock.js');

Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'vscode') {
        return mockPath;
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};

// BDD スタイル (describe/it) のテストを TDD モード (suite/test) でも実行できるように
// グローバルにエイリアスを登録する。TDD モードでは describe/it が未定義のため。
// Mocha のグローバル登録はランタイム時に行われるので、ここではゲッターで遅延参照する。
Object.defineProperty(global, 'describe', {
    get() { return global.suite; },
    configurable: true
});
Object.defineProperty(global, 'it', {
    get() { return global.test; },
    configurable: true
});
Object.defineProperty(global, 'before', {
    get() { return global.suiteSetup; },
    configurable: true
});
Object.defineProperty(global, 'after', {
    get() { return global.suiteTeardown; },
    configurable: true
});
Object.defineProperty(global, 'beforeEach', {
    get() { return global.setup; },
    configurable: true
});
Object.defineProperty(global, 'afterEach', {
    get() { return global.teardown; },
    configurable: true
});
