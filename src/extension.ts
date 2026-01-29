// エントリポイント。Activation/Deactivation だけを担い、詳細実装は activation 配下へ委譲する。
import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { MarkdownParser } from './markdownParser';
import { getFileHandler } from './fileHandler';
import { UndoRedoManager } from './undoRedoManager';
import { PanelSessionManager } from './activation/panelSessionManager';
import { GitDiffCoordinator } from './activation/gitDiffCoordinator';
import { TableEditRunner } from './activation/tableEditRunner';
import { CommandRegistrar } from './activation/commandRegistrar';
import { ThemeApplier } from './activation/themeApplier';

export function activate(context: vscode.ExtensionContext): void {
    const webviewManager = WebviewManager.getInstance(context);
    const markdownParser = new MarkdownParser();
    const fileHandler = getFileHandler();
    const undoRedoManager = UndoRedoManager.getInstance();

    const panelSessionManager = new PanelSessionManager(webviewManager);
    const gitDiffCoordinator = new GitDiffCoordinator(webviewManager);
    const themeApplier = new ThemeApplier(webviewManager);
    const tableEditRunner = new TableEditRunner({
        panelSessionManager,
        undoRedoManager,
        fileHandler,
        webviewManager,
        gitDiffCoordinator
    });

    const commandRegistrar = new CommandRegistrar({
        context,
        markdownParser,
        fileHandler,
        undoRedoManager,
        webviewManager,
        panelSessionManager,
        gitDiffCoordinator,
        tableEditRunner,
        themeApplier
    });

    void themeApplier.applyConfiguredThemeToPanels();
    themeApplier.registerWatchers(context);
    commandRegistrar.register();
}

export function deactivate(): void {
    try {
        const webviewManager = WebviewManager.getInstance();
        if (webviewManager) {
            webviewManager.dispose();
        }
    } catch (error) {
        console.error('Error disposing WebviewManager:', error);
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { disposeFileHandler } = require('./fileHandler');
        disposeFileHandler();
    } catch (error) {
        console.error('Error disposing FileHandler:', error);
    }
}
