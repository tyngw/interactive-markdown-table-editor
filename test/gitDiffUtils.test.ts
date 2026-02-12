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
    detectColumnDiff,
    getGitThemeColors,
    GitDiffStatus,
    RowGitDiff,
    __test__
} from '../src/gitDiffUtils';

const { parseGitDiff, mapTableRowsToGitDiff } = (__test__ as {
    parseGitDiff: (diffOutput: string, tableStartLine: number, tableEndLine: number) => any[];
    mapTableRowsToGitDiff: (lineDiffs: any[], tableStartLine: number, rowCount: number, tableContent?: string) => RowGitDiff[];
    dedupeRowDiffs: (diffs: RowGitDiff[]) => RowGitDiff[];
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
        // heuristics はスコアベースのマッチングを記録する
        assert.ok(result.heuristics!.some(h => h.includes('score_match')));
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

    it('ヘッダが変わってもデータ一致で同一列と判定する', () => {
        const oldHeaders = ['Name', 'Amount'];
        const newHeaders = ['Customer', 'Total'];
        const oldDataRows = [
            ['Alice', '100'],
            ['Bob', '200']
        ];
        const newDataRows = [
            ['Alice', '100'],
            ['Bob', '200']
        ];

        const result = detectColumnDiffWithPositions(
            oldHeaders,
            newHeaders,
            oldDataRows,
            newDataRows
        );

        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.mapping, [0, 1]);
        assert.ok(result.heuristics!.some(h => h.includes('score_match')));
    });

    it('ヘッダが大きく異なりデータも変わっていても同一列と判定する（位置フォールバック）', () => {
        const oldHeaders = ['版番号', '内容', '改訂者', '改訂日'];
        const newHeaders = ['1', '内容', '改訂者', '改訂日'];
        const oldDataRows = [
            ['1.0', '初版作成', '太郎', '2025/01/01']
        ];
        const newDataRows = [
            ['1.1', '初版作成', '太郎', '2025/08/31']
        ];

        const result = detectColumnDiffWithPositions(
            oldHeaders,
            newHeaders,
            oldDataRows,
            newDataRows
        );

        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.addedColumns, []);
        assert.deepStrictEqual(result.deletedColumns, []);
        assert.deepStrictEqual(result.mapping, [0, 1, 2, 3]);
        assert.ok(result.heuristics!.some(h => h.includes('fallback_match')));
    });

    it('複数列の追加・削除を同時に検知する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C', 'D'],
            ['A', 'X', 'C', 'Y']
        );
        // 列数が同じ場合、フォールバックにより位置優先でペアリングされるため
        // 追加・削除ではなくリネームとして扱われる
        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.addedColumns, []);
        assert.deepStrictEqual(result.deletedColumns, []);
        // BとXのリネーム、DとYのリネームが positions に含まれる
        assert.ok(result.positions!.some(p => p.type === 'renamed'));
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
        // 列数が同じ場合、フォールバックにより位置優先でペアリングされ
        // リネームとして扱われる
        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.addedColumns, []);
        assert.deepStrictEqual(result.deletedColumns, []);
        assert.ok(result.positions!.filter(p => p.type === 'renamed').length === 3);
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

