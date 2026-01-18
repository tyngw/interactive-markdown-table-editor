import * as vscode from 'vscode';
import { getFileHandler } from './fileHandler';

interface UndoRedoState {
    uri: string;
    content: string;
    timestamp: number;
    description: string;
}

/**
 * Custom Undo/Redo Manager that works without focus changes
 * Uses WorkspaceEdit to directly modify documents without requiring active editor
 */
export class UndoRedoManager {
    private static instance: UndoRedoManager;
    private undoStack: Map<string, UndoRedoState[]> = new Map();
    private redoStack: Map<string, UndoRedoState[]> = new Map();
    private maxStackSize = 50;

    private constructor() {}

    public static getInstance(): UndoRedoManager {
        if (!UndoRedoManager.instance) {
            UndoRedoManager.instance = new UndoRedoManager();
        }
        return UndoRedoManager.instance;
    }

    /**
     * Save current state before making changes - NO FOCUS CHANGE REQUIRED
     */
    public async saveState(uri: vscode.Uri, description: string = 'Table edit'): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const uriString = uri.toString();

            const state: UndoRedoState = {
                uri: uriString,
                content: document.getText(),
                timestamp: Date.now(),
                description
            };

            // Get or create undo stack for this URI
            let stack = this.undoStack.get(uriString);
            if (!stack) {
                stack = [];
                this.undoStack.set(uriString, stack);
            }

            stack.push(state);

            // Limit stack size
            if (stack.length > this.maxStackSize) {
                stack.shift(); // Remove oldest entry
            }

            // Clear redo stack when new state is saved
            this.redoStack.set(uriString, []);
        } catch (error) {
            console.error('[MTE][UndoRedo] Failed to save state:', error);
        }
    }

    /**
     * Undo last change - NO FOCUS CHANGE REQUIRED
     */
    public async undo(uri: vscode.Uri): Promise<boolean> {
        const uriString = uri.toString();
        const undoStack = this.undoStack.get(uriString);

        if (!undoStack || undoStack.length === 0) {
            return false;
        }

        try {
            // Get current state BEFORE undo for redo stack
            const document = await vscode.workspace.openTextDocument(uri);
            const currentStateBeforeUndo: UndoRedoState = {
                uri: uriString,
                content: document.getText(),
                timestamp: Date.now(),
                description: 'State before undo'
            };

            // Get previous state from undo stack
            const previousState = undoStack.pop()!;

            // Apply previous state using WorkspaceEdit - NO FOCUS CHANGE NEEDED
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            edit.replace(uri, fullRange, previousState.content);

            try {
                await getFileHandler().applyWorkspaceEditAndSave(edit, uri, 'undo');
                // Only save to redo stack AFTER successful undo
                let redoStack = this.redoStack.get(uriString);
                if (!redoStack) {
                    redoStack = [];
                    this.redoStack.set(uriString, redoStack);
                }
                redoStack.push(currentStateBeforeUndo);
                return true;
            } catch (e) {
                // Restore undo stack if edit failed
                undoStack.push(previousState);
                console.error('[MTE][UndoRedo] Undo failed to apply:', e);
                return false;
            }
        } catch (error) {
            console.error('[MTE][UndoRedo] Undo operation failed:', error);
            return false;
        }
    }

    /**
     * Redo last undone change - NO FOCUS CHANGE REQUIRED
     */
    public async redo(uri: vscode.Uri): Promise<boolean> {
        const uriString = uri.toString();
        const redoStack = this.redoStack.get(uriString);

        if (!redoStack || redoStack.length === 0) {
            return false;
        }

        try {
            // Get current state BEFORE redo for undo stack
            const document = await vscode.workspace.openTextDocument(uri);
            const currentStateBeforeRedo: UndoRedoState = {
                uri: uriString,
                content: document.getText(),
                timestamp: Date.now(),
                description: 'State before redo'
            };

            // Get next state from redo stack
            const nextState = redoStack.pop()!;

            // Apply next state using WorkspaceEdit - NO FOCUS CHANGE NEEDED
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            edit.replace(uri, fullRange, nextState.content);

            try {
                await getFileHandler().applyWorkspaceEditAndSave(edit, uri, 'redo');
                // Only save to undo stack AFTER successful redo
                let undoStack = this.undoStack.get(uriString);
                if (!undoStack) {
                    undoStack = [];
                    this.undoStack.set(uriString, undoStack);
                }
                undoStack.push(currentStateBeforeRedo);
                return true;
            } catch (e) {
                // Restore redo stack if edit failed
                redoStack.push(nextState);
                console.error('[MTE][UndoRedo] Redo failed to apply:', e);
                return false;
            }
        } catch (error) {
            console.error('[MTE][UndoRedo] Redo operation failed:', error);
            return false;
        }
    }

    /**
     * Check if undo is available for a URI
     */
    public canUndo(uri: vscode.Uri): boolean {
        const stack = this.undoStack.get(uri.toString());
        return stack !== undefined && stack.length > 0;
    }

    /**
     * Check if redo is available for a URI
     */
    public canRedo(uri: vscode.Uri): boolean {
        const stack = this.redoStack.get(uri.toString());
        return stack !== undefined && stack.length > 0;
    }

    /**
     * Clear all undo/redo history for a URI
     */
    public clearHistory(uri: vscode.Uri): void {
        const uriString = uri.toString();
        this.undoStack.delete(uriString);
        this.redoStack.delete(uriString);
    }

    /**
     * Get undo/redo statistics for debugging
     */
    public getStats(uri: vscode.Uri): { undoCount: number; redoCount: number } {
        const uriString = uri.toString();
        const undoStack = this.undoStack.get(uriString);
        const redoStack = this.redoStack.get(uriString);
        
        const stats = {
            undoCount: undoStack ? undoStack.length : 0,
            redoCount: redoStack ? redoStack.length : 0
        };
        
        return stats;
    }
}