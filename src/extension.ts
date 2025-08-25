import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { TableDataManager, TableData } from './tableDataManager';
import { MarkdownParser } from './markdownParser';
import { getFileHandler } from './fileHandler';
import { buildThemeVariablesCss, getInstalledColorThemes } from './themeUtils';

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown Table Editor extension is now active!');

    // Initialize managers
    const webviewManager = WebviewManager.getInstance(context);
    const markdownParser = new MarkdownParser();
    const fileHandler = getFileHandler();

    console.log('Managers initialized, registering commands...');

    // Helper: apply current configured theme to all open panels
    const applyConfiguredThemeToPanels = async () => {
        try {
            const config = vscode.workspace.getConfiguration('markdownTableEditor');
            const selectedTheme = config.get<string>('theme', 'inherit');
            const themeVars = await buildThemeVariablesCss(selectedTheme);
            webviewManager.broadcastMessage('applyThemeVariables', { cssText: themeVars.cssText });
        } catch (err) {
            console.warn('Failed to apply theme to panels:', err);
        }
    };

    // Apply once on activation so再起動後も即時反映（パネル作成後にも個別適用されます）
    applyConfiguredThemeToPanels();

    // Register commands
    const openEditorCommand = vscode.commands.registerCommand('markdownTableEditor.openEditor', async (uri?: vscode.Uri) => {
        try {
            console.log('Opening table editor...');

            // Get the active editor if no URI provided
            if (!uri) {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
                    vscode.window.showErrorMessage('Please open a Markdown file first.');
                    return;
                }
                uri = activeEditor.document.uri;
            }

            if (!uri) {
                throw new Error('No valid URI available');
            }

            console.log('Reading markdown file:', uri.toString());

            // Read the markdown file
            const content = await fileHandler.readMarkdownFile(uri);
            const ast = markdownParser.parseDocument(content);
            const tables = markdownParser.findTablesInDocument(ast);

            console.log('Found tables:', tables.length);

            if (tables.length === 0) {
                vscode.window.showInformationMessage('No tables found in this Markdown file.');
                return;
            }

            let selectedTableNode;
            let selectedTableIndex = 0;

            if (tables.length === 1) {
                // Only one table, use it directly
                selectedTableNode = tables[0];
                selectedTableIndex = 0;
            } else {
                // Multiple tables, don't prompt user - show all in webview with tabs
                selectedTableNode = tables[0]; // Default to first table for backward compatibility
                selectedTableIndex = 0;
            }

            console.log('Using table:', selectedTableNode);

            // Create TableDataManager instances for all tables
            const allTableData: TableData[] = [];
            const tableManagersMap = new Map<number, TableDataManager>();

            tables.forEach((table, index) => {
                const manager = new TableDataManager(table, uri!.toString(), index);
                const tableData = manager.getTableData();
                allTableData.push(tableData);
                tableManagersMap.set(index, manager);
            });

            // If any table editor is already open, clear the old managers first
            // to ensure we're working with the correct file's data
            if (webviewManager.hasActivePanel()) {
                // Clear all existing managers to prevent conflicts
                activeMultiTableManagers.clear();
                activeTableManagers.clear();
            }

            // Store managers for all tables with proper indexing
            activeMultiTableManagers.set(uri!.toString(), tableManagersMap);

            // Also store the primary manager for backward compatibility
            const primaryManager = tableManagersMap.get(selectedTableIndex);
            if (primaryManager) {
                activeTableManagers.set(uri!.toString(), primaryManager);
            }

            console.log('Creating webview panel...');

            // Create and show the webview panel with all tables
            const panel = webviewManager.createTableEditorPanel(allTableData, uri);

            // Apply configured theme to the panel (async, after panel is ready)
            applyConfiguredThemeToPanels();

            // Wait a moment to ensure panel is stable before showing success message
            setTimeout(() => {
                console.log('Webview panel created successfully');
            }, 100);

            const tableCount = allTableData.length;
            const primaryTable = allTableData[selectedTableIndex];
            vscode.window.showInformationMessage(`Table editor opened with ${tableCount} table${tableCount > 1 ? 's' : ''} (${primaryTable.rows.length} rows, ${primaryTable.headers.length} columns).`);
        } catch (error) {
            console.error('Error opening table editor:', error);
            vscode.window.showErrorMessage(`Failed to open table editor: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    // Select theme command
    const selectThemeCommand = vscode.commands.registerCommand('markdownTableEditor.selectTheme', async () => {
        try {
            const themes = getInstalledColorThemes();
            const items: vscode.QuickPickItem[] = [
                { label: '$(color-mode) Inherit VS Code Theme', description: 'inherit' }
            ].concat(
                themes.map(t => ({ label: t.label, description: t.id }))
            );
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select Table Editor Theme',
                matchOnDescription: true
            });
            if (!picked) return;
            const themeId = picked.description === 'inherit' ? 'inherit' : picked.description || 'inherit';
            await vscode.workspace.getConfiguration('markdownTableEditor').update('theme', themeId, true);
            await applyConfiguredThemeToPanels();
            vscode.window.showInformationMessage('Markdown Table Editor theme updated.');
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to update Table Editor theme: ${err instanceof Error ? err.message : String(err)}`);
        }
    });

    // Store active table data managers by URI and table index
    const activeTableManagers = new Map<string, TableDataManager>();
    const activeMultiTableManagers = new Map<string, Map<number, TableDataManager>>();

    // Register internal commands for webview communication
    const requestTableDataCommand = vscode.commands.registerCommand('markdownTableEditor.internal.requestTableData', async (data: any) => {
        try {
            console.log('Internal command: requestTableData', data);
            const { uri, panelId, forceRefresh } = data;
            
            // Get the URI string to use for manager lookup
            const uriString = uri || webviewManager.getActivePanelUri();
            if (!uriString) {
                console.error('No URI available for requestTableData command');
                return;
            }
            
            const panel = webviewManager.getPanel(uriString);
            if (!panel) {
                console.error('Panel not found for URI:', uriString);
                return;
            }

            // Always re-read file to get all tables
            console.log('Reading fresh data from file for:', uriString, forceRefresh ? '(forced refresh)' : '(request)');

            // Read and parse the file
            const fileUri = vscode.Uri.parse(uriString);
            const content = await fileHandler.readMarkdownFile(fileUri);
            const ast = markdownParser.parseDocument(content);
            const tables = markdownParser.findTablesInDocument(ast);

            if (tables.length > 0) {
                // Create managers for all tables
                const allTableData: TableData[] = [];
                const tableManagersMap = new Map<number, TableDataManager>();

                tables.forEach((table, index) => {
                    const manager = new TableDataManager(table, uriString, index);
                    const tableData = manager.getTableData();
                    allTableData.push(tableData);
                    tableManagersMap.set(index, manager);
                });

                // Store managers for all tables
                activeMultiTableManagers.set(uriString, tableManagersMap);

                // Also store the primary manager for backward compatibility (first table)
                const primaryManager = tableManagersMap.get(0);
                if (primaryManager) {
                    activeTableManagers.set(uriString, primaryManager);
                }

                // Send all table data to webview
                webviewManager.updateTableData(panel, allTableData, fileUri);

                // Don't send success message for refreshes to avoid spam
                if (!forceRefresh) {
                    webviewManager.sendSuccess(panel, `Loaded ${tables.length} table${tables.length > 1 ? 's' : ''} successfully`);
                }

                console.log(`Table data refreshed: ${tables.length} tables loaded`);
            } else {
                webviewManager.sendError(panel, 'No tables found in the file');
                return;
            }
        } catch (error) {
            console.error('Error in requestTableData:', error);
            const uriString = data.uri || webviewManager.getActivePanelUri();
            const panel = uriString ? webviewManager.getPanel(uriString) : null;
            if (panel) {
                webviewManager.sendError(panel, `Failed to load table data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    // 設定変更監視
    const configWatcher = vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('markdownTableEditor.theme')) {
            await applyConfiguredThemeToPanels();
        }
    });

    // VSCodeのテーマ切替時にも再適用（inherit 以外でも強制上書きを維持）
    const colorThemeWatcher = vscode.window.onDidChangeActiveColorTheme(async () => {
        await applyConfiguredThemeToPanels();
    });

    // Register more internal commands
    const updateCellCommand = vscode.commands.registerCommand('markdownTableEditor.internal.updateCell', async (data: any) => {
        try {
            console.log('Internal command: updateCell', data);
            const { uri, panelId, row, col, value, tableIndex } = data;
            
            // Get the URI string to use for manager lookup
            const uriString = uri || webviewManager.getActivePanelUri();
            if (!uriString) {
                console.error('No URI available for updateCell command');
                return;
            }
            
            const panel = webviewManager.getPanel(uriString);
            if (!panel) {
                console.error('Panel not found for URI:', uriString);
                return;
            }

            // Get the specific table manager by index
            const tableManagersMap = activeMultiTableManagers.get(uriString);
            if (!tableManagersMap) {
                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            // Use tableIndex from data, or fall back to 0
            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            let tableDataManager = tableManagersMap.get(targetTableIndex);

            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Try to update the cell, if it fails due to invalid position, refresh the table data
            try {
                tableDataManager.updateCell(row, col, value);
            } catch (positionError) {
                if (positionError instanceof Error && positionError.message.includes('Invalid cell position')) {
                    console.log('Invalid position detected, attempting to refresh table data from file...');
                    try {
                        // Read fresh content from file and re-parse
                        const fileUri = vscode.Uri.parse(uriString);
                        const content = await fileHandler.readMarkdownFile(fileUri);
                        const ast = markdownParser.parseDocument(content);
                        const tables = markdownParser.findTablesInDocument(ast);

                        if (targetTableIndex < tables.length) {
                            // Create new manager with fresh data
                            const newManager = new TableDataManager(tables[targetTableIndex], uriString, targetTableIndex);
                            tableManagersMap.set(targetTableIndex, newManager);
                            tableDataManager = newManager;
                            console.log('Table data refreshed successfully');

                            // Try the update again with fresh data
                            tableDataManager.updateCell(row, col, value);
                        } else {
                            throw new Error(`Table index ${targetTableIndex} not found in refreshed data`);
                        }
                    } catch (refreshError) {
                        console.error('Could not refresh table data:', refreshError);
                        throw positionError; // Re-throw the original error
                    }
                } else {
                    throw positionError; // Re-throw if it's not a position error
                }
            }

            // Update the file using table index for more accurate positioning
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            console.log(`Updating table at index ${tableData.metadata.tableIndex}, lines ${tableData.metadata.startLine}-${tableData.metadata.endLine}`);

            const fileUri = vscode.Uri.parse(uriString);
            await fileHandler.updateTableByIndex(
                fileUri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Don't send any update back to webview to avoid re-rendering
            // The webview has already updated the cell locally
            console.log('Cell update completed successfully without triggering webview re-render');
        } catch (error) {
            console.error('Error in updateCell:', error);
            const uriString = data.uri || webviewManager.getActivePanelUri();
            const panel = uriString ? webviewManager.getPanel(uriString) : null;
            if (panel) {
                // Send error with original position information for potential rollback
                webviewManager.sendError(panel, `Failed to update cell: ${error instanceof Error ? error.message : 'Unknown error'}`);
                webviewManager.sendCellUpdateError(panel, {
                    row: data.row,
                    col: data.col,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    });

    const updateHeaderCommand = vscode.commands.registerCommand('markdownTableEditor.internal.updateHeader', async (data: any) => {
        try {
            console.log('Internal command: updateHeader', data);
            const { uri, panelId, col, value, tableIndex } = data;
            
            // Get the URI string to use for manager lookup
            const uriString = uri || webviewManager.getActivePanelUri();
            if (!uriString) {
                console.error('No URI available for updateHeader command');
                return;
            }
            
            const panel = webviewManager.getPanel(uriString);
            if (!panel) {
                console.error('Panel not found for URI:', uriString);
                return;
            }

            // Get the specific table manager by index
            const tableManagersMap = activeMultiTableManagers.get(uriString);
            if (!tableManagersMap) {
                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            // Use tableIndex from data, or fall back to 0
            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            let tableDataManager = tableManagersMap.get(targetTableIndex);

            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Try to update the header, if it fails due to invalid position, refresh the table data
            try {
                tableDataManager.updateHeader(col, value);
            } catch (positionError) {
                if (positionError instanceof Error && positionError.message.includes('Invalid')) {
                    console.log('Invalid position detected, attempting to refresh table data from file...');
                    try {
                        // Read fresh content from file and re-parse
                        const fileUri = vscode.Uri.parse(uriString);
                        const content = await fileHandler.readMarkdownFile(fileUri);
                        const ast = markdownParser.parseDocument(content);
                        const tables = markdownParser.findTablesInDocument(ast);

                        if (targetTableIndex < tables.length) {
                            // Create new manager with fresh data
                            const newManager = new TableDataManager(tables[targetTableIndex], uriString, targetTableIndex);
                            tableManagersMap.set(targetTableIndex, newManager);
                            tableDataManager = newManager;
                            console.log('Table data refreshed successfully');

                            // Try the update again with fresh data
                            tableDataManager.updateHeader(col, value);
                        } else {
                            throw new Error(`Table index ${targetTableIndex} not found in refreshed data`);
                        }
                    } catch (refreshError) {
                        console.error('Could not refresh table data:', refreshError);
                        throw positionError; // Re-throw the original error
                    }
                } else {
                    throw positionError; // Re-throw if it's not a position error
                }
            }

            // Update the file using table index for more accurate positioning
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            console.log(`Updating table header at index ${tableData.metadata.tableIndex}, lines ${tableData.metadata.startLine}-${tableData.metadata.endLine}`);

            const fileUri = vscode.Uri.parse(uriString);
            await fileHandler.updateTableByIndex(
                fileUri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Don't send any update back to webview to avoid re-rendering
            // The webview has already updated the header locally
            console.log('Header update completed successfully without triggering webview re-render');
        } catch (error) {
            console.error('Error in updateHeader:', error);
            const uriString = data.uri || webviewManager.getActivePanelUri();
            const panel = uriString ? webviewManager.getPanel(uriString) : null;
            if (panel) {
                // Send error with original position information for potential rollback
                webviewManager.sendError(panel, `Failed to update header: ${error instanceof Error ? error.message : 'Unknown error'}`);
                webviewManager.sendHeaderUpdateError(panel, {
                    col: data.col,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    });

    const addRowCommand = vscode.commands.registerCommand('markdownTableEditor.internal.addRow', async (data: any) => {
        try {
            console.log('Internal command: addRow', data);
            const { uri, panelId, index, tableIndex } = data;
            const panel = webviewManager.getPanel(uri);

            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Get the specific table manager by index
            const tableManagersMap = activeMultiTableManagers.get(uri.toString());
            if (!tableManagersMap) {
                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Add the row
            tableDataManager.addRow(index);

            // Update the file using table index for more accurate positioning
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Refresh all table data and send back to webview
            const allTableData: TableData[] = [];
            tableManagersMap.forEach((manager, index) => {
                allTableData[index] = manager.getTableData();
            });

            webviewManager.updateTableData(panel, allTableData, uri);
            webviewManager.sendSuccess(panel, 'Row added successfully');
        } catch (error) {
            console.error('Error in addRow:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to add row: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const deleteRowCommand = vscode.commands.registerCommand('markdownTableEditor.internal.deleteRow', async (data: any) => {
        try {
            console.log('Internal command: deleteRow', data);
            const { uri, panelId, index, tableIndex } = data;
            const panel = webviewManager.getPanel(uri);

            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Get the specific table manager by index
            const tableManagersMap = activeMultiTableManagers.get(uri.toString());
            if (!tableManagersMap) {
                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Delete the row
            tableDataManager.deleteRow(index);

            // Update the file using table index for more accurate positioning
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Refresh all table data and send back to webview
            const allTableData: TableData[] = [];
            tableManagersMap.forEach((manager, index) => {
                allTableData[index] = manager.getTableData();
            });

            webviewManager.updateTableData(panel, allTableData, uri);
            webviewManager.sendSuccess(panel, 'Row deleted successfully');
        } catch (error) {
            console.error('Error in deleteRow:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to delete row: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const addColumnCommand = vscode.commands.registerCommand('markdownTableEditor.internal.addColumn', async (data: any) => {
        try {
            console.log('Internal command: addColumn', data);
            const { uri, panelId, index, header, tableIndex } = data;
            const panel = webviewManager.getPanel(uri);

            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Get the specific table manager by index
            const tableManagersMap = activeMultiTableManagers.get(uri.toString());
            if (!tableManagersMap) {
                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Add the column
            tableDataManager.addColumn(index, header);

            // Update the file using table index for more accurate positioning
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Refresh all table data and send back to webview
            const allTableData: TableData[] = [];
            tableManagersMap.forEach((manager, index) => {
                allTableData[index] = manager.getTableData();
            });

            webviewManager.updateTableData(panel, allTableData, uri);
            webviewManager.sendSuccess(panel, 'Column added successfully');
        } catch (error) {
            console.error('Error in addColumn:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to add column: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const deleteColumnCommand = vscode.commands.registerCommand('markdownTableEditor.internal.deleteColumn', async (data: any) => {
        try {
            console.log('Internal command: deleteColumn', data);
            const { uri, panelId, index, tableIndex } = data;
            const panel = webviewManager.getPanel(uri);

            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Get the specific table manager by index
            const tableManagersMap = activeMultiTableManagers.get(uri.toString());
            if (!tableManagersMap) {
                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Delete the column
            tableDataManager.deleteColumn(index);

            // Update the file using table index for more accurate positioning
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Refresh all table data and send back to webview
            const allTableData: TableData[] = [];
            tableManagersMap.forEach((manager, index) => {
                allTableData[index] = manager.getTableData();
            });

            webviewManager.updateTableData(panel, allTableData, uri);
            webviewManager.sendSuccess(panel, 'Column deleted successfully');
        } catch (error) {
            console.error('Error in deleteColumn:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to delete column: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const sortCommand = vscode.commands.registerCommand('markdownTableEditor.internal.sort', async (data: any) => {
        try {
            console.log('Internal command: sort', data);
            const { uri, panelId, column, direction, tableIndex } = data;
            const panel = webviewManager.getPanel(uri);

            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Get the specific table manager by index
            const tableManagersMap = activeMultiTableManagers.get(uri.toString());
            if (!tableManagersMap) {
                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Sort the table
            tableDataManager.sortByColumn(column, direction);

            // Update the file using table index for more accurate positioning
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Refresh all table data and send back to webview
            const allTableData: TableData[] = [];
            tableManagersMap.forEach((manager, index) => {
                allTableData[index] = manager.getTableData();
            });

            webviewManager.updateTableData(panel, allTableData, uri);
            webviewManager.sendSuccess(panel, `Table sorted by column ${column} (${direction})`);
        } catch (error) {
            console.error('Error in sort:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to sort table: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const moveRowCommand = vscode.commands.registerCommand('markdownTableEditor.internal.moveRow', async (data: any) => {
        try {
            console.log('Internal command: moveRow', data);
            const { uri, panelId, from, to, tableIndex } = data;
            const panel = webviewManager.getPanel(uri);

            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Get the specific table manager by index
            const tableManagersMap = activeMultiTableManagers.get(uri.toString());
            if (!tableManagersMap) {
                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Move the row
            tableDataManager.moveRow(from, to);

            // Update the file using table index for more accurate positioning
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Refresh all table data and send back to webview
            const allTableData: TableData[] = [];
            tableManagersMap.forEach((manager, index) => {
                allTableData[index] = manager.getTableData();
            });

            webviewManager.updateTableData(panel, allTableData, uri);
            webviewManager.sendSuccess(panel, `Row moved from ${from} to ${to}`);
        } catch (error) {
            console.error('Error in moveRow:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to move row: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const moveColumnCommand = vscode.commands.registerCommand('markdownTableEditor.internal.moveColumn', async (data: any) => {
        try {
            console.log('Internal command: moveColumn', data);
            const { uri, panelId, from, to, tableIndex } = data;
            const panel = webviewManager.getPanel(uri);

            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Get the specific table manager by index
            const tableManagersMap = activeMultiTableManagers.get(uri.toString());
            if (!tableManagersMap) {
                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Move the column
            tableDataManager.moveColumn(from, to);

            // Update the file using table index for more accurate positioning
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Refresh all table data and send back to webview
            const allTableData: TableData[] = [];
            tableManagersMap.forEach((manager, index) => {
                allTableData[index] = manager.getTableData();
            });

            webviewManager.updateTableData(panel, allTableData, uri);
            webviewManager.sendSuccess(panel, `Column moved from ${from} to ${to}`);
        } catch (error) {
            console.error('Error in moveColumn:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to move column: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const exportCSVCommand = vscode.commands.registerCommand('markdownTableEditor.internal.exportCSV', async (data: any) => {
        try {
            console.log('Internal command: exportCSV', data);
            const { uri, panelId, csvContent, filename, encoding = 'utf8' } = data;
            const panel = webviewManager.getPanel(uri);

            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Generate default filename based on the current markdown file
            let defaultFilename = filename;
            if (uri && uri.fsPath) {
                const path = require('path');
                const baseName = path.basename(uri.fsPath, path.extname(uri.fsPath));
                defaultFilename = `${baseName}.csv`;
            }

            // Show save dialog with improved default path
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            const defaultPath = workspaceFolder
                ? vscode.Uri.joinPath(workspaceFolder.uri, defaultFilename)
                : vscode.Uri.joinPath(vscode.Uri.file(require('path').dirname(uri.fsPath)), defaultFilename);

            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: defaultPath,
                filters: {
                    'CSV Files': ['csv'],
                    'All Files': ['*']
                }
            });

            if (saveUri) {
                let buffer: Buffer;

                // Handle encoding
                if (encoding === 'sjis') {
                    try {
                        // Convert to Shift_JIS encoding
                        const iconv = require('iconv-lite');
                        buffer = iconv.encode(csvContent, 'shift_jis');
                        console.log('CSV content encoded to Shift_JIS');
                    } catch (error) {
                        // Fallback to UTF-8 if iconv-lite is not available
                        console.warn('iconv-lite encoding failed, falling back to UTF-8:', error);
                        buffer = Buffer.from(csvContent, 'utf8');
                    }
                } else {
                    // UTF-8 encoding (default)
                    buffer = Buffer.from(csvContent, 'utf8');
                }

                // Write CSV content to file
                await vscode.workspace.fs.writeFile(saveUri, buffer);

                const encodingLabel = encoding === 'sjis' ? 'Shift_JIS' : 'UTF-8';
                webviewManager.sendSuccess(panel, `CSV exported successfully to ${saveUri.fsPath} (${encodingLabel})`);
                console.log('CSV exported to:', saveUri.fsPath, 'with encoding:', encodingLabel);
            } else {
                console.log('CSV export cancelled by user');
            }
        } catch (error) {
            console.error('Error in exportCSV:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    context.subscriptions.push(
        openEditorCommand,
        selectThemeCommand,
        requestTableDataCommand,
        configWatcher,
        colorThemeWatcher,
        updateCellCommand,
        updateHeaderCommand,
        addRowCommand,
        deleteRowCommand,
        addColumnCommand,
        deleteColumnCommand,
        sortCommand,
        moveRowCommand,
        moveColumnCommand,
        exportCSVCommand
    );

    console.log('All commands registered successfully!');
}

export function deactivate() {
    console.log('Markdown Table Editor extension is now deactivating...');

    try {
        // Dispose WebviewManager resources
        const webviewManager = WebviewManager.getInstance();
        if (webviewManager) {
            webviewManager.dispose();
            console.log('WebviewManager disposed');
        }
    } catch (error) {
        console.error('Error disposing WebviewManager:', error);
    }

    try {
        // Dispose FileHandler resources
        const { disposeFileHandler } = require('./fileHandler');
        disposeFileHandler();
        console.log('FileHandler disposed');
    } catch (error) {
        console.error('Error disposing FileHandler:', error);
    }

    console.log('Markdown Table Editor extension deactivated successfully');
}