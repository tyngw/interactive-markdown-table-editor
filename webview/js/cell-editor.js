/**
 * Cell Editor Module for Markdown Table Editor
 * 
 * This module handles all cell editing operations, including:
 * - Starting and ending cell edit mode
 * - Input field management
 * - Content validation and processing
 * - Edit state management
 */

const CellEditor = {
    // Initialization state
    isInitialized: false,

    /**
     * 共通: 編集用textarea生成（<br>→\n変換含む）
     */
    createEditingTextarea: function (content, className) {
        // <br>→\n変換
        const editableContent = window.TableEditor.callModule('TableRenderer', 'processCellContentForEditing', content || '');
        const textarea = document.createElement('textarea');
        textarea.className = className;
        textarea.value = editableContent;
        if (editableContent.includes('\n')) {
            textarea.setAttribute('data-multiline', 'true');
        }
        return textarea;
    },

    /**
     * Commit current edit (cell or header, unified)
     */
    commitEdit: function () {
        const state = window.TableEditor.state;
        if (!state.currentEditingCell) return;
        if (state.currentEditingCell.row === -1) {
            this.commitHeaderEdit();
        } else {
            this.commitCellEdit();
        }
    },

    /**
     * Cancel current edit (cell or header, unified)
     */
    cancelEdit: function () {
        const state = window.TableEditor.state;
        if (!state.currentEditingCell) return;
        if (state.currentEditingCell.row === -1) {
            this.cancelHeaderEdit();
        } else {
            this.cancelCellEdit();
        }
    },
    // Initialization state
    isInitialized: false,

    /**
     * Initialize the cell editor module
     */
    init: function () {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('CellEditor: Already initialized, skipping');
            return;
        }

        console.log('CellEditor: Initializing cell editor module...');

        this.isInitialized = true;
        console.log('CellEditor: Module initialized');
    },

    /**
     * Handle cell click event - only for selection, not editing
     */
    handleCellClick: function (row, col, event) {
        // Check if click is on an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return; // Don't interfere with input editing
        }

        // Handle Shift+click for range selection
        if (event.shiftKey) {
            window.TableEditor.callModule('SelectionManager', 'selectCell', row, col, event);
            return;
        }

        // Only handle selection - editing should be triggered by double-click
        window.TableEditor.callModule('SelectionManager', 'selectCell', row, col, event);
    },

    /**
     * Start editing a cell
     */
    startCellEdit: function (row, col) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        if (!data || !data.rows || !data.rows[row] || data.rows[row][col] === undefined) {
            console.warn('CellEditor: Invalid cell position', row, col);
            return;
        }

        // Commit any existing edit first
        if (state.currentEditingCell) {
            this.commitCellEdit();
        }

        // Set editing state
        state.currentEditingCell = { row, col };

        // Get the cell element
        const cell = document.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
        if (!cell) {
            console.warn('CellEditor: Cell element not found', row, col);
            return;
        }

        // Get current cell content
        const currentValue = data.rows[row][col] || '';
        // 共通関数でtextarea生成
        const input = this.createEditingTextarea(currentValue, 'cell-input');

        // 編集開始前のセルの高さを取得（他のセルの高さも取得）
        const rowElement = cell.closest('tr');
        const originalCellHeight = cell.offsetHeight;
        let maxOtherCellHeight = 0;

        if (rowElement) {
            const rowCells = rowElement.querySelectorAll('td:not(.row-number)');
            rowCells.forEach(rowCell => {
                if (rowCell !== cell) {
                    maxOtherCellHeight = Math.max(maxOtherCellHeight, rowCell.offsetHeight);
                }
            });
        }

        // Add editing class first
        cell.classList.add('editing');

        // Replace cell content with input
        cell.innerHTML = '';
        cell.appendChild(input);

        // Style the input to match the cell (detailed styling from original code)
        this.styleInputElement(input, cell, originalCellHeight, maxOtherCellHeight);

        // Add event listeners
        this.addInputEventListeners(input, row, col);

        // Focus and select content
        input.focus();
        // カーソルを末尾に移動（テキストを選択しない）
        const textLength = input.value.length;
        input.setSelectionRange(textLength, textLength);

        // Auto-resize textarea for all content (after DOM is fully rendered)
        setTimeout(() => {
            this.autoResizeTextarea(input);
        }, 0);

        console.log('CellEditor: Started editing cell', row, col);
    },

    /**
     * Commit current cell edit
     */
    commitCellEdit: function () {
        const state = window.TableEditor.state;

        if (!state.currentEditingCell) {
            return; // No active edit
        }

        // Check if it's a header edit
        if (state.currentEditingCell.row === -1) {
            this.commitHeaderEdit();
            return;
        }

        const { row, col } = state.currentEditingCell;
        const cell = document.querySelector(`td[data-row="${row}"][data-col="${col}"]`);

        if (!cell) {
            console.warn('CellEditor: Cell not found during commit', row, col);
            state.currentEditingCell = null;
            return;
        }

        const input = cell.querySelector('input, textarea');
        if (!input) {
            console.warn('CellEditor: Input element not found during commit');
            state.currentEditingCell = null;
            return;
        }

        // Get new value
        const newValue = input.value;

        // Process content for storage
        const processedValue = window.TableEditor.callModule('TableRenderer', 'processCellContentForStorage', newValue);

        // Update data model locally first
        const data = state.tableData;
        if (data && data.rows && data.rows[row]) {
            const oldValue = data.rows[row][col];

            // Update local data immediately
            data.rows[row][col] = processedValue;

            // Also update displayData to maintain consistency
            if (state.displayData && state.displayData.rows && state.displayData.rows[row]) {
                state.displayData.rows[row][col] = processedValue;
            }

            // Send update to VSCode if value changed (for file saving only)
            if (oldValue !== processedValue) {
                window.TableEditor.callModule('TableManager', 'updateCell', row, col, processedValue);
                console.log('CellEditor: Cell updated and sent to VSCode', row, col, processedValue);
            } else {
                console.log('CellEditor: Cell value unchanged, no update sent', row, col);
            }
        }

        // Remove editing class and restore cell display
        cell.classList.remove('editing');

        // Reset all inline styles that might affect cell dimensions
        cell.style.height = '';
        cell.style.minHeight = '';
        cell.style.maxHeight = '';
        cell.style.verticalAlign = '';
        cell.style.textAlign = '';
        // セルのCSSクラスを保存（選択状態などを維持するため）
        const cellClasses = cell.className;
        
        cell.removeAttribute('style'); // すべてのインラインスタイルを削除

        const processedContent = window.TableEditor.callModule('TableRenderer', 'processCellContent', processedValue);
        cell.innerHTML = `<div class="cell-content">${processedContent}</div>`;

        // セルのCSSクラスを復元（選択状態を維持）
        cell.className = cellClasses;

        // セルの属性を更新（単一行か複数行かを判定）
        const hasMultipleLines = processedValue && String(processedValue).includes('<br');
        if (hasMultipleLines) {
            cell.setAttribute('data-multiline', 'true');
        } else {
            cell.removeAttribute('data-multiline');
        }

        // Clear editing state
        state.currentEditingCell = null;
        state.isComposing = false;
        state.imeJustEnded = false;

        // DOM更新後に選択状態を確実に更新
        setTimeout(() => {
            window.TableEditor.callModule('SelectionManager', 'updateCellSelection');
        }, 0);

        console.log('CellEditor: Committed cell edit', row, col);
    },

    /**
     * Cancel current cell edit
     */
    cancelCellEdit: function () {
        const state = window.TableEditor.state;

        if (!state.currentEditingCell) {
            return; // No active edit
        }

        // Check if it's a header edit
        if (state.currentEditingCell.row === -1) {
            this.cancelHeaderEdit();
            return;
        }

        const { row, col } = state.currentEditingCell;
        const cell = document.querySelector(`td[data-row="${row}"][data-col="${col}"]`);

        if (cell) {
            // Remove editing class
            cell.classList.remove('editing');

            // Reset all inline styles that might affect cell dimensions
            cell.style.height = '';
            cell.style.minHeight = '';
            cell.style.maxHeight = '';
            cell.style.verticalAlign = '';
            cell.style.textAlign = '';
            cell.removeAttribute('style'); // すべてのインラインスタイルを削除

            // Restore original content
            const data = state.displayData || state.tableData;
            if (data && data.rows && data.rows[row]) {
                const originalValue = data.rows[row][col] || '';
                const processedContent = window.TableEditor.callModule('TableRenderer', 'processCellContent', originalValue);
                
                // セルのCSSクラスを保存（選択状態などを維持するため）
                const cellClasses = cell.className;
                cell.innerHTML = `<div class="cell-content">${processedContent}</div>`;
                // セルのCSSクラスを復元（選択状態を維持）
                cell.className = cellClasses;

                // セルの属性を更新（単一行か複数行かを判定）
                const hasMultipleLines = originalValue && String(originalValue).includes('<br');
                if (hasMultipleLines) {
                    cell.setAttribute('data-multiline', 'true');
                } else {
                    cell.removeAttribute('data-multiline');
                }
            }
        }

        // Clear editing state
        state.currentEditingCell = null;
        state.isComposing = false;
        state.imeJustEnded = false;

        console.log('CellEditor: Cancelled cell edit', row, col);
    },

    /**
     * Determine appropriate input type based on content
     */
    determineInputType: function (content) {
        // Always use textarea for consistent styling
        return 'textarea';
    },

    /**
     * Style input element to match cell dimensions
     */
    styleInputElement: function (input, cell, originalCellHeight, maxOtherCellHeight) {
        // Set minimal required styles, let CSS handle the rest
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';

        // Check if content has multiple lines
        const hasMultipleLines = input.value && input.value.includes('\n');
        if (hasMultipleLines) {
            input.setAttribute('data-multiline', 'true');
        }

        // Let CSS classes handle the detailed styling
        input.className = 'cell-input';

        // Calculate initial height based on content
        const content = input.value;
        const lines = content ? content.split('\n') : [''];
        const lineCount = Math.max(lines.length, 1);

        // Get line height from CSS
        const lineHeight = 1.2; // em units
        const fontSize = 14; // default font size
        const actualLineHeight = lineHeight * fontSize;
        const padding = 8; // 4px top + 4px bottom

        const textRequiredHeight = (lineCount * actualLineHeight) + padding;
        const minHeight = actualLineHeight + padding;

        // 編集開始前に取得した高さ情報を使用
        // 編集対象セルが最も高い場合でも、テキスト要求高さを優先する
        let finalHeight;

        if (originalCellHeight > maxOtherCellHeight) {
            // 編集対象セルが最も高い場合：テキスト要求高さと元の高さの大きい方を使用
            finalHeight = Math.max(textRequiredHeight, originalCellHeight, minHeight);
            console.log(`StyleInput: Cell is tallest, using max(textRequired=${textRequiredHeight}, original=${originalCellHeight}, min=${minHeight}) = ${finalHeight}`);
        } else {
            // 他のセルの方が高い場合：行の統一性を保つため他のセルの高さに合わせる
            finalHeight = Math.max(textRequiredHeight, maxOtherCellHeight, minHeight);
            console.log(`StyleInput: Other cells taller, using max(textRequired=${textRequiredHeight}, others=${maxOtherCellHeight}, min=${minHeight}) = ${finalHeight}`);
        }

        input.style.setProperty('height', finalHeight + 'px', 'important');
        input.style.setProperty('min-height', minHeight + 'px', 'important');

        console.log(`StyleInput: lines=${lineCount}, textRequired=${textRequiredHeight}, originalCell=${originalCellHeight}, maxOthers=${maxOtherCellHeight}, applied=${finalHeight}`);

        // デバッグ: 実際に設定された高さを確認
        setTimeout(() => {
            const actualHeight = input.offsetHeight;
            const computedHeight = window.getComputedStyle(input).height;
            console.log(`StyleInput Debug: actualHeight=${actualHeight}, computedHeight=${computedHeight}`);
        }, 10);
    },

    /**
     * Add event listeners to input element
     */
    addInputEventListeners: function (input, row, col) {
        const state = window.TableEditor.state;

        // Handle keyboard events for editing
        input.addEventListener('keydown', (event) => {
            // Shift+Enter for line break in textarea (README spec: 改行（編集継続）)
            if (event.key === 'Enter' && event.shiftKey && input.tagName === 'TEXTAREA') {
                return; // allow newline
            }
            // Enter key behavior (README spec)
            if (event.key === 'Enter' && !event.shiftKey) {
                if (state.isComposing || state.imeJustEnded) {
                    console.log('CellEditor: Enter pressed during/after IME composition, ignoring');
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                // 編集確定前に現在の位置を保存
                const currentEditingCell = state.currentEditingCell;
                // 編集確定
                this.commitEdit();
                // セルの場合のみ次行へ移動
                // DOM更新完了後にナビゲーションを実行
                if (currentEditingCell && currentEditingCell.row !== -1) {
                    setTimeout(() => {
                        window.TableEditor.callModule('KeyboardNavigationManager', 'navigateCell', currentEditingCell.row + 1, currentEditingCell.col);
                    }, 0);
                }
            } else if (event.key === 'Tab') {
                event.preventDefault();
                event.stopPropagation();
                // 編集確定前に現在の位置を保存
                const currentEditingCell = state.currentEditingCell;
                this.commitEdit();
                // セル・ヘッダー共通: 次/前のセル・ヘッダーへ
                // DOM更新完了後にナビゲーションを実行
                if (currentEditingCell) {
                    setTimeout(() => {
                        window.TableEditor.callModule('KeyboardNavigationManager', 'navigateToNextCell', currentEditingCell.row, currentEditingCell.col, !event.shiftKey);
                    }, 0);
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.cancelEdit();
            } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                event.stopPropagation();
                this.commitEdit();
                // 編集終了のみ
            }
        });

        // Handle IME composition (日本語入力対応)
        input.addEventListener('compositionstart', (e) => {
            console.log('CellEditor: IME composition started');
            state.isComposing = true;
        });

        input.addEventListener('compositionupdate', (e) => {
            console.log('CellEditor: IME composition updating:', e.data);
            state.isComposing = true;
        });

        input.addEventListener('compositionend', (e) => {
            console.log('CellEditor: IME composition ended:', e.data);
            state.isComposing = false;

            // IME確定直後のEnterキーイベントを適切に処理するため、
            // 短時間だけフラグを設定
            state.imeJustEnded = true;
            setTimeout(() => {
                state.imeJustEnded = false;
            }, 50); // 50ms後にフラグをクリア
        });

        // Auto-resize textarea
        if (input.tagName === 'TEXTAREA') {
            input.addEventListener('input', () => {
                this.autoResizeTextarea(input);
            });
        }

        // Commit on blur (focus lost)
        input.addEventListener('blur', () => {
            // Don't commit if we're in the middle of IME composition
            if (!state.isComposing) {
                setTimeout(() => {
                    // Check if focus moved to another input in the same table
                    const activeElement = document.activeElement;
                    if (!activeElement || !activeElement.closest('.table-editor')) {
                        this.commitCellEdit();
                    }
                }, 10);
            }
        });
    },

    /**
     * Auto-resize textarea to fit content
     */
    autoResizeTextarea: function (textarea) {
        if (!textarea) return;

        // Get the parent cell
        const cell = textarea.closest('td');
        if (!cell) return;

        // Get computed styles
        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computedStyle.lineHeight) || 1.2 * parseFloat(computedStyle.fontSize);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 4;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 4;
        const totalPadding = paddingTop + paddingBottom;

        // Count actual lines in the content
        const content = textarea.value;
        const lines = content ? content.split('\n') : [''];
        const lineCount = Math.max(lines.length, 1); // At least 1 line

        // Calculate height based on line count
        const contentHeight = lineCount * lineHeight;
        const textAreaRequiredHeight = contentHeight + totalPadding;

        // 現在のtextareaの高さを取得
        const currentTextareaHeight = textarea.offsetHeight;

        // 編集中のリサイズでは、テキスト要求高さを最優先にする
        // 他のセルの高さは参考程度に留める
        const rowElement = cell.closest('tr');
        let maxRowCellHeight = 0;

        if (rowElement) {
            // Check all cells in the same row and get the maximum height
            const rowCells = rowElement.querySelectorAll('td:not(.row-number)');
            rowCells.forEach(rowCell => {
                if (rowCell !== cell) {
                    maxRowCellHeight = Math.max(maxRowCellHeight, rowCell.offsetHeight);
                }
            });
        }

        // 編集中は以下の優先順位で高さを決定：
        // 1. テキスト要求高さ（最優先）
        // 2. 現在のtextareaの高さ（初期設定を保持）
        // 3. 他のセルの高さ（行の統一性のため）
        // 4. 最小高さ
        const minHeight = lineHeight + totalPadding;
        const appliedHeight = Math.max(textAreaRequiredHeight, currentTextareaHeight, maxRowCellHeight, minHeight);

        // Update both textarea and cell height with !important
        textarea.style.setProperty('height', appliedHeight + 'px', 'important');
        cell.style.setProperty('height', appliedHeight + 'px', 'important');

        console.log(`AutoResize: lines=${lineCount}, textRequired=${textAreaRequiredHeight}, currentTextarea=${currentTextareaHeight}, maxRowHeight=${maxRowCellHeight}, applied=${appliedHeight}`);

        // デバッグ: 実際に設定された高さを確認
        setTimeout(() => {
            const actualHeight = textarea.offsetHeight;
            const computedHeight = window.getComputedStyle(textarea).height;
            console.log(`AutoResize Debug: actualHeight=${actualHeight}, computedHeight=${computedHeight}`);
        }, 10);
    },

    /**
     * Check if currently editing a cell
     */
    isEditing: function () {
        const state = window.TableEditor.state;
        return state.currentEditingCell !== null;
    },

    /**
     * Get current editing cell position
     */
    getCurrentEditingCell: function () {
        const state = window.TableEditor.state;
        return state.currentEditingCell;
    },

    /**
     * Validate cell content before saving
     */
    validateCellContent: function (content, row, col) {
        // Basic validation - can be extended
        if (content === null || content === undefined) {
            return { valid: false, message: 'Content cannot be null' };
        }

        // Convert to string
        const stringContent = String(content);

        // Check length (example limit)
        if (stringContent.length > 10000) {
            return { valid: false, message: 'Content too long (max 10000 characters)' };
        }

        return { valid: true };
    },

    /**
     * Start editing a header cell
     */
    startHeaderEdit: function (colIndex) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        if (!data || !data.headers || colIndex < 0 || colIndex >= data.headers.length) {
            console.warn('CellEditor: Invalid header column index', colIndex);
            return;
        }

        // Commit any existing edit first
        if (state.currentEditingCell) {
            this.commitCellEdit();
        }

        // Set editing state for header (using row -1 to indicate header)
        state.currentEditingCell = { row: -1, col: colIndex };

        // Get the header element - find the column-title div
        const headerCell = document.querySelector(`th[data-col="${colIndex}"]`);
        if (!headerCell) {
            console.warn('CellEditor: Header cell element not found', colIndex);
            return;
        }

        const columnTitleDiv = headerCell.querySelector('.column-title');
        if (!columnTitleDiv) {
            console.warn('CellEditor: Column title div not found', colIndex);
            return;
        }

        // Get current header content
        const currentValue = data.headers[colIndex] || '';
        // 共通関数でtextarea生成
        const input = this.createEditingTextarea(currentValue, 'header-input');

        // Add editing class to header cell
        headerCell.classList.add('editing');

        // Replace column title content with input
        const originalContent = columnTitleDiv.innerHTML;
        columnTitleDiv.innerHTML = '';
        columnTitleDiv.appendChild(input);

        // Style the textarea to match the header
        this.styleHeaderInputElement(input, columnTitleDiv);

        // Add event listeners for header editing
        this.addHeaderInputEventListeners(input, colIndex, columnTitleDiv, originalContent);

        // Focus and select content (textarea: 全選択 or 末尾にカーソル)
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);

        console.log('CellEditor: Started editing header', colIndex);
    },

    /**
     * Commit current header edit
     */
    commitHeaderEdit: function () {
        const state = window.TableEditor.state;

        if (!state.currentEditingCell || state.currentEditingCell.row !== -1) {
            return; // No active header edit
        }

        const { col } = state.currentEditingCell;
        const headerCell = document.querySelector(`th[data-col="${col}"]`);

        if (!headerCell) {
            console.warn('CellEditor: Header cell not found during commit', col);
            state.currentEditingCell = null;
            return;
        }

        const columnTitleDiv = headerCell.querySelector('.column-title');
        if (!columnTitleDiv) {
            console.warn('CellEditor: Column title div not found during commit');
            state.currentEditingCell = null;
            return;
        }

        const input = columnTitleDiv.querySelector('textarea');
        if (!input) {
            console.warn('CellEditor: Input element not found during commit');
            state.currentEditingCell = null;
            return;
        }


        // Get new value
        const rawValue = input.value;
        // セルと同様に改行→<br>変換
        const newValue = window.TableEditor.callModule('TableRenderer', 'processCellContentForStorage', rawValue.trim());

        // Update data model locally first
        const data = state.tableData;
        if (data && data.headers) {
            const oldValue = data.headers[col];

            // Update local data immediately
            data.headers[col] = newValue;

            // Also update displayData to maintain consistency
            if (state.displayData && state.displayData.headers) {
                state.displayData.headers[col] = newValue;
            }

            // Send update to VSCode if value changed (for file saving)
            if (oldValue !== newValue) {
                window.TableEditor.callModule('TableManager', 'updateHeader', col, newValue);
                console.log('CellEditor: Header updated and sent to VSCode', col, newValue);
            } else {
                console.log('CellEditor: Header value unchanged, no update sent', col);
            }
        }

        // Remove editing class and restore header display
        headerCell.classList.remove('editing');

        // Restore column title content with new value（セルと同様にHTML化）
        const processedContent = window.TableEditor.callModule('TableRenderer', 'processCellContent', newValue);
        
        // ヘッダーセルのCSSクラスを保存（選択状態などを維持するため）
        const headerClasses = headerCell.className;
        columnTitleDiv.innerHTML = processedContent;
        // ヘッダーセルのCSSクラスを復元（選択状態を維持）
        headerCell.className = headerClasses;

        // Clear editing state
        state.currentEditingCell = null;
        state.isComposing = false;
        state.imeJustEnded = false;

        console.log('CellEditor: Committed header edit', col);
    },

    /**
     * Cancel current header edit
     */
    cancelHeaderEdit: function () {
        const state = window.TableEditor.state;

        if (!state.currentEditingCell || state.currentEditingCell.row !== -1) {
            return; // No active header edit
        }

        const { col } = state.currentEditingCell;
        const headerCell = document.querySelector(`th[data-col="${col}"]`);

        if (headerCell) {
            // Remove editing class
            headerCell.classList.remove('editing');

            const columnTitleDiv = headerCell.querySelector('.column-title');
            if (columnTitleDiv) {
                // Restore original content
                const data = state.displayData || state.tableData;
                if (data && data.headers && data.headers[col] !== undefined) {
                    const originalValue = data.headers[col] || '';
                    const processedContent = window.TableEditor.callModule('TableRenderer', 'escapeHtml', originalValue);
                    
                    // ヘッダーセルのCSSクラスを保存（選択状態などを維持するため）
                    const headerClasses = headerCell.className;
                    columnTitleDiv.innerHTML = processedContent;
                    // ヘッダーセルのCSSクラスを復元（選択状態を維持）
                    headerCell.className = headerClasses;
                }
            }
        }

        // Clear editing state
        state.currentEditingCell = null;
        state.isComposing = false;
        state.imeJustEnded = false;

        console.log('CellEditor: Cancelled header edit', col);
    },

    /**
     * Style header input element
     */
    styleHeaderInputElement: function (input, container) {
        // Set styles to match the header cell (textarea用)
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';
        input.style.border = 'none';
        input.style.background = 'transparent';
        input.style.color = 'inherit';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = 'inherit';
        input.style.fontWeight = 'inherit';
        input.style.padding = '0';
        input.style.margin = '0';
        input.style.outline = 'none';
        input.style.textAlign = 'left';
        input.style.resize = 'none';
        input.style.overflow = 'hidden';
    },

    /**
     * Add event listeners to header input element
     */
    addHeaderInputEventListeners: function (input, colIndex, container, originalContent) {
        const state = window.TableEditor.state;

        // セルと同じイベントハンドラを利用
        this.addInputEventListeners(input, -1, colIndex);

        // Handle IME composition (日本語入力対応)
        input.addEventListener('compositionstart', (e) => {
            console.log('CellEditor: IME composition started in header');
            state.isComposing = true;
        });

        input.addEventListener('compositionupdate', (e) => {
            console.log('CellEditor: IME composition updating in header:', e.data);
            state.isComposing = true;
        });

        input.addEventListener('compositionend', (e) => {
            console.log('CellEditor: IME composition ended in header:', e.data);
            state.isComposing = false;

            // IME確定直後のEnterキーイベントを適切に処理するため、
            // 短時間だけフラグを設定
            state.imeJustEnded = true;
            setTimeout(() => {
                state.imeJustEnded = false;
            }, 50); // 50ms後にフラグをクリア
        });

        // Commit on blur (focus lost)
        input.addEventListener('blur', () => {
            // Don't commit if we're in the middle of IME composition
            if (!state.isComposing) {
                setTimeout(() => {
                    // Check if focus moved to another input in the same table
                    const activeElement = document.activeElement;
                    if (!activeElement || !activeElement.closest('.table-editor')) {
                        this.commitHeaderEdit();
                    }
                }, 10);
            }
        });
    },

    /**
     * Focus on a specific cell for editing
     */
    focusCell: function (row, col) {
        const cell = document.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            // If cell is already being edited, focus the input
            const input = cell.querySelector('input, textarea');
            if (input) {
                input.focus();
            } else {
                // Start editing the cell
                this.startCellEdit(row, col);
            }
        }
    },

    /**
     * Cleanup resources when module is being disposed
     */
    cleanup: function () {
        console.log('CellEditor: Starting cleanup...');

        // Cancel any active edit
        if (this.isEditing()) {
            this.cancelEdit();
        }

        // Clear editing state
        const state = window.TableEditor.state;
        if (state) {
            state.currentEditingCell = null;
            state.isComposing = false;
            state.imeJustEnded = false;
        }

        // Remove editing classes from all cells
        document.querySelectorAll('.editing').forEach(cell => {
            cell.classList.remove('editing');
        });

        console.log('CellEditor: Cleanup completed');
    }
};

// Make CellEditor globally available
window.CellEditor = CellEditor;

console.log('CellEditor: Module script loaded');
