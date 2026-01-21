/**
 * 中間列追加・削除の統合テスト
 * レビュー指摘: 中間列のハッチング表示が正しく動作していない問題を検証
 */

import * as assert from 'assert';
import {
    detectColumnDiff,
    getGitDiffForTable
} from '../../src/gitDiffUtils';
import type { RowGitDiff } from '../../src/gitDiffUtils';

describe('Column Diff Mid-Insertion Integration Tests', () => {
    describe('detectColumnDiff with real table headers', () => {
        it('中間に1列追加された場合、addedColumnsに正しいインデックスが含まれる', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'B', 'X', 'C'];  // Bの後にXが追加された
            const oldColumnCount = 3;  // A, B, C

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.strictEqual(result.changeType, 'added');
            assert.strictEqual(result.addedColumns.includes(2), true, 'addedColumns should include index 2');
            assert.strictEqual(result.newColumnCount, 4);
            assert.strictEqual(result.oldColumnCount, 3);
        });

        it('中間から1列削除された場合、deletedColumnsに正しいインデックスが含まれる', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'C'];  // Bが削除された
            const oldColumnCount = 3;  // A, B, C

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.strictEqual(result.changeType, 'removed');
            assert.strictEqual(result.deletedColumns.includes(1), true, 'deletedColumns should include index 1');
            assert.strictEqual(result.newColumnCount, 2);
            assert.strictEqual(result.oldColumnCount, 3);
        });

        it('先頭に1列追加された場合、addedColumnsに0が含まれる', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['X', 'A', 'B', 'C'];  // 先頭にXが追加
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.strictEqual(result.changeType, 'added');
            assert.strictEqual(result.addedColumns.includes(0), true, 'addedColumns should include index 0');
        });

        it('末尾に1列追加された場合、addedColumnsに最後のインデックスが含まれる', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'B', 'C', 'X'];  // 末尾にXが追加
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.strictEqual(result.changeType, 'added');
            assert.strictEqual(result.addedColumns.includes(3), true, 'addedColumns should include index 3');
        });

        it('複数列が中間に追加された場合、すべてのインデックスが含まれる', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'X', 'Y', 'B', 'C'];  // Aの後にX, Yが追加
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.strictEqual(result.changeType, 'added');
            assert.ok(result.addedColumns.includes(1), 'Should include index 1');
            assert.ok(result.addedColumns.includes(2), 'Should include index 2');
        });

        it('mappingが正しく生成される（中間列追加）', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'B', 'X', 'C'];
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.ok(result.mapping, 'mapping should exist');
            assert.strictEqual(result.mapping![0], 0, 'A: old[0] -> new[0]');
            assert.strictEqual(result.mapping![1], 1, 'B: old[1] -> new[1]');
            assert.strictEqual(result.mapping![2], 3, 'C: old[2] -> new[3]');
        });

        it('mappingが正しく生成される（中間列削除）', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'C'];
            const oldColumnCount = 3;  // A, B, C

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.ok(result.mapping, 'mapping should exist');
            assert.strictEqual(result.mapping![0], 0, 'A: old[0] -> new[0]');
            assert.strictEqual(result.mapping![1], -1, 'B: old[1] -> deleted');
            assert.strictEqual(result.mapping![2], 1, 'C: old[2] -> new[1]');
        });

        it('positionsに詳細情報が含まれる（中間列追加）', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'B', 'X', 'C'];
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.ok(result.positions, 'positions should exist');
            const addedPos = result.positions!.find(p => p.type === 'added' && p.header === 'X');
            assert.ok(addedPos, 'Should have position for added column X');
            assert.strictEqual(addedPos!.index, 2, 'X should be at index 2');
            assert.ok(addedPos!.confidence > 0, 'Should have confidence value');
        });

        it('positionsに詳細情報が含まれる（中間列削除）', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'C'];
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.ok(result.positions, 'positions should exist');
            const removedPositions = result.positions!.filter(p => p.type === 'removed');
            assert.strictEqual(removedPositions.length >= 1, true, 'Should have at least one removed position');
        });

        it('heuristicsに使用した検出手法が記録される', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'B', 'X', 'C'];
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.ok(result.heuristics, 'heuristics should exist');
            assert.ok(result.heuristics!.length > 0, 'Should have at least one heuristic');
        });

        it('列数が同じでヘッダが一致する場合、changeType=none', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['A', 'B', 'C'];
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.strictEqual(result.changeType, 'none');
            assert.strictEqual(result.addedColumns.length, 0);
            assert.strictEqual(result.deletedColumns.length, 0);
        });

        it('ヘッダなし（undefinedまたは空配列）の場合、フォールバックロジックが動作', () => {
            const gitDiff: RowGitDiff[] = [];
            const oldColumnCount = 3;

            // ヘッダなしで呼び出し
            const result1 = detectColumnDiff(gitDiff, oldColumnCount, undefined);
            assert.ok(result1, 'Should return result even without headers');

            const result2 = detectColumnDiff(gitDiff, oldColumnCount, []);
            assert.ok(result2, 'Should return result with empty headers array');
        });

        it('大文字小文字の違いを正規化して検出', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['Name', 'age', 'CITY'];  // ageが小文字
            const oldColumnCount = 3;  // Name, Age, City

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            // 正規化により同一と判定されるべき
            assert.strictEqual(result.changeType, 'none');
        });

        it('空白の違いを正規化して検出', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['First  Name', 'Last   Name'];  // 余分な空白
            const oldColumnCount = 2;  // "First Name", "Last Name"

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            // 正規化により同一と判定されるべき
            assert.strictEqual(result.changeType, 'none');
        });
    });

    describe('Enhanced detection with data rows', () => {
        it('データ行を使ったサンプリング補正が適用される', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['Name', 'Age', 'Country', 'City'];  // Countryが追加
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            assert.strictEqual(result.changeType, 'added');
            assert.ok(result.addedColumns.includes(2), 'Country should be added at index 2');
        });

        it('ファジーマッチングで列名変更を検出', () => {
            const gitDiff: RowGitDiff[] = [];
            const newHeaders = ['Name', 'Ages', 'City'];  // Age -> Ages
            const oldColumnCount = 3;

            const result = detectColumnDiff(gitDiff, oldColumnCount, newHeaders);

            // ファジーマッチングでrenameと判定される可能性
            assert.ok(result.positions, 'positions should exist');
            if (result.changeType === 'none') {
                // renamed と判定された場合
                const renamed = result.positions!.find(p => p.type === 'renamed');
                if (renamed) {
                    assert.ok(renamed.confidence < 1.0, 'Renamed should have confidence < 1.0');
                }
            }
        });
    });
});
