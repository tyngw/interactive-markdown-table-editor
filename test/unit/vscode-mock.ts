/**
 * VS Code APIのモックモジュール
 * スタンドアロンテスト実行時にvscodeモジュールを差し替えるために使用
 */

import * as fs from 'fs';
import * as pathMod from 'path';

// --- URI ---
export class Uri {
    readonly scheme: string;
    readonly authority: string;
    readonly path: string;
    readonly query: string;
    readonly fragment: string;
    readonly fsPath: string;

    private constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
        this.scheme = scheme;
        this.authority = authority;
        this.path = path;
        this.query = query;
        this.fragment = fragment;
        this.fsPath = path;
    }

    static file(path: string): Uri {
        return new Uri('file', '', path, '', '');
    }

    static parse(value: string): Uri {
        // 簡易パーサー
        if (value.startsWith('file://')) {
            return new Uri('file', '', value.substring(7), '', '');
        }
        if (value.startsWith('file:')) {
            return new Uri('file', '', value.substring(5), '', '');
        }
        return new Uri('file', '', value, '', '');
    }

    static from(components: { scheme: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
        return new Uri(
            components.scheme,
            components.authority ?? '',
            components.path ?? '',
            components.query ?? '',
            components.fragment ?? ''
        );
    }

    static joinPath(base: Uri, ...pathSegments: string[]): Uri {
        let joined = base.path;
        for (const seg of pathSegments) {
            if (joined.endsWith('/')) {
                joined += seg;
            } else {
                joined += '/' + seg;
            }
        }
        return new Uri(base.scheme, base.authority, joined, base.query, base.fragment);
    }

    toString(): string {
        return `${this.scheme}://${this.authority}${this.path}`;
    }

    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
        return new Uri(
            change.scheme ?? this.scheme,
            change.authority ?? this.authority,
            change.path ?? this.path,
            change.query ?? this.query,
            change.fragment ?? this.fragment
        );
    }

    toJSON(): any {
        return {
            $mid: 1,
            scheme: this.scheme,
            authority: this.authority,
            path: this.path,
            query: this.query,
            fragment: this.fragment,
            fsPath: this.fsPath
        };
    }
}

// --- Position ---
export class Position {
    readonly line: number;
    readonly character: number;

    constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
    }

    isEqual(other: Position): boolean {
        return this.line === other.line && this.character === other.character;
    }

    isBefore(other: Position): boolean {
        return this.line < other.line || (this.line === other.line && this.character < other.character);
    }

    isAfter(other: Position): boolean {
        return this.line > other.line || (this.line === other.line && this.character > other.character);
    }

    translate(lineDelta?: number, characterDelta?: number): Position {
        return new Position(this.line + (lineDelta || 0), this.character + (characterDelta || 0));
    }

    with(line?: number, character?: number): Position {
        return new Position(line ?? this.line, character ?? this.character);
    }

    compareTo(other: Position): number {
        if (this.line !== other.line) { return this.line - other.line; }
        return this.character - other.character;
    }
}

// --- Range ---
export class Range {
    readonly start: Position;
    readonly end: Position;

    constructor(startLine: number | Position, startCharacter: number | Position, endLine?: number, endCharacter?: number) {
        if (typeof startLine === 'number' && typeof startCharacter === 'number') {
            this.start = new Position(startLine, startCharacter);
            this.end = new Position(endLine!, endCharacter!);
        } else {
            this.start = startLine as Position;
            this.end = startCharacter as Position;
        }
    }

    get isEmpty(): boolean {
        return this.start.isEqual(this.end);
    }

    contains(positionOrRange: Position | Range): boolean {
        if (positionOrRange instanceof Position) {
            return !positionOrRange.isBefore(this.start) && !positionOrRange.isAfter(this.end);
        }
        return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
    }
}

// --- Selection ---
export class Selection extends Range {
    readonly anchor: Position;
    readonly active: Position;

    constructor(anchorLine: number | Position, anchorCharacter: number | Position, activeLine?: number, activeCharacter?: number) {
        if (typeof anchorLine === 'number' && typeof anchorCharacter === 'number') {
            super(anchorLine, anchorCharacter, activeLine!, activeCharacter!);
            this.anchor = new Position(anchorLine, anchorCharacter);
            this.active = new Position(activeLine!, activeCharacter!);
        } else {
            const anchor = anchorLine as Position;
            const active = anchorCharacter as Position;
            super(anchor, active);
            this.anchor = anchor;
            this.active = active;
        }
    }
}