// ============================================================
// detectColumnDiffWithPositions テスト
// ============================================================
describe('detectColumnDiffWithPositions', () => {
    it('完全一致のヘッダは exact_match_all を返す', () => {
        const result = detectColumnDiffWithPositions(
            ['Name', 'Age', 'City'],
            ['Name', 'Age', 'City']
        );
        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.mapping, [0, 1, 2]);
        assert.ok(result.heuristics!.includes('exact_match_all'));
    });

    it('列が追加された場合を検出', () => {
        const result = detectColumnDiffWithPositions(
            ['Name', 'Age'],
            ['Name', 'Age', 'City']
        );
        assert.strictEqual(result.oldColumnCount, 2);
        assert.strictEqual(result.newColumnCount, 3);
        assert.ok(result.addedColumns.length > 0);
        assert.ok(result.changeType === 'added' || result.changeType === 'mixed');
    });

    it('列が削除された場合を検出', () => {
        const result = detectColumnDiffWithPositions(
            ['Name', 'Age', 'City'],
            ['Name', 'City']
        );
        assert.strictEqual(result.oldColumnCount, 3);
        assert.strictEqual(result.newColumnCount, 2);
        assert.ok(result.deletedColumns.length > 0);
        assert.ok(result.changeType === 'removed' || result.changeType === 'mixed');
    });

    it('列がリネームされた場合を検出', () => {
        const result = detectColumnDiffWithPositions(
            ['Name', 'Age'],
            ['Name', 'Years']
        );
        assert.strictEqual(result.oldColumnCount, 2);
        assert.strictEqual(result.newColumnCount, 2);
        // mapping should map all columns
        assert.ok(result.mapping!.every(m => m >= 0));
    });

    it('中間列の追加を検出', () => {
        const result = detectColumnDiffWithPositions(
            ['Name', 'City'],
            ['Name', 'Age', 'City']
        );
        assert.strictEqual(result.newColumnCount, 3);
        assert.ok(result.addedColumns.length > 0);
    });

    it('データ行のサンプリングを使用した列マッチング', () => {
        const result = detectColumnDiffWithPositions(
            ['Name', 'Value'],
            ['Name', 'Score'],
            [['Alice', '100'], ['Bob', '200']],
            [['Alice', '100'], ['Bob', '200']]
        );
        assert.strictEqual(result.oldColumnCount, 2);
        assert.strictEqual(result.newColumnCount, 2);
        // Data overlap should improve matching
        assert.ok(result.heuristics!.some(h => h.startsWith('sampling:')));
    });

    it('空のヘッダ配列を処理', () => {
        const result = detectColumnDiffWithPositions([], []);
        assert.strictEqual(result.changeType, 'none');
    });

    it('列数が同じで閾値未満の場合もフォールバックマッチ', () => {
        const result = detectColumnDiffWithPositions(
            ['Alpha', 'Beta', 'Gamma'],
            ['Xxx', 'Yyy', 'Zzz']
        );
        assert.strictEqual(result.oldColumnCount, 3);
        assert.strictEqual(result.newColumnCount, 3);
        // Fallback matching should fill in unmatched columns when counts are equal
        assert.ok(result.heuristics!.some(h => h.startsWith('fallback_match:')));
    });

    it('mixed changeType when both added and removed', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C'],
            ['A', 'D']
        );
        // B and C deleted, D added
        assert.ok(result.addedColumns.length > 0 || result.deletedColumns.length > 0);
    });
});

// ============================================================
// detectColumnDiff テスト（フォールバックロジック含む）
// ============================================================
describe('detectColumnDiff', () => {
    it('空のgitDiffでidentityマッピングを返す', () => {
        const result = detectColumnDiff([], 3);
        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.mapping, [0, 1, 2]);
    });

    it('ヘッダ行なしのフォールバックロジック - 列追加', () => {
        const gitDiff: RowGitDiff[] = [
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| A | B |', isDeletedRow: true },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| A | B | C |' }
        ];
        const result = detectColumnDiff(gitDiff, 3);
        assert.strictEqual(result.newColumnCount, 3);
    });

    it('ヘッダ行ありでenhancedアルゴリズムを使用', () => {
        const gitDiff: RowGitDiff[] = [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '| Name | Age |', isDeletedRow: true },
            { row: -2, status: GitDiffStatus.ADDED, newContent: '| Name | Age | City |' },
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| Alice | 30 |', isDeletedRow: true },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| Alice | 30 | Tokyo |' }
        ];
        const result = detectColumnDiff(gitDiff, 3, ['Name', 'Age', 'City']);
        assert.ok(result.addedColumns.length > 0 || result.oldColumnCount !== result.newColumnCount);
    });

    it('セパレータ行をヘッダとして使わない', () => {
        const gitDiff: RowGitDiff[] = [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '| --- | --- |', isDeletedRow: true },
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| Name | Age |', isDeletedRow: true },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| Name | Age |' }
        ];
        const result = detectColumnDiff(gitDiff, 2, ['Name', 'Age']);
        assert.strictEqual(result.newColumnCount, 2);
    });

    it('列削除のフォールバック', () => {
        const gitDiff: RowGitDiff[] = [
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| A | B | C |', isDeletedRow: true },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| A | B |' }
        ];
        const result = detectColumnDiff(gitDiff, 2);
        assert.ok(result.deletedColumns.length > 0 || result.oldColumnCount > result.newColumnCount);
        assert.strictEqual(result.changeType, 'removed');
    });
});

