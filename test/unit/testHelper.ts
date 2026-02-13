/**
 * テスト用ヘルパー関数群
 * VS Code v1.109+ でプロパティが read-only / getter-only になった API を
 * Object.defineProperty 経由で安全にモック・復元するためのユーティリティ。
 */
import * as vscode from 'vscode';

/**
 * vscode.workspace.fs の readFile/writeFile/stat を安全にモックする。
 * VS Code v1.109+ では vscode.workspace.fs のプロパティが configurable: false のため
 * 個々のメソッドを Object.defineProperty で差し替えることができない。
 * 代わりに vscode.workspace の fs プロパティ自体を Proxy で差し替える。
 *
 * @param method 'readFile' | 'writeFile' | 'stat'
 * @param mockFn モック関数
 * @returns 復元用関数
 */
export function stubWorkspaceFsMethod(
    method: 'readFile' | 'writeFile' | 'stat',
    mockFn: (...args: any[]) => any
): () => void {
    const originalFs = vscode.workspace.fs;
    const originalDescriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'fs');
    const fakeFs = new Proxy({} as typeof originalFs, {
        get(_target, prop, _receiver) {
            if (prop === method) {
                return mockFn;
            }
            return (originalFs as any)[prop];
        }
    });
    Object.defineProperty(vscode.workspace, 'fs', {
        value: fakeFs,
        writable: true,
        configurable: true
    });
    return () => {
        if (originalDescriptor) {
            Object.defineProperty(vscode.workspace, 'fs', originalDescriptor);
        } else {
            Object.defineProperty(vscode.workspace, 'fs', {
                value: originalFs,
                writable: true,
                configurable: true
            });
        }
    };
}

/**
 * vscode.window.activeTextEditor を安全にモックする。
 * getter-only プロパティのため Object.defineProperty で差し替える。
 *
 * @param mockEditor モックエディタオブジェクト
 * @returns 復元用関数
 */
export function stubActiveTextEditor(mockEditor: any): () => void {
    const descriptor = Object.getOwnPropertyDescriptor(vscode.window, 'activeTextEditor');
    Object.defineProperty(vscode.window, 'activeTextEditor', {
        get: () => mockEditor,
        configurable: true
    });
    return () => {
        if (descriptor) {
            Object.defineProperty(vscode.window, 'activeTextEditor', descriptor);
        }
    };
}

/**
 * vscode.workspace.textDocuments を安全にモックする。
 * read-only プロパティのため Object.defineProperty で差し替える。
 *
 * @param mockDocuments モックドキュメント配列
 * @returns 復元用関数
 */
export function stubTextDocuments(mockDocuments: any[]): () => void {
    const descriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');
    Object.defineProperty(vscode.workspace, 'textDocuments', {
        get: () => mockDocuments,
        configurable: true
    });
    return () => {
        if (descriptor) {
            Object.defineProperty(vscode.workspace, 'textDocuments', descriptor);
        }
    };
}

/**
 * vscode.window.visibleTextEditors を安全にモックする。
 * getter-only プロパティのため Object.defineProperty で差し替える。
 *
 * @param mockEditors モックエディタ配列
 * @returns 復元用関数
 */
export function stubVisibleTextEditors(mockEditors: any[]): () => void {
    const descriptor = Object.getOwnPropertyDescriptor(vscode.window, 'visibleTextEditors');
    Object.defineProperty(vscode.window, 'visibleTextEditors', {
        get: () => mockEditors,
        configurable: true
    });
    return () => {
        if (descriptor) {
            Object.defineProperty(vscode.window, 'visibleTextEditors', descriptor);
        }
    };
}

/**
 * console メソッドを安全にモックする。
 * VS Code Extension Host で console メソッドが read-only の場合に対応。
 *
 * @param method 'log' | 'warn' | 'error'
 * @param mockFn モック関数
 * @returns 復元用関数
 */
export function stubConsoleMethod(
    method: 'log' | 'warn' | 'error',
    mockFn: (...args: any[]) => void
): () => void {
    const original = console[method];
    try {
        // まず直接代入を試みる（通常の Node.js 環境では動作する）
        (console as any)[method] = mockFn;
        if ((console as any)[method] !== mockFn) {
            throw new Error('Direct assignment failed');
        }
    } catch {
        // 直接代入が効かない場合は Object.defineProperty を使う
        Object.defineProperty(console, method, {
            value: mockFn,
            writable: true,
            configurable: true
        });
    }
    return () => {
        try {
            (console as any)[method] = original;
            if ((console as any)[method] !== original) {
                throw new Error('Direct restore failed');
            }
        } catch {
            Object.defineProperty(console, method, {
                value: original,
                writable: true,
                configurable: true
            });
        }
    };
}