// --- TextDocument mock ---
export class MockTextDocument {
    readonly uri: Uri;
    readonly languageId: string;
    private _content: string;
    readonly fileName: string;
    readonly isUntitled: boolean = false;
    readonly version: number = 1;
    readonly isDirty: boolean = false;
    readonly isClosed: boolean = false;
    readonly eol: EndOfLine = EndOfLine.LF;

    constructor(uri: Uri, content: string = '', languageId: string = 'markdown') {
        this.uri = uri;
        this._content = content;
        this.languageId = languageId;
        this.fileName = uri.fsPath;
    }

    getText(range?: Range): string {
        if (!range) { return this._content; }
        const lines = this._content.split('\n');
        const startLine = range.start.line;
        const endLine = range.end.line;
        if (startLine === endLine) {
            return (lines[startLine] || '').substring(range.start.character, range.end.character);
        }
        const result: string[] = [];
        result.push((lines[startLine] || '').substring(range.start.character));
        for (let i = startLine + 1; i < endLine; i++) {
            result.push(lines[i] || '');
        }
        result.push((lines[endLine] || '').substring(0, range.end.character));
        return result.join('\n');
    }

    positionAt(offset: number): Position {
        const text = this._content.substring(0, offset);
        const lines = text.split('\n');
        return new Position(lines.length - 1, lines[lines.length - 1].length);
    }

    offsetAt(position: Position): number {
        const lines = this._content.split('\n');
        let offset = 0;
        for (let i = 0; i < position.line && i < lines.length; i++) {
            offset += lines[i].length + 1;
        }
        offset += position.character;
        return offset;
    }

    get lineCount(): number {
        return this._content.split('\n').length;
    }

    lineAt(line: number): { text: string; range: Range; isEmptyOrWhitespace: boolean; lineNumber: number; firstNonWhitespaceCharacterIndex: number; rangeIncludingLineBreak: Range } {
        const lines = this._content.split('\n');
        // VS Code の TextDocument.lineAt と同様に、範囲外の行番号でエラーをスローする
        if (line < 0 || line >= lines.length) {
            throw new Error(`Illegal value for \`line\`: ${line}. Line must be between 0 and ${lines.length - 1}.`);
        }
        const text = lines[line];
        return {
            text,
            range: new Range(line, 0, line, text.length),
            isEmptyOrWhitespace: text.trim().length === 0,
            lineNumber: line,
            firstNonWhitespaceCharacterIndex: text.search(/\S/) >= 0 ? text.search(/\S/) : text.length,
            rangeIncludingLineBreak: new Range(line, 0, line + 1, 0)
        };
    }

    async save(): Promise<boolean> {
        return true;
    }

    validateRange(range: Range): Range {
        return range;
    }

    validatePosition(position: Position): Position {
        return position;
    }

    getWordRangeAtPosition(_position: Position, _regex?: RegExp): Range | undefined {
        return undefined;
    }
}

// --- WorkspaceEdit ---
export class WorkspaceEdit {
    private _edits: Array<{ uri: Uri; range: Range; newText: string }> = [];

    replace(uri: Uri, range: Range, newText: string): void {
        this._edits.push({ uri, range, newText });
    }

    get size(): number {
        return this._edits.length;
    }

    entries(): Array<[Uri, Array<{ range: Range; newText: string }>]> {
        const map = new Map<string, Array<{ range: Range; newText: string }>>();
        for (const edit of this._edits) {
            const key = edit.uri.toString();
            if (!map.has(key)) { map.set(key, []); }
            map.get(key)!.push({ range: edit.range, newText: edit.newText });
        }
        return Array.from(map.entries()).map(([, edits]) => [this._edits[0].uri, edits]);
    }
}

// --- EventEmitter ---
export class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = [];
    event = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
    };
    fire(event: T): void {
        this.listeners.forEach(l => l(event));
    }
    dispose(): void {
        this.listeners = [];
    }
}

// --- Disposable ---
export class Disposable {
    private _callOnDispose: () => void;
    constructor(callOnDispose: () => void) {
        this._callOnDispose = callOnDispose;
    }
    dispose(): void {
        this._callOnDispose();
    }
    static from(...disposables: { dispose: () => void }[]): Disposable {
        return new Disposable(() => disposables.forEach(d => d.dispose()));
    }
}

// --- CancellationTokenSource ---
export class CancellationTokenSource {
    token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
    cancel(): void { this.token.isCancellationRequested = true; }
    dispose(): void {}
}

// --- Enums ---
export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3
}

export enum EndOfLine {
    LF = 1,
    CRLF = 2
}

