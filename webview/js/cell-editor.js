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
    /**
     * Initialize the cell editor module
     */
    init: function() {
        console.log('CellEditor: Initializing cell editor module...');
        
        
        console.log('CellEditor: Module initialized');
    },
    
    /**
     * Handle cell click event - only for selection, not editing
     */
    handleCellClick: function(row, col, event) {
        // Check if click is on an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return; // Don't interfere with input editing
        }
        
        // Only handle selection - editing should be triggered by double-click
        window.TableEditor.callModule('SelectionManager', 'selectCell', row, col, event);
    },
    
    /**
     * Start editing a cell
     */
    startCellEdit: function(row, col) {
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
        const editableContent = window.TableEditor.callModule('TableRenderer', 'processCellContentForEditing', currentValue);
        
        // Determine input type based on content
        const inputType = this.determineInputType(editableContent);
        
        // Create input element (always textarea for consistency)
        const input = document.createElement('textarea');
        input.className = 'cell-input';
        input.value = editableContent;
        
        // Check if content has line breaks for multiline attribute
        const hasLineBreaks = editableContent.includes('\n');
        if (hasLineBreaks) {
            input.setAttribute('data-multiline', 'true');
        }
        
        // 編集開始前のセルの高さを取得
        const originalCellHeight = cell.offsetHeight;
        
        // Add editing class first
        cell.classList.add('editing');
        
        // Replace cell content with input
        cell.innerHTML = '';
        cell.appendChild(input);
        
        // Style the input to match the cell (detailed styling from original code)
        this.styleInputElement(input, cell, originalCellHeight);
        
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
    commitCellEdit: function() {
        const state = window.TableEditor.state;
        
        if (!state.currentEditingCell) {
            return; // No active edit
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
        
        // Update data model
        const data = state.tableData;
        if (data && data.rows && data.rows[row]) {
            const oldValue = data.rows[row][col];
            data.rows[row][col] = processedValue;
            
            // Send update to VSCode if value changed
            if (oldValue !== processedValue) {
                window.TableEditor.updateCell(row, col, processedValue);
                
                console.log('CellEditor: Cell updated', row, col, processedValue);
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
        cell.removeAttribute('style'); // すべてのインラインスタイルを削除
        
        const processedContent = window.TableEditor.callModule('TableRenderer', 'processCellContent', processedValue);
        cell.innerHTML = `<div class="cell-content">${processedContent}</div>`;
        
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
        
        console.log('CellEditor: Committed cell edit', row, col);
    },
    
    /**
     * Cancel current cell edit
     */
    cancelCellEdit: function() {
        const state = window.TableEditor.state;
        
        if (!state.currentEditingCell) {
            return; // No active edit
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
                cell.innerHTML = `<div class="cell-content">${processedContent}</div>`;
                
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
        
        console.log('CellEditor: Cancelled cell edit', row, col);
    },
    
    /**
     * Determine appropriate input type based on content
     */
    determineInputType: function(content) {
        // Always use textarea for consistent styling
        return 'textarea';
    },
    
    /**
     * Style input element to match cell dimensions
     */
    styleInputElement: function(input, cell) {
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
        
        const initialHeight = (lineCount * actualLineHeight) + padding;
        const minHeight = actualLineHeight + padding;
        
        const finalHeight = Math.max(initialHeight, minHeight);
        input.style.setProperty('height', finalHeight + 'px', 'important');
        input.style.setProperty('min-height', minHeight + 'px', 'important');
        
        console.log(`StyleInput: lines=${lineCount}, initialHeight=${finalHeight}`);
        
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
    addInputEventListeners: function(input, row, col) {
        const state = window.TableEditor.state;
        
        // Handle keyboard events for editing
        input.addEventListener('keydown', (event) => {
            // Enter key behavior (README spec)
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.commitCellEdit();
                // Navigate to next row in same column (README spec: 編集確定＆同列の次行へ)
                window.TableEditor.callModule('KeyboardNavigationManager', 'navigateCell', row + 1, col);
            }
            // Shift+Enter for line break in textarea (README spec: 改行（編集継続）)
            else if (event.key === 'Enter' && event.shiftKey && input.tagName === 'TEXTAREA') {
                // Allow default behavior for line break
                return;
            }
            // Ctrl+Enter or Cmd+Enter commits and ends editing (README spec: 編集確定＆編集終了)
            else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                this.commitCellEdit();
                // Don't navigate to next cell - just end editing
            }
            // Tab commits and moves to next cell (README spec: 編集確定＆次のセルへ)
            else if (event.key === 'Tab') {
                event.preventDefault();
                this.commitCellEdit();
                // Navigate to next/previous cell
                window.TableEditor.callModule('KeyboardNavigationManager', 'navigateToNextCell', row, col, !event.shiftKey);
            }
            // Escape commits and ends editing (README spec: 編集確定＆編集終了)
            else if (event.key === 'Escape') {
                event.preventDefault();
                this.commitCellEdit();
                // Don't navigate to next cell - just end editing
            }
        });
        
        // Handle IME composition
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
    autoResizeTextarea: function(textarea) {
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
        const totalHeight = contentHeight + totalPadding;
        
        // Set minimum height (at least 1 line)
        const minHeight = lineHeight + totalPadding;
        const finalHeight = Math.max(totalHeight, minHeight);
        
        // Update both textarea and cell height with !important
        textarea.style.setProperty('height', finalHeight + 'px', 'important');
        cell.style.setProperty('height', finalHeight + 'px', 'important');
        
        console.log(`AutoResize: lines=${lineCount}, lineHeight=${lineHeight}, finalHeight=${finalHeight}`);
        
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
    isEditing: function() {
        const state = window.TableEditor.state;
        return state.currentEditingCell !== null;
    },
    
    /**
     * Get current editing cell position
     */
    getCurrentEditingCell: function() {
        const state = window.TableEditor.state;
        return state.currentEditingCell;
    },
    
    /**
     * Validate cell content before saving
     */
    validateCellContent: function(content, row, col) {
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
     * Focus on a specific cell for editing
     */
    focusCell: function(row, col) {
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
    }
};

// Make CellEditor globally available
window.CellEditor = CellEditor;

console.log('CellEditor: Module script loaded');
