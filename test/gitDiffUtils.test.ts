/**
 * Git差分ユーティリティのテスト
 * 複数行の削除・追加時に正しくMODIFIEDとしてペアリングされるか検証
 * 中間列検知の強化ロジックのテストを含む
 */

import * as assert from 'assert';
import {
    tokenizeRow,
    normalizeHeader,
    computeLCS,
    calculateSimilarity,
    detectColumnDiffWithPositions,
    GitDiffStatus,
    RowGitDiff,
    __test__
} from '../src/gitDiffUtils';

const { parseGitDiff, mapTableRowsToGitDiff } = (__test__ as {
    parseGitDiff: (diffOutput: string, tableStartLine: number, tableEndLine: number) => any[];
    mapTableRowsToGitDiff: (lineDiffs: any[], tableStartLine: number, rowCount: number, tableContent?: string) => RowGitDiff[];
});

function summarize(rows: RowGitDiff[]) {
    return rows.map(r => ({
        row: r.row,
        status: r.status,
        oldContent: r.oldContent,
        newContent: r.newContent,
        isDeletedRow: Boolean(r.isDeletedRow)
    }));
}

describe('mapTableRowsToGitDiff - 複数行の差分ペアリング', () => {
    const tableStartLine = 1; // 0ベースの開始行（ヘッダ行の行番号）
    const tableEndLine = 6;   // 未使用だが parseGitDiff のシグネチャに合わせる
    const rowCount = 3;       // データ行数

    it('削除2行と追加2行を順序通りにペアリングする', () => {
        const diffOutput = [
            '@@ -4,2 +4,2 @@',
            '-| a |',
            '-| b |',
            '+| a2 |',
            '+| b2 |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, rowCount);

        assert.deepStrictEqual(summarize(result), [
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| a |', newContent: undefined, isDeletedRow: true },
            { row: 0, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| a2 |', isDeletedRow: false },
            { row: 1, status: GitDiffStatus.DELETED, oldContent: '| b |', newContent: undefined, isDeletedRow: true },
            { row: 1, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| b2 |', isDeletedRow: false }
        ]);
    });

    it('削除3行・追加2行で余剰削除をDELETEDとして残す', () => {
        const diffOutput = [
            '@@ -4,3 +4,2 @@',
            '-| a |',
            '-| b |',
            '-| c |',
            '+| a2 |',
            '+| b2 |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, rowCount);

        assert.deepStrictEqual(summarize(result), [
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| a |', newContent: undefined, isDeletedRow: true },
            { row: 0, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| a2 |', isDeletedRow: false },
            { row: 1, status: GitDiffStatus.DELETED, oldContent: '| b |', newContent: undefined, isDeletedRow: true },
            { row: 1, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| b2 |', isDeletedRow: false },
            { row: 2, status: GitDiffStatus.DELETED, oldContent: '| c |', newContent: undefined, isDeletedRow: true }
        ]);
    });

    it('削除2行・追加3行で余剰追加をADDEDとして残す', () => {
        const diffOutput = [
            '@@ -4,2 +4,3 @@',
            '-| a |',
            '-| b |',
            '+| a2 |',
            '+| b2 |',
            '+| c3 |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, rowCount + 1);

        assert.deepStrictEqual(summarize(result), [
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| a |', newContent: undefined, isDeletedRow: true },
            { row: 0, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| a2 |', isDeletedRow: false },
            { row: 1, status: GitDiffStatus.DELETED, oldContent: '| b |', newContent: undefined, isDeletedRow: true },
            { row: 1, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| b2 |', isDeletedRow: false },
            { row: 2, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| c3 |', isDeletedRow: false }
        ]);
    });

    it('複数hunkでもペアリングが混ざらない', () => {
        const diffOutput = [
            '@@ -4,1 +4,1 @@',
            '-| r0 |',
            '+| r0a |',
            '@@ -6,1 +6,2 @@',
            '-| r2 |',
            '+| r2a |',
            '+| r2b |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, rowCount + 1);

        assert.deepStrictEqual(summarize(result), [
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| r0 |', newContent: undefined, isDeletedRow: true },
            { row: 0, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| r0a |', isDeletedRow: false },
            { row: 2, status: GitDiffStatus.DELETED, oldContent: '| r2 |', newContent: undefined, isDeletedRow: true },
            { row: 2, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| r2a |', isDeletedRow: false },
            { row: 3, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| r2b |', isDeletedRow: false }
        ]);
    });

    it('ヘッダ行の変更を行番号にマップできる', () => {
        const diffOutput = [
            '@@ -2,1 +2,1 @@',
            '-| H1 | H2 |',
            '+| H1 | H2 new |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, rowCount);

        assert.deepStrictEqual(summarize(result), [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '| H1 | H2 |', newContent: undefined, isDeletedRow: true },
            { row: -2, status: GitDiffStatus.ADDED, oldContent: undefined, newContent: '| H1 | H2 new |', isDeletedRow: false }
        ]);
    });
});

// ============================================================
// 中間列検知の強化ロジックのテスト
// ============================================================

describe('tokenizeRow - エスケープ/コードスパン対応のセル分割', () => {
    it('単純なテーブル行を正しく分割する', () => {
        const result = tokenizeRow('| a | b | c |');
        assert.deepStrictEqual(result, ['a', 'b', 'c']);
    });

    it('先頭/末尾パイプ省略形式を正しく分割する', () => {
        const result = tokenizeRow('a | b | c');
        assert.deepStrictEqual(result, ['a', 'b', 'c']);
    });

    it('エスケープされたパイプを区切りとして扱わない', () => {
        const result = tokenizeRow('| a \\| b | c |');
        assert.deepStrictEqual(result, ['a \\| b', 'c']);
    });

    it('コードスパン内のパイプを無視する', () => {
        const result = tokenizeRow('| `a|b` | c |');
        assert.deepStrictEqual(result, ['`a|b`', 'c']);
    });

    it('複数バッククォートのコードスパンを処理する', () => {
        const result = tokenizeRow('| ``a|b`` | c |');
        assert.deepStrictEqual(result, ['``a|b``', 'c']);
    });

    it('空文字列に対して空配列を返す', () => {
        const result = tokenizeRow('');
        assert.deepStrictEqual(result, []);
    });

    it('パイプのない文字列を単一セルとして扱う', () => {
        const result = tokenizeRow('just text');
        assert.deepStrictEqual(result, ['just text']);
    });

    it('連続した空白セルを正しく処理する', () => {
        const result = tokenizeRow('| a |  | c |');
        assert.deepStrictEqual(result, ['a', '', 'c']);
    });
});

describe('normalizeHeader - ヘッダの正規化', () => {
    it('先頭末尾の空白を除去する', () => {
        assert.strictEqual(normalizeHeader('  Header  '), 'header');
    });

    it('連続空白を単一スペースに正規化する', () => {
        assert.strictEqual(normalizeHeader('Header   Name'), 'header name');
    });

    it('小文字化する', () => {
        assert.strictEqual(normalizeHeader('HEADER'), 'header');
    });

    it('空文字列を処理する', () => {
        assert.strictEqual(normalizeHeader(''), '');
    });
});

describe('computeLCS - 最長共通部分列', () => {
    it('同一配列で完全一致', () => {
        const result = computeLCS(['a', 'b', 'c'], ['a', 'b', 'c']);
        assert.strictEqual(result.length, 3);
        assert.deepStrictEqual(result, [
            { i1: 0, i2: 0 },
            { i1: 1, i2: 1 },
            { i1: 2, i2: 2 }
        ]);
    });

    it('中間に挿入がある場合', () => {
        const result = computeLCS(['a', 'b', 'c'], ['a', 'b', 'x', 'c']);
        assert.strictEqual(result.length, 3);
        assert.deepStrictEqual(result, [
            { i1: 0, i2: 0 },
            { i1: 1, i2: 1 },
            { i1: 2, i2: 3 }
        ]);
    });

    it('中間から削除がある場合', () => {
        const result = computeLCS(['a', 'b', 'x', 'c'], ['a', 'b', 'c']);
        assert.strictEqual(result.length, 3);
        assert.deepStrictEqual(result, [
            { i1: 0, i2: 0 },
            { i1: 1, i2: 1 },
            { i1: 3, i2: 2 }
        ]);
    });

    it('空配列を処理する', () => {
        const result = computeLCS([], ['a', 'b']);
        assert.deepStrictEqual(result, []);
    });
});

describe('calculateSimilarity - レーベンシュタイン類似度', () => {
    it('同一文字列で1.0を返す', () => {
        assert.strictEqual(calculateSimilarity('header', 'header'), 1.0);
    });

    it('完全に異なる文字列で低い値を返す', () => {
        const similarity = calculateSimilarity('abc', 'xyz');
        assert.ok(similarity < 0.5);
    });

    it('類似した文字列で高い値を返す', () => {
        const similarity = calculateSimilarity('header', 'headers');
        assert.ok(similarity > 0.7);
    });

    it('空文字列で0.0を返す', () => {
        assert.strictEqual(calculateSimilarity('', 'test'), 0.0);
        assert.strictEqual(calculateSimilarity('test', ''), 0.0);
    });
});

describe('detectColumnDiffWithPositions - 中間列検知', () => {
    it('列数が同じで変更がない場合', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C'],
            ['A', 'B', 'C']
        );
        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.addedColumns, []);
        assert.deepStrictEqual(result.deletedColumns, []);
        assert.deepStrictEqual(result.mapping, [0, 1, 2]);
    });

    it('末尾に列追加を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C'],
            ['A', 'B', 'C', 'D']
        );
        assert.strictEqual(result.changeType, 'added');
        assert.deepStrictEqual(result.addedColumns, [3]);
        assert.deepStrictEqual(result.deletedColumns, []);
    });

    it('中間に列追加を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C'],
            ['A', 'B', 'X', 'C']
        );
        assert.strictEqual(result.changeType, 'added');
        assert.deepStrictEqual(result.addedColumns, [2]);
        assert.deepStrictEqual(result.deletedColumns, []);
        // mapping: A->0, B->1, C->3
        assert.strictEqual(result.mapping![0], 0);
        assert.strictEqual(result.mapping![1], 1);
        assert.strictEqual(result.mapping![2], 3);
    });

    it('中間から列削除を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'X', 'C'],
            ['A', 'B', 'C']
        );
        assert.strictEqual(result.changeType, 'removed');
        assert.deepStrictEqual(result.addedColumns, []);
        assert.deepStrictEqual(result.deletedColumns, [2]);
        // mapping: A->0, B->1, X->-1, C->2
        assert.strictEqual(result.mapping![0], 0);
        assert.strictEqual(result.mapping![1], 1);
        assert.strictEqual(result.mapping![2], -1);
        assert.strictEqual(result.mapping![3], 2);
    });

    it('ヘッダ名変更と中間挿入を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C'],
            ['A', 'NewB', 'X', 'C']
        );
        // B -> NewB はファジーマッチで検出、X は追加
        assert.strictEqual(result.addedColumns.includes(2), true);
        // heuristics に fuzzy_match が含まれる場合がある
        assert.ok(result.heuristics!.some(h => 
            h.includes('exact_match') || h.includes('lcs_match') || h.includes('fuzzy_match')
        ));
    });

    it('positions に詳細情報が含まれる', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C'],
            ['A', 'C']
        );
        assert.ok(result.positions);
        assert.ok(result.positions!.length > 0);
        const removedPos = result.positions!.find(p => p.type === 'removed');
        assert.ok(removedPos);
        assert.strictEqual(removedPos!.index, 1);
        assert.strictEqual(removedPos!.header, 'B');
        assert.ok(removedPos!.confidence > 0);
    });

    it('サンプリング補正が適用される（データ行あり）', () => {
        const oldHeaders = ['Name', 'Age', 'City'];
        const newHeaders = ['Name', 'Age', 'Country', 'City'];
        const oldDataRows = [
            ['Alice', '25', 'Tokyo'],
            ['Bob', '30', 'Osaka']
        ];
        const newDataRows = [
            ['Alice', '25', 'Japan', 'Tokyo'],
            ['Bob', '30', 'Japan', 'Osaka']
        ];
        
        const result = detectColumnDiffWithPositions(
            oldHeaders,
            newHeaders,
            oldDataRows,
            newDataRows
        );
        
        assert.strictEqual(result.changeType, 'added');
        assert.deepStrictEqual(result.addedColumns, [2]);
        assert.ok(result.heuristics!.some(h => h.includes('sampling')));
    });

    it('複数列の追加・削除を同時に検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C', 'D'],
            ['A', 'X', 'C', 'Y']
        );
        // B は削除、X は追加（位置1に）、Y は追加（位置3に）
        assert.ok(result.addedColumns.includes(1) || result.addedColumns.includes(3));
        assert.ok(result.deletedColumns.includes(1) || result.deletedColumns.length > 0);
    });
});

