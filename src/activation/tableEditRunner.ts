// このモジュールはテーブル編集系コマンドの共通処理をまとめ、
// Undo 保存、Markdown 反映、Git diff スケジューリングを一括で扱う。
import { FileHandler } from '../fileHandler';
import { TableDataManager } from '../tableDataManager';
import { UndoRedoManager } from '../undoRedoManager';
import { WebviewManager } from '../webviewManager';
import { PanelSessionManager } from './panelSessionManager';
import { GitDiffCoordinator } from './gitDiffCoordinator';

export interface TableEditOptions<T = void> {
    operationName: string;
    mutate: (context: {
        manager: TableDataManager;
        managersMap: Map<number, TableDataManager>;
        tableIndex: number;
        commandData: any;
    }) => T | Promise<T>;
    getUndoDescription?: (commandData: any) => string;
    getSuccessMessage?: (result: T, commandData: any) => string | undefined;
    getErrorMessage?: (error: unknown, commandData: any) => string;
}

interface Dependencies {
    panelSessionManager: PanelSessionManager;
    undoRedoManager: UndoRedoManager;
    fileHandler: FileHandler;
    webviewManager: WebviewManager;
    gitDiffCoordinator: GitDiffCoordinator;
}

export class TableEditRunner {
    private readonly panelSessionManager: PanelSessionManager;
    private readonly undoRedoManager: UndoRedoManager;
    private readonly fileHandler: FileHandler;
    private readonly webviewManager: WebviewManager;
    private readonly gitDiffCoordinator: GitDiffCoordinator;

    constructor(deps: Dependencies) {
        this.panelSessionManager = deps.panelSessionManager;
        this.undoRedoManager = deps.undoRedoManager;
        this.fileHandler = deps.fileHandler;
        this.webviewManager = deps.webviewManager;
        this.gitDiffCoordinator = deps.gitDiffCoordinator;
    }

    public async run<T>(commandData: any, options: TableEditOptions<T>): Promise<void> {
        const { uri: rawUri, panelId } = commandData;
        const { uri, uriString, panel, tableManagersMap } = this.panelSessionManager.resolvePanelContext(rawUri, panelId);

        if (!uriString || !uri) {
            return;
        }

        if (!panel) {
            return;
        }

        if (!tableManagersMap) {
            this.webviewManager.sendError(panel, 'Table managers not found');
            return;
        }

        const tableIndex = typeof commandData?.tableIndex === 'number' ? commandData.tableIndex : 0;
        const tableDataManager = tableManagersMap.get(tableIndex);

        if (!tableDataManager) {
            this.webviewManager.sendError(panel, `Table manager not found for table ${tableIndex}`);
            return;
        }

        try {
            const undoDescription = options.getUndoDescription ? options.getUndoDescription(commandData) : options.operationName;
            await this.undoRedoManager.saveState(uri, undoDescription);

            const result = await options.mutate({
                manager: tableDataManager,
                managersMap: tableManagersMap,
                tableIndex,
                commandData
            });

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            try {
                this.webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // 非致命的なので握りつぶす
            }

            const applied = await this.fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            try {
                if (applied) {
                    this.webviewManager.sendOperationSuccess(panel, 'save-completed', { kind: 'save', phase: 'completed', applied: true });
                } else {
                    this.webviewManager.sendOperationSuccess(panel, 'save-skipped', { kind: 'save', phase: 'skipped', applied: false });
                }
            } catch (e) {
                // 非致命的なので握りつぶす
            }

            this.gitDiffCoordinator.scheduleGitDiffCalculation(uri, panel, tableManagersMap).catch(err => {
                // ロギングは gitDiffCoordinator 側で行う
                void err;
            });

            const successMessage = options.getSuccessMessage
                ? options.getSuccessMessage(result, commandData)
                : `${options.operationName} completed`;

            if (successMessage) {
                this.webviewManager.sendSuccess(panel, successMessage);
            }
        } catch (error) {
            const errorMessage = options.getErrorMessage
                ? options.getErrorMessage(error, commandData)
                : `Failed to ${options.operationName.toLowerCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            this.webviewManager.sendError(panel, errorMessage);
        }
    }
}