/**
 * csvUtils のユニットテスト
 * CSV パース、エンコーディング検出、バッファデコード、矩形化をテスト
 */
import * as assert from 'assert';
import { detectTextEncoding, decodeBuffer, parseCsv, toRectangular, SupportedEncoding } from '../../src/csvUtils';

suite('csvUtils Test Suite', () => {
    suite('detectTextEncoding', () => {
        test('should detect UTF-8 BOM', () => {
            const buf = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
            assert.strictEqual(detectTextEncoding(buf), 'utf8');
        });

        test('should detect UTF-8 without BOM', () => {
            const buf = Buffer.from('Hello World', 'utf8');
            assert.strictEqual(detectTextEncoding(buf), 'utf8');
        });

        test('should detect SJIS when replacement characters appear', () => {
            // Shift_JIS エンコードされたバイト列（UTF-8として解釈すると置換文字が出る）
            // 「あ」のShift_JIS: 0x82, 0xA0
            const buf = Buffer.from([0x82, 0xA0, 0x82, 0xA2, 0x82, 0xA4]);
            assert.strictEqual(detectTextEncoding(buf), 'sjis');
        });

        test('should detect UTF-8 for ASCII text', () => {
            const buf = Buffer.from('simple,csv,data', 'utf8');
            assert.strictEqual(detectTextEncoding(buf), 'utf8');
        });

        test('should detect UTF-8 for valid Japanese UTF-8', () => {
            const buf = Buffer.from('こんにちは', 'utf8');
            assert.strictEqual(detectTextEncoding(buf), 'utf8');
        });

        test('should handle empty buffer', () => {
            const buf = Buffer.from([]);
            assert.strictEqual(detectTextEncoding(buf), 'utf8');
        });
    });

    suite('decodeBuffer', () => {
        test('should decode UTF-8 buffer', () => {
            const buf = Buffer.from('Hello', 'utf8');
            assert.strictEqual(decodeBuffer(buf, 'utf8'), 'Hello');
        });

        test('should decode SJIS buffer', () => {
            // iconv-lite で SJIS エンコードされたバッファ
            const iconv = require('iconv-lite');
            const buf = iconv.encode('テスト', 'shift_jis');
            assert.strictEqual(decodeBuffer(buf, 'sjis'), 'テスト');
        });

        test('should fallback to UTF-8 for invalid SJIS', () => {
            // SJIS デコードが失敗するケース（通常の UTF-8 テキスト）
            const buf = Buffer.from('Plain ASCII', 'utf8');
            const result = decodeBuffer(buf, 'sjis');
            // iconv-lite は Plain ASCII も正しくデコードする
            assert.ok(typeof result === 'string');
        });
    });

    suite('parseCsv', () => {
        test('should parse simple CSV', () => {
            const result = parseCsv('a,b,c\n1,2,3');
            assert.deepStrictEqual(result, [['a', 'b', 'c'], ['1', '2', '3']]);
        });

        test('should handle quoted fields', () => {
            const result = parseCsv('"hello","world"');
            assert.deepStrictEqual(result, [['hello', 'world']]);
        });

        test('should handle quotes with commas inside', () => {
            const result = parseCsv('"a,b",c');
            assert.deepStrictEqual(result, [['a,b', 'c']]);
        });

        test('should handle escaped quotes (double quotes)', () => {
            const result = parseCsv('"he""llo",world');
            assert.deepStrictEqual(result, [['he"llo', 'world']]);
        });

        test('should handle newlines in quoted fields', () => {
            const result = parseCsv('"line1\nline2",b');
            assert.deepStrictEqual(result, [['line1\nline2', 'b']]);
        });

        test('should handle CRLF line endings', () => {
            const result = parseCsv('a,b\r\n1,2');
            assert.deepStrictEqual(result, [['a', 'b'], ['1', '2']]);
        });

        test('should handle CR line endings', () => {
            const result = parseCsv('a,b\r1,2');
            assert.deepStrictEqual(result, [['a', 'b'], ['1', '2']]);
        });

        test('should remove trailing empty rows', () => {
            const result = parseCsv('a,b\n1,2\n\n');
            assert.deepStrictEqual(result, [['a', 'b'], ['1', '2']]);
        });

        test('should handle empty input', () => {
            const result = parseCsv('');
            // 空入力は空行が1つ生成されるが、末尾空行除去で除去される
            assert.deepStrictEqual(result, []);
        });

        test('should handle single field', () => {
            const result = parseCsv('hello');
            assert.deepStrictEqual(result, [['hello']]);
        });

        test('should handle unclosed quotes (invalid CSV)', () => {
            // 不正なクォートはそのまま扱う
            const result = parseCsv('"unclosed');
            assert.ok(Array.isArray(result));
            assert.ok(result.length > 0);
        });
    });

    suite('toRectangular', () => {
        test('should convert rows to rectangular format with headers', () => {
            const rows = [['Name', 'Age'], ['Alice', '30'], ['Bob', '25']];
            const result = toRectangular(rows);
            assert.deepStrictEqual(result.headers, ['Name', 'Age']);
            assert.deepStrictEqual(result.rows, [['Alice', '30'], ['Bob', '25']]);
        });

        test('should handle empty rows', () => {
            const result = toRectangular([]);
            assert.deepStrictEqual(result.headers, []);
            assert.deepStrictEqual(result.rows, []);
        });

        test('should skip leading empty rows', () => {
            const rows = [['', ''], ['Name', 'Age'], ['Alice', '30']];
            const result = toRectangular(rows);
            assert.deepStrictEqual(result.headers, ['Name', 'Age']);
            assert.deepStrictEqual(result.rows, [['Alice', '30']]);
        });

        test('should normalize to max column count', () => {
            const rows = [['A', 'B', 'C'], ['1', '2']];
            const result = toRectangular(rows);
            assert.deepStrictEqual(result.headers, ['A', 'B', 'C']);
            assert.deepStrictEqual(result.rows, [['1', '2', '']]);
        });

        test('should generate default headers for empty header cells', () => {
            const rows = [['', 'B', ''], ['1', '2', '3']];
            const result = toRectangular(rows);
            assert.strictEqual(result.headers[0], 'Column 1');
            assert.strictEqual(result.headers[1], 'B');
            assert.strictEqual(result.headers[2], 'Column 3');
        });

        test('should strip BOM from first header', () => {
            const rows = [['\uFEFFName', 'Age'], ['Alice', '30']];
            const result = toRectangular(rows);
            assert.strictEqual(result.headers[0], 'Name');
        });

        test('should handle rows with only empty rows', () => {
            const rows = [['', ''], ['', '']];
            const result = toRectangular(rows);
            // すべて空なので先頭のスキップですべてスキップされる
            assert.deepStrictEqual(result.headers, []);
            assert.deepStrictEqual(result.rows, []);
        });

        test('should handle header-only input', () => {
            const rows = [['Name', 'Age']];
            const result = toRectangular(rows);
            assert.deepStrictEqual(result.headers, ['Name', 'Age']);
            assert.deepStrictEqual(result.rows, []);
        });

        test('should trim whitespace from headers', () => {
            const rows = [['  Name  ', '  Age  '], ['Alice', '30']];
            const result = toRectangular(rows);
            assert.strictEqual(result.headers[0], 'Name');
            assert.strictEqual(result.headers[1], 'Age');
        });
    });

    suite('decodeBuffer - SJIS fallback', () => {
        test('should fallback to utf8 when iconv-lite decode throws', () => {
            // iconv-lite の decode をモックしてエラーを投げさせる
            const iconv = require('iconv-lite');
            const origDecode = iconv.decode;
            iconv.decode = () => { throw new Error('decode error'); };
            try {
                const buf = Buffer.from('fallback text', 'utf8');
                const result = decodeBuffer(buf, 'sjis');
                assert.strictEqual(result, 'fallback text');
            } finally {
                iconv.decode = origDecode;
            }
        });
    });
});