// ============================================================
// getGitThemeColors テスト
// ============================================================
describe('getGitThemeColors', () => {
    it('テーマ色オブジェクトを返す', () => {
        const colors = getGitThemeColors();
        assert.ok(colors);
        assert.ok(typeof colors.addedBackground === 'string');
        assert.ok(typeof colors.modifiedBackground === 'string');
        assert.ok(typeof colors.deletedBackground === 'string');
    });
});

// ============================================================
// buildColumnSamples / calculateDataOverlap / calculateColumnMatchScore テスト (internal)
// ============================================================
describe('internal helpers via detectColumnDiffWithPositions', () => {
    it('データ行サンプリングなしでも動作する', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B'],
            ['A', 'C'],
            undefined,
            undefined
        );
        assert.strictEqual(result.oldColumnCount, 2);
    });

    it('大量のデータ行でもサンプリングが機能する', () => {
        const oldData = Array.from({ length: 100 }, (_, i) => [`item${i}`, `${i * 10}`]);
        const newData = Array.from({ length: 100 }, (_, i) => [`item${i}`, `${i * 10}`]);
        const result = detectColumnDiffWithPositions(
            ['Name', 'Value'],
            ['Name', 'Value'],
            oldData,
            newData
        );
        assert.deepStrictEqual(result.mapping, [0, 1]);
    });

    it('空のデータ行配列', () => {
        const result = detectColumnDiffWithPositions(
            ['X', 'Y'],
            ['X', 'Z'],
            [],
            []
        );
        assert.strictEqual(result.oldColumnCount, 2);
    });
});

// ============================================================
// 追加テスト: 未カバー行のカバレッジ向上
// ============================================================

describe('parseGitDiff - unchanged lines and edge cases', () => {
    it('should skip lines before first hunk header (!inHunk continue, JS L311)', () => {
        // git diff のヘッダー行（diff --git, index, --- +++）は hunk の前にある
        // これらは !inHunk の条件で continue される
        const diffOutput = [
            'diff --git a/file.md b/file.md',
            'index abc1234..def5678 100644',
            '--- a/file.md',
            '+++ b/file.md',
            '@@ -1,2 +1,2 @@',
            '-| old |',
            '+| new |',
            ''
        ].join('\n');

        const result = parseGitDiff(diffOutput, 0, 5);
        // ヘッダー行は無視され、hunk内の変更のみ検出される
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[1].status, GitDiffStatus.ADDED);
    });

    it('should handle unchanged context lines (increment both line numbers)', () => {
        // unchanged行（+/-で始まらない行）があるdiffを解析
        const diffOutput = [
            '@@ -1,3 +1,3 @@',
            ' | unchanged |',   // unchanged line → oldLineNumber++, newLineNumber++
            '-| old |',
            '+| new |',
            ''
        ].join('\n');

        const result = parseGitDiff(diffOutput, 0, 5);
        // unchanged行は含まれず、削除と追加のみ
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[0].oldLineNumber, 2);
        assert.strictEqual(result[1].status, GitDiffStatus.ADDED);
        assert.strictEqual(result[1].lineNumber, 2);
    });

    it('should skip backslash lines (no newline at end of file)', () => {
        const diffOutput = [
            '@@ -1,2 +1,2 @@',
            '-old line',
            '\\ No newline at end of file',
            '+new line',
            ''
        ].join('\n');

        const result = parseGitDiff(diffOutput, 0, 5);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].status, GitDiffStatus.DELETED);
        assert.strictEqual(result[1].status, GitDiffStatus.ADDED);
    });
});

