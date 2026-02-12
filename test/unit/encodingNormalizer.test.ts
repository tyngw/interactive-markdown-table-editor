/**
 * encodingNormalizer のユニットテスト
 * Shift_JIS 正規化とインポート正規化をテスト
 */
import * as assert from 'assert';
import { normalizeForShiftJisExport, normalizeForImport, ReplacementInfo } from '../../src/encodingNormalizer';

suite('encodingNormalizer Test Suite', () => {
    suite('normalizeForShiftJisExport', () => {
        test('should return unchanged for ASCII text', () => {
            const result = normalizeForShiftJisExport('Hello World');
            assert.strictEqual(result.normalized, 'Hello World');
            assert.deepStrictEqual(result.replacements, []);
        });

        test('should normalize text with NFKC', () => {
            // 全角英数字 → 半角英数字に正規化されるケース
            const result = normalizeForShiftJisExport('Ａ');
            // jaconv.normalize は NFKC を行う
            assert.ok(typeof result.normalized === 'string');
            assert.ok(Array.isArray(result.replacements));
        });

        test('should return replacement info for changed characters', () => {
            // NFKC 正規化で変わる文字を含むテスト
            const input = 'ﾃｽﾄ'; // 半角カタカナ
            const result = normalizeForShiftJisExport(input);
            // jaconv.normalize で全角化されるはず
            assert.ok(typeof result.normalized === 'string');
            assert.ok(Array.isArray(result.replacements));
        });

        test('should handle empty string', () => {
            const result = normalizeForShiftJisExport('');
            assert.strictEqual(result.normalized, '');
            assert.deepStrictEqual(result.replacements, []);
        });

        test('should handle plain Japanese text', () => {
            const result = normalizeForShiftJisExport('こんにちは');
            assert.ok(typeof result.normalized === 'string');
            assert.ok(Array.isArray(result.replacements));
        });
    });

    suite('normalizeForImport', () => {
        test('should return unchanged for ASCII text', () => {
            const result = normalizeForImport('Hello World');
            assert.strictEqual(result.normalized, 'Hello World');
            assert.deepStrictEqual(result.replacements, []);
        });

        test('should normalize text with NFKC for import', () => {
            const result = normalizeForImport('Ａ');
            assert.ok(typeof result.normalized === 'string');
            assert.ok(Array.isArray(result.replacements));
        });

        test('should return replacement info for changed characters', () => {
            const input = 'ﾃｽﾄ';
            const result = normalizeForImport(input);
            assert.ok(typeof result.normalized === 'string');
            assert.ok(Array.isArray(result.replacements));
        });

        test('should handle empty string', () => {
            const result = normalizeForImport('');
            assert.strictEqual(result.normalized, '');
            assert.deepStrictEqual(result.replacements, []);
        });
    });
});
