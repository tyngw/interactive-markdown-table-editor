/**
 * 列差分検出モジュール
 * Git差分から列の追加・削除を検出するためのユーティリティを提供
 */

// 型定義
export {
    ColumnDiffInfo,
    ColumnDiffResult,
    CellParseOptions,
    HeaderCompareOptions,
    RowGitDiffInput,
    DEFAULT_CELL_PARSE_OPTIONS,
    DEFAULT_HEADER_COMPARE_OPTIONS
} from './types';

// セル分解ユーティリティ
export {
    countTableCells,
    parseTableRowCells,
    isSeparatorRow
} from './cellParser';

// ヘッダ比較ユーティリティ
export {
    normalizeHeader,
    headersEqual,
    findHeaderIndex,
    headerExists,
    findDeletedHeaderIndices,
    findAddedHeaderIndices,
    createHeaderPositionMapping
} from './headerComparator';

// 列差分検出
export {
    detectColumnDiff,
    detectColumnDiffSimple,
    ColumnDiffDetectorOptions
} from './columnDiffDetector';