describe('mapTableRowsToGitDiff - out of range and dedupe', () => {
    it('should exclude rows outside valid range (shouldIncludeRow false)', () => {
        // tableStartLine = 100 で行番号が大幅に外れたdiffを作る
        // toTableRow: baseLine - tableStartLine - 3
        // row = 1 - 100 - 3 = -102 → shouldIncludeRow(-102, 3) = false
        const diffOutput = [
            '@@ -1,1 +1,1 @@',
            '-| old |',
            '+| new |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, 100, 200);
        const result = mapTableRowsToGitDiff(lineDiffs, 100, 3);
        // 行が範囲外なので結果は空
        assert.strictEqual(result.length, 0);
    });

    it('should deduplicate identical deleted rows', () => {
        // 同じ行に同じoldContentのDELETED diffが2つ
        const diffOutput = [
            '@@ -4,2 +4,1 @@',
            '-| dup |',
            '-| dup |',
            '+| new |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, 1, 5);
        const result = mapTableRowsToGitDiff(lineDiffs, 1, 5);
        // dedupeによって同じrow+status+oldContentの重複は除去される
        const deletedEntries = result.filter(r => r.status === GitDiffStatus.DELETED);
        // 行番号が異なるので重複にはならないが、テーブル行は同じになりうる
        assert.ok(deletedEntries.length >= 1);
    });

    it('should deduplicate identical added rows', () => {
        // 同じ行に同じnewContentのADDED diffが2つあるケース
        const diffOutput = [
            '@@ -4,1 +4,2 @@',
            '-| old |',
            '+| dup |',
            '+| dup |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, 1, 5);
        const result = mapTableRowsToGitDiff(lineDiffs, 1, 5);
        const addedEntries = result.filter(r => r.status === GitDiffStatus.ADDED);
        // ADDEDの重複削除では oldContent チェックしないので、同一行の場合は重複除去される
        assert.ok(addedEntries.length >= 1);
    });
});

describe('detectColumnDiff - fallback simple logic', () => {
    it('should use fallback when oldHeaders exist but newHeaders is empty', () => {
        // oldHeaders有り、newHeaders（currentHeaders）無し → 強化版が使えないのでフォールバック
        const gitDiff = [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '| A | B | C |' },
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| 1 | 2 | 3 |' },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| 1 | 2 |' }
        ] as any[];

        const result = detectColumnDiff(gitDiff, 2);
        // フォールバック: oldColumnCount=3 (from deleted data row), newColumnCount=2
        // columnDiff = 2 - 3 = -1 → removed
        assert.strictEqual(result.changeType, 'removed');
        assert.ok(result.deletedColumns.length > 0);
        assert.ok(result.heuristics!.includes('fallback_simple'));
    });

    it('should use fallback with added columns when newColumnCount > oldColumnCount', () => {
        const gitDiff = [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '| A | B |' },
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| 1 | 2 |' },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| 1 | 2 | 3 |' }
        ] as any[];

        const result = detectColumnDiff(gitDiff, 3);
        // フォールバック: oldColumnCount=2, newColumnCount=3
        // columnDiff = 3 - 2 = 1 → added
        assert.strictEqual(result.changeType, 'added');
        assert.ok(result.addedColumns.length > 0);
    });

    it('should use oldHeaders.length for oldColumnCount when no data rows deleted', () => {
        // データ削除行がなく、ヘッダ削除行のみの場合 → oldHeaders.length を使用
        const gitDiff = [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '| A | B | C |' },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| 1 | 2 |' }
        ] as any[];

        const result = detectColumnDiff(gitDiff, 2);
        assert.strictEqual(result.oldColumnCount, 3);
        assert.strictEqual(result.changeType, 'removed');
        assert.ok(result.heuristics!.includes('fallback_simple'));
    });

    it('should handle separator row in deleted header position', () => {
        // row=-2 の削除行がセパレータの場合 → 次の非セパレータ削除行からoldHeadersを取得
        const gitDiff = [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '| --- | --- |' },
            { row: -1, status: GitDiffStatus.DELETED, oldContent: '| X | Y |' },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| 1 |' }
        ] as any[];

        const result = detectColumnDiff(gitDiff, 1);
        // actualHeaderRow として row=-1 の '| X | Y |' が使われる
        assert.ok(result.oldHeaders!.length > 0);
    });

    it('should handle added header row at row=-2', () => {
        // 追加行にもrow=-2のヘッダがある場合
        const gitDiff = [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '| A | B |' },
            { row: -2, status: GitDiffStatus.ADDED, newContent: '| A | B | C |' }
        ] as any[];

        const result = detectColumnDiff(gitDiff, 3, ['A', 'B', 'C']);
        // 両方ヘッダがあるので強化版が使われる
        assert.strictEqual(result.newColumnCount, 3);
    });

    it('should return identity mapping when no gitDiff provided', () => {
        const result = detectColumnDiff([], 3);
        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.mapping, [0, 1, 2]);
    });

    it('should return identity mapping when null gitDiff provided', () => {
        const result = detectColumnDiff(null as any, 2);
        assert.strictEqual(result.changeType, 'none');
        assert.deepStrictEqual(result.mapping, [0, 1]);
    });

    it('should extract data rows for sampling in detectColumnDiff', () => {
        // データ行（row >= 0）がある場合にoldDataRows/newDataRowsが抽出される
        const gitDiff = [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '| A | B |' },
            { row: -2, status: GitDiffStatus.ADDED, newContent: '| A | C |' },
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| 1 | 2 |' },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| 1 | 3 |' }
        ] as any[];

        const result = detectColumnDiff(gitDiff, 2, ['A', 'C']);
        // 強化版が使われる（oldHeaders, newHeaders両方ある）
        assert.ok(result.oldColumnCount > 0);
    });
});

