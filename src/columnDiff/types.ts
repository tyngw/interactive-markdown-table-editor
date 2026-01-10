/**
 * 列差分検出に関する型定義
 * Git差分から列の追加・削除を検出するための型を提供
 */

/**
 * 列の差分情報
 * 変更前と変更後の列数を比較して、追加・削除された列を検出
 */
export interface ColumnDiffInfo {
    /** 変更前の列数 */
    oldColumnCount: number;
    /** 変更後の列数 */
    newColumnCount: number;
    /** 追加された列のインデックス（変更後の列番号） */
    addedColumns: number[];
    /** 削除された列のインデックス（変更前の列番号） */
    deletedColumns: number[];
    /** 変更前のヘッダ（削除列表示用） */
    oldHeaders?: string[];
}

/**
 * セル分解オプション
 */
export interface CellParseOptions {
    /** エスケープされたパイプ（\|）を考慮するか */
    handleEscapedPipes: boolean;
    /** セル値をトリムするか */
    trimCells: boolean;
}

/**
 * ヘッダ比較オプション
 */
export interface HeaderCompareOptions {
    /** 大文字小文字を無視するか */
    ignoreCase: boolean;
    /** 前後の空白を無視するか */
    trimWhitespace: boolean;
    /** 連続する空白を正規化するか */
    normalizeWhitespace: boolean;
}

/**
 * 行のGit差分情報（gitDiffUtils.tsから参照）
 */
export interface RowGitDiffInput {
    row: number;
    status: 'unchanged' | 'added' | 'deleted';
    oldContent?: string;
    newContent?: string;
    isDeletedRow?: boolean;
}

/**
 * 列差分検出の結果詳細
 */
export interface ColumnDiffResult extends ColumnDiffInfo {
    /** 検出に使用した手法 */
    detectionMethod: 'header-comparison' | 'fallback-end-columns' | 'no-change';
    /** 検出の信頼度（0-1） */
    confidence: number;
}

/**
 * デフォルトのセル分解オプション
 */
export const DEFAULT_CELL_PARSE_OPTIONS: CellParseOptions = {
    handleEscapedPipes: true,
    trimCells: true
};

/**
 * デフォルトのヘッダ比較オプション
 */
export const DEFAULT_HEADER_COMPARE_OPTIONS: HeaderCompareOptions = {
    ignoreCase: false,
    trimWhitespace: true,
    normalizeWhitespace: true
};
