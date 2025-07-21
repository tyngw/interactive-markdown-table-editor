import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { TableDataManager, TableData } from './tableDataManager';
import { MarkdownParser } from './markdownParser';
import { getFileHandler } from './fileHandler';

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown Table Editor extension is now active!');

    // Initialize managers
    const webviewManager = WebviewManager.getInstance(context);
    const markdownParser = new MarkdownParser();
    const fileHandler = getFileHandler();

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

            // For now, use the first table found
            // TODO: Allow user to select which table to edit
            const tableNode = tables[0];
            console.log('Using table:', tableNode);
            
            const tableDataManager = new TableDataManager(tableNode, uri.toString());
            const tableData = tableDataManager.getTableData();

            console.log('Creating webview panel...');
            
            // Create and show the webview panel
            const panel = webviewManager.createTableEditorPanel(tableData, uri);
            
            console.log('Webview panel created successfully');
            
            vscode.window.showInformationMessage(`Table editor opened with ${tableData.rows.length} rows and ${tableData.headers.length} columns.`);
        } catch (error) {
            console.error('Error opening table editor:', error);
            vscode.window.showErrorMessage(`Failed to open table editor: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    const createTableCommand = vscode.commands.registerCommand('markdownTableEditor.createTable', async (uri?: vscode.Uri) => {
        try {
            console.log('Creating new table...');
            
            // Get the active editor if no URI provided
            if (!uri) {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
                    vscode.window.showErrorMessage('Please open a Markdown file first.');
                    return;
                }
                uri = activeEditor.document.uri;
            }

            console.log('Creating table for file:', uri.toString());

            // Create a sample table node and manager
            const sampleTableNode = {
                startLine: 0,
                endLine: 3,
                headers: ['Column 1', 'Column 2', 'Column 3'],
                rows: [
                    ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
                    ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3']
                ],
                alignment: ['left' as const, 'left' as const, 'left' as const]
            };
            
            const tableDataManager = new TableDataManager(sampleTableNode, uri.toString());
            const sampleTableData = tableDataManager.getTableData();

            console.log('Creating webview panel for new table...');

            // Create and show the webview panel
            const panel = webviewManager.createTableEditorPanel(sampleTableData, uri);
            
            console.log('Webview panel created successfully for new table');
            
            vscode.window.showInformationMessage('New table created. Edit it and it will be inserted into your Markdown file.');
        } catch (error) {
            console.error('Error creating table:', error);
            vscode.window.showErrorMessage(`Failed to create table: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    // Store active table data managers by URI
    const activeTableManagers = new Map<string, TableDataManager>();

    // Register internal commands for webview communication
    const requestTableDataCommand = vscode.commands.registerCommand('markdownTableEditor.internal.requestTableData', async (data: any) => {
        try {
            console.log('Internal command: requestTableData', data);
            const { uri, panelId } = data;
            const panel = webviewManager.getPanel(uri);
            
            if (!panel) {
                console.error('Panel not found for URI:', uri.toString());
                return;
            }

            // Get or create table data manager
            let tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                // Read and parse the file
                const content = await fileHandler.readMarkdownFile(uri);
                const ast = markdownParser.parseDocument(content);
                const tables = markdownParser.findTablesInDocument(ast);
                
                if (tables.length > 0) {
                    tableDataManager = new TableDataManager(tables[0], uri.toString());
                    activeTableManagers.set(uri.toString(), tableDataManager);
                }
            }

            if (tableDataManager) {
                const tableData = tableDataManager.getTableData();
                webviewManager.updateTableData(panel, tableData);
                webviewManager.sendSuccess(panel, 'Table data loaded successfully');
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

            const tableDataManager = activeTableManagers.get(uri.toString());
            if (!tableDataManager) {
                webviewManager.sendError(panel, 'Table data manager not found');
                return;
            }

            // Update the cell
            tableDataManager.updateCell(row, col, value);
            
            // Update the file
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableInFile(
                uri, 
                tableData.metadata.startLine, 
                tableData.metadata.endLine, 
                updatedMarkdown
            );

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData());
            webviewManager.sendSuccess(panel, 'Cell updated successfully');
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
            
            // Update the file
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableInFile(
                uri, 
                tableData.metadata.startLine, 
                tableData.metadata.endLine, 
                updatedMarkdown
            );

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData());
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
            
            // Update the file
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableInFile(
                uri, 
                tableData.metadata.startLine, 
                tableData.metadata.endLine, 
                updatedMarkdown
            );

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData());
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
            
            // Update the file
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableInFile(
                uri, 
                tableData.metadata.startLine, 
                tableData.metadata.endLine, 
                updatedMarkdown
            );

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData());
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
            
            // Update the file
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableInFile(
                uri, 
                tableData.metadata.startLine, 
                tableData.metadata.endLine, 
                updatedMarkdown
            );

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData());
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
            
            // Update the file
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableInFile(
                uri, 
                tableData.metadata.startLine, 
                tableData.metadata.endLine, 
                updatedMarkdown
            );

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData());
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
            
            // Update the file
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableInFile(
                uri, 
                tableData.metadata.startLine, 
                tableData.metadata.endLine, 
                updatedMarkdown
            );

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData());
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
            
            // Update the file
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableInFile(
                uri, 
                tableData.metadata.startLine, 
                tableData.metadata.endLine, 
                updatedMarkdown
            );

            // Send updated data back to webview
            webviewManager.updateTableData(panel, tableDataManager.getTableData());
            webviewManager.sendSuccess(panel, `Column moved from ${from} to ${to}`);
        } catch (error) {
            console.error('Error in moveColumn:', error);
            const panel = webviewManager.getPanel(data.uri);
            if (panel) {
                webviewManager.sendError(panel, `Failed to move column: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    context.subscriptions.push(
        openEditorCommand,
        createTableCommand,
        requestTableDataCommand,
        updateCellCommand,
        addRowCommand,
        deleteRowCommand,
        addColumnCommand,
        deleteColumnCommand,
        sortCommand,
        moveRowCommand,
        moveColumnCommand
    );
}

export function deactivate() {
    console.log('Markdown Table Editor extension is now deactivated!');
}