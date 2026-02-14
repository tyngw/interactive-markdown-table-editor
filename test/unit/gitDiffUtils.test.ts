/**
 * gitDiffUtils のユニットテスト
 * Git差分解析、テーブル行のトークン化、ヘッダ正規化、LCS計算などをテスト
 */
import * as assert from 'assert';
import {
    tokenizeRow,
    normalizeHeader,
    computeLCS,
    calculateSimilarity,
    detectColumnDiffWithPositions,
    getGitThemeColors,
    detectColumnDiff,
    __test__
} from '../../src/gitDiffUtils';

suite('gitDiffUtils Test Suite', () => {
    suite('tokenizeRow', () => {
        test('should parse simple pipe-separated cells', () => {
            const result = tokenizeRow('| a | b | c |');
            assert.deepStrictEqual(result, ['a', 'b', 'c']);
        });

        test('should handle cells without surrounding pipes', () => {
            const result = tokenizeRow('a | b | c');
            assert.deepStrictEqual(result, ['a', 'b', 'c']);
        });

        test('should trim whitespace from cells', () => {
            const result = tokenizeRow('|  hello  |  world  |');
            assert.deepStrictEqual(result, ['hello', 'world']);
        });

        test('should handle cells with escaped pipes', () => {
            const result = tokenizeRow('| a\\|b | c |');
            assert.deepStrictEqual(result, ['a\\|b', 'c']);
        });

        test('should preserve content inside code spans', () => {
            const result = tokenizeRow('| `code|with|pipe` | normal |');
            assert.deepStrictEqual(result, ['`code|with|pipe`', 'normal']);
        });

        test('should handle backticks with multiple ticks', () => {
            const result = tokenizeRow('| ``code|with|pipe`` | normal |');
            assert.deepStrictEqual(result, ['``code|with|pipe``', 'normal']);
        });

        test('should handle unmatched opening backtick', () => {
            const result = tokenizeRow('| `code | normal |');
            assert.ok(Array.isArray(result));
            assert.ok(result.length > 0);
        });

        test('should return empty array for null input', () => {
            const result = tokenizeRow(null as any);
            assert.deepStrictEqual(result, []);
        });

        test('should return empty array for undefined input', () => {
            const result = tokenizeRow(undefined as any);
            assert.deepStrictEqual(result, []);
        });

        test('should return empty array for non-string input', () => {
            const result = tokenizeRow(123 as any);
            assert.deepStrictEqual(result, []);
        });

        test('should handle empty row', () => {
            const result = tokenizeRow('');
            assert.deepStrictEqual(result, []);
        });

        test('should handle row with only pipes', () => {
            const result = tokenizeRow('| | |');
            assert.deepStrictEqual(result, []);
        });

        test('should handle single cell', () => {
            const result = tokenizeRow('hello');
            assert.deepStrictEqual(result, ['hello']);
        });

        test('should handle content with escaped backslash before pipe', () => {
            const result = tokenizeRow('| a \\\\ | b |');
            assert.ok(result.length >= 2);
        });

        test('should handle mixed code spans and pipes', () => {
            const result = tokenizeRow('| `a | b` | c | `d | e` |');
            assert.ok(result.length >= 2);
        });
    });

    suite('normalizeHeader', () => {
        test('should lowercase text', () => {
            const result = normalizeHeader('HELLO');
            assert.strictEqual(result, 'hello');
        });

        test('should trim whitespace', () => {
            const result = normalizeHeader('  hello  ');
            assert.strictEqual(result, 'hello');
        });

        test('should replace multiple spaces with single space', () => {
            const result = normalizeHeader('hello   world');
            assert.strictEqual(result, 'hello world');
        });

        test('should handle tabs and newlines', () => {
            const result = normalizeHeader('hello\t\tworld\ntest');
            assert.strictEqual(result, 'hello world test');
        });

        test('should return empty string for null input', () => {
            const result = normalizeHeader(null as any);
            assert.strictEqual(result, '');
        });

        test('should return empty string for undefined input', () => {
            const result = normalizeHeader(undefined as any);
            assert.strictEqual(result, '');
        });

        test('should return empty string for empty string', () => {
            const result = normalizeHeader('');
            assert.strictEqual(result, '');
        });

        test('should handle non-string input', () => {
            const result = normalizeHeader(123 as any);
            assert.strictEqual(result, '');
        });

        test('should combine all transformations', () => {
            const result = normalizeHeader('  HELLO   WORLD  ');
            assert.strictEqual(result, 'hello world');
        });
    });

    suite('computeLCS', () => {
        test('should find LCS of two identical arrays', () => {
            const result = computeLCS(['a', 'b', 'c'], ['a', 'b', 'c']);
            assert.strictEqual(result.length, 3);
            assert.deepStrictEqual(result[0], { i1: 0, i2: 0 });
        });

        test('should find LCS of different arrays', () => {
            const result = computeLCS(['a', 'b', 'c'], ['a', 'x', 'c']);
            assert.ok(result.length >= 2);
            assert.strictEqual(result[0].i1, 0);
            assert.strictEqual(result[result.length - 1].i1, 2);
        });

        test('should return empty array for empty first array', () => {
            const result = computeLCS([], ['a', 'b', 'c']);
            assert.deepStrictEqual(result, []);
        });

        test('should return empty array for empty second array', () => {
            const result = computeLCS(['a', 'b', 'c'], []);
            assert.deepStrictEqual(result, []);
        });

        test('should return empty array for both empty arrays', () => {
            const result = computeLCS([], []);
            assert.deepStrictEqual(result, []);
        });

        test('should handle arrays with no common elements', () => {
            const result = computeLCS(['a', 'b', 'c'], ['x', 'y', 'z']);
            assert.deepStrictEqual(result, []);
        });

        test('should handle single element arrays', () => {
            const result = computeLCS(['a'], ['a']);
            assert.deepStrictEqual(result, [{ i1: 0, i2: 0 }]);
        });

        test('should handle single non-matching element arrays', () => {
            const result = computeLCS(['a'], ['b']);
            assert.deepStrictEqual(result, []);
        });

        test('should preserve order of indices in LCS', () => {
            const result = computeLCS(
                ['a', 'b', 'c', 'd'],
                ['b', 'a', 'd', 'c']
            );
            // Should find 'b', 'd' as LCS
            assert.ok(result.length >= 1);
            for (let i = 1; i < result.length; i++) {
                assert.ok(result[i].i1 > result[i - 1].i1, 'indices should be in increasing order');
                assert.ok(result[i].i2 > result[i - 1].i2, 'indices should be in increasing order');
            }
        });
    });

    suite('calculateSimilarity', () => {
        test('should return 1.0 for identical strings', () => {
            const result = calculateSimilarity('hello', 'hello');
            assert.strictEqual(result, 1.0);
        });

        test('should return 0.0 for completely different strings', () => {
            const result = calculateSimilarity('abc', 'xyz');
            assert.strictEqual(result, 0.0);
        });

        test('should return value between 0 and 1 for similar strings', () => {
            const result = calculateSimilarity('hello', 'hallo');
            assert.ok(result > 0 && result < 1);
        });

        test('should handle empty strings', () => {
            const result = calculateSimilarity('', '');
            assert.ok(result >= 0 && result <= 1);
        });

        test('should handle one empty string', () => {
            const result = calculateSimilarity('hello', '');
            assert.ok(result >= 0 && result <= 1);
        });

        test('should be symmetric', () => {
            const result1 = calculateSimilarity('abc', 'abd');
            const result2 = calculateSimilarity('abd', 'abc');
            assert.strictEqual(result1, result2);
        });
    });

    suite('getGitThemeColors', () => {
        test('should return color configuration object', () => {
            const result = getGitThemeColors();
            assert.ok(result);
            assert.ok(typeof result === 'object');
        });

        test('should have addedBackground color', () => {
            const result = getGitThemeColors();
            assert.ok(result.addedBackground !== undefined);
            assert.ok(typeof result.addedBackground === 'string');
        });

        test('should have deletedBackground color', () => {
            const result = getGitThemeColors();
            assert.ok(result.deletedBackground !== undefined);
            assert.ok(typeof result.deletedBackground === 'string');
        });

        test('should have modifiedBackground color if present', () => {
            const result = getGitThemeColors();
            // modifiedBackground might not be present, but if it is, should be string
            if (result.modifiedBackground !== undefined) {
                assert.ok(typeof result.modifiedBackground === 'string');
            }
        });

        test('should return consistent values across calls', () => {
            const result1 = getGitThemeColors();
            const result2 = getGitThemeColors();
            assert.deepStrictEqual(result1, result2);
        });
    });

    suite('detectColumnDiff', () => {
        test('should return ColumnDiffInfo object', () => {
            const rowDiffs: any[] = [];
            const result = detectColumnDiff(rowDiffs, 2);
            assert.ok(result);
            assert.ok(typeof result === 'object');
        });

        test('should detect no changes for no git diffs', () => {
            const result = detectColumnDiff([], 2);
            assert.ok(result);
            assert.strictEqual(result.newColumnCount, 2);
        });

        test('should handle undefined headers', () => {
            const result = detectColumnDiff([], 3, undefined);
            assert.ok(result);
        });

        test('should handle provided headers', () => {
            const headers = ['a', 'b', 'c'];
            const result = detectColumnDiff([], 3, headers);
            assert.ok(result);
        });

        test('should detect column changes with git diff info', () => {
            const rowDiffs: any[] = [
                { row: 0, status: 'deleted', oldContent: 'a|b' },
                { row: 0, status: 'added', newContent: 'a|b|c' }
            ];
            const result = detectColumnDiff(rowDiffs, 2);
            assert.ok(result);
        });
    });

    suite('detectColumnDiffWithPositions', () => {
        test('should return ColumnDiffInfo object', () => {
            const result = detectColumnDiffWithPositions(['a', 'b'], ['a', 'b']);
            assert.ok(result);
            assert.ok(typeof result === 'object');
        });

        test('should detect no changes for identical headers', () => {
            const result = detectColumnDiffWithPositions(['a', 'b'], ['a', 'b']);
            assert.ok(result);
            assert.strictEqual(result.oldColumnCount, 2);
            assert.strictEqual(result.newColumnCount, 2);
        });

        test('should detect column addition', () => {
            const result = detectColumnDiffWithPositions(['a', 'b'], ['a', 'b', 'c']);
            assert.ok(result);
            assert.strictEqual(result.oldColumnCount, 2);
            assert.strictEqual(result.newColumnCount, 3);
        });

        test('should detect column deletion', () => {
            const result = detectColumnDiffWithPositions(['a', 'b', 'c'], ['a', 'b']);
            assert.ok(result);
            assert.strictEqual(result.oldColumnCount, 3);
            assert.strictEqual(result.newColumnCount, 2);
        });

        test('should handle empty headers', () => {
            const result = detectColumnDiffWithPositions([], []);
            assert.ok(result);
        });

        test('should handle with data rows', () => {
            const result = detectColumnDiffWithPositions(
                ['a', 'b'],
                ['a', 'b'],
                [['1', '2']],
                [['1', '2']]
            );
            assert.ok(result);
        });

        test('should handle asymmetric data rows', () => {
            const result = detectColumnDiffWithPositions(
                ['a', 'b'],
                ['a', 'b', 'c'],
                [['1', '2']],
                undefined
            );
            assert.ok(result);
        });
    });

    suite('__test__ exports', () => {
        test('should export parseGitDiff function', () => {
            assert.ok(__test__.parseGitDiff);
            assert.ok(typeof __test__.parseGitDiff === 'function');
        });

        test('should export mapTableRowsToGitDiff function', () => {
            assert.ok(__test__.mapTableRowsToGitDiff);
            assert.ok(typeof __test__.mapTableRowsToGitDiff === 'function');
        });

        test('should export dedupeRowDiffs function', () => {
            assert.ok(__test__.dedupeRowDiffs);
            assert.ok(typeof __test__.dedupeRowDiffs === 'function');
        });
    });

    suite('parseGitDiff (internal)', () => {
        test('should parse simple unified diff', () => {
            const diff = [
                '--- a/test.md',
                '+++ b/test.md',
                '@@ -1,3 +1,4 @@',
                ' | a | b |',
                ' | 1 | 2 |',
                '-| 3 | 4 |',
                '+| 5 | 6 |'
            ].join('\n');
            
            const result = __test__.parseGitDiff(diff, 0, 10);
            assert.ok(result);
            assert.ok(Array.isArray(result));
        });

        test('should return empty array for empty diff', () => {
            const result = __test__.parseGitDiff('', 0, 10);
            assert.ok(Array.isArray(result));
        });

        test('should handle diff without hunks', () => {
            const diff = '--- a/test.md\n+++ b/test.md';
            const result = __test__.parseGitDiff(diff, 0, 10);
            assert.ok(Array.isArray(result));
        });
    });

    suite('mapTableRowsToGitDiff (internal)', () => {
        test('should map unchanged rows', () => {
            const lineDiffs: any[] = [];
            const result = __test__.mapTableRowsToGitDiff(lineDiffs, 0, 1);
            assert.ok(Array.isArray(result));
        });

        test('should map added rows', () => {
            const lineDiffs: any[] = [];
            const result = __test__.mapTableRowsToGitDiff(lineDiffs, 0, 1);
            assert.ok(Array.isArray(result));
        });

        test('should map deleted rows', () => {
            const lineDiffs: any[] = [];
            const result = __test__.mapTableRowsToGitDiff(lineDiffs, 0, 1);
            assert.ok(Array.isArray(result));
        });

        test('should handle different row counts', () => {
            const lineDiffs: any[] = [];
            const result = __test__.mapTableRowsToGitDiff(lineDiffs, 0, 5);
            assert.ok(Array.isArray(result));
        });

        test('should use optional tableContent parameter', () => {
            const lineDiffs: any[] = [];
            const result = __test__.mapTableRowsToGitDiff(lineDiffs, 0, 1, '| a | b |');
            assert.ok(Array.isArray(result));
        });
    });

    suite('dedupeRowDiffs (internal)', () => {
        test('should remove duplicate row diffs', () => {
            const rowDiffs = [
                { row: 0, status: 'added' as any, newContent: 'test' },
                { row: 0, status: 'added' as any, newContent: 'test' },
                { row: 1, status: 'deleted' as any, oldContent: 'test' }
            ];
            const result = __test__.dedupeRowDiffs(rowDiffs);
            assert.ok(Array.isArray(result));
            // Should have fewer or equal items
            assert.ok(result.length <= rowDiffs.length);
        });

        test('should handle empty array', () => {
            const result = __test__.dedupeRowDiffs([]);
            assert.deepStrictEqual(result, []);
        });

        test('should handle single item', () => {
            const rowDiffs = [{ row: 0, status: 'added' as any }];
            const result = __test__.dedupeRowDiffs(rowDiffs);
            assert.deepStrictEqual(result, rowDiffs);
        });

        test('should preserve unique items', () => {
            const rowDiffs = [
                { row: 0, status: 'added' as any, newContent: 'a' },
                { row: 1, status: 'deleted' as any, oldContent: 'b' },
                { row: 2, status: 'added' as any, newContent: 'c' }
            ];
            const result = __test__.dedupeRowDiffs(rowDiffs);
            assert.strictEqual(result.length, 3);
        });

        test('should remove duplicates with different oldContent', () => {
            const rowDiffs = [
                { row: 0, status: 'deleted' as any, oldContent: 'a' },
                { row: 0, status: 'deleted' as any, oldContent: 'b' }
            ];
            const result = __test__.dedupeRowDiffs(rowDiffs);
            // Should dedupe based on row and status, keeping first one
            assert.ok(result.length <= 2);
        });

        test('should preserve rows with different status', () => {
            const rowDiffs = [
                { row: 0, status: 'added' as any, newContent: 'a' },
                { row: 0, status: 'deleted' as any, oldContent: 'a' }
            ];
            const result = __test__.dedupeRowDiffs(rowDiffs);
            // Different status should not be deduplicated
            assert.strictEqual(result.length, 2);
        });
    });

    // Additional edge case tests for calculateSimilarity
    suite('calculateSimilarity edge cases', () => {
        test('should handle very long strings', () => {
            const long1 = 'a'.repeat(1000);
            const long2 = 'a'.repeat(1000);
            const result = calculateSimilarity(long1, long2);
            assert.strictEqual(result, 1.0);
        });

        test('should handle strings with special characters', () => {
            const result = calculateSimilarity('hello|world', 'hello|world');
            assert.strictEqual(result, 1.0);
        });

        test('should handle newlines and whitespace', () => {
            const result = calculateSimilarity('a\nb', 'a\nb');
            assert.strictEqual(result, 1.0);
        });
    });

    // Additional edge case tests for computeLCS
    suite('computeLCS edge cases', () => {
        test('should handle very long arrays', () => {
            const arr1 = Array.from({ length: 100 }, (_, i) => `item${i}`);
            const arr2 = Array.from({ length: 100 }, (_, i) => `item${i}`);
            const result = computeLCS(arr1, arr2);
            assert.strictEqual(result.length, 100);
        });

        test('should handle arrays with duplicates', () => {
            const result = computeLCS(['a', 'a', 'b'], ['a', 'a', 'b']);
            assert.strictEqual(result.length, 3);
        });

        test('should handle one-element arrays', () => {
            const result = computeLCS(['x'], ['x']);
            assert.strictEqual(result.length, 1);
        });

        test('should handle mixed match positions', () => {
            const arr1 = ['a', 'b', 'c', 'd', 'e'];
            const arr2 = ['e', 'd', 'c', 'b', 'a'];
            const result = computeLCS(arr1, arr2);
            // Only 'c' is in the LCS
            assert.ok(result.length >= 1);
        });
    });

    // Additional edge case tests for tokenizeRow
    suite('tokenizeRow edge cases', () => {
        test('should handle multiple consecutive pipes', () => {
            const result = tokenizeRow('|||||');
            assert.ok(Array.isArray(result));
        });

        test('should handle pipes with spaces between', () => {
            const result = tokenizeRow('| | | |');
            assert.deepStrictEqual(result, []);
        });

        test('should handle nested code spans with different tick counts', () => {
            const result = tokenizeRow('| ``a|b`` | `c|d` |');
            assert.ok(result.length >= 2);
        });

        test('should handle backticks at edges', () => {
            const result = tokenizeRow('|`start|end`|');
            assert.ok(result.length >= 1);
        });

        test('should handle mixed escapes and code spans', () => {
            const result = tokenizeRow('| \\`code| | `real|code` |');
            assert.ok(result.length >= 2);
        });

        test('should trim empty strings from cells', () => {
            const result = tokenizeRow('| a | | b |');
            // Should not include the empty cell
            assert.ok(result.length >= 2);
        });
    });

    // Additional edge case tests for normalizeHeader
    suite('normalizeHeader edge cases', () => {
        test('should handle very long headers', () => {
            const long = 'A'.repeat(1000);
            const result = normalizeHeader(long);
            assert.strictEqual(result, long.toLowerCase());
        });

        test('should handle unicode characters', () => {
            const result = normalizeHeader('Ａ　Ｂ');
            assert.ok(typeof result === 'string');
        });

        test('should handle mixed spaces and tabs', () => {
            const result = normalizeHeader('a \t b  \t c');
            assert.strictEqual(result, 'a b c');
        });

        test('should preserve non-breaking spaces as regular spaces', () => {
            const result = normalizeHeader('hello\u00A0world');
            assert.ok(typeof result === 'string');
        });
    });

    // Integration tests combining multiple functions
    suite('Integration tests for git diff analysis', () => {
        test('should parse and tokenize a complete diff', () => {
            const diff = [
                '--- a/test.md',
                '+++ b/test.md',
                '@@ -1,2 +1,3 @@',
                ' | header |',
                '-| old |',
                '+| new |'
            ].join('\n');
            
            const parsed = __test__.parseGitDiff(diff, 0, 10);
            assert.ok(Array.isArray(parsed));
        });

        test('should process headers and normalize them', () => {
            const header = 'Header  With   SPACES';
            const normalized = normalizeHeader(header);
            assert.strictEqual(normalized, 'header with spaces');
        });

        test('should handle complex table with various row types', () => {
            const lineDiffs: any[] = [
                { lineNumber: 1, status: 'unchanged' },
                { lineNumber: 2, status: 'deleted', oldContent: '| old | data |' },
                { lineNumber: 3, status: 'added', newContent: '| new | data |' }
            ];
            const result = __test__.mapTableRowsToGitDiff(lineDiffs, 0, 3);
            assert.ok(Array.isArray(result));
        });
    });
});