export enum ColorThemeKind {
    Light = 1,
    Dark = 2,
    HighContrast = 3,
    HighContrastLight = 4
}

// --- ExtensionMode ---
export enum ExtensionMode {
    Production = 1,
    Development = 2,
    Test = 3
}

// --- workspace ---
export const workspace = {
    openTextDocument: async (uri: any): Promise<MockTextDocument> => {
        // ファイルが実在する場合は内容を読み込む
        const fsPath = typeof uri === 'string' ? uri : (uri && uri.fsPath ? uri.fsPath : uri?.path || '');
        try {
            if (fsPath && fs.existsSync(fsPath)) {
                const content = fs.readFileSync(fsPath, 'utf8');
                return new MockTextDocument(typeof uri === 'string' ? Uri.parse(uri) : uri, content);
            }
        } catch (_e) {
            // fallthrough
        }
        return new MockTextDocument(typeof uri === 'string' ? Uri.parse(uri) : uri);
    },
    applyEdit: async (edit: WorkspaceEdit): Promise<boolean> => {
        // WorkspaceEditの内容をファイルに反映する
        try {
            const entries = edit.entries();
            for (const [uri, edits] of entries) {
                const fsPath = uri.fsPath;
                if (fsPath && fs.existsSync(fsPath)) {
                    let content = fs.readFileSync(fsPath, 'utf8');
                    // 逆順にソートして適用（後ろの位置から先に置換することで位置ずれを防ぐ）
                    const sorted = [...edits].sort((a, b) => {
                        const aOff = content.split('\n').slice(0, a.range.start.line).join('\n').length + a.range.start.character;
                        const bOff = content.split('\n').slice(0, b.range.start.line).join('\n').length + b.range.start.character;
                        return bOff - aOff;
                    });
                    for (const e of sorted) {
                        const lines = content.split('\n');
                        const startOff = lines.slice(0, e.range.start.line).join('\n').length + (e.range.start.line > 0 ? 1 : 0) + e.range.start.character;
                        const endOff = lines.slice(0, e.range.end.line).join('\n').length + (e.range.end.line > 0 ? 1 : 0) + e.range.end.character;
                        content = content.substring(0, startOff) + e.newText + content.substring(endOff);
                    }
                    fs.writeFileSync(fsPath, content, 'utf8');
                }
            }
        } catch (_e) {
            // fallthrough
        }
        return true;
    },
    getConfiguration: (_section?: string) => ({
        get: <T>(key: string, defaultValue?: T): T => defaultValue as T,
        update: async () => {},
        has: () => false,
        inspect: () => undefined
    }),
    fs: {
        readFile: async (uri: Uri): Promise<Uint8Array> => {
            try {
                const fsPath = uri.fsPath || uri.path;
                if (fsPath && fs.existsSync(fsPath)) {
                    return new Uint8Array(fs.readFileSync(fsPath));
                }
            } catch (_e) { /* fallthrough */ }
            return new Uint8Array(0);
        },
        writeFile: async (uri: Uri, content: Uint8Array): Promise<void> => {
            try {
                const fsPath = uri.fsPath || uri.path;
                if (fsPath) {
                    const dir = pathMod.dirname(fsPath);
                    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
                    fs.writeFileSync(fsPath, Buffer.from(content));
                }
            } catch (_e) { /* ignore */ }
        },
        stat: async (uri: Uri): Promise<{ type: number; ctime: number; mtime: number; size: number }> => {
            const fsPath = uri.fsPath || uri.path;
            try {
                if (fsPath && fs.existsSync(fsPath)) {
                    const stat = fs.statSync(fsPath);
                    return {
                        type: stat.isDirectory() ? 2 : 1,
                        ctime: stat.ctimeMs,
                        mtime: stat.mtimeMs,
                        size: stat.size
                    };
                }
            } catch (_e) { /* fallthrough */ }
            throw new Error(`File not found: ${fsPath}`);
        },
        createDirectory: async (uri: Uri): Promise<void> => {
            const fsPath = uri.fsPath || uri.path;
            if (fsPath) { fs.mkdirSync(fsPath, { recursive: true }); }
        },
        delete: async (uri: Uri): Promise<void> => {
            const fsPath = uri.fsPath || uri.path;
            if (fsPath && fs.existsSync(fsPath)) { fs.rmSync(fsPath, { recursive: true }); }
        },
        copy: async (source: Uri, target: Uri): Promise<void> => {
            fs.copyFileSync(source.fsPath || source.path, target.fsPath || target.path);
        },
        rename: async (source: Uri, target: Uri): Promise<void> => {
            fs.renameSync(source.fsPath || source.path, target.fsPath || target.path);
        },
        readDirectory: async (uri: Uri): Promise<Array<[string, number]>> => {
            const fsPath = uri.fsPath || uri.path;
            if (fsPath && fs.existsSync(fsPath)) {
                const entries = fs.readdirSync(fsPath, { withFileTypes: true });
                return entries.map(e => [e.name, e.isDirectory() ? 2 : 1]);
            }
            return [];
        }
    },
    onDidChangeTextDocument: (_handler: any) => ({ dispose: () => {} }),
    onDidChangeConfiguration: (_handler: any) => ({ dispose: () => {} }),
    getWorkspaceFolder: (_uri: any) => null,
    workspaceFolders: [] as any[],
    textDocuments: [] as MockTextDocument[]
};

