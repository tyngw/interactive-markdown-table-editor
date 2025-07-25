import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { TableDataManager, TableData } from './tableDataManager';
import { MarkdownParser } from './markdownParser';
import { getFileHandler } from './fileHandler';

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown Table Editor extension is now active!');
    
    // Show activation message
    vscode.window.showInformationMessage('Markdown Table Editor activated!');

    // Initialize managers
    const webviewManager = WebviewManager.getInstance(context);
    const markdownParser = new MarkdownParser();
    const fileHandler = getFileHandler();

    console.log('Managers initialized, registering commands...');

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
            const allTableData: TableData[] = tables.map((table, index) => {
                const manager = new TableDataManager(table, uri!.toString(), index);
                return manager.getTableData();
            });
            
            // Store managers for all tables
            allTableData.forEach((tableData, index) => {
                const manager = new TableDataManager(tables[index], uri!.toString(), index);
                activeTableManagers.set(`${uri!.toString()}_table_${index}`, manager);
            });
            
            // Also store the primary manager for backward compatibility
            const primaryManager = new TableDataManager(selectedTableNode, uri!.toString(), selectedTableIndex);
            activeTableManagers.set(uri!.toString(), primaryManager);

            console.log('Creating webview panel...');
            
            // Create and show the webview panel with all tables
            const panel = webviewManager.createTableEditorPanel(allTableData, uri);
            
            console.log('Webview panel created successfully');
            
            const tableCount = allTableData.length;
            const primaryTable = allTableData[selectedTableIndex];
            vscode.window.showInformationMessage(`Table editor opened with ${tableCount} table${tableCount > 1 ? 's' : ''} (${primaryTable.rows.length} rows, ${primaryTable.headers.length} columns).`);
        } catch (error) {
            console.error('Error opening table editor:', error);
            vscode.window.showErrorMessage(`Failed to open table editor: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    // Store active table data managers by URI
    const activeTableManagers = new Map<string, TableDataManager>();

    // Register internal commands for webview communication
    const requestTableDataCommand = vscode.commands.registerCommand('markdownTableEditor.internal.requestTableData', async (data: any) => {
        try {
            console.log('Internal command: requestTableData', data);
            const { uri, panelId, forceRefresh } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Get or create table data manager
            let tableDataManager = activeTableManagers.get(uri.toString());
            
            // Always re-read file if forceRefresh is true or no manager exists
            if (!tableDataManager || forceRefresh) {
                console.log('Reading fresh data from file for:', uri.toString(), forceRefresh ? '(forced refresh)' : '(new manager)');
                
                // Read and parse the file
                const content = await fileHandler.readMarkdownFile(uri);
                const ast = markdownParser.parseDocument(content);
                const tables = markdownParser.findTablesInDocument(ast);
                
                if (tables.length > 0) {
                    // Determine which table to use
                    let tableIndex = 0;
                    if (tableDataManager && forceRefresh) {
                        // If refreshing existing manager, try to use the same table index
                        const currentTableIndex = tableDataManager.getTableData().metadata.tableIndex;
                        if (currentTableIndex < tables.length) {
                            tableIndex = currentTableIndex;
                        }
                    }
                    
                    // Create new manager with fresh data
                    tableDataManager = new TableDataManager(tables[tableIndex], uri.toString(), tableIndex);
                    activeTableManagers.set(uri.toString(), tableDataManager);
                    
                    if (forceRefresh) {
                        console.log('Table data refreshed from file for:', uri.toString());
                    }
                } else {
                    webviewManager.sendError(panel, 'No tables found in the file');
                    return;
                }
            } else {
                // For existing manager without force refresh, still check for file changes
                const content = await fileHandler.readMarkdownFile(uri);
                const ast = markdownParser.parseDocument(content);
                const tables = markdownParser.findTablesInDocument(ast);
                
                if (tables.length > 0) {
                    // For existing manager, try to find the matching table by index
                    const currentTableIndex = tableDataManager.getTableData().metadata.tableIndex;
                    if (currentTableIndex < tables.length) {
                        // Update manager with the current table data from file
                        const updatedTableNode = tables[currentTableIndex];
                        tableDataManager = new TableDataManager(updatedTableNode, uri.toString(), currentTableIndex);
                        activeTableManagers.set(uri.toString(), tableDataManager);
                    } else {
                        // Use the first table if original index is not available
                        tableDataManager = new TableDataManager(tables[0], uri.toString(), 0);
                        activeTableManagers.set(uri.toString(), tableDataManager);
                    }
                }
            }

            if (tableDataManager) {
                const tableData = tableDataManager.getTableData();
                webviewManager.updateTableData(panel, tableData, uri);
                
                // Don't send success message for refreshes to avoid spam
                if (!forceRefresh) {
                    webviewManager.sendSuccess(panel, 'Table data loaded successfully');
                }
            } else {
                webviewManager.sendError(panel, 'No table data found');
            }
        } catch (error) {
            console.error('Error in requestTableData:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to load table data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const updateCellCommand = vscode.commands.registerCommand('markdownTableEditor.internal.updateCell', async (data: any) => {
        try {
            console.log('Internal command: updateCell', data);
            const { uri, panelId, row, col, value } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            let tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                webviewManager.sendError(panel, 'Table data manager not found');
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
                        const content = await fileHandler.readMarkdownFile(uri);
                        const ast = markdownParser.parseDocument(content);
                        const tables = markdownParser.findTablesInDocument(ast);
                        
                        if (tables.length > 0) {
                            // Find the correct table by index
                            const currentTableData = tableDataManager.getTableData();
                            const tableIndex = currentTableData.metadata.tableIndex;
                            if (tableIndex < tables.length) {
                                // Create new manager with fresh data
                                const newManager = new TableDataManager(tables[tableIndex], uri);
                                activeTableManagers.set(uri.toString(), newManager);
                                tableDataManager = newManager;
                                console.log('Table data refreshed successfully');
                                
                                // Try the update again with fresh data
                                tableDataManager.updateCell(row, col, value);
                            } else {
                                throw new Error(`Table index ${tableIndex} not found in refreshed data`);
                            }
                        } else {
                            throw new Error('No tables found in refreshed data');
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
            
            await fileHandler.updateTableByIndex(
                uri, 
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData(), uri);
            // Don't send success message - webview will handle auto-saved status
        } catch (error) {
            console.error('Error in updateCell:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to update cell: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const addRowCommand = vscode.commands.registerCommand('markdownTableEditor.internal.addRow', async (data: any) => {
        try {
            console.log('Internal command: addRow', data);
            const { uri, panelId, index } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            const tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                webviewManager.sendError(panel, 'Table data manager not found');
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

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData(), uri);
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
            const { uri, panelId, index } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            const tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                webviewManager.sendError(panel, 'Table data manager not found');
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

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData(), uri);
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
            const { uri, panelId, index, header } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            const tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                webviewManager.sendError(panel, 'Table data manager not found');
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

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData(), uri);
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
            const { uri, panelId, index } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            const tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                webviewManager.sendError(panel, 'Table data manager not found');
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

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData(), uri);
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
            const { uri, panelId, column, direction } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            const tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                webviewManager.sendError(panel, 'Table data manager not found');
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

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData(), uri);
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
            const { uri, panelId, from, to } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            const tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                webviewManager.sendError(panel, 'Table data manager not found');
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

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData(), uri);
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
            const { uri, panelId, from, to } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            const tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                webviewManager.sendError(panel, 'Table data manager not found');
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

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData(), uri);
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
        requestTableDataCommand,
        updateCellCommand,
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
    vscode.window.showInformationMessage('Markdown Table Editor commands registered!');
}

export function deactivate() {
    console.log('Markdown Table Editor extension is now deactivated!');
}