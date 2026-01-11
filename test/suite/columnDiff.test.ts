/**
 * 列差分検出モジュールのテスト
 * セル分解、ヘッダ比較、列差分検出の各機能をテスト
 */

import * as assert from 'assert';
import {
    // セル分解
    countTableCells,
    parseTableRowCells,
    isSeparatorRow,
    // ヘッダ比較
    normalizeHeader,
    headersEqual,
    findHeaderIndex,
    headerExists,
    findDeletedHeaderIndices,
    findAddedHeaderIndices,
    createHeaderPositionMapping,
    // 列差分検出
    detectColumnDiff,
    detectColumnDiffSimple,
    // 型
    RowGitDiffInput
} from '../../columnDiff';

suite('ColumnDiff Module Tests', () => {
    
    suite('cellParser - countTableCells', () => {
        
        test('基本的なテーブル行のセル数を正しくカウント', () => {
            assert.strictEqual(countTableCells('| a | b | c |'), 3);
            assert.strictEqual(countTableCells('| Header1 | Header2 |'), 2);
            assert.strictEqual(countTableCells('| single |'), 1);
        });
        
        test('先頭/末尾のパイプがない場合も処理', () => {
            assert.strictEqual(countTableCells('a | b | c'), 3);
            assert.strictEqual(countTableCells('| a | b | c'), 3);
            assert.strictEqual(countTableCells('a | b | c |'), 3);
        });
        
        test('空文字列やパイプなしの場合は0を返す', () => {
            assert.strictEqual(countTableCells(''), 0);
            assert.strictEqual(countTableCells('no pipes here'), 0);
        });
        
        test('エスケープされたパイプを考慮してカウント', () => {
            // "a \| b" は1つのセル、"c" は別のセル → 合計2セル
            assert.strictEqual(countTableCells('| a \\| b | c |'), 2);
            // 複数のエスケープされたパイプ
            assert.strictEqual(countTableCells('| a \\| b \\| c | d |'), 2);
        });
        
        test('エスケープ処理を無効化した場合', () => {
            // エスケープを無効にすると \| も区切りとして扱う
            assert.strictEqual(
                countTableCells('| a \\| b | c |', { handleEscapedPipes: false }), 
                3
            );
        });
        
    });
    
    suite('cellParser - parseTableRowCells', () => {
        
        test('基本的なテーブル行からセル値を抽出', () => {
            assert.deepStrictEqual(
                parseTableRowCells('| a | b | c |'),
                ['a', 'b', 'c']
            );
            assert.deepStrictEqual(
                parseTableRowCells('| Header1 | Header2 |'),
                ['Header1', 'Header2']
            );
        });
        
        test('セル値をトリム', () => {
            assert.deepStrictEqual(
                parseTableRowCells('|  a  |  b  |'),
                ['a', 'b']
            );
        });
        
        test('トリムを無効化した場合', () => {
            assert.deepStrictEqual(
                parseTableRowCells('|  a  |  b  |', { trimCells: false }),
                ['  a  ', '  b  ']
            );
        });
        
        test('エスケープされたパイプを含むセル', () => {
            // "a | b" が1つのセルとして抽出される
            assert.deepStrictEqual(
                parseTableRowCells('| a \\| b | c |'),
                ['a | b', 'c']
            );
        });
        
        test('空のセルを処理', () => {
            assert.deepStrictEqual(
                parseTableRowCells('| a |  | c |'),
                ['a', '', 'c']
            );
        });
        
        test('空文字列の場合は空配列を返す', () => {
            assert.deepStrictEqual(parseTableRowCells(''), []);
            assert.deepStrictEqual(parseTableRowCells('no pipes'), []);
        });
        
    });
    
    suite('cellParser - isSeparatorRow', () => {
        
        test('セパレータ行を正しく判定', () => {
            assert.strictEqual(isSeparatorRow('| --- | --- | --- |'), true);
            assert.strictEqual(isSeparatorRow('| :--- | :---: | ---: |'), true);
            assert.strictEqual(isSeparatorRow('|---|---|'), true);
        });
        
        test('ヘッダ行はセパレータ行ではない', () => {
            assert.strictEqual(isSeparatorRow('| Header1 | Header2 |'), false);
            assert.strictEqual(isSeparatorRow('| a | b | c |'), false);
        });
        
        test('混在行はセパレータ行ではない', () => {
            assert.strictEqual(isSeparatorRow('| --- | text | --- |'), false);
        });
        
    });
    
    suite('headerComparator - normalizeHeader', () => {
        
        test('前後の空白を除去', () => {
            assert.strictEqual(normalizeHeader('  Header  '), 'Header');
        });
        
        test('連続する空白を正規化', () => {
            assert.strictEqual(normalizeHeader('Header  Name'), 'Header Name');
        });
        
        test('大文字小文字を無視（オプション）', () => {
            assert.strictEqual(
                normalizeHeader('HEADER', { ignoreCase: true }),
                'header'
            );
        });
        
        test('デフォルトでは大文字小文字を維持', () => {
            assert.strictEqual(normalizeHeader('HEADER'), 'HEADER');
        });
        
    });
    
    suite('headerComparator - headersEqual', () => {
        
        test('同じヘッダは等しい', () => {
            assert.strictEqual(headersEqual('Header', 'Header'), true);
        });
        
        test('空白の差異を無視', () => {
            assert.strictEqual(headersEqual('  Header  ', 'Header'), true);
            assert.strictEqual(headersEqual('Header  Name', 'Header Name'), true);
        });
        
        test('大文字小文字の差異（デフォルトでは区別）', () => {
            assert.strictEqual(headersEqual('Header', 'HEADER'), false);
        });
        
        test('大文字小文字を無視（オプション）', () => {
            assert.strictEqual(
                headersEqual('Header', 'HEADER', { ignoreCase: true }),
                true
            );
        });
        
    });
    
    suite('headerComparator - findHeaderIndex', () => {
        
        test('ヘッダのインデックスを取得', () => {
            const headers = ['A', 'B', 'C'];
            assert.strictEqual(findHeaderIndex(headers, 'B'), 1);
        });
        
        test('存在しないヘッダは-1を返す', () => {
            const headers = ['A', 'B', 'C'];
            assert.strictEqual(findHeaderIndex(headers, 'D'), -1);
        });
        
        test('空白の差異を無視して検索', () => {
            const headers = ['Header1', 'Header2'];
            assert.strictEqual(findHeaderIndex(headers, '  Header1  '), 0);
        });
        
    });
    
    suite('headerComparator - findDeletedHeaderIndices', () => {
        
        test('削除されたヘッダのインデックスを検出', () => {
            const oldHeaders = ['A', 'B', 'C', 'D'];
            const newHeaders = ['A', 'C', 'D'];
            assert.deepStrictEqual(
                findDeletedHeaderIndices(oldHeaders, newHeaders),
                [1] // B が削除された
            );
        });
        
        test('複数の削除を検出', () => {
            const oldHeaders = ['A', 'B', 'C', 'D'];
            const newHeaders = ['A', 'D'];
            assert.deepStrictEqual(
                findDeletedHeaderIndices(oldHeaders, newHeaders),
                [1, 2] // B, C が削除された
            );
        });
        
        test('削除がない場合は空配列', () => {
            const oldHeaders = ['A', 'B'];
            const newHeaders = ['A', 'B', 'C'];
            assert.deepStrictEqual(
                findDeletedHeaderIndices(oldHeaders, newHeaders),
                []
            );
        });
        
    });
    
    suite('headerComparator - findAddedHeaderIndices', () => {
        
        test('追加されたヘッダのインデックスを検出', () => {
            const oldHeaders = ['A', 'B'];
            const newHeaders = ['A', 'B', 'C'];
            assert.deepStrictEqual(
                findAddedHeaderIndices(oldHeaders, newHeaders),
                [2] // C が追加された
            );
        });
        
        test('中間位置への追加を検出', () => {
            const oldHeaders = ['A', 'C'];
            const newHeaders = ['A', 'B', 'C'];
            assert.deepStrictEqual(
                findAddedHeaderIndices(oldHeaders, newHeaders),
                [1] // B が追加された
            );
        });
        
    });
    
    suite('headerComparator - createHeaderPositionMapping', () => {
        
        test('位置マッピングを作成', () => {
            const oldHeaders = ['A', 'B', 'C'];
            const newHeaders = ['A', 'C']; // B が削除された
            const mapping = createHeaderPositionMapping(oldHeaders, newHeaders);
            
            assert.strictEqual(mapping.get(0), 0); // A -> 0
            assert.strictEqual(mapping.get(1), -1); // B -> -1 (削除)
            assert.strictEqual(mapping.get(2), 1); // C -> 1
        });
        
    });
    
    suite('columnDiffDetector - detectColumnDiff', () => {
        
        test('列の削除を検出（ヘッダ比較）', () => {
            const gitDiff: RowGitDiffInput[] = [
                { row: -2, status: 'deleted', oldContent: '| A | B | C |' },
                { row: -2, status: 'added', newContent: '| A | C |' },
                { row: 0, status: 'deleted', oldContent: '| 1 | 2 | 3 |' },
                { row: 0, status: 'added', newContent: '| 1 | 3 |' }
            ];
            
            const result = detectColumnDiff(gitDiff, 2);
            
            assert.strictEqual(result.oldColumnCount, 3);
            assert.strictEqual(result.newColumnCount, 2);
            assert.deepStrictEqual(result.deletedColumns, [1]); // B が削除された
            assert.strictEqual(result.detectionMethod, 'header-comparison');
        });
        
        test('列の追加を検出（ヘッダ比較）', () => {
            const gitDiff: RowGitDiffInput[] = [
                { row: -2, status: 'deleted', oldContent: '| A | B |' },
                { row: -2, status: 'added', newContent: '| A | B | C |' },
                { row: 0, status: 'deleted', oldContent: '| 1 | 2 |' },
                { row: 0, status: 'added', newContent: '| 1 | 2 | 3 |' }
            ];
            
            const result = detectColumnDiff(gitDiff, 3);
            
            assert.strictEqual(result.oldColumnCount, 2);
            assert.strictEqual(result.newColumnCount, 3);
            assert.deepStrictEqual(result.addedColumns, [2]); // C が追加された
            assert.strictEqual(result.detectionMethod, 'header-comparison');
        });
        
        test('フォールバック: ヘッダ情報なしで末尾から削除', () => {
            const gitDiff: RowGitDiffInput[] = [
                { row: 0, status: 'deleted', oldContent: '| 1 | 2 | 3 |' },
                { row: 0, status: 'added', newContent: '| 1 | 2 |' }
            ];
            
            const result = detectColumnDiff(gitDiff, 2);
            
            assert.strictEqual(result.oldColumnCount, 3);
            assert.strictEqual(result.newColumnCount, 2);
            assert.deepStrictEqual(result.deletedColumns, [2]); // 末尾から削除と仮定
            assert.strictEqual(result.detectionMethod, 'fallback-end-columns');
        });
        
        test('変更なしの場合', () => {
            const gitDiff: RowGitDiffInput[] = [
                { row: 0, status: 'deleted', oldContent: '| 1 | 2 |' },
                { row: 0, status: 'added', newContent: '| a | b |' }
            ];
            
            const result = detectColumnDiff(gitDiff, 2);
            
            assert.strictEqual(result.oldColumnCount, 2);
            assert.strictEqual(result.newColumnCount, 2);
            assert.deepStrictEqual(result.deletedColumns, []);
            assert.deepStrictEqual(result.addedColumns, []);
            assert.strictEqual(result.detectionMethod, 'no-change');
        });
        
        test('空のgitDiffの場合', () => {
            const result = detectColumnDiff([], 3);
            
            assert.strictEqual(result.oldColumnCount, 3);
            assert.strictEqual(result.newColumnCount, 3);
            assert.strictEqual(result.detectionMethod, 'no-change');
        });
        
        test('エスケープされたパイプを含む行を正しく処理', () => {
            const gitDiff: RowGitDiffInput[] = [
                { row: -2, status: 'deleted', oldContent: '| A | B \\| C | D |' },
                { row: -2, status: 'added', newContent: '| A | D |' },
                { row: 0, status: 'deleted', oldContent: '| 1 | 2 \\| 3 | 4 |' }
            ];
            
            const result = detectColumnDiff(gitDiff, 2);
            
            // oldContent は 3 列 (A, "B | C", D)
            assert.strictEqual(result.oldColumnCount, 3);
            assert.strictEqual(result.newColumnCount, 2);
            // "B | C" が削除された
            assert.deepStrictEqual(result.deletedColumns, [1]);
        });
        
        test('大文字小文字を無視したヘッダ比較（オプション）', () => {
            const gitDiff: RowGitDiffInput[] = [
                { row: -2, status: 'deleted', oldContent: '| header1 | header2 |' },
                { row: -2, status: 'added', newContent: '| HEADER1 | HEADER2 | HEADER3 |' },
                { row: 0, status: 'deleted', oldContent: '| 1 | 2 |' }
            ];
            
            const result = detectColumnDiff(gitDiff, 3, {
                headerCompare: { ignoreCase: true }
            });
            
            assert.strictEqual(result.oldColumnCount, 2);
            assert.strictEqual(result.newColumnCount, 3);
            // 大文字小文字を無視するので header1, header2 は存在扱い
            assert.deepStrictEqual(result.addedColumns, [2]); // HEADER3 が追加
            assert.strictEqual(result.detectionMethod, 'header-comparison');
        });
        
    });
    
    suite('columnDiffDetector - detectColumnDiffSimple', () => {
        
        test('簡易版が ColumnDiffInfo を返す', () => {
            const gitDiff: RowGitDiffInput[] = [
                { row: -2, status: 'deleted', oldContent: '| A | B | C |' },
                { row: -2, status: 'added', newContent: '| A | C |' },
                { row: 0, status: 'deleted', oldContent: '| 1 | 2 | 3 |' }
            ];
            
            const result = detectColumnDiffSimple(gitDiff, 2);
            
            assert.strictEqual(result.oldColumnCount, 3);
            assert.strictEqual(result.newColumnCount, 2);
            assert.deepStrictEqual(result.deletedColumns, [1]);
            // detectionMethod と confidence は含まれない
            assert.strictEqual('detectionMethod' in result, false);
        });
        
    });
    
});