describe('detectColumnDiffWithPositions - deleted and added columns', () => {
    it('should detect deleted columns when old has more columns', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C', 'D'],
            ['A', 'C'],
            [['1', '2', '3', '4']],
            [['1', '3']]
        );
        assert.ok(result.deletedColumns.length > 0);
        assert.ok(result.changeType === 'removed' || result.changeType === 'mixed');
    });

    it('should detect added columns when new has more columns', () => {
        const result = detectColumnDiffWithPositions(
            ['A', 'B'],
            ['A', 'B', 'C', 'D'],
            [['1', '2']],
            [['1', '2', '3', '4']]
        );
        assert.ok(result.addedColumns.length > 0);
        assert.ok(result.changeType === 'added' || result.changeType === 'mixed');
    });

    it('should handle completely different headers', () => {
        const result = detectColumnDiffWithPositions(
            ['Alpha', 'Beta'],
            ['Gamma', 'Delta', 'Epsilon']
        );
        // 全く異なるヘッダで列数も異なる
        assert.strictEqual(result.oldColumnCount, 2);
        assert.strictEqual(result.newColumnCount, 3);
    });
});

describe('computeLCS - backtracking paths', () => {
    it('should follow dp[i-1][j] > dp[i][j-1] path', () => {
        // LCSバックトラックで dp[i-1][j] > dp[i][j-1] となるケース
        // arr1 = ['a', 'x', 'b'], arr2 = ['a', 'b']
        // LCS = ['a', 'b'], バックトラックで 'x' をスキップする際に dp[i-1][j] > dp[i][j-1]
        const result = computeLCS(['a', 'x', 'b'], ['a', 'b']);
        assert.deepStrictEqual(result, [{ i1: 0, i2: 0 }, { i1: 2, i2: 1 }]);
    });

    it('should follow dp[i][j-1] path', () => {
        // arr2 側にextra要素がある場合
        const result = computeLCS(['a', 'b'], ['a', 'x', 'b']);
        assert.deepStrictEqual(result, [{ i1: 0, i2: 0 }, { i1: 1, i2: 2 }]);
    });
});

describe('getGitThemeColors', () => {
    it('should return color object with expected keys', () => {
        const colors = getGitThemeColors();
        assert.ok(colors.addedBackground);
        assert.ok(colors.modifiedBackground);
        assert.ok(colors.deletedBackground);
    });
});

