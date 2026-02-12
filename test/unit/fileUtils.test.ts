/**
 * fileUtils のユニットテスト
 * normalizeTableLines, contentEndsWithLineBreak, buildUpdatedContent をテスト
 */
import * as assert from 'assert';
import { normalizeTableLines, contentEndsWithLineBreak, buildUpdatedContent } from '../../src/fileUtils';

suite('fileUtils Test Suite', () => {
    suite('normalizeTableLines', () => {
        test('should split content by newlines', () => {
            const result = normalizeTableLines('line1\nline2\nline3');
            assert.deepStrictEqual(result, ['line1', 'line2', 'line3']);
        });

        test('should handle CRLF', () => {
            const result = normalizeTableLines('line1\r\nline2\r\nline3');
            assert.deepStrictEqual(result, ['line1', 'line2', 'line3']);
        });

        test('should trim trailing empty lines', () => {
            const result = normalizeTableLines('line1\nline2\n\n\n');
            assert.deepStrictEqual(result, ['line1', 'line2']);
        });

        test('should keep internal empty lines', () => {
            const result = normalizeTableLines('line1\n\nline3');
            assert.deepStrictEqual(result, ['line1', '', 'line3']);
        });

        test('should handle single line', () => {
            const result = normalizeTableLines('single');
            assert.deepStrictEqual(result, ['single']);
        });

        test('should handle empty string', () => {
            const result = normalizeTableLines('');
            // 空文字列は split で [''] になり、末尾空行除去で空配列になる
            assert.deepStrictEqual(result, []);
        });
    });

    suite('contentEndsWithLineBreak', () => {
        test('should return true for LF ending', () => {
            assert.strictEqual(contentEndsWithLineBreak('text\n', '\n'), true);
        });

        test('should return true for CRLF ending', () => {
            assert.strictEqual(contentEndsWithLineBreak('text\r\n', '\r\n'), true);
        });

        test('should return false for no line break', () => {
            assert.strictEqual(contentEndsWithLineBreak('text', '\n'), false);
        });

        test('should return false for empty string', () => {
            assert.strictEqual(contentEndsWithLineBreak('', '\n'), false);
        });

        test('should return false for wrong EOL type', () => {
            assert.strictEqual(contentEndsWithLineBreak('text\n', '\r\n'), false);
        });
    });

    suite('buildUpdatedContent', () => {
        test('should replace lines in the middle', () => {
            const original = 'line0\nline1\nline2\nline3\nline4';
            const result = buildUpdatedContent(original, 1, 3, ['new1', 'new2'], '\n');
            assert.strictEqual(result, 'line0\nnew1\nnew2\nline4');
        });

        test('should replace first lines', () => {
            const original = 'line0\nline1\nline2';
            const result = buildUpdatedContent(original, 0, 1, ['new0', 'new1'], '\n');
            assert.strictEqual(result, 'new0\nnew1\nline2');
        });

        test('should replace last lines', () => {
            const original = 'line0\nline1\nline2';
            const result = buildUpdatedContent(original, 1, 2, ['new1', 'new2'], '\n');
            assert.strictEqual(result, 'line0\nnew1\nnew2');
        });

        test('should throw for invalid start line (negative)', () => {
            const original = 'line0\nline1';
            assert.throws(() => {
                buildUpdatedContent(original, -1, 0, ['new'], '\n');
            }, RangeError);
        });

        test('should throw for end line beyond bounds', () => {
            const original = 'line0\nline1';
            assert.throws(() => {
                buildUpdatedContent(original, 0, 5, ['new'], '\n');
            }, RangeError);
        });

        test('should throw for start > end', () => {
            const original = 'line0\nline1\nline2';
            assert.throws(() => {
                buildUpdatedContent(original, 2, 1, ['new'], '\n');
            }, RangeError);
        });

        test('should preserve trailing EOL', () => {
            const original = 'line0\nline1\nline2\n';
            const result = buildUpdatedContent(original, 1, 1, ['new1'], '\n');
            assert.ok(result.endsWith('\n'));
        });

        test('should not add trailing EOL when original does not have one', () => {
            const original = 'line0\nline1\nline2';
            const result = buildUpdatedContent(original, 1, 1, ['new1'], '\n');
            assert.ok(!result.endsWith('\n'));
        });

        test('should handle CRLF', () => {
            const original = 'line0\r\nline1\r\nline2';
            const result = buildUpdatedContent(original, 1, 1, ['new1'], '\r\n');
            assert.strictEqual(result, 'line0\r\nnew1\r\nline2');
        });

        test('should replace single line', () => {
            const original = 'line0\nline1\nline2';
            const result = buildUpdatedContent(original, 1, 1, ['replaced'], '\n');
            assert.strictEqual(result, 'line0\nreplaced\nline2');
        });

        test('should handle replacement with more lines', () => {
            const original = 'line0\nline1\nline2';
            const result = buildUpdatedContent(original, 1, 1, ['a', 'b', 'c'], '\n');
            assert.strictEqual(result, 'line0\na\nb\nc\nline2');
        });

        test('should handle replacement with fewer lines', () => {
            const original = 'line0\nline1\nline2\nline3';
            const result = buildUpdatedContent(original, 1, 2, ['single'], '\n');
            assert.strictEqual(result, 'line0\nsingle\nline3');
        });

        test('should strip trailing EOL when original does not have one', () => {
            // Original does NOT end with newline, but replacement lines
            // produce trailing EOL via join. This covers the else-if branch.
            const original = 'line0\nline1';
            // Replace the last line with content that ends with a newline char
            // Actually, the issue is when afterTable is empty and replacementLines
            // produce an EOL at end. Let me construct: replace last line with ['new\n']
            // No - the EOL is added by join, not by content. If afterTable is empty
            // and replacement ends at the last position, join won't add trailing EOL.
            // The scenario: original has no trailing EOL, but replacement adds more lines
            // such that join produces trailing EOL. Actually this happens when
            // replacement lines include an empty string at the end.
            const result = buildUpdatedContent(original, 1, 1, ['replaced', ''], '\n');
            // Original 'line0\nline1' doesn't end with \n
            // Updated would be 'line0\nreplaced\n' which ends with \n
            // So the else-if should strip it
            assert.ok(!result.endsWith('\n'));
        });

        test('should strip trailing EOL for CRLF when original lacks it', () => {
            // CRLF の場合も同様に末尾 EOL を除去するケースをテスト
            const original = 'line0\r\nline1';
            const result = buildUpdatedContent(original, 1, 1, ['replaced', ''], '\r\n');
            // 元が CRLF で終わっていないので、更新後も CRLF で終わらないはず
            assert.ok(!result.endsWith('\r\n'));
        });

        test('should add trailing EOL when original has it but updated does not', () => {
            // 元のコンテンツに末尾改行あり、置換結果で末尾改行がなくなるケース
            // → L39 (updatedContent += eol) が実行される
            const original = 'A\nB\n';
            // 全行を置換 (startLine=0, endLine=2 → beforeTable=[], afterTable=[])
            // replacementLines=['X'] → updatedContent='X' (末尾改行なし)
            const result = buildUpdatedContent(original, 0, 2, ['X'], '\n');
            // 元が改行ありなので、更新後も改行が追加される
            assert.ok(result.endsWith('\n'), 'Should add trailing EOL to match original');
            assert.strictEqual(result, 'X\n');
        });

        test('should strip trailing EOL when original lacks it and replacement adds empty trailing line', () => {
            // 元のコンテンツが末尾改行なしで、置換結果が末尾改行ありになるケース
            // afterTable が空で replacementLines の最後が空文字の場合に EOL が生成される
            const original = 'only-line';
            const result = buildUpdatedContent(original, 0, 0, ['replaced', ''], '\n');
            // 元が改行なしなので、更新後も改行なしであるべき
            assert.ok(!result.endsWith('\n'), 'Should strip trailing EOL to match original');
            assert.strictEqual(result, 'replaced');
        });

        test('should strip trailing CRLF when original lacks it (single line)', () => {
            const original = 'single';
            const result = buildUpdatedContent(original, 0, 0, ['new', ''], '\r\n');
            assert.ok(!result.endsWith('\r\n'));
        });
    });
});
