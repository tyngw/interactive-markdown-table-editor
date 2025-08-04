/**
 * UI Rendering Module
 * 
 * Handles UI rendering, application layout, and table display
 */

const UIRenderer = {
    /**
     * Initialize UI renderer
     */
    init: function() {
        console.log('UIRenderer: Initializing...');
        console.log('UIRenderer: Initialized');
    },

    /**
     * Render the application with table tabs
     */
    renderApplicationWithTabs: function () {
        console.log('UIRenderer: renderApplicationWithTabs called');
        const app = document.getElementById('app');
        if (!app) {
            console.error('UIRenderer: App element not found');
            return;
        }

        console.log('UIRenderer: App element found, allTables count:', TableEditor.state.allTables.length);

        // Save current scroll position before rendering tabs
        const scrollState = TableEditor.scrollManager.saveScrollPosition();

        let html = '';

        // Render tabs (always show for consistency)
        if (TableEditor.state.allTables.length >= 1) {
            html += '<div class="table-tabs">';
            TableEditor.state.allTables.forEach((table, index) => {
                const isActive = index === TableEditor.state.currentTableIndex;
                const tabTitle = `表 ${index + 1}`;
                console.log('UIRenderer: Rendering tab', index, 'active:', isActive, 'currentTableIndex:', TableEditor.state.currentTableIndex);
                html += `<button class="tab-button ${isActive ? 'active' : ''}" onclick="TableEditor.callModule('TableManager', 'switchToTable', ${index})">${tabTitle}</button>`;
            });
            html += '</div>';
        }

        // Add table container
        html += '<div id="table-content"></div>';

        console.log('UIRenderer: Setting app innerHTML');
        app.innerHTML = html;

        // Render current table
        const renderer = TableEditor.getModule('TableRenderer');
        console.log('UIRenderer: TableRenderer module:', !!renderer);
        console.log('UIRenderer: Current tableData:', !!TableEditor.state.tableData);

        if (renderer && TableEditor.state.tableData) {
            console.log('UIRenderer: Rendering table with TableRenderer');
            // Create a custom render method that targets table-content
            this.renderTableInContainer(TableEditor.state.tableData);
            
            // Restore scroll position immediately to prevent flickering
            TableEditor.scrollManager.restoreScrollPosition(scrollState, 'UIRenderer.renderApplicationWithTabs');
        } else if (!TableEditor.state.tableData) {
            console.log('UIRenderer: No table data, showing no-data message');
            document.getElementById('table-content').innerHTML = '<div class="no-data">テーブルデータがありません</div>';
        } else {
            console.error('UIRenderer: TableRenderer module not available');
            TableEditor.showError('Failed to render table: TableRenderer module not loaded');
        }
    },

    /**
     * Render table in the table-content container
     */
    renderTableInContainer: function (data) {
        console.log('UIRenderer: renderTableInContainer called with data:', data);

        const tableContent = document.getElementById('table-content');
        if (!tableContent) {
            console.error('UIRenderer: table-content element not found');
            return;
        }

        // Save current scroll position using unified scroll manager
        const scrollState = TableEditor.scrollManager.saveScrollPosition();

        const renderer = TableEditor.getModule('TableRenderer');
        if (!renderer) {
            console.error('UIRenderer: TableRenderer module not available');
            return;
        }

        if (!data || !data.headers || !data.rows) {
            console.error('UIRenderer: Invalid data structure:', data);
            tableContent.innerHTML = '<div class="error">Invalid table data structure</div>';
            return;
        }

        // Update state data
        const state = TableEditor.state;
        state.tableData = data;
        state.displayData = data; // Currently displayed data

        console.log('UIRenderer: Rendering table with', data.headers.length, 'columns and', data.rows.length, 'rows');

        try {
            const tableContentHtml = renderer.renderTableContent();
            console.log('UIRenderer: Generated table content HTML length:', tableContentHtml.length);

            tableContent.innerHTML = `
                <div class="table-container">
                    <table class="table-editor" id="tableEditor">
                        ${tableContentHtml}
                    </table>
                </div>
                
                <!-- Sort Actions Panel -->
                <div class="sort-actions" id="sortActions" style="display: none;">
                    <span class="sort-status-badge">📊 Viewing sorted data</span>
                    <button class="sort-action-btn secondary" onclick="TableEditor.callModule('SortingManager', 'restoreOriginalView')">📄 Restore Original</button>
                    <button class="sort-action-btn" onclick="TableEditor.callModule('SortingManager', 'commitSortToFile')">💾 Save Sort to File</button>
                </div>
                
                <!-- Export Actions Panel -->
                <div class="export-actions">
                    <select class="encoding-select" id="encodingSelect">
                        <option value="utf8">UTF-8</option>
                        <option value="sjis">Shift_JIS</option>
                    </select>
                    <button class="export-btn" onclick="TableEditor.callModule('CSVExporter', 'exportToCSV')">📄 Export CSV</button>
                </div>
                
                <!-- Status Bar -->
                <div class="status-bar" id="statusBar">
                    <div class="status-left">
                        <div class="status-item" id="statusSelection"></div>
                    </div>
                    <div class="status-center">
                        <div class="status-message" id="statusMessage"></div>
                    </div>
                    <div class="status-right">
                        <div class="status-item" id="statusInfo"></div>
                    </div>
                </div>
                
                <!-- Column Width Dialog -->
                <div class="dialog-overlay" id="columnWidthDialogOverlay" style="display: none;">
                    <div class="dialog" id="columnWidthDialog">
                        <div class="dialog-header">
                            <h3>列幅を変更</h3>
                        </div>
                        <div class="dialog-content">
                            <div class="form-group">
                                <label for="columnWidthInput">幅 (px):</label>
                                <div class="input-with-spinner">
                                    <input type="number" id="columnWidthInput" min="50" max="800" step="10" value="150">
                                    <div class="spinner-buttons">
                                        <button type="button" class="spinner-up" onclick="TableEditor.callModule('ContextMenuManager', 'adjustColumnWidthInput', 10)">▲</button>
                                        <button type="button" class="spinner-down" onclick="TableEditor.callModule('ContextMenuManager', 'adjustColumnWidthInput', -10)">▼</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="dialog-footer">
                            <button type="button" class="dialog-btn secondary" onclick="TableEditor.callModule('ContextMenuManager', 'hideColumnWidthDialog')">キャンセル</button>
                            <button type="button" class="dialog-btn primary" onclick="TableEditor.callModule('ContextMenuManager', 'applyColumnWidth')">OK</button>
                        </div>
                    </div>
                </div>
                
                <!-- Context Menus -->
                <div class="context-menu" id="rowContextMenu" style="display: none;">
                    <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'addRowAbove')">
                        <span class="context-menu-icon">⬆️</span>
                        この上に行を追加
                    </div>
                    <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'addRowBelow')">
                        <span class="context-menu-icon">⬇️</span>
                        この下に行を追加
                    </div>
                    <div class="context-menu-separator"></div>
                    <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'deleteRowFromContext')">
                        <span class="context-menu-icon">🗑️</span>
                        この行を削除
                    </div>
                </div>
                <div class="context-menu" id="columnContextMenu" style="display: none;">
                    <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'addColumnLeft')">
                        <span class="context-menu-icon">⬅️</span>
                        この左に列を追加
                    </div>
                    <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'addColumnRight')">
                        <span class="context-menu-icon">➡️</span>
                        この右に列を追加
                    </div>
                    <div class="context-menu-separator"></div>
                    <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'showColumnWidthDialogFromContext')">
                        <span class="context-menu-icon">📏</span>
                        幅を変更
                    </div>
                    <div class="context-menu-separator"></div>
                    <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'deleteColumnFromContext')">
                        <span class="context-menu-icon">🗑️</span>
                        この列を削除
                    </div>
                </div>
            `;

            // Initialize column widths for new data
            renderer.initializeColumnWidths(data);

            // Set table width to sum of column widths to prevent window resize effects
            renderer.setTableWidth();

            // Restore scroll position immediately to prevent flickering
            TableEditor.scrollManager.restoreScrollPosition(scrollState, 'UIRenderer.renderTableInContainer');

            // Update sort actions visibility after rendering
            TableEditor.callModule('SortingManager', 'updateSortActionsVisibility');

            // Update status bar with table information
            TableEditor.callModule('StatusBarManager', 'updateTableDimensions');

            console.log('UIRenderer: Table rendering completed successfully');
        } catch (error) {
            console.error('UIRenderer: Error during table rendering:', error);
            tableContent.innerHTML = '<div class="error">Error rendering table: ' + error.message + '</div>';
        }
    },

    /**
     * Load CSS file
     */
    loadCSS: function () {
        if (window.cssUri) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = window.cssUri;
            document.head.appendChild(link);
            console.log('UIRenderer: CSS loaded from', window.cssUri);
        }
    },

    /**
     * Show fallback message when main interface fails
     */
    showFallbackMessage: function () {
        const container = document.getElementById('table-container');
        if (container) {
            container.innerHTML = '<div class="error-fallback">Table editor encountered an error. Please reload the webview.</div>';
        }
    },

    /**
     * Cleanup UI renderer resources
     */
    cleanup: function() {
        console.log('UIRenderer: Cleaned up');
    }
};

// Register the module
if (window.TableEditor) {
    window.TableEditor.registerModule('UIRenderer', UIRenderer);
} else {
    // If TableEditor is not available yet, store the module for later registration
    window.UIRenderer = UIRenderer;
}

console.log('UIRenderer: Module loaded');