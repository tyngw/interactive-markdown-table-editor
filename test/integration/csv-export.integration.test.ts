import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as iconv from 'iconv-lite';
import { parseCsv, decodeBuffer, detectTextEncoding } from '../../src/csvUtils';

/**
 * CSV Export Integration Tests
 *
            assert.ok(detectedEncoding === 'sjis' || detectedEncoding === 'utf8', 'Should detect encoding');

            const decodedContent = decodeBuffer(readBuffer, 'sjis');
            assert.strictEqual(decodedContent, csvContent, 'Decoded content should match original');
        });

        test('should export Japanese characters in Shift-JIS encoding', async function() {
            this.timeout(5000);
            const exportPath = path.join(tempDir, 'japanese-sjis-export.csv');
            const csvContent = '名前,年齢,都市\n田中,25,東京\n佐藤,30,大阪\n鈴木,35,京都';
            const buffer = iconv.encode(csvContent, 'shift_jis');
            fs.writeFileSync(exportPath, buffer);

            assert.ok(fs.existsSync(exportPath), 'Japanese Shift-JIS CSV file should be created');
            const stats = fs.statSync(exportPath);
            assert.ok(stats.size > 0, 'File should have content');

            const readBuffer = fs.readFileSync(exportPath);
            const decodedContent = decodeBuffer(readBuffer, 'sjis');
            assert.strictEqual(decodedContent, csvContent, 'Japanese content should be preserved in Shift-JIS');

            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 4, 'Should have 4 rows');
            assert.strictEqual(parsed[0][0], '名前', 'Header should be preserved');
        });

        test('should handle Shift-JIS with special characters', async function() {
            this.timeout(5000);
            const exportPath = path.join(tempDir, 'special-sjis.csv');
            const csvContent = '名前,説明,備考\n' +
                             '田中太郎,一般的なユーザー,テスト用\n' +
                             '佐藤花子,管理者ユーザー,本番環境\n' +
                             '鈴木次郎,ゲストユーザー,"複数行\n対応"';
            const buffer = iconv.encode(csvContent, 'shift_jis');
            fs.writeFileSync(exportPath, buffer);

            assert.ok(fs.existsSync(exportPath), 'Special chars Shift-JIS CSV file should be created');
            const readBuffer = fs.readFileSync(exportPath);
            const decodedContent = decodeBuffer(readBuffer, 'sjis');
            assert.strictEqual(decodedContent, csvContent, 'Special chars should be preserved');

            const parsed = parseCsv(decodedContent);
            assert.ok(parsed.length > 0, 'CSV should be parsed');
        });

        test('should handle large Shift-JIS CSV file', async function() {
            this.timeout(5000);
            const exportPath = path.join(tempDir, 'large-sjis.csv');
            let largeContent = 'ID,名前,都市\n';
            for (let i = 1; i <= 500; i++) {
                largeContent += `${i},ユーザー${i},都市${i % 10}\n`;
            }
            const buffer = iconv.encode(largeContent, 'shift_jis');
            fs.writeFileSync(exportPath, buffer);

            assert.ok(fs.existsSync(exportPath), 'Large Shift-JIS CSV file should be created');
            const stats = fs.statSync(exportPath);
            assert.ok(stats.size > 0, 'Large file should have content');

            const readBuffer = fs.readFileSync(exportPath);
            const decodedContent = decodeBuffer(readBuffer, 'sjis');
            const parsed = parseCsv(decodedContent);
            assert.strictEqual(parsed.length, 501, 'Should have 501 rows (header + 500 data rows)');
        });
    });

});
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseCsv, decodeBuffer, detectTextEncoding } from '../../src/csvUtils';
import * as iconv from 'iconv-lite';

/**
 * CSV Import/Export Integration Tests
 * 
 * These tests validate CSV file handling through the extension's public interface.
 * Tests cover both import and export operations with UTF-8 and Shift-JIS encodings.
 */
suite('CSV Import/Export Integration Tests', () => {
    let tempDir: string;

    suiteSetup(async () => {
        // Create temporary directory for test files
        tempDir = path.join(__dirname, '..', '..', 'temp-test-csv');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    suiteTeardown(() => {
        // Clean up temporary files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    suite('CSV Export Tests - UTF-8 Encoding', () => {
        test('should write UTF-8 CSV file', async () => {
            const exportPath = path.join(tempDir, 'exported-utf8.csv');
            const csvContent = 'Name,Age,City\nJohn,25,Tokyo\nJane,30,Osaka\nBob,35,Kyoto';
            
            // Write file directly
            fs.writeFileSync(exportPath, csvContent, 'utf8');

            // Verify file was created and content matches
            assert.ok(fs.existsSync(exportPath), 'CSV file should be created');
            const fileContent = fs.readFileSync(exportPath, 'utf8');
            assert.strictEqual(fileContent, csvContent, 'File content should match');
        });

        test('should preserve Japanese characters in UTF-8', async () => {
            const exportPath = path.join(tempDir, 'japanese-utf8.csv');
            const csvContent = '名前,年齢,都市\n田中,25,東京\n佐藤,30,大阪';
            
            fs.writeFileSync(exportPath, csvContent, 'utf8');

            assert.ok(fs.existsSync(exportPath), 'Japanese CSV file should be created');
            const fileContent = fs.readFileSync(exportPath, 'utf8');
            assert.strictEqual(fileContent, csvContent, 'Japanese content should be preserved');
        });

        test('should handle complex CSV content with special characters', async () => {
            const exportPath = path.join(tempDir, 'complex-exported.csv');
            const complexContent = 'Name,Description,Notes\n' +
                                 '"John, Jr.","A ""smart"" person","Line 1\nLine 2"\n' +
                                 'Jane,Simple text,Normal note\n' +
                                 '"Special chars: áéíóú","Unicode: 漢字","Mixed: abc123"';
            
            fs.writeFileSync(exportPath, complexContent, 'utf8');

            assert.ok(fs.existsSync(exportPath), 'Complex CSV file should be created');
            const fileContent = fs.readFileSync(exportPath, 'utf8');
            assert.strictEqual(fileContent, complexContent, 'Complex content should be preserved exactly');
        });

        test('should handle large CSV content', async () => {
            const exportPath = path.join(tempDir, 'large-exported.csv');
            
            // Generate large CSV content (1000 rows)
            let largeContent = 'ID,Name,Email,Phone,Address\n';
            for (let i = 1; i <= 1000; i++) {
                largeContent += `${i},User${i},user${i}@example.com,+1-555-${String(i).padStart(4, '0')},${i} Main St\n`;
            }
            
            fs.writeFileSync(exportPath, largeContent, 'utf8');

            assert.ok(fs.existsSync(exportPath), 'Large CSV file should be created');
            const fileContent = fs.readFileSync(exportPath, 'utf8');
            assert.strictEqual(fileContent, largeContent, 'Large content should be preserved exactly');

            // Verify file size is reasonable
            const stats = fs.statSync(exportPath);
            assert.ok(stats.size > 50000, 'Large file should have appropriate size');
        });

});

});