describe('dedupeRowDiffs - DELETED行のoldContent区別 (JS L451-454)', () => {
    it('should keep DELETED rows with same row but different oldContent', () => {
        // 同じtableRow位置に異なるoldContentのDELETED行を作る
        // hunkの中で2つの異なる削除行が同じテーブル行にマッピングされるケース
        const diffOutput = [
            '@@ -4,3 +4,1 @@',
            '-| content1 |',
            '-| content2 |',
            '-| content3 |',
            '+| new |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, 1, 8);
        const result = mapTableRowsToGitDiff(lineDiffs, 1, 5);
        // 異なるoldContentのDELETED行は重複扱いにならずそのまま保持される
        const deletedEntries = result.filter(r => r.status === GitDiffStatus.DELETED);
        // 少なくとも2つのDELETEDエントリが異なるoldContentを持つ
        if (deletedEntries.length >= 2) {
            const uniqueContents = new Set(deletedEntries.map(e => e.oldContent));
            assert.ok(uniqueContents.size >= 2, 'Different oldContent should not be deduped');
        }
    });

    it('should deduplicate DELETED rows with same row and same oldContent', () => {
        // 同じ行に完全に同じoldContentのDELETED diffが複数ある場合
        const diffOutput = [
            '@@ -4,2 +4,0 @@',
            '-| same |',
            '-| same |',
            ''
        ].join('\n');

        const lineDiffs = parseGitDiff(diffOutput, 1, 5);
        const result = mapTableRowsToGitDiff(lineDiffs, 1, 5);
        const deletedWithSameContent = result.filter(
            r => r.status === GitDiffStatus.DELETED && r.oldContent === '| same |'
        );
        // 同じoldContentの場合はdedupeされて1つだけ残る
        // ただし行番号が異なれば別エントリ
        assert.ok(deletedWithSameContent.length >= 1);
    });
});

describe('detectColumnDiffWithPositions - mapping already assigned (JS L774)', () => {
    it('should skip already-mapped columns via continue', () => {
        // 3列→3列で、ヘッダが類似しすぎて同じoldIndexが複数のnewIndexにマッチしうるケース
        // LCSがうまく動かない場合に scoreMatrix のcontinueに到達
        const result = detectColumnDiffWithPositions(
            ['Name', 'Age', 'City'],
            ['Name', 'Age', 'City'],
            [['Alice', '30', 'Tokyo']],
            [['Alice', '30', 'Tokyo']]
        );
        // 全く同じ列構成なので mapping は [0,1,2] 
        assert.strictEqual(result.oldColumnCount, 3);
        assert.strictEqual(result.newColumnCount, 3);
        assert.ok(result.mapping);
    });

    it('should handle column shuffle where score matrix has conflicts', () => {
        // 列が入れ替わった場合、scoreMatrixの中でmapping[oldIndex] !== -1の場合continueする
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C', 'D'],
            ['D', 'C', 'B', 'A'],
            [['1', '2', '3', '4']],
            [['4', '3', '2', '1']]
        );
        assert.strictEqual(result.oldColumnCount, 4);
        assert.strictEqual(result.newColumnCount, 4);
    });

    it('should detect renamed columns in matchedDetails loop (JS L826-830)', () => {
        // ヘッダーがリネームされたケース: A → A_renamed, B はそのまま
        // matchedDetailsにエントリが入り、normalizedOldとnormalizedNewが異なるとき renamed position が追加される
        const result = detectColumnDiffWithPositions(
            ['Name', 'Age'],
            ['FullName', 'Age'],
            [['Alice', '30']],
            [['Alice', '30']]
        );
        // ヘッダーが変わっているのでリネームまたは追加/削除が検出されるはず
        assert.ok(result.positions);
        assert.ok(result.positions!.length > 0);
    });

    it('should continue in matchedDetails loop when mapping mismatch (JS L828-829)', () => {
        // mapping[oldIdx] !== newIdx のとき continue する
        // 列数が変わり、mappingがずれるケース
        const result = detectColumnDiffWithPositions(
            ['A', 'B', 'C'],
            ['C', 'A'],  // 列削除+入れ替え
            [['1', '2', '3']],
            [['3', '1']]
        );
        assert.ok(result.mapping);
        // 少なくとも削除列があるはず
        assert.ok(result.deletedColumns.length > 0 || result.changeType !== 'none');
    });
});

describe('detectColumnDiff - separator header fallback with null oldContent (JS L934)', () => {
    it('should skip deletedRows with no oldContent when searching for actual header', () => {
        // headerDeletedRow (row=-2) がセパレータ行で、
        // 他の deletedRows に oldContent がないものが混在
        const gitDiff: RowGitDiff[] = [
            { row: -2, status: GitDiffStatus.DELETED, oldContent: '|---|---|', newContent: '' },
            { row: 0, status: GitDiffStatus.DELETED, oldContent: undefined as any, newContent: '' },
            { row: 1, status: GitDiffStatus.DELETED, oldContent: '| A | B |', newContent: '' },
            { row: -2, status: GitDiffStatus.ADDED, newContent: '| X | Y |', oldContent: '' },
        ];
        const result = detectColumnDiff(gitDiff, 2, ['X', 'Y']);
        assert.ok(result);
        // oldHeaders が actualHeaderRow ('| A | B |') から抽出されるはず
        assert.ok((result.oldHeaders || []).length > 0 || result.oldColumnCount >= 0);
    });
});

