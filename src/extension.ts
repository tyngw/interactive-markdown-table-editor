import * as vscode from 'vscode';
import { debug, info, warn, error } from './logging';
import { WebviewManager } from './webviewManager';
import { TableDataManager, TableData } from './tableDataManager';
import { MarkdownParser } from './markdownParser';
import { getFileHandler } from './fileHandler';
import { buildThemeVariablesCss, getInstalledColorThemes } from './themeUtils';
import { UndoRedoManager } from './undoRedoManager';
import { decodeBuffer, detectTextEncoding, parseCsv, toRectangular } from './csvUtils';
import { normalizeForImport } from './encodingNormalizer';
import { normalizeForShiftJisExport } from './encodingNormalizer';
import { getGitDiffForTable, clearDiffCache, detectColumnDiff } from './gitDiffUtils';

// 各ファイルの差分計算状況を追跡するマップ
// キー: ファイル URI, 値: 計算中のプロミスまたは null
const diffCalculationMap = new Map<string, Promise<any> | null>();
// 最後に webview に送信した gitDiff を保持して差分の変化を検出する
// キー: ファイル URI, 値: Map<tableIndex, stringifiedDiff>
const lastSentDiffMap = new Map<string, Map<number, string>>();

export function activate(context: vscode.ExtensionContext) {
    // VS Code automatically loads l10n files based on vscode.env.language

    // Initialize managers
    const webviewManager = WebviewManager.getInstance(context);
    const markdownParser = new MarkdownParser();
    const fileHandler = getFileHandler();
    const undoRedoManager = UndoRedoManager.getInstance();

    // Helper: apply current configured theme to all open panels
    const applyConfiguredThemeToPanels = async () => {
        try {
            const config = vscode.workspace.getConfiguration('markdownTableEditor');
            const selectedTheme = config.get<string>('theme', 'inherit');
            info(`[Extension] Applying theme: "${selectedTheme}"`);
            const themeVars = await buildThemeVariablesCss(selectedTheme);
            const activeCount = webviewManager.communicationManagerCount;
            info(`[Extension] Broadcasting applyThemeVariables to ${activeCount} communication managers`);
            webviewManager.broadcastNotification('applyThemeVariables', { cssText: themeVars.cssText });
        } catch (err) {
            error('[Extension] Theme application failed:', err);
        }
    };

    // Apply once on activation so再起動後も即時反映（パネル作成後にも個別適用されます）
    applyConfiguredThemeToPanels();

    // Register commands
    const openEditorCommand = vscode.commands.registerCommand('markdownTableEditor.openEditor', async (uri?: vscode.Uri) => {
        try {

            // Get the active editor if no URI provided
            if (!uri) {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
                    vscode.window.showErrorMessage(vscode.l10n.t('error.noMarkdownFile'));
                    return;
                }
                uri = activeEditor.document.uri;
            }

            if (!uri) {
                throw new Error(vscode.l10n.t('error.noValidUri'));
            }

            // Read the markdown file
            const content = await fileHandler.readMarkdownFile(uri);
            const ast = markdownParser.parseDocument(content);
            const tables = markdownParser.findTablesInDocument(ast);

            if (tables.length === 0) {
                vscode.window.showInformationMessage(vscode.l10n.t('error.noTables'));
                return;
            }

            
            let selectedTableIndex = 0;

            if (tables.length === 1) {
                // Only one table, use it directly
                // default to first table (no variable needed)
                selectedTableIndex = 0;
            } else {
                // Multiple tables, don't prompt user - show all in webview with tabs
                // default to first table (no variable needed)
                selectedTableIndex = 0;
            }

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

            // Create and show the webview panel with all tables
            await webviewManager.createTableEditorPanel(allTableData, uri);

            // Apply configured theme to the panel (async, after panel is ready)
            applyConfiguredThemeToPanels();

            // Wait a moment to ensure panel is stable before showing success message
            setTimeout(() => {
                // Panel created successfully
            }, 100);

        } catch (error) {
            console.error('Error opening table editor:', error);
            vscode.window.showErrorMessage(vscode.l10n.t('error.openTableEditor', error instanceof Error ? error.message : 'Unknown error'));
        }
    });

    // Open editor in new panel command
    const openEditorNewPanelCommand = vscode.commands.registerCommand('markdownTableEditor.openEditorNewPanel', async (uri?: vscode.Uri) => {
        try {

            // Get the active editor if no URI provided
            if (!uri) {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
                    vscode.window.showErrorMessage(vscode.l10n.t('error.noMarkdownFile'));
                    return;
                }
                uri = activeEditor.document.uri;
            }

            if (!uri) {
                throw new Error(vscode.l10n.t('error.noValidUri'));
            }

            // Read the markdown file
            const content = await fileHandler.readMarkdownFile(uri);
            const ast = markdownParser.parseDocument(content);
            const tables = markdownParser.findTablesInDocument(ast);

            if (tables.length === 0) {
                vscode.window.showInformationMessage(vscode.l10n.t('error.noTables'));
                return;
            }

            
            let selectedTableIndex = 0;

            if (tables.length === 1) {
                // Only one table, use it directly
                // default to first table (no variable needed)
                selectedTableIndex = 0;
            } else {
                // Multiple tables, don't prompt user - show all in webview with tabs
                // default to first table (no variable needed)
                selectedTableIndex = 0;
            }

            // Create TableDataManager instances for all tables
            const allTableData: TableData[] = [];
            const tableManagersMap = new Map<number, TableDataManager>();

            tables.forEach((table, index) => {
                const manager = new TableDataManager(table, uri!.toString(), index);
                const tableData = manager.getTableData();
                allTableData.push(tableData);
                tableManagersMap.set(index, manager);
            });

            // Create webview panel in new panel with actual data
            const { panelId: uniquePanelId } = await webviewManager.createTableEditorPanelNewPanel(allTableData, uri);

            // Update the managers to use the unique panel ID
            const updatedTableManagersMap = new Map<number, TableDataManager>();
            tables.forEach((table, index) => {
                const manager = new TableDataManager(table, uniquePanelId, index);
                updatedTableManagersMap.set(index, manager);
            });

            // Store managers for all tables with unique panel ID
            activeMultiTableManagers.set(uniquePanelId, updatedTableManagersMap);

            // Also store the primary manager for backward compatibility
            const primaryManager = updatedTableManagersMap.get(selectedTableIndex);
            if (primaryManager) {
                activeTableManagers.set(uniquePanelId, primaryManager);
            }

            // Apply configured theme to the panel (async, after panel is ready)
            applyConfiguredThemeToPanels();

            // Wait a moment to ensure panel is stable before showing success message
            setTimeout(() => {
                // Panel created successfully in new panel
            }, 100);

        } catch (error) {
            console.error('Error opening table editor in new panel:', error);
            vscode.window.showErrorMessage(vscode.l10n.t('error.openTableEditorNewPanel', error instanceof Error ? error.message : 'Unknown error'));
        }
    });

    // Select theme command
    const selectThemeCommand = vscode.commands.registerCommand('markdownTableEditor.selectTheme', async () => {
        try {
            const themes = getInstalledColorThemes();
            const items: vscode.QuickPickItem[] = [
                { label: `$(color-mode) ${vscode.l10n.t('selectTheme.inherit')}`, description: 'inherit' }
            ].concat(
                themes.map(t => ({ label: t.label, description: t.id }))
            );
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: vscode.l10n.t('selectTheme.placeholder'),
                matchOnDescription: true
            });
            if (!picked) {return;}
            const themeId = picked.description === 'inherit' ? 'inherit' : picked.description || 'inherit';
            await vscode.workspace.getConfiguration('markdownTableEditor').update('theme', themeId, true);
            await applyConfiguredThemeToPanels();
            vscode.window.showInformationMessage(vscode.l10n.t('selectTheme.updated'));
        } catch (err) {
            vscode.window.showErrorMessage(vscode.l10n.t('error.updateTheme', err instanceof Error ? err.message : String(err)));
        }
    });

    // Store active table data managers by URI and table index
    const activeTableManagers = new Map<string, TableDataManager>();
    const activeMultiTableManagers = new Map<string, Map<number, TableDataManager>>();

    const normalizeUri = (value: unknown): { uri: vscode.Uri | null; uriString: string } => {
        if (!value) {
            return { uri: null, uriString: '' };
        }

        if (typeof value === 'string') {
            try {
                return { uri: vscode.Uri.parse(value), uriString: value };
            } catch (error) {
                                return { uri: null, uriString: value };
            }
        }

        if (value instanceof vscode.Uri) {
            const uriString = value.toString();
            return { uri: value, uriString };
        }

        if (typeof (value as any)?.toString === 'function') {
            const uriString = (value as any).toString();
            try {
                return { uri: vscode.Uri.parse(uriString), uriString };
            } catch (error) {
                                return { uri: null, uriString };
            }
        }

        return { uri: null, uriString: '' };
    };

    const resolvePanelContext = (
        uriValue: unknown,
        panelId?: string
    ): {
        uri: vscode.Uri | null;
        uriString: string;
        panel: vscode.WebviewPanel | null;
        panelKey?: string;
        tableManagersMap?: Map<number, TableDataManager>;
    } => {
        const { uri, uriString } = normalizeUri(uriValue);
        const candidateKeys: string[] = [];

        if (panelId && typeof panelId === 'string' && panelId.length > 0) {
            candidateKeys.push(panelId);
        }

        if (uriString) {
            candidateKeys.push(uriString);
        }

        let resolvedPanel: vscode.WebviewPanel | null = null;
        let resolvedPanelKey: string | undefined = undefined;

        for (const key of candidateKeys) {
            const candidatePanel = webviewManager.getPanel(key);
            if (candidatePanel) {
                resolvedPanel = candidatePanel;
                resolvedPanelKey = key;
                break;
            }
        }

        if (!resolvedPanel && candidateKeys.length > 0) {
            // Panel might not be tracked yet; prefer the first candidate key for downstream lookup.
            resolvedPanelKey = candidateKeys[0];
        }

        let tableManagersMap: Map<number, TableDataManager> | undefined;

        if (resolvedPanelKey) {
            tableManagersMap = activeMultiTableManagers.get(resolvedPanelKey);
        }

        if (!tableManagersMap) {
            for (const key of candidateKeys) {
                const candidateMap = activeMultiTableManagers.get(key);
                if (candidateMap) {
                    tableManagersMap = candidateMap;
                    resolvedPanelKey = key;
                    break;
                }
            }
        }

        return {
            uri,
            uriString,
            panel: resolvedPanel,
            panelKey: resolvedPanelKey,
            tableManagersMap
        };
    };

    /**
     * 差分計算を一つのプロミスチェーンとして管理し、複数の並行計算を防ぐ
     * ファイル単位で計算を順序付けることで、競合状態を回避する
     */
    const scheduleGitDiffCalculation = (
        fileUri: vscode.Uri,
        panel: vscode.WebviewPanel,
        tableManagersMap: Map<number, TableDataManager>
    ): Promise<void> => {
        const uriString = fileUri.toString();
        
        // 前の計算が完了するまで待つ
        const previousCalculation = diffCalculationMap.get(uriString) || Promise.resolve();
        
        const newCalculation = previousCalculation
            .then(async () => {
                try {
                    clearDiffCache(fileUri);
                    
                    // Get all table data managers for this file
                    const allTableData: TableData[] = [];
                    tableManagersMap.forEach((manager, idx) => {
                        allTableData[idx] = manager.getTableData();
                    });

                    // Calculate git diff for all tables asynchronously
                    const tablesWithGitDiff = await Promise.all(
                        allTableData.map(async (tbl, idx) => {
                            const manager = tableManagersMap.get(idx);
                            const tableMarkdown = manager ? manager.serializeToMarkdown() : undefined;
                            const gitDiff = await getGitDiffForTable(
                                fileUri,
                                tbl.metadata.startLine,
                                tbl.metadata.endLine,
                                tbl.rows.length,
                                tableMarkdown
                            );
                            const columnDiff = detectColumnDiff(gitDiff, tbl.headers.length);
                            return {
                                tableIndex: idx,
                                gitDiff,
                                columnDiff
                            };
                        })
                    );

                    // Compare with last sent diffs to avoid redundant notifications
                    try {
                        const uriKey = uriString;
                        let lastMap = lastSentDiffMap.get(uriKey);
                        if (!lastMap) {
                            lastMap = new Map<number, string>();
                            lastSentDiffMap.set(uriKey, lastMap);
                        }

                        let changed = false;
                        for (const tbl of tablesWithGitDiff) {
                            const idx = (tbl as any).tableIndex as number;
                            const serialized = JSON.stringify(tbl.gitDiff || []);
                            const prev = lastMap.get(idx);
                            if (prev !== serialized) {
                                changed = true;
                                lastMap.set(idx, serialized);
                            }
                        }

                        if (changed) {
                            webviewManager.updateGitDiff(panel, tablesWithGitDiff);
                        } else {
                            debug('[Extension] No git diff changes detected, skipping updateGitDiff');
                        }
                    } catch (e) {
                        // Fallback: send diffs if comparison fails
                        webviewManager.updateGitDiff(panel, tablesWithGitDiff);
                    }
                } catch (diffError) {
                    // Silently fail for diff calculation - UI should continue working
                    warn('[Extension] Failed to calculate git diff:', diffError);
                } finally {
                    // 計算完了 → map から削除
                    diffCalculationMap.delete(uriString);
                }
            })
            .catch(err => {
                warn('[Extension] Diff calculation chain error:', err);
                diffCalculationMap.delete(uriString);
            });
        
        // 新しい計算をマップに記録
        diffCalculationMap.set(uriString, newCalculation);
        
        return newCalculation;
    };

    /**
     * テーブル操作に共通する処理（Undo保存・更新反映・メッセージ送信）を集約するヘルパー関数。
     * 同種のコード重複と記述漏れ（特にUndoセーブ）を防ぎ、保守性を高めることが目的。
     */
    interface TableEditOptions<T = void> {
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

    const runTableEdit = async <T>(commandData: any, options: TableEditOptions<T>): Promise<void> => {
        
        const { uri: rawUri, panelId } = commandData;
        const { uri, uriString, panel, tableManagersMap } = resolvePanelContext(rawUri, panelId);

        if (!uriString || !uri) {
                        return;
        }

        if (!panel) {
                        return;
        }

        if (!tableManagersMap) {
            webviewManager.sendError(panel, 'Table managers not found');
            return;
        }

        const tableIndex = typeof commandData?.tableIndex === 'number' ? commandData.tableIndex : 0;
        const tableDataManager = tableManagersMap.get(tableIndex);

        if (!tableDataManager) {
            webviewManager.sendError(panel, `Table manager not found for table ${tableIndex}`);
            return;
        }

        try {
            const undoDescription = options.getUndoDescription ? options.getUndoDescription(commandData) : options.operationName;
            await undoRedoManager.saveState(uri, undoDescription);

            const result = await options.mutate({
                manager: tableDataManager,
                managersMap: tableManagersMap,
                tableIndex,
                commandData
            });

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            // Notify webview that a save is about to start for UI feedback
            try {
                webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // Non-fatal - continue
            }

            const applied = await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Notify webview of save result
            try {
                if (applied) {
                    webviewManager.sendOperationSuccess(panel, 'save-completed', { kind: 'save', phase: 'completed', applied: true });
                } else {
                    webviewManager.sendOperationSuccess(panel, 'save-skipped', { kind: 'save', phase: 'skipped', applied: false });
                }
            } catch (e) {
                // ignore
            }

            // 差分計算を順序付き非同期キューで実行（複数の並行計算を防ぐ）
            // ファイル単位で計算をスケジュール
            scheduleGitDiffCalculation(uri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });

            const successMessage = options.getSuccessMessage
                ? options.getSuccessMessage(result, commandData)
                : `${options.operationName} completed`;

            if (successMessage) {
                webviewManager.sendSuccess(panel, successMessage);
            }
        } catch (error) {
            console.error(`Error in ${options.operationName}:`, error);
            const errorMessage = options.getErrorMessage
                ? options.getErrorMessage(error, commandData)
                : `Failed to ${options.operationName.toLowerCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            webviewManager.sendError(panel, errorMessage);
        }
    };

    // Register internal commands for webview communication
    const requestTableDataCommand = vscode.commands.registerCommand('markdownTableEditor.internal.requestTableData', async (data: any) => {
        try {
                        const { uri, panelId, forceRefresh } = data;

            // Get the URI string and panel ID to use for manager lookup
            let uriString: string;
            let actualPanelId: string;

            if (uri) {
                // Handle both string URIs and URI objects
                uriString = typeof uri === 'string' ? uri : (uri.external || uri.toString());
            } else {
                uriString = webviewManager.getActivePanelUri() || '';
            }

            // Use provided panelId or fall back to uriString
            actualPanelId = panelId || uriString;

            if (!uriString) {
                                return;
            }

            const panel = webviewManager.getPanel(actualPanelId);
            if (!panel) {
                                return;
            }

            // Always re-read file to get all tables
            
            // Read and parse the current in-memory document (unsaved changes included)
            const fileUri = vscode.Uri.parse(uriString);
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const content = doc.getText();
            const ast = markdownParser.parseDocument(content);
            const tables = markdownParser.findTablesInDocument(ast);

            if (tables.length > 0) {
                // Create managers for all tables using the actual panel ID
                const allTableData: TableData[] = [];
                const tableManagersMap = new Map<number, TableDataManager>();

                tables.forEach((table, index) => {
                    const manager = new TableDataManager(table, actualPanelId, index);
                    const tableData = manager.getTableData();
                    allTableData.push(tableData);
                    tableManagersMap.set(index, manager);
                });

                // Store managers for all tables using the actual panel ID
                activeMultiTableManagers.set(actualPanelId, tableManagersMap);

                // Also store the primary manager for backward compatibility (first table)
                const primaryManager = tableManagersMap.get(0);
                if (primaryManager) {
                    activeTableManagers.set(actualPanelId, primaryManager);
                }

                // Send table data without diffs first for a fast initial load
                webviewManager.updateTableData(panel, allTableData, fileUri);

                // Asynchronously load and send Git diffs for all tables
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
                            const columnDiff = detectColumnDiff(gitDiff, tableData.headers.length);
                            return { ...tableData, gitDiff, columnDiff };
                        })
                    );

                    // すべてのテーブルの差分を個別通知で送信（初回のテーブルデータ送信はそのまま維持）
                    debug('[GitDiffDebug] Sending Git diffs to webview via updateGitDiff.');
                    try {
                        const diffsPayload = tablesWithGitDiff.map((tbl, idx) => ({
                            tableIndex: idx,
                            gitDiff: tbl.gitDiff,
                            columnDiff: (tbl as any).columnDiff
                        }));
                        // 既存の updateTableData の再送を止め、差分情報のみ別通知で送る
                        webviewManager.updateGitDiff(panel, diffsPayload);
                    } catch (err) {
                        console.error('[GitDiffDebug] Failed to send git diffs via updateGitDiff:', err);
                        // フォールバック: 互換性のために tablesWithGitDiff を再送しておく
                        try {
                            webviewManager.updateTableData(panel, tablesWithGitDiff, fileUri);
                        } catch (err2) {
                            console.error('[GitDiffDebug] Fallback updateTableData also failed:', err2);
                        }
                    }
                })();


                // Don't send success message for refreshes to avoid spam
                if (!forceRefresh) {
                    webviewManager.sendSuccess(panel, `Loaded ${tables.length} table${tables.length > 1 ? 's' : ''} successfully`);
                }

                            } else {
                webviewManager.sendError(panel, 'No tables found in the file');
                return;
            }
        } catch (error) {
            console.error('Error in requestTableData:', error);
            const actualPanelId = data.panelId || data.uri || webviewManager.getActivePanelUri();
            const panel = actualPanelId ? webviewManager.getPanel(actualPanelId) : null;
            if (panel) {
                webviewManager.sendError(panel, `Failed to load table data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    // ファイル変更監視 - VSCodeエディタでの変更を全パネルに反映
    const fileWatcher = vscode.workspace.onDidChangeTextDocument(async (event) => {
        const changedUri = event.document.uri;

        // Markdownファイルの変更のみを監視
        if (event.document.languageId !== 'markdown') {
            return;
        }

        // ファイルが変更された場合、Git diffキャッシュをクリア
        clearDiffCache(changedUri);

        // 変更されたファイルに対応するパネルを全て取得
        const filePanels = webviewManager.getPanelsForFile(changedUri.toString());

        if (filePanels.size > 0) {
            
            try {
                // 変更イベントからインメモリの内容を取得（未保存変更を含む）
                const content = event.document.getText();
                const ast = markdownParser.parseDocument(content);
                const tables = markdownParser.findTablesInDocument(ast);

                if (tables.length > 0) {
                    // 各パネルに対してデータを更新
                    for (const [panelId, panel] of filePanels.entries()) {
                        // Create managers for all tables using the panel ID
                        const allTableData: TableData[] = [];
                        const tableManagersMap = new Map<number, TableDataManager>();

                        tables.forEach((table, index) => {
                            const manager = new TableDataManager(table, panelId, index);
                            const tableData = manager.getTableData();
                            allTableData.push(tableData);
                            tableManagersMap.set(index, manager);
                        });

                        // Store managers for all tables using the panel ID
                        activeMultiTableManagers.set(panelId, tableManagersMap);

                        // Also store the primary manager for backward compatibility
                        const primaryManager = tableManagersMap.get(0);
                        if (primaryManager) {
                            activeTableManagers.set(panelId, primaryManager);
                        }

                        // Notify webview that existing git diffs are now stale (clear them)
                        try {
                            const emptyDiffs = Array.from(tableManagersMap.keys()).map(idx => ({
                                tableIndex: idx,
                                gitDiff: []
                            }));
                            if (emptyDiffs.length > 0) {
                                webviewManager.updateGitDiff(panel, emptyDiffs);
                                // Update lastSentDiffMap to reflect cleared state
                                const uriKey = changedUri.toString();
                                const m = new Map<number, string>();
                                Array.from(tableManagersMap.keys()).forEach(idx => m.set(idx, JSON.stringify([])));
                                lastSentDiffMap.set(uriKey, m);
                            }
                        } catch (e) {
                            // Non-fatal
                        }

                        // Get Git diff information for all tables
                        const tablesWithGitDiff = await Promise.all(
                            allTableData.map(async (tableData, index) => {
                                // テーブルのMarkdown表現を取得（行番号マッピングの精度向上のため）
                                const manager = tableManagersMap.get(index);
                                const tableMarkdown = manager ? manager.serializeToMarkdown() : undefined;
                                const gitDiff = await getGitDiffForTable(
                                    changedUri,
                                    tableData.metadata.startLine,
                                    tableData.metadata.endLine,
                                    tableData.rows.length,
                                    tableMarkdown
                                );
                                const columnDiff = detectColumnDiff(gitDiff, tableData.headers.length);
                                return { ...tableData, gitDiff, columnDiff };
                            })
                        );

                        // Send updated table data with Git diff to webview
                        webviewManager.updateTableData(panel, tablesWithGitDiff, changedUri);

                                            }
                }
            } catch (error) {
                console.error('Error updating panels after file change:', error);
                // Send error to all affected panels
                for (const panel of filePanels.values()) {
                    webviewManager.sendError(panel, `Failed to update from file change: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
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
                                    
            const { uri, panelId, row, col, value, tableIndex } = data;

            // Save state before making changes for undo functionality
            const uriObj = typeof uri === 'string' ? vscode.Uri.parse(uri) : uri;
            await undoRedoManager.saveState(uriObj, `Update cell (${row}, ${col})`);

            // Get the URI string and panel ID to use for manager lookup
            let uriString: string;
            let actualPanelId: string;

            if (uri) {
                // Handle both string URIs and URI objects
                uriString = typeof uri === 'string' ? uri : (uri.external || uri.toString());
            } else {
                uriString = webviewManager.getActivePanelUri() || '';
            }

            // Use provided panelId or fall back to uriString
            actualPanelId = panelId || uriString;

            if (!uriString) {
                                return;
            }

            const panel = webviewManager.getPanel(actualPanelId);
            if (!panel) {
                                return;
            }

            // Get the specific table manager by index using the actual panel ID
            const tableManagersMap = activeMultiTableManagers.get(actualPanelId);
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

            if (!tableDataManager) {
                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // Try to update the cell, if it fails due to invalid position, refresh the table data
            try {
                tableDataManager.updateCell(row, col, value);
            } catch (positionError) {
                if (positionError instanceof Error && positionError.message.includes('Invalid cell position')) {
                                        try {
                        // Read fresh content from file and re-parse
                        const fileUri = vscode.Uri.parse(uriString);
                        const content = await fileHandler.readMarkdownFile(fileUri);
                        const ast = markdownParser.parseDocument(content);
                        const tables = markdownParser.findTablesInDocument(ast);

                        if (targetTableIndex < tables.length) {
                            // Create new manager with fresh data using the actual panel ID
                            const newManager = new TableDataManager(tables[targetTableIndex], actualPanelId, targetTableIndex);
                            tableManagersMap.set(targetTableIndex, newManager);
                            tableDataManager = newManager;
                            
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

            const fileUri = vscode.Uri.parse(uriString);

            // Notify webview that a save is about to start for UI feedback
            try {
                webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // Non-fatal - continue
            }

            const applied = await fileHandler.updateTableByIndex(
                fileUri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Notify webview of save result
            try {
                if (applied) {
                    webviewManager.sendOperationSuccess(panel, 'save-completed', { kind: 'save', phase: 'completed', applied: true });
                } else {
                    webviewManager.sendOperationSuccess(panel, 'save-skipped', { kind: 'save', phase: 'skipped', applied: false });
                }
            } catch (e) {
                // ignore
            }

            // 差分計算を順序付き非同期キューで実行（複数の並行計算を防ぐ）
            scheduleGitDiffCalculation(fileUri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });

            // Don't send any update back to webview to avoid re-rendering
            // The webview has already updated the cell locally
                    } catch (error) {
            console.error('Error in updateCell:', error);
            const actualPanelId = data.panelId || data.uri || webviewManager.getActivePanelUri();
            const panel = actualPanelId ? webviewManager.getPanel(actualPanelId) : null;
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

    const bulkUpdateCellsCommand = vscode.commands.registerCommand('markdownTableEditor.internal.bulkUpdateCells', async (data: any) => {
        try {

                        
            const { uri, panelId, updates, tableIndex } = data;

            // Get the URI string and panel ID to use for manager lookup
            let uriString: string;
            let actualPanelId: string;

            if (uri) {
                uriString = typeof uri === 'string' ? uri : (uri.external || uri.toString());
            } else {
                uriString = webviewManager.getActivePanelUri() || '';
            }

            actualPanelId = panelId || uriString;

            if (!uriString || !updates || !Array.isArray(updates)) {

                return;
            }

            const panel = webviewManager.getPanel(actualPanelId);
            if (!panel) {
                                return;
            }

            // Get the specific table manager by index using the actual panel ID
            const tableManagersMap = activeMultiTableManagers.get(actualPanelId);
            if (!tableManagersMap) {
                                webviewManager.sendError(panel, 'Table managers not found');
                return;
            }

            const targetTableIndex = tableIndex !== undefined ? tableIndex : 0;
            let tableDataManager = tableManagersMap.get(targetTableIndex);

            if (!tableDataManager) {
                                webviewManager.sendError(panel, `Table manager not found for table ${targetTableIndex}`);
                return;
            }

            // 事前にテーブルサイズを確保（必要な最大行・列を計算）
            let maxRow = -1;
            let maxCol = -1;
            for (const update of updates) {
                maxRow = Math.max(maxRow, update.row);
                maxCol = Math.max(maxCol, update.col);
            }

            const currentTableData = tableDataManager.getTableData();
            const neededRows = Math.max(0, maxRow + 1 - currentTableData.rows.length);
            const neededCols = Math.max(0, maxCol + 1 - currentTableData.headers.length);

            // 必要に応じてテーブルを拡張
            if (neededRows > 0) {
                tableDataManager.insertRows(currentTableData.rows.length, neededRows);
            }

            if (neededCols > 0) {
                for (let i = 0; i < neededCols; i++) {
                    const newColIndex = currentTableData.headers.length + i;
                    const columnLetter = String.fromCharCode(65 + (newColIndex % 26)); // A, B, C...
                    tableDataManager.addColumn(undefined, 1, `Column ${columnLetter}`);
                }
            }

            // Apply all updates using batchUpdateCells (supports row=-1 for header row)
            console.log('Applying batch updates:', JSON.stringify(updates));
            tableDataManager.batchUpdateCells(updates);

            // Update the file once after all updates
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            console.log('Serialized markdown:', updatedMarkdown);
            const tableData = tableDataManager.getTableData();
            console.log('Table data after update:', JSON.stringify(tableData));

            const fileUri = vscode.Uri.parse(uriString);

            // Notify webview that a save is about to start for UI feedback
            try {
                webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // Non-fatal - continue
            }

            const applied = await fileHandler.updateTableByIndex(
                fileUri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Notify webview of save result
            try {
                if (applied) {
                    webviewManager.sendOperationSuccess(panel, 'save-completed', { kind: 'save', phase: 'completed', applied: true });
                } else {
                    webviewManager.sendOperationSuccess(panel, 'save-skipped', { kind: 'save', phase: 'skipped', applied: false });
                }
            } catch (e) {
                // ignore
            }

            // 差分計算を順序付き非同期キューで実行（複数の並行計算を防ぐ）
            scheduleGitDiffCalculation(fileUri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });
        } catch (error) {
            console.error('Error in bulkUpdateCells:', error);
            const actualPanelId = data.panelId || data.uri || webviewManager.getActivePanelUri();
            const panel = actualPanelId ? webviewManager.getPanel(actualPanelId) : null;
            if (panel) {
                webviewManager.sendError(panel, `Failed to bulk update cells: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const updateHeaderCommand = vscode.commands.registerCommand('markdownTableEditor.internal.updateHeader', async (data: any) => {
        try {
            const { uri, panelId, col, value, tableIndex } = data;

            // Get the URI string and panel ID to use for manager lookup
            let uriString: string;
            let actualPanelId: string;

            if (uri) {
                // Handle both string URIs and URI objects
                uriString = typeof uri === 'string' ? uri : (uri.external || uri.toString());
            } else {
                uriString = webviewManager.getActivePanelUri() || '';
            }

            // Use provided panelId or fall back to uriString
            actualPanelId = panelId || uriString;

            if (!uriString) {
                console.error('No URI available for updateHeader command');
                return;
            }

            const panel = webviewManager.getPanel(actualPanelId);
            if (!panel) {
                                return;
            }

            // Get the specific table manager by index using the actual panel ID
            const tableManagersMap = activeMultiTableManagers.get(actualPanelId);
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
                                        try {
                        // Read fresh content from file and re-parse
                        const fileUri = vscode.Uri.parse(uriString);
                        const content = await fileHandler.readMarkdownFile(fileUri);
                        const ast = markdownParser.parseDocument(content);
                        const tables = markdownParser.findTablesInDocument(ast);

                        if (targetTableIndex < tables.length) {
                            // Create new manager with fresh data using the actual panel ID
                            const newManager = new TableDataManager(tables[targetTableIndex], actualPanelId, targetTableIndex);
                            tableManagersMap.set(targetTableIndex, newManager);
                            tableDataManager = newManager;
                            
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

            const fileUri = vscode.Uri.parse(uriString);
            await fileHandler.updateTableByIndex(
                fileUri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // 差分計算を順序付き非同期キューで実行（複数の並行計算を防ぐ）
            scheduleGitDiffCalculation(fileUri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });

            // Don't send any update back to webview to avoid re-rendering
            // The webview has already updated the header locally
        } catch (error) {
            console.error('Error in updateHeader:', error);
            const actualPanelId = data.panelId || data.uri || webviewManager.getActivePanelUri();
            const panel = actualPanelId ? webviewManager.getPanel(actualPanelId) : null;
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
        await runTableEdit(data, {
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
        await runTableEdit(data, {
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
        await runTableEdit(data, {
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
        await runTableEdit(data, {
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
        await runTableEdit(data, {
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
        await runTableEdit(data, {
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
        try {
            const { uri: rawUri, panelId, column, direction, tableIndex } = data;
            const { uri, uriString, panel, panelKey, tableManagersMap } = resolvePanelContext(rawUri, panelId);

            if (!uriString || !uri) {
                console.error('Unable to resolve URI for sort command');
                return;
            }

            if (!panel) {
                console.error('Panel not found for ID:', panelKey || uriString);
                return;
            }

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

            tableDataManager.sortByColumn(column, direction);

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            // Notify webview that a save is about to start for UI feedback
            try {
                webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // Non-fatal - continue
            }

            const applied = await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Notify webview of save result
            try {
                if (applied) {
                    webviewManager.sendOperationSuccess(panel, 'save-completed', { kind: 'save', phase: 'completed', applied: true });
                } else {
                    webviewManager.sendOperationSuccess(panel, 'save-skipped', { kind: 'save', phase: 'skipped', applied: false });
                }
            } catch (e) {
                // ignore
            }

            // 差分計算を順序付き非同期キューで実行（複数の並行計算を防ぐ）
            scheduleGitDiffCalculation(uri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });

            webviewManager.sendSuccess(panel, `Table sorted by column ${column} (${direction})`);
        } catch (error) {
            console.error('Error in sort:', error);
            const { panel } = resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                webviewManager.sendError(panel, `Failed to sort table: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const moveRowCommand = vscode.commands.registerCommand('markdownTableEditor.internal.moveRow', async (data: any) => {
        try {
            const { uri: rawUri, panelId, fromIndex, toIndex, tableIndex } = data;
            const { uri, uriString, panel, panelKey, tableManagersMap } = resolvePanelContext(rawUri, panelId);

            if (!uriString || !uri) {
                console.error('Unable to resolve URI for moveRow command');
                return;
            }

            if (!panel) {
                console.error('Panel not found for ID:', panelKey || uriString);
                return;
            }

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

            tableDataManager.moveRow(fromIndex, toIndex);

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            // Notify webview that a save is about to start for UI feedback
            try {
                webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // Non-fatal - continue
            }

            const applied = await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Notify webview of save result
            try {
                if (applied) {
                    webviewManager.sendOperationSuccess(panel, 'save-completed', { kind: 'save', phase: 'completed', applied: true });
                } else {
                    webviewManager.sendOperationSuccess(panel, 'save-skipped', { kind: 'save', phase: 'skipped', applied: false });
                }
            } catch (e) {
                // ignore
            }

            // 差分計算を順序付き非同期キューで実行（複数の並行計算を防ぐ）
            scheduleGitDiffCalculation(uri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });

            webviewManager.sendSuccess(panel, `Row moved from ${fromIndex} to ${toIndex}`);
        } catch (error) {
            console.error('Error in moveRow:', error);
            const { panel } = resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                webviewManager.sendError(panel, `Failed to move row: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const moveColumnCommand = vscode.commands.registerCommand('markdownTableEditor.internal.moveColumn', async (data: any) => {
        try {
            const { uri: rawUri, panelId, fromIndex, toIndex, tableIndex } = data;
            const { uri, uriString, panel, panelKey, tableManagersMap } = resolvePanelContext(rawUri, panelId);

            if (!uriString || !uri) {
                console.error('Unable to resolve URI for moveColumn command');
                return;
            }

            if (!panel) {
                console.error('Panel not found for ID:', panelKey || uriString);
                return;
            }

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

            tableDataManager.moveColumn(fromIndex, toIndex);

            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();

            // Notify webview that a save is about to start for UI feedback
            try {
                webviewManager.sendOperationSuccess(panel, 'save-started', { kind: 'save', phase: 'started' });
            } catch (e) {
                // Non-fatal - continue
            }

            const applied = await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Notify webview of save result
            try {
                if (applied) {
                    webviewManager.sendOperationSuccess(panel, 'save-completed', { kind: 'save', phase: 'completed', applied: true });
                } else {
                    webviewManager.sendOperationSuccess(panel, 'save-skipped', { kind: 'save', phase: 'skipped', applied: false });
                }
            } catch (e) {
                // ignore
            }

            // 差分計算を順序付き非同期キューで実行（複数の並行計算を防ぐ）
            scheduleGitDiffCalculation(uri, panel, tableManagersMap).catch(err => {
                warn('[Extension] Diff calculation scheduling failed:', err);
            });

            webviewManager.sendSuccess(panel, `Column moved from ${fromIndex} to ${toIndex}`);
        } catch (error) {
            console.error('Error in moveColumn:', error);
            const { panel } = resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                webviewManager.sendError(panel, `Failed to move column: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const exportCSVCommand = vscode.commands.registerCommand('markdownTableEditor.internal.exportCSV', async (data: any) => {
        try {
            const { uri: rawUri, panelId, data: exportData } = data;
            const { uri, uriString, panel } = resolvePanelContext(rawUri, panelId);
            const csvContent = exportData?.csvContent;
            const filename = exportData?.filename;
            const encoding = exportData?.encoding || 'utf8';

            if (!panel) {
                console.error('Panel not found for exportCSV command');
                return;
            }

            if (!uriString || !uri) {
                webviewManager.sendError(panel, 'Missing URI for CSV export');
                return;
            }

            if (!csvContent || typeof csvContent !== 'string' || csvContent.length === 0) {
                console.error('Invalid or empty CSV content');
                webviewManager.sendError(panel, 'Invalid or empty CSV content');
                return;
            }

            let defaultFilename = filename;
            if (uri.fsPath) {
                const path = require('path');
                const baseName = path.basename(uri.fsPath, path.extname(uri.fsPath));
                defaultFilename = `${baseName}.csv`;
            }

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
                let contentToWrite = csvContent;
                let buffer: Buffer;

                if (encoding === 'sjis') {
                    // 近似変換の事前チェック
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
                            // 変換せずにSJISエンコードを試みる（非対応文字は '?' になる可能性あり）
                            contentToWrite = csvContent;
                        }
                    }

                    try {
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
                webviewManager.sendSuccess(panel, vscode.l10n.t('success.csvExported', saveUri.fsPath, encodingLabel));
                            } else {
                            }
        } catch (error) {
            console.error('Error in exportCSV:', error);
            const { panel } = resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                webviewManager.sendError(panel, `Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    const importCSVCommand = vscode.commands.registerCommand('markdownTableEditor.internal.importCSV', async (data: any) => {
        try {
            const { uri: rawUri, panelId, tableIndex } = data || {};
            const { uri, uriString, panel, panelKey, tableManagersMap } = resolvePanelContext(rawUri, panelId);

            if (!uriString || !uri) {
                console.error('Unable to resolve URI for importCSV command');
                return;
            }
            if (!panel) {
                console.error('Panel not found for ID:', panelKey || uriString);
                return;
            }
            if (!tableManagersMap) {
                webviewManager.sendError(panel, vscode.l10n.t('error.tableManagersNotFound'));
                return;
            }

            const targetTableIndex = typeof tableIndex === 'number' ? tableIndex : 0;
            const tableDataManager = tableManagersMap.get(targetTableIndex);
            if (!tableDataManager) {
                webviewManager.sendError(panel, vscode.l10n.t('error.tableManagerNotFoundForIndex', targetTableIndex));
                return;
            }

            // ファイル選択
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

            // 読込 + 自動判別
            const buf = await vscode.workspace.fs.readFile(csvUri);
            const enc = detectTextEncoding(Buffer.from(buf));
            const textRaw = decodeBuffer(Buffer.from(buf), enc);
            // 文字正規化（NFKC）: 解析前に適用
            const { normalized: text } = normalizeForImport(textRaw);

            // 解析
            const rows = parseCsv(text);
            if (!rows || rows.length === 0) {
                webviewManager.sendError(panel, vscode.l10n.t('error.csvEmpty'));
                return;
            }
            // 有効性の軽い検証（いずれかのセルに内容があるか）
            const hasAnyValue = rows.some(r => r.some(c => (c || '').trim().length > 0));
            if (!hasAnyValue) {
                webviewManager.sendError(panel, vscode.l10n.t('error.csvNoValues'));
                return;
            }
            const rectangular = toRectangular(rows);

            // Export時の逆変換: セル内の改行(\n)をストレージ形式の <br/> に変換
            const headersNormalized = rectangular.headers.map(h => (h ?? '').replace(/\n/g, '<br/>'));
            const rowsNormalized = rectangular.rows.map(r => r.map(c => (c ?? '').replace(/\n/g, '<br/>')));

            // 確認ダイアログ（モーダル）。承認時のみ上書き
            const confirm = await vscode.window.showWarningMessage(
                vscode.l10n.t('csv.importConfirm'),
                { modal: true },
                vscode.l10n.t('csv.yes')
            );
            if (confirm !== vscode.l10n.t('csv.yes')) {
                                return;
            }

            // Undo保存
            await undoRedoManager.saveState(uri, 'Import CSV');

            // テーブルに反映（置換）
            tableDataManager.replaceContents(headersNormalized, rowsNormalized);

            // Markdownへ反映
            const updatedMarkdown = tableDataManager.serializeToMarkdown();
            const tableData = tableDataManager.getTableData();
            await fileHandler.updateTableByIndex(
                uri,
                tableData.metadata.tableIndex,
                updatedMarkdown
            );

            // Git差分情報のキャッシュをクリア（ファイルが変更されたため）
            clearDiffCache(uri);

            // すべてのテーブルを再送
            const allTableData: TableData[] = [];
            tableManagersMap.forEach((manager, idx) => {
                allTableData[idx] = manager.getTableData();
            });

            // Get Git diff information for all tables
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
                    const columnDiff = detectColumnDiff(gitDiff, tableData.headers.length);
                    return { ...tableData, gitDiff, columnDiff };
                })
            );

            webviewManager.updateTableData(panel, tablesWithGitDiff, uri);

            const label = enc === 'sjis' ? vscode.l10n.t('csv.encoding.sjis') : vscode.l10n.t('csv.encoding.utf8');
            webviewManager.sendSuccess(panel, vscode.l10n.t('success.csvImported', csvUri.fsPath, label));
        } catch (error) {
            console.error('Error in importCSV:', error);
            const { panel } = resolvePanelContext(data?.uri, data?.panelId);
            if (panel) {
                webviewManager.sendError(panel, `Failed to import CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    context.subscriptions.push(
        openEditorCommand,
        openEditorNewPanelCommand,
        selectThemeCommand,
        requestTableDataCommand,
        fileWatcher,
        configWatcher,
        colorThemeWatcher,
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

export function deactivate() {
    console.log('Markdown Table Editor extension is now deactivating...');

    try {
        // Dispose WebviewManager resources
        const webviewManager = WebviewManager.getInstance();
        if (webviewManager) {
            webviewManager.dispose();
                    }
    } catch (error) {
        console.error('Error disposing WebviewManager:', error);
    }

    try {
        // Dispose FileHandler resources
        const { disposeFileHandler } = require('./fileHandler');
        disposeFileHandler();
            } catch (error) {
        console.error('Error disposing FileHandler:', error);
    }

    }
