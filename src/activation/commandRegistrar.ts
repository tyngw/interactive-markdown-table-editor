// このモジュールは VS Code コマンド登録とファイル/設定ウォッチャをまとめる。
// 担当: extension.ts から登録処理を切り出し、依存を注入してテスト容易性を高める。
import * as vscode from 'vscode';
import * as path from 'path';
import { decodeBuffer, detectTextEncoding, parseCsv, toRectangular } from '../csvUtils';
import { normalizeForImport, normalizeForShiftJisExport } from '../encodingNormalizer';
import { getGitDiffForTable, detectColumnDiff } from '../gitDiffUtils';
import { MarkdownParser } from '../markdownParser';
import { TableDataManager, TableData } from '../tableDataManager';
import { FileHandler } from '../fileHandler';
import { UndoRedoManager } from '../undoRedoManager';
import { WebviewManager } from '../webviewManager';
import { GitDiffCoordinator } from './gitDiffCoordinator';
import { PanelSessionManager } from './panelSessionManager';
import { TableEditRunner } from './tableEditRunner';
import { ThemeApplier } from './themeApplier';
import { debug, warn } from '../logging';

export interface CommandRegistrarDeps {
    context: vscode.ExtensionContext;
    markdownParser: MarkdownParser;
    fileHandler: FileHandler;
    undoRedoManager: UndoRedoManager;
    webviewManager: WebviewManager;
    panelSessionManager: PanelSessionManager;
    gitDiffCoordinator: GitDiffCoordinator;
    tableEditRunner: TableEditRunner;
    themeApplier: ThemeApplier;
}

export class CommandRegistrar {
    private readonly context: vscode.ExtensionContext;
    private readonly markdownParser: MarkdownParser;
    private readonly fileHandler: FileHandler;
    private readonly undoRedoManager: UndoRedoManager;
    private readonly webviewManager: WebviewManager;
    private readonly panelSessionManager: PanelSessionManager;
    private readonly gitDiffCoordinator: GitDiffCoordinator;
    private readonly tableEditRunner: TableEditRunner;
    private readonly themeApplier: ThemeApplier;

    constructor(deps: CommandRegistrarDeps) {
        this.context = deps.context;
        this.markdownParser = deps.markdownParser;
        this.fileHandler = deps.fileHandler;
        this.undoRedoManager = deps.undoRedoManager;
        this.webviewManager = deps.webviewManager;
        this.panelSessionManager = deps.panelSessionManager;
        this.gitDiffCoordinator = deps.gitDiffCoordinator;
        this.tableEditRunner = deps.tableEditRunner;
        this.themeApplier = deps.themeApplier;
    }

    public register(): void {
        this.registerExternalCommands();
        this.registerInternalCommands();
        this.registerWatchers();
    }

    private registerExternalCommands(): void {
        const openEditorCommand = vscode.commands.registerCommand('markdownTableEditor.openEditor', async (uri?: vscode.Uri) => {
            await this.handleOpenEditor(uri, false);
        });

        const openEditorNewPanelCommand = vscode.commands.registerCommand('markdownTableEditor.openEditorNewPanel', async (uri?: vscode.Uri) => {
            await this.handleOpenEditor(uri, true);
        });

        const selectThemeCommand = vscode.commands.registerCommand('markdownTableEditor.selectTheme', async () => {
            await this.themeApplier.showThemePicker();
        });

        this.context.subscriptions.push(openEditorCommand, openEditorNewPanelCommand, selectThemeCommand);
    }