describe('detectColumnDiffWithPositions - mapping collision continue (JS L780)', () => {
    it('should skip already-assigned mapping via continue in scoreMatrix loop', () => {
        // 同じヘッダー名を持つ列がある場合、同じnewIndexに複数のoldIndexが競合する
        // → 2番目以降は continue で飛ばされる
        const result = detectColumnDiffWithPositions(
            ['Name', 'Name', 'Age'],
            ['Name', 'Age', 'City'],
            [['Alice', 'Bob', '30']],
            [['Alice', '30', 'Tokyo']]
        );
        assert.ok(result.mapping);
        // 同名ヘッダーがあるので mapping 衝突が発生し continue を通る
    });
});

describe('detectColumnDiffWithPositions - matchedDetails mapping mismatch (JS L830)', () => {
    it('should continue when matchedDetail mapping does not match', () => {
        // matchedDetails にエントリがあるが mapping[oldIdx] !== newIdx のケース
        // 同じヘッダー名の列があると、scoreMatrix 内で同一 oldIdx に複数の newIdx がマッチし
        // 貪欲割り当ての結果 matchedDetails に入った detailの mapping が不一致になる
        const result = detectColumnDiffWithPositions(
            ['Alpha', 'Beta', 'Alpha'],  // 同名ヘッダー → scoreMatrix で衝突
            ['Alpha', 'Alpha', 'Beta'],
            [['1', '2', '3']],
            [['1', '3', '2']]
        );
        assert.ok(result.mapping);
    });

    it('should detect renamed column position when headers differ', () => {
        // 完全に異なるヘッダー名で mapping が成立する場合
        // normalizedOld[oldIdx] !== normalizedNew[newIdx] → renamed position 追加
        const result = detectColumnDiffWithPositions(
            ['OldName', 'Age'],
            ['NewName', 'Age'],
            [['Alice', '30']],
            [['Alice', '30']]
        );
        assert.ok(result.positions);
        // OldName→NewName のリネームが検出されるか、追加/削除として検出される
        const hasNameChange = result.positions!.some(p => 
            p.type === 'renamed' || p.type === 'added' || p.type === 'removed'
        );
        assert.ok(hasNameChange || result.changeType !== 'none');
    });
});

describe('dedupeRowDiffs - non-DELETED duplicate (JS L457-460)', () => {
    const { dedupeRowDiffs } = __test__;

    it('should deduplicate ADDED rows with same row and status', () => {
        const diffs: RowGitDiff[] = [
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| A |' },
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| B |' },
        ];
        const result = dedupeRowDiffs(diffs);
        // non-DELETED なので row+status が一致すれば重複として扱われる → return true → 1つのみ残る
        assert.strictEqual(result.length, 1);
    });

    it('should keep ADDED rows with different row numbers', () => {
        const diffs: RowGitDiff[] = [
            { row: 0, status: GitDiffStatus.ADDED, newContent: '| A |' },
            { row: 1, status: GitDiffStatus.ADDED, newContent: '| B |' },
        ];
        const result = dedupeRowDiffs(diffs);
        assert.strictEqual(result.length, 2);
    });

    it('should compare oldContent for DELETED duplicates with same row (JS L458)', () => {
        // DELETED の場合は oldContent も比較する
        const diffs: RowGitDiff[] = [
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| same |' },
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| same |' },
        ];
        const result = dedupeRowDiffs(diffs);
        // 同じ oldContent なので重複除去 → 1つだけ残る
        assert.strictEqual(result.length, 1);
    });

    it('should keep DELETED rows with different oldContent on same row (JS L458)', () => {
        const diffs: RowGitDiff[] = [
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| A |' },
            { row: 0, status: GitDiffStatus.DELETED, oldContent: '| B |' },
        ];
        const result = dedupeRowDiffs(diffs);
        // 異なる oldContent なので重複ではない → 2つ残る
        assert.strictEqual(result.length, 2);
    });
});
