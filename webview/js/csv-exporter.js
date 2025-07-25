/**
 * CSV Exporter Module for Markdown Table Editor
 * 
 * This module handles CSV export functionality.
 */

const CSVExporter = {
    /**
     * Initialize the CSV exporter module
     */
    init: function() {
        console.log('CSVExporter: Initializing CSV exporter module...');
        
        
        console.log('CSVExporter: Module initialized');
    },
    
    /**
     * Export table data to CSV
     */
    exportToCSV: function() {
        console.log('CSVExporter: Starting CSV export...');
        
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.headers || !data.rows) {
            if (window.TableEditor.modules.StatusBarManager) {
                window.TableEditor.modules.StatusBarManager.showError('No table data available for export');
            }
            return;
        }
        
        try {
            // Get selected encoding
            const encodingSelect = document.getElementById('encodingSelect');
            const encoding = encodingSelect ? encodingSelect.value : 'utf8';
            
            // Generate CSV content
            const csvContent = this.generateCSVContent(data);
            
            // Get filename
            const filename = this.getDefaultCSVFilename();
            
            // Send to extension for file save
            if (window.TableEditor.vscode) {
                window.TableEditor.vscode.postMessage({
                    command: 'exportCSV',
                    data: {
                        csvContent: csvContent,
                        filename: filename,
                        encoding: encoding
                    }
                });
                
                const encodingLabel = encoding === 'sjis' ? 'Shift_JIS' : 'UTF-8';
                if (window.TableEditor.modules.StatusBarManager) {
                    window.TableEditor.modules.StatusBarManager.showSuccess(`CSV export initiated (${encodingLabel})...`);
                }
            } else {
                console.error('CSVExporter: VSCode API not available');
            }
        } catch (error) {
            console.error('CSVExporter: Export failed', error);
            if (window.TableEditor.modules.StatusBarManager) {
                window.TableEditor.modules.StatusBarManager.showError('CSV export failed: ' + error.message);
            }
        }
    },
    
    /**
     * Generate CSV content from table data
     */
    generateCSVContent: function(data) {
        let csvContent = '';
        
        // Add headers
        const headerRow = data.headers.map(header => this.escapeCSVField(header)).join(',');
        csvContent += headerRow + '\n';
        
        // Add data rows
        data.rows.forEach(row => {
            const csvRow = row.map(cell => this.escapeCSVField(cell)).join(',');
            csvContent += csvRow + '\n';
        });
        
        return csvContent;
    },
    
    /**
     * Escape CSV field (handle commas, quotes, newlines)
     */
    escapeCSVField: function(field) {
        if (field === null || field === undefined) {
            return '';
        }
        
        // Convert to string
        const str = String(field);
        
        // If field contains comma, quote, or newline, wrap in quotes and escape quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        
        return str;
    },
    
    /**
     * Get default CSV filename based on current context
     */
    getDefaultCSVFilename: function() {
        const state = window.TableEditor.state;
        
        // Try to get filename from fileInfo (preferred method)
        if (state.fileInfo) {
            if (state.fileInfo.fileNameWithoutExt) {
                return `${state.fileInfo.fileNameWithoutExt}.csv`;
            } else if (state.fileInfo.fileName) {
                const baseName = state.fileInfo.fileName.replace(/\.[^/.]+$/, '');
                return `${baseName}.csv`;
            }
        }
        
        // Fallback: try to get from legacy filename property
        if (state.fileInfo && state.fileInfo.filename) {
            const baseName = state.fileInfo.filename.replace(/\.[^/.]+$/, '');
            return `${baseName}.csv`;
        }
        
        // Try to get from document URI (legacy support)
        if (state.documentUri) {
            try {
                const uri = state.documentUri;
                const pathParts = uri.split('/');
                const filename = pathParts[pathParts.length - 1];
                const baseName = filename.replace(/\.[^/.]+$/, '');
                return `${baseName}.csv`;
            } catch (error) {
                console.warn('CSVExporter: Could not parse document URI', error);
            }
        }
        
        // Default filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-T]/g, '');
        return `markdown-table-${timestamp}.csv`;
    }
};

// Make CSVExporter globally available
window.CSVExporter = CSVExporter;

console.log('CSVExporter: Module script loaded');