    private registerInternalCommands(): void {
        const requestTableDataCommand = vscode.commands.registerCommand('markdownTableEditor.internal.requestTableData', async (data: any) => {
            await this.handleRequestTableData(data);
        });

        const updateCellCommand = vscode.commands.registerCommand('markdownTableEditor.internal.updateCell', async (data: any) => {
            await this.handleUpdateCell(data);
        });

        const bulkUpdateCellsCommand = vscode.commands.registerCommand('markdownTableEditor.internal.bulkUpdateCells', async (data: any) => {
            await this.handleBulkUpdateCells(data);
        });

        const updateHeaderCommand = vscode.commands.registerCommand('markdownTableEditor.internal.updateHeader', async (data: any) => {
            await this.handleUpdateHeader(data);
        });

        const addRowCommand = vscode.commands.registerCommand('markdownTableEditor.internal.addRow', async (data: any) => {
            await this.tableEditRunner.run(data, {
                operationName: 'Add row',
                getSuccessMessage: () => {
                    const count = data?.data?.count || 1;
                    return count > 1 ? `${count} rows added successfully` : 'Row added successfully';
                },
                mutate: ({ manager, commandData }) => {
                    const count = commandData?.count || 1;
                    manager.addRow(commandData?.index, count);
                },
                getErrorMessage: (error) => `Failed to add row: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        });

        const deleteRowCommand = vscode.commands.registerCommand('markdownTableEditor.internal.deleteRow', async (data: any) => {
            await this.tableEditRunner.run(data, {
                operationName: 'Delete row',
                getUndoDescription: () => 'Delete row',
                getSuccessMessage: () => 'Row deleted successfully',
                mutate: ({ manager, commandData }) => {
                    const index = commandData?.index;
                    if (typeof index !== 'number' || index < 0) {
                        throw new Error('Invalid row index received for deletion');
                    }
                    manager.deleteRow(index);
                },
                getErrorMessage: (error) => `Failed to delete row: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        });

        const addColumnCommand = vscode.commands.registerCommand('markdownTableEditor.internal.addColumn', async (data: any) => {
            await this.tableEditRunner.run(data, {
                operationName: 'Add column',
                getSuccessMessage: () => {
                    const count = data?.data?.count || 1;
                    return count > 1 ? `${count} columns added successfully` : 'Column added successfully';
                },
                mutate: ({ manager, commandData }) => {
                    const count = commandData?.count || 1;
                    manager.addColumn(commandData?.index, count, commandData?.header);
                },
                getErrorMessage: (error) => `Failed to add column: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        });

        const deleteColumnCommand = vscode.commands.registerCommand('markdownTableEditor.internal.deleteColumn', async (data: any) => {
            await this.tableEditRunner.run(data, {
                operationName: 'Delete column',
                getSuccessMessage: () => 'Column deleted successfully',
                mutate: ({ manager, commandData }) => {
                    const index = commandData?.index;
                    if (typeof index !== 'number' || index < 0) {
                        throw new Error('Invalid column index received for deletion');
                    }
                    manager.deleteColumn(index);
                },
                getErrorMessage: (error) => `Failed to delete column: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        });

        const deleteRowsCommand = vscode.commands.registerCommand('markdownTableEditor.internal.deleteRows', async (data: any) => {
            await this.tableEditRunner.run(data, {
                operationName: 'Delete rows',
                getUndoDescription: (commandData) => `Delete ${Array.isArray(commandData?.indices) ? commandData.indices.length : 0} row(s)`,
                getSuccessMessage: (_result, commandData) => {
                    const count = Array.isArray(commandData?.indices) ? commandData.indices.length : 0;
                    return count > 0 ? `${count} row(s) deleted successfully` : undefined;
                },
                mutate: ({ manager, commandData }) => {
                    if (!Array.isArray(commandData?.indices) || commandData.indices.length === 0) {
                        throw new Error('No row indices provided for deletion');
                    }
                    manager.deleteRows(commandData.indices);
                },
                getErrorMessage: (error) => `Failed to delete rows: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        });

        const deleteColumnsCommand = vscode.commands.registerCommand('markdownTableEditor.internal.deleteColumns', async (data: any) => {
            await this.tableEditRunner.run(data, {
                operationName: 'Delete columns',
                getUndoDescription: (commandData) => `Delete ${Array.isArray(commandData?.indices) ? commandData.indices.length : 0} column(s)`,
                getSuccessMessage: (_result, commandData) => {
                    const count = Array.isArray(commandData?.indices) ? commandData.indices.length : 0;
                    return count > 0 ? `${count} column(s) deleted successfully` : undefined;
                },
                mutate: ({ manager, commandData }) => {
                    if (!Array.isArray(commandData?.indices) || commandData.indices.length === 0) {
                        throw new Error('No column indices provided for deletion');
                    }
                    manager.deleteColumns(commandData.indices);
                },
                getErrorMessage: (error) => `Failed to delete columns: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        });

        const sortCommand = vscode.commands.registerCommand('markdownTableEditor.internal.sort', async (data: any) => {
            await this.handleSort(data);
        });

        const moveRowCommand = vscode.commands.registerCommand('markdownTableEditor.internal.moveRow', async (data: any) => {
            await this.handleMoveRow(data);
        });

        const moveColumnCommand = vscode.commands.registerCommand('markdownTableEditor.internal.moveColumn', async (data: any) => {
            await this.handleMoveColumn(data);
        });

        const exportCSVCommand = vscode.commands.registerCommand('markdownTableEditor.internal.exportCSV', async (data: any) => {
            await this.handleExportCSV(data);
        });

        const importCSVCommand = vscode.commands.registerCommand('markdownTableEditor.internal.importCSV', async (data: any) => {
            await this.handleImportCSV(data);
        });

        this.context.subscriptions.push(
            requestTableDataCommand,
            updateCellCommand,
            bulkUpdateCellsCommand,
            updateHeaderCommand,
            addRowCommand,
            deleteRowCommand,
            deleteRowsCommand,
            addColumnCommand,
            deleteColumnCommand,
            deleteColumnsCommand,
            sortCommand,
            moveRowCommand,
            moveColumnCommand,
            exportCSVCommand,
            importCSVCommand
        );
    }

    private registerWatchers(): void {
        const fileWatcher = vscode.workspace.onDidChangeTextDocument(async (event) => {
            await this.handleFileChange(event);
        });

        this.context.subscriptions.push(fileWatcher);
    }

    private async handleOpenEditor(uri?: vscode.Uri, forceNewPanel?: boolean): Promise<void> {
        try {
            let targetUri = uri;
            if (!targetUri) {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
                    vscode.window.showErrorMessage(vscode.l10n.t('error.noMarkdownFile'));
                    return;
                }
                targetUri = activeEditor.document.uri;
            }

            if (!targetUri) {
                throw new Error(vscode.l10n.t('error.noValidUri'));
            }

            const content = await this.fileHandler.readMarkdownFile(targetUri);
            const ast = this.markdownParser.parseDocument(content);
            const tables = this.markdownParser.findTablesInDocument(ast);

            if (tables.length === 0) {
                vscode.window.showInformationMessage(vscode.l10n.t('error.noTables'));
                return;
            }

            const allTableData: TableData[] = [];
            const tableManagersMap = new Map<number, TableDataManager>();

            tables.forEach((table, index) => {
                const manager = new TableDataManager(table, targetUri!.toString(), index);
                const tableData = manager.getTableData();
                allTableData.push(tableData);
                tableManagersMap.set(index, manager);
            });

            if (!forceNewPanel && this.webviewManager.hasActivePanel()) {
                this.panelSessionManager.clearAll();
            }

            if (forceNewPanel) {
                const { panelId: uniquePanelId } = await this.webviewManager.createTableEditorPanelNewPanel(allTableData, targetUri);
                const updatedTableManagersMap = new Map<number, TableDataManager>();
                tables.forEach((table, index) => {
                    const manager = new TableDataManager(table, uniquePanelId, index);
                    updatedTableManagersMap.set(index, manager);
                });
                this.panelSessionManager.setManagers(uniquePanelId, updatedTableManagersMap);
            } else {
                await this.webviewManager.createTableEditorPanel(allTableData, targetUri);
                this.panelSessionManager.setManagers(targetUri.toString(), tableManagersMap);
            }

            await this.themeApplier.applyConfiguredThemeToPanels();
        } catch (error) {
            console.error('Error opening table editor:', error);
            vscode.window.showErrorMessage(vscode.l10n.t(forceNewPanel ? 'error.openTableEditorNewPanel' : 'error.openTableEditor', error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    private async handleRequestTableData(data: any): Promise<void> {
        try {
            const { uri, panelId, forceRefresh } = data;
            let uriString: string;
            let actualPanelId: string;

            if (uri) {
                uriString = typeof uri === 'string' ? uri : (uri.external || uri.toString());
            } else {
                uriString = this.webviewManager.getActivePanelUri() || '';
            }

            actualPanelId = panelId || uriString;

            if (!uriString) {
                return;
            }

            const panel = this.webviewManager.getPanel(actualPanelId);
            if (!panel) {
                return;
            }

            const fileUri = vscode.Uri.parse(uriString);
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const content = doc.getText();
            const ast = this.markdownParser.parseDocument(content);
            const tables = this.markdownParser.findTablesInDocument(ast);

            if (tables.length === 0) {
                this.webviewManager.sendError(panel, 'No tables found in the file');
                return;
            }

            const allTableData: TableData[] = [];
            const tableManagersMap = new Map<number, TableDataManager>();

            tables.forEach((table, index) => {
                const manager = new TableDataManager(table, actualPanelId, index);
                const tableData = manager.getTableData();
                allTableData.push(tableData);
                tableManagersMap.set(index, manager);
            });

            this.panelSessionManager.setManagers(actualPanelId, tableManagersMap);
            this.webviewManager.updateTableData(panel, allTableData, fileUri);

            (async () => {
                debug('[GitDiffDebug] Starting async Git diff loading.');
                const tablesWithGitDiff = await Promise.all(
                    allTableData.map(async (tableData, index) => {
                        debug(`[GitDiffDebug] Getting diff for table ${index}`);
                        const manager = tableManagersMap.get(index);
                        const tableMarkdown = manager ? manager.serializeToMarkdown() : undefined;
                        const gitDiff = await getGitDiffForTable(
                            fileUri,
                            tableData.metadata.startLine,
                            tableData.metadata.endLine,
                            tableData.rows.length,
                            tableMarkdown
                        );
                        debug(`[GitDiffDebug] Got diff for table ${index}:`, gitDiff.length > 0 ? gitDiff : 'No diff');
                        const columnDiff = detectColumnDiff(gitDiff, tableData.headers.length, tableData.headers);
                        return { ...tableData, gitDiff, columnDiff };
                    })
                );

                try {
                    const diffsPayload = tablesWithGitDiff.map((tbl, idx) => ({
                        tableIndex: idx,
                        gitDiff: tbl.gitDiff,
                        columnDiff: (tbl as any).columnDiff
                    }));
                    this.webviewManager.updateGitDiff(panel, diffsPayload);
                } catch (err) {
                    console.error('[GitDiffDebug] Failed to send git diffs via updateGitDiff:', err);
                    try {
                        this.webviewManager.updateTableData(panel, tablesWithGitDiff, fileUri);
                    } catch (fallbackError) {
                        console.error('[GitDiffDebug] Fallback updateTableData also failed:', fallbackError);
                    }
                }
            })();

            if (!forceRefresh) {
                this.webviewManager.sendSuccess(panel, `Loaded ${tables.length} table${tables.length > 1 ? 's' : ''} successfully`);
            }
        } catch (error) {
            console.error('Error in requestTableData:', error);
            const actualPanelId = data.panelId || data.uri || this.webviewManager.getActivePanelUri();
            const panel = actualPanelId ? this.webviewManager.getPanel(actualPanelId) : null;
            if (panel) {
                this.webviewManager.sendError(panel, `Failed to load table data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private async handleUpdateCell(data: any): Promise<void> {
        try {
            const { uri, panelId, row, col, value, tableIndex } = data;
            const uriObj = typeof uri === 'string' ? vscode.Uri.parse(uri) : uri;
            await this.undoRedoManager.saveState(uriObj, `Update cell (${row}, ${col})`);

            let uriString: string;
            let actualPanelId: string;

            if (uri) {
                uriString = typeof uri === 'string' ? uri : (uri.external || uri.toString());
            } else {
                uriString = this.webviewManager.getActivePanelUri() || '';
            }

            actualPanelId = panelId || uriString;

            if (!uriString) {
                return;
            }

            const panel = this.webviewManager.getPanel(actualPanelId);
            if (!panel) {
                return;
            }

            const tableManagersMap = this.panelSessionManager.getManagers(actualPanelId);
            if (!tableManagersMap) {
                this.webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            let tableDataManager = tableManagersMap.get(targetTableIndex);

            if (!tableDataManager) {
                this.webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            try {
                tableDataManager.updateCell(row, col, value);
            } catch (positionError) {
                if (positionError instanceof Error && positionError.message.includes('Invalid cell position')) {
                    try {
                        const fileUri = vscode.Uri.parse(uriString);
                        const content = await this.fileHandler.readMarkdownFile(fileUri);
                        const ast = this.markdownParser.parseDocument(content);
                        const tables = this.markdownParser.findTablesInDocument(ast);

                        if (targetTableIndex < tables.length) {
                            const newManager = new TableDataManager(tables[targetTableIndex], actualPanelId, targetTableIndex);
                            tableManagersMap.set(targetTableIndex, newManager);
                            tableDataManager = newManager;
                            tableDataManager.updateCell(row, col, value);
                        } else {
                            throw new Error(`Table index ${targetTableIndex} not found in refreshed data`);
                        }
                    } catch (refreshError) {
                        console.error('Could not refresh table data:', refreshError);
                        throw positionError;
                    }
                } else {
                    throw positionError;
                }
            }

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            const fileUri = vscode.Uri.parse(uriString);

            try {
                this.webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // 非致命なので握りつぶす
            }

            const applied = await this.fileHandler.updateTableByIndex(
                fileUri,
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
                // 非致命なので握りつぶす
            }

            this.gitDiffCoordinator.scheduleGitDiffCalculation(fileUri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });
        } catch (error) {
            console.error('Error in updateCell:', error);
            const actualPanelId = data.panelId || data.uri || this.webviewManager.getActivePanelUri();
            const panel = actualPanelId ? this.webviewManager.getPanel(actualPanelId) : null;
            if (panel) {
                this.webviewManager.sendError(panel, `Failed to update cell: ${error instanceof Error ? error.message : 'Unknown error'}`);
                this.webviewManager.sendCellUpdateError(panel, {
                    row: data.row,
                    col: data.col,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    }

    private async handleBulkUpdateCells(data: any): Promise<void> {
        try {
            const { uri, panelId, updates, tableIndex } = data;

            let uriString: string;
            let actualPanelId: string;

            if (uri) {
                uriString = typeof uri === 'string' ? uri : (uri.external || uri.toString());
            } else {
                uriString = this.webviewManager.getActivePanelUri() || '';
            }

            actualPanelId = panelId || uriString;

            if (!uriString || !updates || !Array.isArray(updates)) {
                return;
            }

            const panel = this.webviewManager.getPanel(actualPanelId);
            if (!panel) {
                return;
            }

            const tableManagersMap = this.panelSessionManager.getManagers(actualPanelId);
            if (!tableManagersMap) {
                this.webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            let tableDataManager = tableManagersMap.get(targetTableIndex);

            if (!tableDataManager) {
                this.webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            let maxRow = -1;
            let maxCol = -1;
            for (const update of updates) {
                maxRow = Math.max(maxRow, update.row);
                maxCol = Math.max(maxCol, update.col);
            }

            const currentTableData = tableDataManager.getTableData();
            const neededRows = Math.max(0, maxRow + 1 - currentTableData.rows.length);
            const neededCols = Math.max(0, maxCol + 1 - currentTableData.headers.length);

            if (neededRows > 0) {
                tableDataManager.insertRows(currentTableData.rows.length, neededRows);
            }

            if (neededCols > 0) {
                for (let i = 0; i < neededCols; i++) {
                    const newColIndex = currentTableData.headers.length + i;
                    const columnLetter = String.fromCharCode(65 + (newColIndex % 26));
                    tableDataManager.addColumn(undefined, 1, `Column ${columnLetter}`);
                }
            }

            tableDataManager.batchUpdateCells(updates);

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            const fileUri = vscode.Uri.parse(uriString);

            try {
                this.webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // 非致命なので握りつぶす
            }

            const applied = await this.fileHandler.updateTableByIndex(
                fileUri,
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
                // 非致命なので握りつぶす
            }

            this.gitDiffCoordinator.scheduleGitDiffCalculation(fileUri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });
        } catch (error) {
            console.error('Error in bulkUpdateCells:', error);
            const actualPanelId = data.panelId || data.uri || this.webviewManager.getActivePanelUri();
            const panel = actualPanelId ? this.webviewManager.getPanel(actualPanelId) : null;
            if (panel) {
                this.webviewManager.sendError(panel, `Failed to bulk update cells: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private async handleUpdateHeader(data: any): Promise<void> {
        try {
            const { uri, panelId, col, value, tableIndex } = data;

            let uriString: string;
            let actualPanelId: string;

            if (uri) {
                uriString = typeof uri === 'string' ? uri : (uri.external || uri.toString());
            } else {
                uriString = this.webviewManager.getActivePanelUri() || '';
            }

            actualPanelId = panelId || uriString;

            if (!uriString) {
                return;
            }

            const panel = this.webviewManager.getPanel(actualPanelId);
            if (!panel) {
                return;
            }

            const tableManagersMap = this.panelSessionManager.getManagers(actualPanelId);
            if (!tableManagersMap) {
                this.webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            let tableDataManager = tableManagersMap.get(targetTableIndex);

            if (!tableDataManager) {
                this.webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            try {
                tableDataManager.updateHeader(col, value);
            } catch (positionError) {
                if (positionError instanceof Error && positionError.message.includes('Invalid')) {
                    try {
                        const fileUri = vscode.Uri.parse(uriString);
                        const content = await this.fileHandler.readMarkdownFile(fileUri);
                        const ast = this.markdownParser.parseDocument(content);
                        const tables = this.markdownParser.findTablesInDocument(ast);

                        if (targetTableIndex < tables.length) {
                            const newManager = new TableDataManager(tables[targetTableIndex], actualPanelId, targetTableIndex);
                            tableManagersMap.set(targetTableIndex, newManager);
                            tableDataManager = newManager;
                            tableDataManager.updateHeader(col, value);
                        } else {
                            throw new Error(`Table index ${targetTableIndex} not found in refreshed data`);
                        }
                    } catch (refreshError) {
                        console.error('Could not refresh table data:', refreshError);
                        throw positionError;
                    }
                } else {
                    throw positionError;
                }
            }

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            const fileUri = vscode.Uri.parse(uriString);
            await this.fileHandler.updateTableByIndex(
                fileUri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            this.gitDiffCoordinator.scheduleGitDiffCalculation(fileUri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });
        } catch (error) {
            console.error('Error in updateHeader:', error);
            const actualPanelId = data.panelId || data.uri || this.webviewManager.getActivePanelUri();
            const panel = actualPanelId ? this.webviewManager.getPanel(actualPanelId) : null;
            if (panel) {
                this.webviewManager.sendError(panel, `Failed to update header: ${error instanceof Error ? error.message : 'Unknown error'}`);
                this.webviewManager.sendHeaderUpdateError(panel, {
                    col: data.col,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    }

    private async handleSort(data: any): Promise<void> {
        try {
            const { uri: rawUri, panelId, column, direction, tableIndex } = data;
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

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                this.webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            tableDataManager.sortByColumn(column, direction);

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            try {
                this.webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // 非致命なので握りつぶす
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
                // 非致命なので握りつぶす
            }

            this.gitDiffCoordinator.scheduleGitDiffCalculation(uri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });

            this.webviewManager.sendSuccess(panel, `Table sorted by column ${column} (${direction})`);
        } catch (error) {
            console.error('Error in sort:', error);
            const { panel } = this.panelSessionManager.resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                this.webviewManager.sendError(panel, `Failed to sort table: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private async handleMoveRow(data: any): Promise<void> {
        try {
            const { uri: rawUri, panelId, fromIndex, toIndex, tableIndex } = data;
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

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                this.webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            tableDataManager.moveRow(fromIndex, toIndex);

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            try {
                this.webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // 非致命なので握りつぶす
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
                // 非致命なので握りつぶす
            }

            this.gitDiffCoordinator.scheduleGitDiffCalculation(uri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });

            this.webviewManager.sendSuccess(panel, `Row moved from ${fromIndex} to ${toIndex}`);
        } catch (error) {
            console.error('Error in moveRow:', error);
            const { panel } = this.panelSessionManager.resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                this.webviewManager.sendError(panel, `Failed to move row: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private async handleMoveColumn(data: any): Promise<void> {
        try {
            const { uri: rawUri, panelId, fromIndex, toIndex, tableIndex } = data;
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

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                this.webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            tableDataManager.moveColumn(fromIndex, toIndex);

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            try {
                this.webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // 非致命なので握りつぶす
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
                // 非致命なので握りつぶす
            }

            this.gitDiffCoordinator.scheduleGitDiffCalculation(uri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });

            this.webviewManager.sendSuccess(panel, `Column moved from ${fromIndex} to ${toIndex}`);
        } catch (error) {
            console.error('Error in moveColumn:', error);
            const { panel } = this.panelSessionManager.resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                this.webviewManager.sendError(panel, `Failed to move column: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private async handleExportCSV(data: any): Promise<void> {
        try {
            const { uri: rawUri, panelId, data: exportData } = data;
            const { uri, uriString, panel } = this.panelSessionManager.resolvePanelContext(rawUri, panelId);
            const csvContent = exportData?.csvContent;
            const filename = exportData?.filename;
            const encoding = exportData?.encoding || 'utf8';

            if (!panel) {
                return;
            }

            if (!uriString || !uri) {
                this.webviewManager.sendError(panel, 'Missing URI for CSV export');
                return;
            }

            if (!csvContent || typeof csvContent !== 'string' || csvContent.length === 0) {
                this.webviewManager.sendError(panel, 'Invalid or empty CSV content');
                return;
            }

            let defaultFilename = filename;
            if (uri.fsPath) {
                const baseName = path.basename(uri.fsPath, path.extname(uri.fsPath));
                defaultFilename = `${baseName}.csv`;
            }

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            const defaultPath = workspaceFolder
                ? vscode.Uri.joinPath(workspaceFolder.uri, defaultFilename)
                : vscode.Uri.joinPath(vscode.Uri.file(path.dirname(uri.fsPath)), defaultFilename);

            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: defaultPath,
                filters: {
                    'CSV Files': ['csv'],
                    'All Files': ['*']
                }
            });

            if (saveUri) {
                let contentToWrite = csvContent;
                let buffer: Buffer;

                if (encoding === 'sjis') {
                    const { normalized, replacements } = normalizeForShiftJisExport(csvContent);
                    if (replacements.length > 0) {
                        const examples = Array.from(new Set(replacements.map(r => `${r.from}→${r.to}`))).slice(0, 5).join('、');
                        const examplesStr = `${examples}${replacements.length > 5 ? '、他' : ''}`;
                        const confirm = await vscode.window.showWarningMessage(
                            vscode.l10n.t('csv.shiftJisWarning', examplesStr),
                            { modal: true },
                            vscode.l10n.t('csv.convertAndSave'),
                            vscode.l10n.t('csv.doNotConvert')
                        );
                        if (confirm === undefined) {
                            return;
                        }
                        if (confirm === vscode.l10n.t('csv.convertAndSave')) {
                            contentToWrite = normalized;
                        } else if (confirm === vscode.l10n.t('csv.doNotConvert')) {
                            contentToWrite = csvContent;
                        }
                    }

                    try {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const iconv = require('iconv-lite');
                        buffer = iconv.encode(contentToWrite, 'shift_jis');
                    } catch (error) {
                        console.warn('iconv-lite encoding failed, falling back to UTF-8:', error);
                        buffer = Buffer.from(contentToWrite, 'utf8');
                    }
                } else {
                    buffer = Buffer.from(contentToWrite, 'utf8');
                }

                await vscode.workspace.fs.writeFile(saveUri, buffer);

                const encodingLabel = encoding === 'sjis' ? vscode.l10n.t('csv.encoding.sjis') : vscode.l10n.t('csv.encoding.utf8');
                this.webviewManager.sendSuccess(panel, vscode.l10n.t('success.csvExported', saveUri.fsPath, encodingLabel));
            }
        } catch (error) {
            console.error('Error in exportCSV:', error);
            const { panel } = this.panelSessionManager.resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                this.webviewManager.sendError(panel, `Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private async handleImportCSV(data: any): Promise<void> {
        try {
            const { uri: rawUri, panelId, tableIndex } = data || {};
            const { uri, uriString, panel, tableManagersMap } = this.panelSessionManager.resolvePanelContext(rawUri, panelId);

            if (!uriString || !uri) {
                return;
            }
            if (!panel) {
                return;
            }
            if (!tableManagersMap) {
                this.webviewManager.sendError(panel, vscode.l10n.t('error.tableManagersNotFound'));
                return;
            }

            const targetTableIndex = typeof tableIndex === 'number' ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                this.webviewManager.sendError(panel, vscode.l10n.t('error.tableManagerNotFoundForIndex', targetTableIndex));
                return;
            }

            const openUris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'CSV Files': ['csv'],
                    'All Files': ['*']
                },
                title: vscode.l10n.t('csv.selectFileTitle')
            });
            if (!openUris || openUris.length === 0) {
                return;
            }
            const csvUri = openUris[0];

            const buf = await vscode.workspace.fs.readFile(csvUri);
            const enc = detectTextEncoding(Buffer.from(buf));
            const textRaw = decodeBuffer(Buffer.from(buf), enc);
            const { normalized: text } = normalizeForImport(textRaw);

            const rows = parseCsv(text);
            if (!rows || rows.length === 0) {
                this.webviewManager.sendError(panel, vscode.l10n.t('error.csvEmpty'));
                return;
            }
            const hasAnyValue = rows.some(r => r.some(c => (c || '').trim().length > 0));
            if (!hasAnyValue) {
                this.webviewManager.sendError(panel, vscode.l10n.t('error.csvNoValues'));
                return;
            }
            const rectangular = toRectangular(rows);

            const headersNormalized = rectangular.headers.map(h => (h ?? '').replace(/\n/g, '<br/>'));
            const rowsNormalized = rectangular.rows.map(r => r.map(c => (c ?? '').replace(/\n/g, '<br/>')));

            const confirm = await vscode.window.showWarningMessage(
                vscode.l10n.t('csv.importConfirm'),
                { modal: true },
                vscode.l10n.t('csv.yes')
            );
            if (confirm !== vscode.l10n.t('csv.yes')) {
                return;
            }

            await this.undoRedoManager.saveState(uri, 'Import CSV');

            tableDataManager.replaceContents(headersNormalized, rowsNormalized);

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await this.fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            const allTableData: TableData[] = [];
            tableManagersMap.forEach((manager, idx) => {
                allTableData[idx] = manager.getTableData();
            });

            const tablesWithGitDiff = await Promise.all(
                allTableData.map(async (tableData, index) => {
                    const manager = tableManagersMap.get(index);
                    const tableMarkdown = manager ? manager.serializeToMarkdown() : undefined;
                    const gitDiff = await getGitDiffForTable(
                        uri,
                        tableData.metadata.startLine,
                        tableData.metadata.endLine,
                        tableData.rows.length,
                        tableMarkdown
                    );
                    const columnDiff = detectColumnDiff(gitDiff, tableData.headers.length, tableData.headers);
                    return { ...tableData, gitDiff, columnDiff };
                })
            );

            this.webviewManager.updateTableData(panel, tablesWithGitDiff, uri);

            const label = enc === 'sjis' ? vscode.l10n.t('csv.encoding.sjis') : vscode.l10n.t('csv.encoding.utf8');
            this.webviewManager.sendSuccess(panel, vscode.l10n.t('success.csvImported', csvUri.fsPath, label));
        } catch (error) {
            console.error('Error in importCSV:', error);
            const { panel } = this.panelSessionManager.resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                this.webviewManager.sendError(panel, `Failed to import CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    private async handleFileChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        const changedUri = event.document.uri;

        if (event.document.languageId !== 'markdown') {
            return;
        }

        const filePanels = this.webviewManager.getPanelsForFile(changedUri.toString());

        if (filePanels.size === 0) {
            return;
        }

        try {
            const content = event.document.getText();
            const ast = this.markdownParser.parseDocument(content);
            const tables = this.markdownParser.findTablesInDocument(ast);

            if (tables.length === 0) {
                return;
            }

            for (const [panelId, panel] of filePanels.entries()) {
                const allTableData: TableData[] = [];
                const tableManagersMap = new Map<number, TableDataManager>();

                tables.forEach((table, index) => {
                    const manager = new TableDataManager(table, panelId, index);
                    const tableData = manager.getTableData();
                    allTableData.push(tableData);
                    tableManagersMap.set(index, manager);
                });

                this.panelSessionManager.setManagers(panelId, tableManagersMap);

                try {
                    const emptyDiffs = Array.from(tableManagersMap.keys()).map(idx => ({
                        tableIndex: idx,
                        gitDiff: []
                    }));
                    if (emptyDiffs.length > 0) {
                        this.webviewManager.updateGitDiff(panel, emptyDiffs);
                        this.gitDiffCoordinator.resetLastSent(changedUri.toString(), tableManagersMap);
                    }
                } catch (e) {
                    // 非致命
                }

                const tablesWithGitDiff = await Promise.all(
                    allTableData.map(async (tableData, index) => {
                        const manager = tableManagersMap.get(index);
                        const tableMarkdown = manager ? manager.serializeToMarkdown() : undefined;
                        const gitDiff = await getGitDiffForTable(
                            changedUri,
                            tableData.metadata.startLine,
                            tableData.metadata.endLine,
                            tableData.rows.length,
                            tableMarkdown
                        );
                        const columnDiff = detectColumnDiff(gitDiff, tableData.headers.length, tableData.headers);
                        return { ...tableData, gitDiff, columnDiff };
                    })
                );

                this.webviewManager.updateTableData(panel, tablesWithGitDiff, changedUri);
            }
        } catch (error) {
            console.error('Error updating panels after file change:', error);
            for (const panel of filePanels.values()) {
                this.webviewManager.sendError(panel, `Failed to update from file change: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
}