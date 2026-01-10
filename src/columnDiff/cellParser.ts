/**
 * Markdownテーブル行のセル分解ユーティリティ
 * エスケープされたパイプ（\|）を考慮した堅牢なセル分解を提供
 */

import { CellParseOptions, DEFAULT_CELL_PARSE_OPTIONS } from './types';

/**
 * エスケープされたパイプを一時的なプレースホルダに置換
 * @param content 処理対象の文字列
 * @returns プレースホルダに置換された文字列
 */
const ESCAPED_PIPE_PLACEHOLDER = '\x00ESCAPED_PIPE\x00';

function replaceEscapedPipes(content: string): string {
    // \| を一時的なプレースホルダに置換
    return content.replace(/\\\|/g, ESCAPED_PIPE_PLACEHOLDER);
}

/**
 * プレースホルダを元のエスケープされたパイプに復元
 * @param content プレースホルダを含む文字列
 * @returns 復元された文字列（パイプ文字として）
 */
function restoreEscapedPipes(content: string): string {
    // プレースホルダを | に復元（エスケープは除去）
    return content.replace(new RegExp(ESCAPED_PIPE_PLACEHOLDER, 'g'), '|');
}

/**
 * Markdownテーブル行の先頭・末尾のパイプを除去
 * @param rowContent テーブル行の文字列
 * @returns パイプを除去した文字列
 */
function stripOuterPipes(rowContent: string): string {
    let result = rowContent.trim();
    if (result.startsWith('|')) {
        result = result.substring(1);
    }
    if (result.endsWith('|')) {
        result = result.substring(0, result.length - 1);
    }
    return result;
}

/**
 * Markdownテーブル行からセル数を取得
 * エスケープされたパイプ（\|）を考慮する
 * 
 * @param rowContent テーブル行の文字列（例: "| a | b | c |"）
 * @param options セル分解オプション
 * @returns セル数（例: 3）
 * 
 * @example
 * countTableCells("| a | b | c |") // => 3
 * countTableCells("| a \\| b | c |") // => 2 (エスケープされたパイプを考慮)
 */
export function countTableCells(
    rowContent: string,
    options: Partial<CellParseOptions> = {}
): number {
    const opts = { ...DEFAULT_CELL_PARSE_OPTIONS, ...options };
    
    if (!rowContent || !rowContent.includes('|')) {
        return 0;
    }

    let content = rowContent;
    
    // エスケープされたパイプを処理
    if (opts.handleEscapedPipes) {
        content = replaceEscapedPipes(content);
    }
    
    const stripped = stripOuterPipes(content);
    
    if (!stripped) {
        return 0;
    }
    
    return stripped.split('|').length;
}

/**
 * Markdownテーブル行から列の値を抽出
 * エスケープされたパイプ（\|）を考慮する
 * 
 * @param rowContent テーブル行の文字列（例: "| a | b | c |"）
 * @param options セル分解オプション
 * @returns セル値の配列（例: ['a', 'b', 'c']）
 * 
 * @example
 * parseTableRowCells("| a | b | c |") // => ['a', 'b', 'c']
 * parseTableRowCells("| a \\| b | c |") // => ['a | b', 'c'] (エスケープされたパイプを考慮)
 */
export function parseTableRowCells(
    rowContent: string,
    options: Partial<CellParseOptions> = {}
): string[] {
    const opts = { ...DEFAULT_CELL_PARSE_OPTIONS, ...options };
    
    if (!rowContent || !rowContent.includes('|')) {
        return [];
    }

    let content = rowContent;
    
    // エスケープされたパイプを処理
    if (opts.handleEscapedPipes) {
        content = replaceEscapedPipes(content);
    }
    
    const stripped = stripOuterPipes(content);
    
    if (!stripped) {
        return [];
    }
    
    const cells = stripped.split('|');
    
    // セル値を処理
    return cells.map(cell => {
        let value = cell;
        
        // エスケープされたパイプを復元
        if (opts.handleEscapedPipes) {
            value = restoreEscapedPipes(value);
        }
        
        // トリム
        if (opts.trimCells) {
            value = value.trim();
        }
        
        return value;
    });
}

/**
 * 行がセパレータ行かどうかを判定
 * セパレータ行は全てのセルが `---` または `:---:` などの形式
 * 
 * @param rowContent テーブル行の文字列
 * @param options セル分解オプション
 * @returns セパレータ行の場合true
 * 
 * @example
 * isSeparatorRow("| --- | :---: | ---: |") // => true
 * isSeparatorRow("| Header1 | Header2 |") // => false
 */
export function isSeparatorRow(
    rowContent: string,
    options: Partial<CellParseOptions> = {}
): boolean {
    const cells = parseTableRowCells(rowContent, options);
    
    if (cells.length === 0) {
        return false;
    }
    
    // すべてのセルがセパレータパターンにマッチするか確認
    // セパレータパターン: 空白、ハイフン、コロンのみで構成
    const separatorPattern = /^[\s\-:]*$/;
    
    return cells.every(cell => separatorPattern.test(cell));
}
