/**
 * 列差分検出ロジック
 * Git差分から列の追加・削除を検出する
 * 
 * 責務:
 * - 削除行/追加行からヘッダ情報を抽出
 * - ヘッダ比較による列差分の特定
 * - フォールバック処理（ヘッダ情報がない場合）
 */

import { 
    ColumnDiffInfo, 
    ColumnDiffResult, 
    RowGitDiffInput,
    HeaderCompareOptions,
    CellParseOptions,
    DEFAULT_HEADER_COMPARE_OPTIONS,
    DEFAULT_CELL_PARSE_OPTIONS
} from './types';
import { parseTableRowCells, countTableCells, isSeparatorRow } from './cellParser';
import { findDeletedHeaderIndices, findAddedHeaderIndices } from './headerComparator';

/**
 * 列差分検出オプション
 */
export interface ColumnDiffDetectorOptions {
    /** ヘッダ比較オプション */
    headerCompare?: Partial<HeaderCompareOptions>;
    /** セル分解オプション */
    cellParse?: Partial<CellParseOptions>;
    /** デバッグログを出力するか */
    debug?: boolean;
}

/**
 * デバッグログユーティリティ
 */
function createDebugLogger(enabled: boolean) {
    return (...args: unknown[]) => {
        if (enabled) {
            console.log('[ColumnDiffDetector]', ...args);
        }
    };
}

/**
 * 削除行からヘッダ情報を抽出
 * @param deletedRows 削除行の配列
 * @param cellParseOptions セル分解オプション
 * @param debugLog デバッグログ関数
 * @returns 抽出されたヘッダ配列（見つからない場合は空配列）
 */
function extractOldHeaders(
    deletedRows: RowGitDiffInput[],
    cellParseOptions: Partial<CellParseOptions>,
    debugLog: (...args: unknown[]) => void
): string[] {
    // row = -2 がヘッダ行を探す
    const headerDeletedRow = deletedRows.find(d => d.row === -2);
    
    if (headerDeletedRow && headerDeletedRow.oldContent) {
        // セパレータ行ではないことを確認
        if (!isSeparatorRow(headerDeletedRow.oldContent, cellParseOptions)) {
            const cells = parseTableRowCells(headerDeletedRow.oldContent, cellParseOptions);
            debugLog('oldHeaders extracted from row -2:', cells);
            return cells;
        }
    }
    
    // row = -2 がセパレータの場合、最初の有効なヘッダ行を探す
    const actualHeaderRow = deletedRows.find(d => {
        if (!d.oldContent) {
            return false;
        }
        return !isSeparatorRow(d.oldContent, cellParseOptions);
    });
    
    if (actualHeaderRow && actualHeaderRow.oldContent) {
        const cells = parseTableRowCells(actualHeaderRow.oldContent, cellParseOptions);
        debugLog('oldHeaders extracted from actual header row:', cells);
        return cells;
    }
    
    debugLog('No old headers found');
    return [];
}

/**
 * 追加行からヘッダ情報を抽出
 * @param addedRows 追加行の配列
 * @param cellParseOptions セル分解オプション
 * @param debugLog デバッグログ関数
 * @returns 抽出されたヘッダ配列（見つからない場合は空配列）
 */
function extractNewHeaders(
    addedRows: RowGitDiffInput[],
    cellParseOptions: Partial<CellParseOptions>,
    debugLog: (...args: unknown[]) => void
): string[] {
    // row = -2 がヘッダ行を探す
    const headerAddedRow = addedRows.find(d => d.row === -2);
    
    if (headerAddedRow && headerAddedRow.newContent) {
        if (!isSeparatorRow(headerAddedRow.newContent, cellParseOptions)) {
            const cells = parseTableRowCells(headerAddedRow.newContent, cellParseOptions);
            debugLog('newHeaders extracted from row -2:', cells);
            return cells;
        }
    }
    
    debugLog('No new headers found from added rows');
    return [];
}