describe('mapTableRowsToGitDiff - データセル値の編集', () => {
    const tableStartLine = 1;
    const tableEndLine = 6;
    const rowCount = 2;

    it('単一行のデータセル値を編集する', () => {
        const diffOutput = [
            '@@ -4,1 +4,1 @@',
            '-| Alice | 25 |',
            '+| Alice | 30 |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, rowCount);

        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[0].oldContent, '| Alice | 25 |');
        assert.strictEqual(result[1].status, GitDiffStatus.ADDED);
        assert.strictEqual(result[1].newContent, '| Alice | 30 |');
    });

    it('複数行のデータセル値を編集する', () => {
        const diffOutput = [
            '@@ -4,2 +4,2 @@',
            '-| Alice | 25 |',
            '-| Bob | 30 |',
            '+| Alice | 26 |',
            '+| Bob | 31 |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, rowCount + 1);

        assert.strictEqual(result.length, 4);
        // 1行目の削除と追加
        assert.strictEqual(result[0].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[0].row, 0);
        assert.strictEqual(result[1].status, GitDiffStatus.ADDED);
        assert.strictEqual(result[1].row, 0);
        // 2行目の削除と追加
        assert.strictEqual(result[2].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[2].row, 1);
        assert.strictEqual(result[3].status, GitDiffStatus.ADDED);
        assert.strictEqual(result[3].row, 1);
    });

    it('変更なしの行は含まれない', () => {
        const diffOutput = [
            '@@ -4,3 +4,3 @@',
            ' | Alice | 25 |',
            '-| Bob | 30 |',
            '+| Bob | 31 |',
            ' | Carol | 28 |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, rowCount + 1);

        // 変更行のみが対象で、変更なし行は含まれない
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[0].oldContent, '| Bob | 30 |');
        assert.strictEqual(result[1].status, GitDiffStatus.ADDED);
        assert.strictEqual(result[1].newContent, '| Bob | 31 |');
    });

    it('列追加と行編集の組み合わせ', () => {
        const diffOutput = [
            '@@ -2,2 +2,3 @@',
            '-| Name | Age |',
            '+| Name | Age | Country |',
            ' | Alice | 25 |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, 1);

        assert.strictEqual(result.length, 2);
        // ヘッダ行の変更
        assert.strictEqual(result[0].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[0].row, -2);
        assert.strictEqual(result[1].status, GitDiffStatus.ADDED);
        assert.strictEqual(result[1].row, -2);
    });
});

describe('detectColumnDiffWithPositions - エッジケース', () => {
    it('先頭列の削除を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['X', 'B', 'C'],
            ['B', 'C']
        );
        assert.strictEqual(result.changeType, 'removed');
        assert.deepStrictEqual(result.deletedColumns, [0]);
        assert.strictEqual(result.mapping![0], -1);
        assert.strictEqual(result.mapping![1], 0);
        assert.strictEqual(result.mapping![2], 1);
    });

    it('先頭列の追加を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['B', 'C'],
            ['X', 'B', 'C']
        );
        assert.strictEqual(result.changeType, 'added');
        assert.deepStrictEqual(result.addedColumns, [0]);
    });

    it('複数列の連続削除を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'X', 'Y', 'D'],
            ['A', 'D']
        );
        assert.strictEqual(result.changeType, 'removed');
        assert.deepStrictEqual(result.deletedColumns, [1, 2]);
        assert.strictEqual(result.mapping![0], 0);
        assert.strictEqual(result.mapping![3], 1);
    });

    it('複数列の連続追加を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'D'],
            ['A', 'X', 'Y', 'D']
        );
        assert.strictEqual(result.changeType, 'added');
        assert.deepStrictEqual(result.addedColumns, [1, 2]);
    });

    it('単一列のテーブル（追加）を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A'],
            ['A', 'B']
        );
        assert.strictEqual(result.changeType, 'added');
        assert.deepStrictEqual(result.addedColumns, [1]);
    });

    it('単一列のテーブル（削除）を検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B'],
            ['A']
        );
        assert.strictEqual(result.changeType, 'removed');
        assert.deepStrictEqual(result.deletedColumns, [1]);
    });

    it('すべての列が削除される場合', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C'],
            []
        );
        assert.strictEqual(result.changeType, 'removed');
        assert.deepStrictEqual(result.deletedColumns, [0, 1, 2]);
    });

    it('すべての列が追加される場合', () => {
        const result = detectColumnDiffWithPositions(
            [],
            ['A', 'B', 'C']
        );
        assert.strictEqual(result.changeType, 'added');
        assert.deepStrictEqual(result.addedColumns, [0, 1, 2]);
    });

    it('すべての列名が変更される場合', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C'],
            ['X', 'Y', 'Z']
        );
        // 列数は同じだが、ファジーマッチが失敗する場合
        assert.ok(result.changeType === 'added' || result.changeType === 'removed' || result.changeType === 'mixed');
    });

    it('大文字小文字の違いのみ', () => {
        const result = detectColumnDiffWithPositions(
            ['Name', 'Age', 'City'],
            ['name', 'age', 'city']
        );
        // 正規化により同じと見なされるはず
        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.addedColumns, []);
        assert.deepStrictEqual(result.deletedColumns, []);
    });

    it('空白の違いのみ', () => {
        const result = detectColumnDiffWithPositions(
            ['  Name  ', 'Age', 'City'],
            ['Name', '  Age  ', 'City']
        );
        // 正規化により同じと見なされるはず
        assert.strictEqual(result.changeType, 'none');
    });

    it('特殊文字を含むヘッダ', () => {
        const result = detectColumnDiffWithPositions(
            ['Name (EN)', 'Age [年齢]', 'City & Country'],
            ['Name (EN)', 'Age [年齢]', 'City & Country']
        );
        assert.strictEqual(result.changeType, 'none');
    });
});

