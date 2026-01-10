/**
 * ヘッダ比較ユーティリティ
 * 正規化されたヘッダ比較を提供し、列の追加・削除位置を特定
 */

import { HeaderCompareOptions, DEFAULT_HEADER_COMPARE_OPTIONS } from './types';

/**
 * ヘッダ文字列を正規化
 * @param header ヘッダ文字列
 * @param options 比較オプション
 * @returns 正規化されたヘッダ文字列
 */
export function normalizeHeader(
    header: string,
    options: Partial<HeaderCompareOptions> = {}
): string {
    const opts = { ...DEFAULT_HEADER_COMPARE_OPTIONS, ...options };
    
    let normalized = header;
    
    // 前後の空白を除去
    if (opts.trimWhitespace) {
        normalized = normalized.trim();
    }
    
    // 連続する空白を正規化（単一スペースに置換）
    if (opts.normalizeWhitespace) {
        normalized = normalized.replace(/\s+/g, ' ');
    }
    
    // 大文字小文字を無視
    if (opts.ignoreCase) {
        normalized = normalized.toLowerCase();
    }
    
    return normalized;
}

/**
 * 2つのヘッダが等しいかを比較
 * @param header1 比較対象1
 * @param header2 比較対象2
 * @param options 比較オプション
 * @returns 等しい場合true
 */
export function headersEqual(
    header1: string,
    header2: string,
    options: Partial<HeaderCompareOptions> = {}
): boolean {
    return normalizeHeader(header1, options) === normalizeHeader(header2, options);
}

/**
 * ヘッダ配列内でのインデックスを検索
 * @param headers ヘッダ配列
 * @param targetHeader 検索対象のヘッダ
 * @param options 比較オプション
 * @returns 見つかった場合はインデックス、見つからない場合は-1
 */
export function findHeaderIndex(
    headers: string[],
    targetHeader: string,
    options: Partial<HeaderCompareOptions> = {}
): number {
    const normalizedTarget = normalizeHeader(targetHeader, options);
    
    for (let i = 0; i < headers.length; i++) {
        if (normalizeHeader(headers[i], options) === normalizedTarget) {
            return i;
        }
    }
    
    return -1;
}

/**
 * ヘッダがリスト内に存在するかを確認
 * @param headers ヘッダ配列
 * @param targetHeader 検索対象のヘッダ
 * @param options 比較オプション
 * @returns 存在する場合true
 */
export function headerExists(
    headers: string[],
    targetHeader: string,
    options: Partial<HeaderCompareOptions> = {}
): boolean {
    return findHeaderIndex(headers, targetHeader, options) !== -1;
}

/**
 * 削除されたヘッダのインデックスを特定
 * oldHeaders に存在して newHeaders に存在しないヘッダを検出
 * 
 * @param oldHeaders 変更前のヘッダ配列
 * @param newHeaders 変更後のヘッダ配列
 * @param options 比較オプション
 * @returns 削除されたヘッダのインデックス配列（oldHeaders内の位置）
 */
export function findDeletedHeaderIndices(
    oldHeaders: string[],
    newHeaders: string[],
    options: Partial<HeaderCompareOptions> = {}
): number[] {
    const deletedIndices: number[] = [];
    
    for (let i = 0; i < oldHeaders.length; i++) {
        if (!headerExists(newHeaders, oldHeaders[i], options)) {
            deletedIndices.push(i);
        }
    }
    
    return deletedIndices;
}

/**
 * 追加されたヘッダのインデックスを特定
 * newHeaders に存在して oldHeaders に存在しないヘッダを検出
 * 
 * @param oldHeaders 変更前のヘッダ配列
 * @param newHeaders 変更後のヘッダ配列
 * @param options 比較オプション
 * @returns 追加されたヘッダのインデックス配列（newHeaders内の位置）
 */
export function findAddedHeaderIndices(
    oldHeaders: string[],
    newHeaders: string[],
    options: Partial<HeaderCompareOptions> = {}
): number[] {
    const addedIndices: number[] = [];
    
    for (let i = 0; i < newHeaders.length; i++) {
        if (!headerExists(oldHeaders, newHeaders[i], options)) {
            addedIndices.push(i);
        }
    }
    
    return addedIndices;
}

/**
 * ヘッダの位置マッピングを作成
 * oldHeaders の各ヘッダが newHeaders のどの位置に対応するかをマッピング
 * 
 * @param oldHeaders 変更前のヘッダ配列
 * @param newHeaders 変更後のヘッダ配列
 * @param options 比較オプション
 * @returns マッピング（oldIndex -> newIndex, 削除された場合は -1）
 */
export function createHeaderPositionMapping(
    oldHeaders: string[],
    newHeaders: string[],
    options: Partial<HeaderCompareOptions> = {}
): Map<number, number> {
    const mapping = new Map<number, number>();
    
    for (let oldIdx = 0; oldIdx < oldHeaders.length; oldIdx++) {
        const newIdx = findHeaderIndex(newHeaders, oldHeaders[oldIdx], options);
        mapping.set(oldIdx, newIdx);
    }
    
    return mapping;
}
