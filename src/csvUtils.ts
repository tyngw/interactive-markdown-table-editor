/**
 * どこで: VS Code 拡張 (extension ホスト側)
 * 何を: CSV文字列のパースおよびS-JIS/UTF-8の自動判別デコードを提供
 * なぜ: Webview からのCSVインポート要求に対して、堅牢にファイル読込とテーブル化を行うため
 */

import * as iconv from 'iconv-lite';

export type SupportedEncoding = 'utf8' | 'sjis';

export function detectTextEncoding(buf: Buffer): SupportedEncoding {
    // UTF-8 BOM
    if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        return 'utf8';
    }
    // Try UTF-8; if replacement char appears, assume SJIS
    const text = buf.toString('utf8');
    const replacementCount = (text.match(/\uFFFD/g) || []).length;
    if (replacementCount > 0) {return 'sjis';}
    return 'utf8';
}

export function decodeBuffer(buf: Buffer, enc: SupportedEncoding): string {
    if (enc === 'sjis') {
        try {
            return iconv.decode(buf, 'shift_jis');
        } catch {
            // フォールバック
            return buf.toString('utf8');
        }
    }
    return buf.toString('utf8');
}

export function parseCsv(text: string): string[][] {
    // 改行正規化
    const src = text.replace(/\r\n?/g, '\n');
    const rows: string[][] = [];
    let cur: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < src.length && src[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                cur.push(field);
                field = '';
            } else if (ch === '\n') {
                cur.push(field);
                rows.push(cur);
                cur = [];
                field = '';
            } else {
                field += ch;
            }
        }
    }
    // 末尾フィールド
    if (inQuotes) {
        // 不正なクォートはそのまま扱う
    }
    cur.push(field);
    rows.push(cur);

    // 末尾の空行を除去
    while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
        rows.pop();
    }
    return rows;
}

function stripBom(s: string): string { return s.replace(/^\uFEFF/, ''); }

export function toRectangular(rows: string[][]): { headers: string[]; rows: string[][] } {
    // 先頭の空行をスキップ（全セル空の行）
    const work = [...rows];
    while (work.length > 0 && work[0].every(c => (c || '').trim() === '')) {
        work.shift();
    }
    if (work.length === 0) {
        return { headers: [], rows: [] };
    }
    const maxCols = work.reduce((m, r) => Math.max(m, r.length), 0);
    const norm = work.map(r => r.concat(Array(Math.max(0, maxCols - r.length)).fill('')));
    let headers = (norm[0] || []).map((h, i) => (h || '').trim());
    // BOM除去（先頭セル）
    if (headers.length > 0) {headers[0] = stripBom(headers[0]);}
    headers = headers.map((h, i) => h || `Column ${i + 1}`);
    const body = norm.slice(1);
    return { headers, rows: body };
}