/**
 * 削除行から変更前の列数を取得
 * @param deletedRows 削除行の配列
 * @param fallbackCount フォールバック列数
 * @param cellParseOptions セル分解オプション
 * @param debugLog デバッグログ関数
 * @returns 変更前の列数
 */
function extractOldColumnCount(
    deletedRows: RowGitDiffInput[],
    fallbackCount: number,
    cellParseOptions: Partial<CellParseOptions>,
    debugLog: (...args: unknown[]) => void
): number {
    // 最初のデータ行削除行を使用
    const firstDataDeletedRow = deletedRows.find(d => d.row >= 0);
    
    if (firstDataDeletedRow && firstDataDeletedRow.oldContent) {
        const count = countTableCells(firstDataDeletedRow.oldContent, cellParseOptions);
        debugLog('oldColumnCount from deleted row:', count, 'content:', firstDataDeletedRow.oldContent.substring(0, 50));
        return count;
    }
    
    // ヘッダ行から取得を試みる
    const headerRow = deletedRows.find(d => d.row === -2 && d.oldContent);
    if (headerRow && headerRow.oldContent) {
        const count = countTableCells(headerRow.oldContent, cellParseOptions);
        debugLog('oldColumnCount from header row:', count);
        return count;
    }
    
    debugLog('No deleted rows found, using fallback:', fallbackCount);
    return fallbackCount;
}

/**
 * ヘッダ比較による列差分検出
 * @param oldHeaders 変更前のヘッダ
 * @param newHeaders 変更後のヘッダ
 * @param headerCompareOptions ヘッダ比較オプション
 * @param debugLog デバッグログ関数
 * @returns 検出された削除/追加列インデックス
 */
function detectByHeaderComparison(
    oldHeaders: string[],
    newHeaders: string[],
    headerCompareOptions: Partial<HeaderCompareOptions>,
    debugLog: (...args: unknown[]) => void
): { deletedColumns: number[]; addedColumns: number[] } {
    debugLog('Comparing headers - old:', oldHeaders, 'new:', newHeaders);
    
    const deletedColumns = findDeletedHeaderIndices(oldHeaders, newHeaders, headerCompareOptions);
    const addedColumns = findAddedHeaderIndices(oldHeaders, newHeaders, headerCompareOptions);
    
    debugLog('Header comparison result - deleted:', deletedColumns, 'added:', addedColumns);
    
    return { deletedColumns, addedColumns };
}

/**
 * フォールバック: 末尾から列が追加/削除されたと仮定
 * @param oldColumnCount 変更前の列数
 * @param newColumnCount 変更後の列数
 * @param debugLog デバッグログ関数
 * @returns 検出された削除/追加列インデックス
 */
function detectByFallback(
    oldColumnCount: number,
    newColumnCount: number,
    debugLog: (...args: unknown[]) => void
): { deletedColumns: number[]; addedColumns: number[] } {
    const deletedColumns: number[] = [];
    const addedColumns: number[] = [];
    const columnDiff = newColumnCount - oldColumnCount;
    
    if (columnDiff > 0) {
        // 列が追加された場合: 末尾に追加されたと仮定
        for (let i = oldColumnCount; i < newColumnCount; i++) {
            addedColumns.push(i);
        }
        debugLog('Fallback: columns added at end:', addedColumns);
    } else if (columnDiff < 0) {
        // 列が削除された場合: 末尾から削除されたと仮定
        for (let i = newColumnCount; i < oldColumnCount; i++) {
            deletedColumns.push(i);
        }
        debugLog('Fallback: columns deleted from end:', deletedColumns);
    }
    
    return { deletedColumns, addedColumns };
}

/**
 * Git差分から列の追加・削除情報を検出
 * 
 * @param gitDiff 行のGit差分情報
 * @param currentColumnCount 現在のテーブルの列数
 * @param options 検出オプション
 * @returns 列の差分情報
 */