describe('tokenizeRow - 特殊ケース', () => {
    it('バッククォート内のエスケープを処理する', () => {
        const result = tokenizeRow('| `\\|test` | b |');
        assert.deepStrictEqual(result, ['`\\|test`', 'b']);
    });

    it('複数のコードスパンを処理する', () => {
        const result = tokenizeRow('| `a|b` | `c|d` |');
        assert.deepStrictEqual(result, ['`a|b`', '`c|d`']);
    });

    it('ネストされたバッククォートは正しく処理されない場合がある', () => {
        // マークダウンの仕様上、ネストは正式にはサポートされない
        const result = tokenizeRow('| ``a`b`` | c |');
        // 実装の動作に依存
        assert.ok(result.length >= 2);
    });

    it('セルに複数のスペースと空白文字が含まれる場合', () => {
        const result = tokenizeRow('|  a  b  | c |');
        assert.deepStrictEqual(result, ['a  b', 'c']);
    });

    it('セルに改行文字が含まれない（マークダウンテーブルは1行）', () => {
        const result = tokenizeRow('| a | b |');
        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(result, ['a', 'b']);
    });
});

describe('computeLCS - より詳細なケース', () => {
    it('完全に異なる配列', () => {
        const result = computeLCS(['a', 'b'], ['x', 'y']);
        assert.strictEqual(result.length, 0);
    });

    it('1つの要素だけ共通', () => {
        const result = computeLCS(['a', 'b', 'c'], ['x', 'b', 'y']);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].i1, 1);
        assert.strictEqual(result[0].i2, 1);
    });

    it('交互に異なる配列', () => {
        const result = computeLCS(['a', 'x', 'b', 'y'], ['a', 'b']);
        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(result, [
            { i1: 0, i2: 0 },
            { i1: 2, i2: 1 }
        ]);
    });

    it('大きな配列での性能', () => {
        const arr1 = Array.from({ length: 100 }, (_, i) => `item${i}`);
        const arr2 = arr1.slice(); // コピー
        arr2.splice(50, 1); // 中間1つ削除
        
        const result = computeLCS(arr1, arr2);
        // 99個の共通要素を期待
        assert.strictEqual(result.length, 99);
    });
});

