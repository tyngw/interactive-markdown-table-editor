/**
 * Test mocking utilities for vscode API
 * Provides helpers to properly mock readonly properties and methods
 */
import * as vscode from 'vscode';

/**
 * Temporarily replace a vscode.workspace.fs method with a mock implementation.
 * Properly handles readonly properties using Object.defineProperty.
 * Returns a cleanup function that restores the original.
 */
export function mockWorkspaceFsMethod(
    methodName: 'writeFile' | 'readFile' | 'delete' | 'rename' | 'copy' | 'mkdir' | 'stat',
    mockFn: Function
): () => void {
    const fs = (vscode.workspace as any).fs;
    const original = fs[methodName];
    
    // Use Object.defineProperty to set the mock, making it writable temporarily
    Object.defineProperty(fs, methodName, {
        value: mockFn,
        writable: true,
        configurable: true
    });
    
    // Return cleanup function
    return () => {
        Object.defineProperty(fs, methodName, {
            value: original,
            writable: false,
            configurable: true
        });
    };
}

/**
 * Temporarily replace a module export with a mock.
 * Returns a cleanup function that restores the original.
 */
export function mockModuleExport(
    module: any,
    exportName: string,
    mockValue: any
): () => void {
    const original = module[exportName];
    (module as any)[exportName] = mockValue;
    
    return () => {
        (module as any)[exportName] = original;
    };
}

/**
 * Temporarily replace a vscode API property.
 * Returns a cleanup function that restores the original.
 */
export function mockVscodeProperty(
    obj: any,
    propertyPath: string,
    mockValue: any
): () => void {
    const parts = propertyPath.split('.');
    const parent = parts.slice(0, -1).reduce((o, p) => o[p], obj);
    const lastPart = parts[parts.length - 1];
    
    const original = parent[lastPart];
    parent[lastPart] = mockValue;
    
    return () => {
        parent[lastPart] = original;
    };
}