export function detectColumnDiff(
    gitDiff: RowGitDiffInput[],
    currentColumnCount: number,
    options: ColumnDiffDetectorOptions = {}
): ColumnDiffResult {
    const headerCompareOpts = { ...DEFAULT_HEADER_COMPARE_OPTIONS, ...options.headerCompare };
    const cellParseOpts = { ...DEFAULT_CELL_PARSE_OPTIONS, ...options.cellParse };
    const debugLog = createDebugLogger(options.debug ?? false);
    
    // 初期結果
    const result: ColumnDiffResult = {
        oldColumnCount: currentColumnCount,
        newColumnCount: currentColumnCount,
        addedColumns: [],
        deletedColumns: [],
        oldHeaders: [],
        detectionMethod: 'no-change',
        confidence: 1.0
    };
    
    // 入力チェック
    if (!gitDiff || gitDiff.length === 0) {
        debugLog('No gitDiff provided');
        return result;
    }
    
    // 削除行と追加行を分類
    const deletedRows = gitDiff.filter(d => d.status === 'deleted' && d.oldContent);
    const addedRows = gitDiff.filter(d => d.status === 'added');
    
    debugLog('Found deletedRows:', deletedRows.length, 'addedRows:', addedRows.length);
    
    // ヘッダ情報を抽出
    const oldHeaders = extractOldHeaders(deletedRows, cellParseOpts, debugLog);
    const newHeaders = extractNewHeaders(addedRows, cellParseOpts, debugLog);
    result.oldHeaders = oldHeaders;
    
    // 変更前の列数を取得
    const oldColumnCount = extractOldColumnCount(deletedRows, currentColumnCount, cellParseOpts, debugLog);
    const newColumnCount = currentColumnCount;
    
    result.oldColumnCount = oldColumnCount;
    result.newColumnCount = newColumnCount;
    
    // 列数に差がない場合
    const columnDiff = newColumnCount - oldColumnCount;
    if (columnDiff === 0) {
        debugLog('No column count change detected');
        return result;
    }
    
    debugLog('Column diff:', columnDiff, '(old:', oldColumnCount, '-> new:', newColumnCount, ')');
    
    // ヘッダ比較による検出を試みる
    if (oldHeaders.length > 0 && newHeaders.length > 0) {
        const headerResult = detectByHeaderComparison(oldHeaders, newHeaders, headerCompareOpts, debugLog);
        
        // ヘッダ比較で結果が得られた場合
        if (headerResult.deletedColumns.length > 0 || headerResult.addedColumns.length > 0) {
            result.deletedColumns = headerResult.deletedColumns;
            result.addedColumns = headerResult.addedColumns;
            result.detectionMethod = 'header-comparison';
            result.confidence = 0.9; // ヘッダ比較は高信頼度
            
            debugLog('Detection by header comparison:', result);
            return result;
        }
    }
    
    // フォールバック: 末尾から追加/削除されたと仮定
    const fallbackResult = detectByFallback(oldColumnCount, newColumnCount, debugLog);
    result.deletedColumns = fallbackResult.deletedColumns;
    result.addedColumns = fallbackResult.addedColumns;
    result.detectionMethod = 'fallback-end-columns';
    result.confidence = 0.5; // フォールバックは低信頼度
    
    debugLog('Detection by fallback:', result);
    return result;
}

/**
 * 簡易版: ColumnDiffInfo のみを返す（後方互換性用）
 */
export function detectColumnDiffSimple(
    gitDiff: RowGitDiffInput[],
    currentColumnCount: number,
    options: ColumnDiffDetectorOptions = {}
): ColumnDiffInfo {
    const result = detectColumnDiff(gitDiff, currentColumnCount, options);
    
    // ColumnDiffResult から ColumnDiffInfo に変換
    return {
        oldColumnCount: result.oldColumnCount,
        newColumnCount: result.newColumnCount,
        addedColumns: result.addedColumns,
        deletedColumns: result.deletedColumns,
        oldHeaders: result.oldHeaders
    };
}
