import * as assert from 'assert';

/**
 * CSV Exporter Webview Module Tests
 * 
 * These tests validate the webview-side CSV export functionality,
 * including content generation and message formatting.
 */
suite('CSV Exporter Webview Tests', () => {
    let mockWindow: any;
    let mockDocument: any;
    let CSVExporter: any;
    let sentMessages: any[];

    setup(() => {
        sentMessages = [];

        // Mock window object
        mockWindow = {
            TableEditor: {
                state: {
                    displayData: null,
                    tableData: null,
                    fileInfo: null,
                    documentUri: null
                },
                modules: {
                    StatusBarManager: {
                        showError: (message: string) => console.log('Error:', message),
                        showSuccess: (message: string) => console.log('Success:', message)
                    }
                },
                vscode: {
                    postMessage: (message: any) => {
                        sentMessages.push(message);
                        return Promise.resolve();
                    }
                }
            }
        };

        // Mock document object
        mockDocument = {
            getElementById: (id: string) => {
                if (id === 'encodingSelect') {
                    return { value: 'utf8' };
                }
                return null;
            }
        };

        // Set up global mocks
        (global as any).window = mockWindow;
        (global as any).document = mockDocument;
        (global as any).console = console;

        // Load CSV Exporter module (simulate the actual module)
        CSVExporter = {
            isInitialized: false,
            
            init: function() {
                if (this.isInitialized) {
                    return;
                }
                this.isInitialized = true;
            },

            exportToCSV: function() {
                const state = mockWindow.TableEditor.state;
                const data = state.displayData || state.tableData;
                
                if (!data || !data.headers || !data.rows) {
                    if (mockWindow.TableEditor.modules.StatusBarManager) {
                        mockWindow.TableEditor.modules.StatusBarManager.showError('No table data available for export');
                    }
                    return;
                }
                
                try {
                    // Get selected encoding
                    const encodingSelect = mockDocument.getElementById('encodingSelect');
                    const encoding = encodingSelect ? encodingSelect.value : 'utf8';
                    
                    // Generate CSV content
                    const csvContent = this.generateCSVContent(data);
                    
                    // Get filename
                    const filename = this.getDefaultCSVFilename();
                    
                    // Send to extension for file save
                    if (mockWindow.TableEditor.vscode) {
                        mockWindow.TableEditor.vscode.postMessage({
                            command: 'exportCSV',
                            data: {
                                csvContent: csvContent,
                                filename: filename,
                                encoding: encoding
                            }
                        });
                        
                        const encodingLabel = encoding === 'sjis' ? 'Shift_JIS' : 'UTF-8';
                        if (mockWindow.TableEditor.modules.StatusBarManager) {
                            mockWindow.TableEditor.modules.StatusBarManager.showSuccess(`CSV export initiated (${encodingLabel})...`);
                        }
                    }
                } catch (error) {
                    console.error('CSVExporter: Export failed', error);
                    if (mockWindow.TableEditor.modules.StatusBarManager) {
                        mockWindow.TableEditor.modules.StatusBarManager.showError('CSV export failed: ' + (error as Error).message);
                    }
                }
            },

            generateCSVContent: function(data: any) {
                let csvContent = '';
                
                // Add headers
                const headerRow = data.headers.map((header: any) => this.escapeCSVField(header)).join(',');
                csvContent += headerRow + '\n';
                
                // Add data rows
                data.rows.forEach((row: any[]) => {
                    const csvRow = row.map((cell: any) => this.escapeCSVField(cell)).join(',');
                    csvContent += csvRow + '\n';
                });
                
                return csvContent;
            },

            escapeCSVField: function(field: any) {
                if (field === null || field === undefined) {
                    return '';
                }
                
                // Convert to string
                let str = String(field);
                
                // Convert <br> tags to newlines (case-insensitive, with or without closing tag)
                str = str.replace(/<br\s*\/?>/gi, '\n');
                
                // If field contains comma, quote, or newline, wrap in quotes and escape quotes
                if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                
                return str;
            },

            getDefaultCSVFilename: function() {
                const state = mockWindow.TableEditor.state;
                
                // Try to get filename from fileInfo
                if (state.fileInfo) {
                    if (state.fileInfo.fileNameWithoutExt) {
                        return `${state.fileInfo.fileNameWithoutExt}.csv`;
                    } else if (state.fileInfo.fileName) {
                        const baseName = state.fileInfo.fileName.replace(/\.[^/.]+$/, '');
                        return `${baseName}.csv`;
                    }
                }
                
                // Try to get from document URI
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
    });

    teardown(() => {
        sentMessages = [];
    });

    suite('CSV Content Generation Tests', () => {
        test('should generate basic CSV content', () => {
            const testData = {
                headers: ['Name', 'Age', 'City'],
                rows: [
                    ['John', '25', 'Tokyo'],
                    ['Jane', '30', 'Osaka'],
                    ['Bob', '35', 'Kyoto']
                ]
            };

            const csvContent = CSVExporter.generateCSVContent(testData);
            const expectedContent = 'Name,Age,City\nJohn,25,Tokyo\nJane,30,Osaka\nBob,35,Kyoto\n';
            
            assert.strictEqual(csvContent, expectedContent, 'Basic CSV content should be generated correctly');
        });

        test('should handle CSV fields with special characters', () => {
            const testData = {
                headers: ['Name', 'Description', 'Notes'],
                rows: [
                    ['John, Jr.', 'A "smart" person', 'Line 1\nLine 2'],
                    ['Jane', 'Simple text', 'Normal note']
                ]
            };

            const csvContent = CSVExporter.generateCSVContent(testData);
            const expectedContent = 'Name,Description,Notes\n"John, Jr.","A ""smart"" person","Line 1\nLine 2"\nJane,Simple text,Normal note\n';
            
            assert.strictEqual(csvContent, expectedContent, 'CSV with special characters should be properly escaped');
        });

        test('should handle null and undefined values', () => {
            const testData = {
                headers: ['Name', 'Age', 'Notes'],
                rows: [
                    ['John', null, 'Has notes'],
                    ['Jane', undefined, ''],
                    [null, '30', undefined]
                ]
            };

            const csvContent = CSVExporter.generateCSVContent(testData);
            const expectedContent = 'Name,Age,Notes\nJohn,,Has notes\nJane,,\n,30,\n';
            
            assert.strictEqual(csvContent, expectedContent, 'Null and undefined values should be converted to empty strings');
        });

        test('should handle Japanese characters', () => {
            const testData = {
                headers: ['名前', '年齢', '都市'],
                rows: [
                    ['田中', '25', '東京'],
                    ['佐藤', '30', '大阪']
                ]
            };

            const csvContent = CSVExporter.generateCSVContent(testData);
            const expectedContent = '名前,年齢,都市\n田中,25,東京\n佐藤,30,大阪\n';
            
            assert.strictEqual(csvContent, expectedContent, 'Japanese characters should be preserved');
        });
    });

    suite('CSV Field Escaping Tests', () => {
        test('should escape fields with commas', () => {
            const result = CSVExporter.escapeCSVField('Hello, World');
            assert.strictEqual(result, '"Hello, World"', 'Fields with commas should be quoted');
        });

        test('should escape fields with quotes', () => {
            const result = CSVExporter.escapeCSVField('Say "Hello"');
            assert.strictEqual(result, '"Say ""Hello"""', 'Fields with quotes should be quoted and quotes escaped');
        });

        test('should escape fields with newlines', () => {
            const result = CSVExporter.escapeCSVField('Line 1\nLine 2');
            assert.strictEqual(result, '"Line 1\nLine 2"', 'Fields with newlines should be quoted');
        });

        test('should not escape simple fields', () => {
            const result = CSVExporter.escapeCSVField('SimpleText');
            assert.strictEqual(result, 'SimpleText', 'Simple fields should not be quoted');
        });

        test('should convert br tags to newlines', () => {
            const result = CSVExporter.escapeCSVField('Line 1<br>Line 2');
            assert.strictEqual(result, '"Line 1\nLine 2"', 'BR tags should be converted to newlines and quoted');
        });

        test('should convert various br tag formats to newlines', () => {
            const testCases = [
                { input: 'Line 1<br>Line 2', expected: '"Line 1\nLine 2"' },
                { input: 'Line 1<br/>Line 2', expected: '"Line 1\nLine 2"' },
                { input: 'Line 1<BR>Line 2', expected: '"Line 1\nLine 2"' },
                { input: 'Line 1<BR/>Line 2', expected: '"Line 1\nLine 2"' },
                { input: 'Line 1<br />Line 2', expected: '"Line 1\nLine 2"' }
            ];
            
            testCases.forEach(testCase => {
                const result = CSVExporter.escapeCSVField(testCase.input);
                assert.strictEqual(result, testCase.expected, `${testCase.input} should be converted correctly`);
            });
        });

        test('should handle multiple br tags', () => {
            const result = CSVExporter.escapeCSVField('Line 1<br>Line 2<br/>Line 3');
            assert.strictEqual(result, '"Line 1\nLine 2\nLine 3"', 'Multiple BR tags should all be converted');
        });

        test('should handle null and undefined', () => {
            assert.strictEqual(CSVExporter.escapeCSVField(null), '', 'Null should return empty string');
            assert.strictEqual(CSVExporter.escapeCSVField(undefined), '', 'Undefined should return empty string');
        });

        test('should convert numbers to strings', () => {
            assert.strictEqual(CSVExporter.escapeCSVField(123), '123', 'Numbers should be converted to strings');
            assert.strictEqual(CSVExporter.escapeCSVField(123.45), '123.45', 'Decimal numbers should be converted to strings');
        });
    });

    suite('Filename Generation Tests', () => {
        test('should generate filename from fileInfo.fileNameWithoutExt', () => {
            mockWindow.TableEditor.state.fileInfo = {
                fileNameWithoutExt: 'document'
            };

            const filename = CSVExporter.getDefaultCSVFilename();
            assert.strictEqual(filename, 'document.csv', 'Should use fileNameWithoutExt');
        });

        test('should generate filename from fileInfo.fileName', () => {
            mockWindow.TableEditor.state.fileInfo = {
                fileName: 'document.md'
            };

            const filename = CSVExporter.getDefaultCSVFilename();
            assert.strictEqual(filename, 'document.csv', 'Should extract base name from fileName');
        });

        test('should generate filename from documentUri', () => {
            mockWindow.TableEditor.state.fileInfo = null;
            mockWindow.TableEditor.state.documentUri = 'file:///path/to/document.md';

            const filename = CSVExporter.getDefaultCSVFilename();
            assert.strictEqual(filename, 'document.csv', 'Should extract filename from documentUri');
        });

        test('should generate default timestamp filename', () => {
            mockWindow.TableEditor.state.fileInfo = null;
            mockWindow.TableEditor.state.documentUri = null;

            const filename = CSVExporter.getDefaultCSVFilename();
            assert.ok(filename.startsWith('markdown-table-'), 'Should start with markdown-table-');
            assert.ok(filename.endsWith('.csv'), 'Should end with .csv');
            assert.ok(filename.length > 20, 'Should include timestamp');
        });
    });

    suite('Export Process Tests', () => {
        test('should export CSV with UTF-8 encoding', () => {
            // Set up test data
            mockWindow.TableEditor.state.tableData = {
                headers: ['Name', 'Age'],
                rows: [['John', '25'], ['Jane', '30']]
            };
            mockWindow.TableEditor.state.fileInfo = {
                fileNameWithoutExt: 'test'
            };

            // Mock encoding select to return UTF-8
            mockDocument.getElementById = (id: string) => {
                if (id === 'encodingSelect') {
                    return { value: 'utf8' };
                }
                return null;
            };

            CSVExporter.exportToCSV();

            assert.strictEqual(sentMessages.length, 1, 'Should send one message');
            
            const message = sentMessages[0];
            assert.strictEqual(message.command, 'exportCSV', 'Should send exportCSV command');
            assert.ok(message.data, 'Should include data object');
            assert.strictEqual(message.data.csvContent, 'Name,Age\nJohn,25\nJane,30\n', 'Should include correct CSV content');
            assert.strictEqual(message.data.filename, 'test.csv', 'Should include correct filename');
            assert.strictEqual(message.data.encoding, 'utf8', 'Should include UTF-8 encoding');
        });

        test('should export CSV with Shift_JIS encoding', () => {
            // Set up test data with Japanese characters
            mockWindow.TableEditor.state.tableData = {
                headers: ['名前', '年齢'],
                rows: [['田中', '25'], ['佐藤', '30']]
            };

            // Mock encoding select to return Shift_JIS
            mockDocument.getElementById = (id: string) => {
                if (id === 'encodingSelect') {
                    return { value: 'sjis' };
                }
                return null;
            };

            CSVExporter.exportToCSV();

            assert.strictEqual(sentMessages.length, 1, 'Should send one message');
            
            const message = sentMessages[0];
            assert.strictEqual(message.data.encoding, 'sjis', 'Should include Shift_JIS encoding');
        });

        test('should handle missing table data', () => {
            mockWindow.TableEditor.state.tableData = null;
            mockWindow.TableEditor.state.displayData = null;

            let errorMessage = '';
            mockWindow.TableEditor.modules.StatusBarManager.showError = (message: string) => {
                errorMessage = message;
            };

            CSVExporter.exportToCSV();

            assert.strictEqual(sentMessages.length, 0, 'Should not send any messages');
            assert.strictEqual(errorMessage, 'No table data available for export', 'Should show error message');
        });

        test('should handle missing VSCode API', () => {
            mockWindow.TableEditor.state.tableData = {
                headers: ['Name'],
                rows: [['John']]
            };
            mockWindow.TableEditor.vscode = null;

            CSVExporter.exportToCSV();

            assert.strictEqual(sentMessages.length, 0, 'Should not send any messages when VSCode API is unavailable');
        });

        test('should use displayData over tableData', () => {
            mockWindow.TableEditor.state.tableData = {
                headers: ['Original'],
                rows: [['Data']]
            };
            mockWindow.TableEditor.state.displayData = {
                headers: ['Display'],
                rows: [['Data']]
            };

            CSVExporter.exportToCSV();

            const message = sentMessages[0];
            assert.ok(message.data.csvContent.includes('Display'), 'Should use displayData when available');
            assert.ok(!message.data.csvContent.includes('Original'), 'Should not use tableData when displayData is available');
        });
    });

    suite('Error Handling Tests', () => {
        test('should handle CSV generation errors', () => {
            mockWindow.TableEditor.state.tableData = {
                headers: ['Name'],
                rows: [['John']]
            };

            // Mock generateCSVContent to throw an error
            const originalGenerateCSVContent = CSVExporter.generateCSVContent;
            CSVExporter.generateCSVContent = () => {
                throw new Error('CSV generation failed');
            };

            let errorMessage = '';
            mockWindow.TableEditor.modules.StatusBarManager.showError = (message: string) => {
                errorMessage = message;
            };

            try {
                CSVExporter.exportToCSV();
                assert.ok(errorMessage.includes('CSV export failed'), 'Should show error message');
                assert.strictEqual(sentMessages.length, 0, 'Should not send messages on error');
            } finally {
                CSVExporter.generateCSVContent = originalGenerateCSVContent;
            }
        });

        test('should handle filename generation errors', () => {
            mockWindow.TableEditor.state.tableData = {
                headers: ['Name'],
                rows: [['John']]
            };

            // Mock getDefaultCSVFilename to throw an error
            const originalGetDefaultCSVFilename = CSVExporter.getDefaultCSVFilename;
            CSVExporter.getDefaultCSVFilename = () => {
                throw new Error('Filename generation failed');
            };

            let errorMessage = '';
            mockWindow.TableEditor.modules.StatusBarManager.showError = (message: string) => {
                errorMessage = message;
            };

            try {
                CSVExporter.exportToCSV();
                assert.ok(errorMessage.includes('CSV export failed'), 'Should show error message');
            } finally {
                CSVExporter.getDefaultCSVFilename = originalGetDefaultCSVFilename;
            }
        });
    });
});
