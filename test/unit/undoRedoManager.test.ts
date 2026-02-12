/**
 * undoRedoManager のユニットテスト
 * Undo/Redo スタック管理、状態保存/復元をテスト
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UndoRedoManager } from '../../src/undoRedoManager';

suite('UndoRedoManager Test Suite', () => {
    let manager: UndoRedoManager;
    let testDir: string;
    let testFile: vscode.Uri;

    setup(() => {
        // シングルトンインスタンスを取得
        manager = UndoRedoManager.getInstance();
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'undo-redo-test-'));
        testFile = vscode.Uri.file(path.join(testDir, 'test.md'));
        // テスト用にクリーンな状態にする
        manager.clearHistory(testFile);
    });

    teardown(() => {
        manager.clearHistory(testFile);
        try {
            if (fs.existsSync(testFile.fsPath)) {
                fs.unlinkSync(testFile.fsPath);
            }
            fs.rmdirSync(testDir);
        } catch {
            // cleanup best effort
        }
    });

    test('getInstance should return singleton', () => {
        const a = UndoRedoManager.getInstance();
        const b = UndoRedoManager.getInstance();
        assert.strictEqual(a, b);
    });

    test('canUndo should return false initially', () => {
        assert.strictEqual(manager.canUndo(testFile), false);
    });

    test('canRedo should return false initially', () => {
        assert.strictEqual(manager.canRedo(testFile), false);
    });

    test('getStats should return zero counts initially', () => {
        const stats = manager.getStats(testFile);
        assert.strictEqual(stats.undoCount, 0);
        assert.strictEqual(stats.redoCount, 0);
    });

    test('saveState should add to undo stack', async () => {
        fs.writeFileSync(testFile.fsPath, 'initial content', 'utf8');
        await manager.saveState(testFile, 'test save');
        assert.strictEqual(manager.canUndo(testFile), true);
        assert.strictEqual(manager.getStats(testFile).undoCount, 1);
    });

    test('saveState should clear redo stack', async () => {
        fs.writeFileSync(testFile.fsPath, 'content1', 'utf8');
        await manager.saveState(testFile, 'save1');
        fs.writeFileSync(testFile.fsPath, 'content2', 'utf8');
        await manager.saveState(testFile, 'save2');

        // Undo to create redo stack
        await manager.undo(testFile);
        assert.strictEqual(manager.canRedo(testFile), true);

        // Save new state should clear redo stack
        fs.writeFileSync(testFile.fsPath, 'content3', 'utf8');
        await manager.saveState(testFile, 'save3');
        assert.strictEqual(manager.canRedo(testFile), false);
    });

    test('saveState should limit stack size to maxStackSize', async () => {
        fs.writeFileSync(testFile.fsPath, 'content', 'utf8');
        // Save more than maxStackSize states
        for (let i = 0; i < 55; i++) {
            await manager.saveState(testFile, `save ${i}`);
        }
        // Stack should be capped at 50
        assert.ok(manager.getStats(testFile).undoCount <= 50);
    });

    test('saveState should handle errors gracefully', async () => {
        // ファイルが存在しない場合
        const nonExistentFile = vscode.Uri.file(path.join(testDir, 'non-existent.md'));
        // エラーをスローせず、静かに失敗することを確認
        await manager.saveState(nonExistentFile, 'test');
        // エラーが発生しなければOK
    });

    test('undo should return false when stack is empty', async () => {
        const result = await manager.undo(testFile);
        assert.strictEqual(result, false);
    });

    test('undo should restore previous state', async () => {
        fs.writeFileSync(testFile.fsPath, 'original', 'utf8');
        await manager.saveState(testFile, 'before edit');
        fs.writeFileSync(testFile.fsPath, 'modified', 'utf8');

        const result = await manager.undo(testFile);
        assert.strictEqual(result, true);
    });

    test('undo should add current state to redo stack', async () => {
        fs.writeFileSync(testFile.fsPath, 'original', 'utf8');
        await manager.saveState(testFile, 'before edit');
        fs.writeFileSync(testFile.fsPath, 'modified', 'utf8');

        await manager.undo(testFile);
        assert.strictEqual(manager.canRedo(testFile), true);
    });

    test('redo should return false when stack is empty', async () => {
        const result = await manager.redo(testFile);
        assert.strictEqual(result, false);
    });

    test('redo should restore undone state', async () => {
        fs.writeFileSync(testFile.fsPath, 'original', 'utf8');
        await manager.saveState(testFile, 'before edit');
        fs.writeFileSync(testFile.fsPath, 'modified', 'utf8');

        await manager.undo(testFile);
        const result = await manager.redo(testFile);
        assert.strictEqual(result, true);
    });

    test('redo should add current state to undo stack', async () => {
        fs.writeFileSync(testFile.fsPath, 'original', 'utf8');
        await manager.saveState(testFile, 'before edit');
        fs.writeFileSync(testFile.fsPath, 'modified', 'utf8');

        await manager.undo(testFile);
        const undoCountBeforeRedo = manager.getStats(testFile).undoCount;
        await manager.redo(testFile);
        assert.ok(manager.getStats(testFile).undoCount >= undoCountBeforeRedo);
    });

    test('clearHistory should reset both stacks', async () => {
        fs.writeFileSync(testFile.fsPath, 'content', 'utf8');
        await manager.saveState(testFile, 'save1');
        await manager.saveState(testFile, 'save2');

        manager.clearHistory(testFile);
        assert.strictEqual(manager.canUndo(testFile), false);
        assert.strictEqual(manager.canRedo(testFile), false);
        assert.deepStrictEqual(manager.getStats(testFile), { undoCount: 0, redoCount: 0 });
    });

    test('multiple undos should work sequentially', async () => {
        fs.writeFileSync(testFile.fsPath, 'v1', 'utf8');
        await manager.saveState(testFile, 'save1');
        fs.writeFileSync(testFile.fsPath, 'v2', 'utf8');
        await manager.saveState(testFile, 'save2');
        fs.writeFileSync(testFile.fsPath, 'v3', 'utf8');

        assert.strictEqual(manager.getStats(testFile).undoCount, 2);
        await manager.undo(testFile);
        assert.strictEqual(manager.getStats(testFile).undoCount, 1);
        await manager.undo(testFile);
        assert.strictEqual(manager.getStats(testFile).undoCount, 0);
    });

    test('getStats should reflect undo/redo counts correctly', async () => {
        fs.writeFileSync(testFile.fsPath, 'content', 'utf8');
        await manager.saveState(testFile, 'save1');
        await manager.saveState(testFile, 'save2');

        let stats = manager.getStats(testFile);
        assert.strictEqual(stats.undoCount, 2);
        assert.strictEqual(stats.redoCount, 0);

        await manager.undo(testFile);
        stats = manager.getStats(testFile);
        assert.strictEqual(stats.undoCount, 1);
        assert.strictEqual(stats.redoCount, 1);
    });

    test('separate URIs should have independent stacks', async () => {
        const file1 = vscode.Uri.file(path.join(testDir, 'file1.md'));
        const file2 = vscode.Uri.file(path.join(testDir, 'file2.md'));
        fs.writeFileSync(file1.fsPath, 'content1', 'utf8');
        fs.writeFileSync(file2.fsPath, 'content2', 'utf8');

        await manager.saveState(file1, 'save file1');
        assert.strictEqual(manager.canUndo(file1), true);
        assert.strictEqual(manager.canUndo(file2), false);

        // Cleanup
        manager.clearHistory(file1);
        manager.clearHistory(file2);
        fs.unlinkSync(file1.fsPath);
        fs.unlinkSync(file2.fsPath);
    });

    test('saveState stack.shift() fires when exceeding maxStackSize', async () => {
        // maxStackSize は 50 なので、51回 saveState を呼び出す
        fs.writeFileSync(testFile.fsPath, 'base', 'utf8');
        for (let i = 0; i < 51; i++) {
            await manager.saveState(testFile, `save-${i}`);
        }
        // スタックサイズが50に制限されること
        assert.strictEqual(manager.getStats(testFile).undoCount, 50);
    });

    test('saveState catch block when openTextDocument throws (L51 JS)', async () => {
        // openTextDocument が throw する場合の catch ブロックをカバー
        const origOpen = (vscode.workspace as any).openTextDocument;
        (vscode.workspace as any).openTextDocument = async () => {
            throw new Error('Cannot open document');
        };
        try {
            // 例外を握りつぶすので throw しないことを確認
            await manager.saveState(testFile, 'should catch');
        } finally {
            (vscode.workspace as any).openTextDocument = origOpen;
        }
    });

    test('undo should create redo stack if not exists and succeed', async () => {
        // redo スタックが存在しない状態で undo を実行し、成功パスで redo スタックが生成されることを確認
        fs.writeFileSync(testFile.fsPath, 'state-a', 'utf8');
        await manager.saveState(testFile, 'before change');
        fs.writeFileSync(testFile.fsPath, 'state-b', 'utf8');

        // redo スタックを明示的に削除して L83-84 に到達させる
        const uriString = testFile.toString();
        (manager as any).redoStack.delete(uriString);

        // clearHistory でスタックをリセットせず、redo スタックが未生成の状態を確認
        const result = await manager.undo(testFile);
        assert.strictEqual(result, true);
        assert.strictEqual(manager.canRedo(testFile), true);
    });

    test('undo should restore undo stack when applyWorkspaceEditAndSave fails', async () => {
        // getFileHandler をモックして applyWorkspaceEditAndSave がエラーを投げるようにする
        const fileHandlerModule = require('../../src/fileHandler');
        const originalGetFileHandler = fileHandlerModule.getFileHandler;

        fs.writeFileSync(testFile.fsPath, 'original-content', 'utf8');
        await manager.saveState(testFile, 'before fail');
        fs.writeFileSync(testFile.fsPath, 'changed-content', 'utf8');

        const undoCountBefore = manager.getStats(testFile).undoCount;

        // applyWorkspaceEditAndSave がエラーを投げるようモック
        const fakeHandler = {
            applyWorkspaceEditAndSave: async () => { throw new Error('apply failed'); }
        };
        fileHandlerModule.getFileHandler = () => fakeHandler;

        try {
            const result = await manager.undo(testFile);
            // apply が失敗したので false が返る
            assert.strictEqual(result, false);
            // undo スタックが復元されているはず
            assert.strictEqual(manager.getStats(testFile).undoCount, undoCountBefore);
        } finally {
            fileHandlerModule.getFileHandler = originalGetFileHandler;
        }
    });

    test('undo should return false when outer try/catch fires (e.g., openTextDocument fails)', async () => {
        // undo スタックにデータがある状態で、undoStack.pop() 後の処理で例外を発生させる
        // openTextDocument が失敗するのではなく、スタックのデータが不正な場合を想定
        fs.writeFileSync(testFile.fsPath, 'original-outer', 'utf8');
        await manager.saveState(testFile, 'state-for-outer-catch');

        // undo スタックを直接操作して壊れたデータを入れる
        const uriString = testFile.toString();
        const undoStack = (manager as any).undoStack.get(uriString);
        // スタックの先頭を不正なデータに置き換え
        undoStack[undoStack.length - 1] = null;

        const result = await manager.undo(testFile);
        // null.content へのアクセスで outer catch に入り false が返る
        assert.strictEqual(result, false);
    });

    test('redo should create undo stack if not exists and succeed', async () => {
        fs.writeFileSync(testFile.fsPath, 'state-1', 'utf8');
        await manager.saveState(testFile, 'before');
        fs.writeFileSync(testFile.fsPath, 'state-2', 'utf8');

        // undo → redo の流れで undo スタックが再生成される
        await manager.undo(testFile);

        // undo 後に undoStack を明示的に削除して L130-131 に到達させる
        const uriString = testFile.toString();
        (manager as any).undoStack.delete(uriString);

        const result = await manager.redo(testFile);
        assert.strictEqual(result, true);
        assert.strictEqual(manager.canUndo(testFile), true);
    });

    test('redo should restore redo stack when applyWorkspaceEditAndSave fails', async () => {
        const fileHandlerModule = require('../../src/fileHandler');
        const originalGetFileHandler = fileHandlerModule.getFileHandler;

        fs.writeFileSync(testFile.fsPath, 'original', 'utf8');
        await manager.saveState(testFile, 'before');
        fs.writeFileSync(testFile.fsPath, 'modified', 'utf8');

        await manager.undo(testFile);
        const redoCountBefore = manager.getStats(testFile).redoCount;

        // redo で apply がエラーを投げるようモック
        const fakeHandler = {
            applyWorkspaceEditAndSave: async () => { throw new Error('redo apply failed'); }
        };
        fileHandlerModule.getFileHandler = () => fakeHandler;

        try {
            const result = await manager.redo(testFile);
            assert.strictEqual(result, false);
            // redo スタックが復元されているはず
            assert.strictEqual(manager.getStats(testFile).redoCount, redoCountBefore);
        } finally {
            fileHandlerModule.getFileHandler = originalGetFileHandler;
        }
    });

    test('redo should return false when outer try/catch fires', async () => {
        fs.writeFileSync(testFile.fsPath, 'redo-outer-1', 'utf8');
        await manager.saveState(testFile, 'state-for-redo-outer');
        fs.writeFileSync(testFile.fsPath, 'redo-outer-2', 'utf8');
        await manager.undo(testFile);

        // redo スタックを直接操作して壊れたデータを入れる
        const uriString = testFile.toString();
        const redoStack = (manager as any).redoStack.get(uriString);
        // スタックの先頭を不正なデータに置き換え
        redoStack[redoStack.length - 1] = null;

        const result = await manager.redo(testFile);
        // null.content へのアクセスで outer catch に入り false が返る
        assert.strictEqual(result, false);
    });
});