// --- window ---
export const window = {
    activeTextEditor: undefined as any,
    visibleTextEditors: [] as any[],
    showInformationMessage: async (..._args: any[]) => undefined,
    showWarningMessage: async (..._args: any[]) => undefined,
    showErrorMessage: async (..._args: any[]) => undefined,
    showQuickPick: async (..._args: any[]) => undefined,
    showSaveDialog: async (..._args: any[]) => undefined,
    showOpenDialog: async (..._args: any[]) => undefined,
    showTextDocument: async (_doc: any, _options?: any) => ({
        document: _doc,
        selection: new Selection(0, 0, 0, 0),
        selections: [new Selection(0, 0, 0, 0)],
        viewColumn: ViewColumn.One,
        edit: async (_callback: any) => true,
        revealRange: () => {},
        setDecorations: () => {}
    }),
    createWebviewPanel: (_viewType: string, _title: string, _showOptions: any, _options?: any) => {
        let _html = '';
        const _disposeListeners: Function[] = [];
        const _viewStateListeners: Function[] = [];
        const panel: any = {
            webview: {
                get html() { return _html; },
                set html(value: string) { _html = value; },
                cspSource: 'test-csp',
                asWebviewUri: (uri: Uri) => uri,
                onDidReceiveMessage: () => ({ dispose: () => {} }),
                postMessage: async () => true
            },
            title: _title,
            viewType: _viewType,
            visible: true,
            active: true,
            viewColumn: 2,
            onDidDispose: (listener: Function, _thisArg?: any, _disposables?: any[]) => {
                _disposeListeners.push(listener);
                return { dispose: () => {} };
            },
            onDidChangeViewState: (listener: Function, _thisArg?: any, _disposables?: any[]) => {
                _viewStateListeners.push(listener);
                return { dispose: () => {} };
            },
            reveal: () => {},
            dispose: () => {
                // パネルdispose時にonDidDisposeリスナーを呼ぶ
                for (const listener of _disposeListeners) {
                    try { listener(); } catch (_) {}
                }
            },
            // テスト用: viewStateイベントを手動トリガーするヘルパー
            _triggerViewStateChange: (event: any) => {
                for (const listener of _viewStateListeners) {
                    try { listener(event); } catch (_) {}
                }
            }
        };
        return panel;
    },
    onDidChangeActiveColorTheme: (_handler: any) => ({ dispose: () => {} }),
    createOutputChannel: (_name: string) => ({
        appendLine: () => {},
        append: () => {},
        clear: () => {},
        show: () => {},
        dispose: () => {}
    })
};

// --- commands ---
export const commands = {
    registerCommand: (_command: string, _callback: (...args: any[]) => any) => ({ dispose: () => {} }),
    executeCommand: async <T>(_command: string, ..._args: any[]): Promise<T | undefined> => undefined,
    getCommands: async (_filterInternal?: boolean): Promise<string[]> => []
};

// --- extensions ---
export const extensions = {
    all: [] as any[],
    getExtension: (_extensionId: string): any => undefined
};

// --- env ---
export const env = {
    language: 'en',
    uriScheme: 'vscode',
    appName: 'Visual Studio Code',
    clipboard: {
        readText: async () => '',
        writeText: async (_value: string) => {}
    }
};

// --- l10n ---
export const l10n = {
    t: (message: string, ..._args: any[]) => message
};

// --- ConfigurationTarget ---
export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
}

// --- TextEdit ---
export class TextEdit {
    range: Range;
    newText: string;
    constructor(range: Range, newText: string) {
        this.range = range;
        this.newText = newText;
    }
    static replace(range: Range, newText: string): TextEdit {
        return new TextEdit(range, newText);
    }
}