describe('mapTableRowsToGitDiff - ヘッダ行のみの変更', () => {
    const tableStartLine = 1;
    const tableEndLine = 6;

    it('ヘッダ行のみ削除される', () => {
        const diffOutput = [
            '@@ -2,1 +2,0 @@',
            '-| Name | Age |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, 2);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[0].row, -2);
    });

    it('ヘッダ行のみ追加される', () => {
        const diffOutput = [
            '@@ -2,0 +2,1 @@',
            '+| Name | Age |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, 0);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].status, GitDiffStatus.ADDED);
        assert.strictEqual(result[0].row, -2);
    });
});

describe('mapTableRowsToGitDiff - 複雑な混合ケース', () => {
    const tableStartLine = 1;
    const tableEndLine = 10;

    it('ヘッダ変更と複数データ行の追加・削除・編集', () => {
        const diffOutput = [
            '@@ -2,1 +2,1 @@',
            '-| Name | Age |',
            '+| Name | Age | City |',
            '@@ -4,2 +4,3 @@',
            '-| Alice | 25 |',
            '-| Bob | 30 |',
            '+| Alice | 26 | Tokyo |',
            '+| Carol | 28 | Osaka |',
            '+| Dave | 35 | Kyoto |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, 5);

        // ヘッダの削除と追加
        assert.strictEqual(result[0].row, -2);
        assert.strictEqual(result[0].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[1].row, -2);
        assert.strictEqual(result[1].status, GitDiffStatus.ADDED);

        // データ行の変更
        const dataResults = result.slice(2);
        assert.ok(dataResults.length >= 4);
    });

    it('離れた複数hunkでの独立した変更', () => {
        const diffOutput = [
            '@@ -3,1 +3,2 @@',
            '-| Alice | 25 |',
            '+| Alice | 25 | New |',
            '+| Bob | 30 | Col |',
            '@@ -7,1 +8,1 @@',
            '-| Carol | 28 |',
            '+| Carol | 29 |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, tableStartLine, tableEndLine);
        const result = mapTableRowsToGitDiff(lineDiffs, tableStartLine, 5);

        // hunk 1: 行0
        const hunk1Rows = result.filter(r => r.row === 0 || (result.indexOf(r) < 4 && r.row !== 2));
        assert.ok(hunk1Rows.length >= 2);

        // hunk 2: 行2
        const hunk2Rows = result.filter(r => r.row === 2 && result.indexOf(r) >= 4);
        assert.ok(hunk2Rows.length >= 2);
    });
});

describe('normalizeHeader - より詳細なケース', () => {
    it('複数の連続空白を正規化', () => {
        assert.strictEqual(normalizeHeader('A    B    C'), 'a b c');
    });

    it('タブ文字を処理する', () => {
        // タブは空白として扱われるか、あるいは特別な処理が必要
        const result = normalizeHeader('A\tB');
        assert.ok(result.includes('a'));
    });

    it('前後の改行文字を処理する', () => {
        const result = normalizeHeader('\nHeader\n');
        // 正規化後の結果は実装に依存
        assert.ok(result.toLowerCase().includes('header') || result === 'header');
    });

    it('数字と記号を含むヘッダ', () => {
        assert.strictEqual(normalizeHeader('Col 1 (Ratio: 50%)'), 'col 1 (ratio: 50%)');
    });

    it('Unicode文字を含むヘッダ', () => {
        const result = normalizeHeader('名前 (Name)');
        // Unicode文字は保持されるはず
        assert.ok(result.includes('名前'));
    });
});

describe('calculateSimilarity - より詳細なケース', () => {
    it('1文字異なる', () => {
        const sim = calculateSimilarity('test', 'text');
        assert.ok(sim > 0.5 && sim < 1.0);
    });

    it('1文字削除', () => {
        const sim = calculateSimilarity('testing', 'test');
        assert.ok(sim > 0.7);
    });

    it('1文字挿入', () => {
        const sim = calculateSimilarity('test', 'testing');
        assert.ok(sim > 0.7);
    });

    it('複数の変更', () => {
        const sim = calculateSimilarity('abcdef', 'azbzef');
        assert.ok(sim > 0.4 && sim < 1.0);
    });

    it('大文字小文字が異なる文字列', () => {
        const sim = calculateSimilarity('Test', 'TEST');
        // 異なる文字としてカウントされる
        assert.ok(sim > 0.5);
    });

    it('非常に短い文字列', () => {
        const sim = calculateSimilarity('a', 'b');
        assert.ok(sim >= 0 && sim <= 1.0);
    });

    it('長い文字列での類似度', () => {
        const long = 'a'.repeat(100);
        const sim = calculateSimilarity(long, long + 'b');
        assert.ok(sim > 0.95);
    });
});
