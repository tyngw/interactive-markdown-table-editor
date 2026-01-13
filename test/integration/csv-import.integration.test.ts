import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as iconv from 'iconv-lite';
import { parseCsv, decodeBuffer, detectTextEncoding } from '../../src/csvUtils';

/**
 * CSV Import Integration Tests
 *
 * Tests focused solely on import behavior and encoding detection.
 */
suite('CSV Import Integration Tests', () => {
    let tempDir: string;

    suiteSetup(async () => {
        tempDir = path.join(__dirname, '..', '..', 'temp-test-csv-import');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    suiteTeardown(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    suite('CSV Import Tests - UTF-8 Encoding', () => {
        test('should import CSV with UTF-8 encoding', async () => {
            const importPath = path.join(tempDir, 'import-utf8.csv');
            const csvContent = 'Name,Age,City\nJohn,25,Tokyo\nJane,30,Osaka\nBob,35,Kyoto';
            fs.writeFileSync(importPath, csvContent, 'utf8');

            const buffer = fs.readFileSync(importPath);
            const encoding = detectTextEncoding(buffer);
            const decodedContent = decodeBuffer(buffer, encoding);

            assert.strictEqual(decodedContent, csvContent, 'Decoded content should match original');

            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 4, 'Should parse 4 rows');
            assert.deepStrictEqual(parsed[0], ['Name', 'Age', 'City'], 'Header should be correct');
            assert.deepStrictEqual(parsed[1], ['John', '25', 'Tokyo'], 'First data row should be correct');
        });

        test('should import Japanese CSV from UTF-8 file', async () => {
            const importPath = path.join(tempDir, 'import-japanese-utf8.csv');
            const csvContent = '名前,年齢,都市\n田中,25,東京\n佐藤,30,大阪\n鈴木,35,京都';
            fs.writeFileSync(importPath, csvContent, 'utf8');

            const buffer = fs.readFileSync(importPath);
            const encoding = detectTextEncoding(buffer);
            const decodedContent = decodeBuffer(buffer, encoding);

            assert.strictEqual(decodedContent, csvContent, 'Japanese content should be preserved');

            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 4, 'Should parse 4 rows');
            assert.strictEqual(parsed[0][0], '名前', 'Header should be 名前');
            assert.strictEqual(parsed[1][0], '田中', 'First data should be 田中');
            assert.strictEqual(parsed[2][2], '大阪', 'Osaka should be preserved');
        });

        test('should import UTF-8 CSV with special characters and quotes', async () => {
            const importPath = path.join(tempDir, 'import-special-utf8.csv');
            const csvContent = 'Name,Description,Notes\n' +
                             '"Smith, John","A ""skilled"" developer","First line\nSecond line"\n' +
                             'Alice,Team lead,Main office';
            fs.writeFileSync(importPath, csvContent, 'utf8');

            const buffer = fs.readFileSync(importPath);
            const encoding = detectTextEncoding(buffer);
            const decodedContent = decodeBuffer(buffer, encoding);

            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 3, 'Should parse 3 rows');
            assert.strictEqual(parsed[1][0], 'Smith, John', 'Quoted field with comma should be preserved');
        });

        test('should import large UTF-8 CSV file', async () => {
            const importPath = path.join(tempDir, 'import-large-utf8.csv');
            let csvContent = 'ID,Name,Email,City\n';
            for (let i = 1; i <= 1000; i++) {
                csvContent += `${i},User${i},user${i}@example.com,City${i % 10}\n`;
            }
            fs.writeFileSync(importPath, csvContent, 'utf8');

            const buffer = fs.readFileSync(importPath);
            const encoding = detectTextEncoding(buffer);
            const decodedContent = decodeBuffer(buffer, encoding);

            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 1001, 'Should parse all 1001 rows');
            assert.strictEqual(parsed[500][1], 'User500', '500th user should be correct');
        });
    });

    suite('CSV Import Tests - Shift-JIS Encoding', () => {
        test('should import CSV with Shift-JIS encoding', async function() {
            this.timeout(5000);
            const importPath = path.join(tempDir, 'import-sjis.csv');
            const csvContent = 'Name,Age,City\nJohn,25,Tokyo\nJane,30,Osaka\nBob,35,Kyoto';
            const buffer = iconv.encode(csvContent, 'shift_jis');
            fs.writeFileSync(importPath, buffer);

            const readBuffer = fs.readFileSync(importPath);
            const encoding = detectTextEncoding(readBuffer);
            const decodedContent = decodeBuffer(readBuffer, encoding);

            assert.strictEqual(decodedContent, csvContent, 'Decoded content should match original');

            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 4, 'Should parse 4 rows');
            assert.strictEqual(parsed[1][0], 'John', 'First data should be John');
        });

        test('should import Japanese CSV from Shift-JIS file', async function() {
            this.timeout(5000);
            const importPath = path.join(tempDir, 'import-japanese-sjis.csv');
            const csvContent = '名前,年齢,都市\n田中,25,東京\n佐藤,30,大阪\n鈴木,35,京都';
            const buffer = iconv.encode(csvContent, 'shift_jis');
            fs.writeFileSync(importPath, buffer);

            const readBuffer = fs.readFileSync(importPath);
            const encoding = detectTextEncoding(readBuffer);
            const decodedContent = decodeBuffer(readBuffer, encoding);

            assert.strictEqual(decodedContent, csvContent, 'Japanese content should be preserved');

            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 4, 'Should parse 4 rows');
            assert.strictEqual(parsed[1][0], '田中', 'First data should be 田中');
            assert.strictEqual(parsed[3][2], '京都', 'Kyoto should be 京都');
        });

        test('should import Shift-JIS CSV with Japanese description fields', async function() {
            this.timeout(5000);
            const importPath = path.join(tempDir, 'import-sjis-desc.csv');
            const csvContent = '社員ID,名前,部門,説明\n' +
                             '001,田中太郎,営業部,営業マン\n' +
                             '002,佐藤花子,企画部,企画担当\n' +
                             '003,鈴木次郎,技術部,システムエンジニア';
            const buffer = iconv.encode(csvContent, 'shift_jis');
            fs.writeFileSync(importPath, buffer);

            const readBuffer = fs.readFileSync(importPath);
            const encoding = detectTextEncoding(readBuffer);
            const decodedContent = decodeBuffer(readBuffer, encoding);

            assert.ok(decodedContent.includes('田中太郎'), 'Should contain 田中太郎');
            assert.ok(decodedContent.includes('企画部'), 'Should contain 企画部');
            assert.ok(decodedContent.includes('システムエンジニア'), 'Should contain システムエンジニア');

            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 4, 'Should parse 4 rows');
            assert.strictEqual(parsed[1][1], '田中太郎', 'Second column should be name');
        });

        test('should import large Shift-JIS CSV file', async function() {
            this.timeout(5000);
            const importPath = path.join(tempDir, 'import-large-sjis.csv');
            let csvContent = 'ID,ユーザー名,メールアドレス\n';
            for (let i = 1; i <= 500; i++) {
                csvContent += `${i},ユーザー${i},user${i}@example.jp\n`;
            }
            const buffer = iconv.encode(csvContent, 'shift_jis');
            fs.writeFileSync(importPath, buffer);

            const readBuffer = fs.readFileSync(importPath);
            const encoding = detectTextEncoding(readBuffer);
            const decodedContent = decodeBuffer(readBuffer, encoding);

            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 501, 'Should parse all 501 rows');
            assert.ok(parsed[250][1].includes('ユーザー'), '250th row should contain ユーザー');
        });
    });

    suite('CSV Encoding Detection Tests', () => {
        test('should correctly detect UTF-8 encoding', async () => {
            const content = 'Name,Age,City\n日本,25,Tokyo';
            const buffer = Buffer.from(content, 'utf8');
            const encoding = detectTextEncoding(buffer);
            assert.strictEqual(encoding, 'utf8', 'Should detect UTF-8');
        });

        test('should correctly detect Shift-JIS encoding', async function() {
            this.timeout(5000);
            const content = 'Name,Age,City\n田中,25,東京';
            const buffer = iconv.encode(content, 'shift_jis');
            const encoding = detectTextEncoding(buffer);
            assert.ok(encoding === 'sjis' || encoding === 'utf8', 'Should detect encoding');
            const decoded = decodeBuffer(buffer, encoding);
            assert.ok(decoded.includes('田中'), 'Decoded content should contain 田中');
        });

        test('should handle UTF-8 BOM correctly', async () => {
            const content = 'Name,Age,City\nJohn,25,Tokyo';
            const utf8BOM = Buffer.concat([
                Buffer.from([0xEF, 0xBB, 0xBF]),
                Buffer.from(content, 'utf8')
            ]);
            const encoding = detectTextEncoding(utf8BOM);
            assert.strictEqual(encoding, 'utf8', 'Should detect UTF-8 BOM as UTF-8');
        });
    });

});
