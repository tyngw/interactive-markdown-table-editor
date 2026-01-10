import React from 'react'
import { render, screen } from '@testing-library/react'
import TableBody from '../components/TableBody'
import { EditorState, GitDiffStatus } from '../types'

describe('TableBody - git diff deleted row hatching', () => {
  test('when a column is added in the middle, deleted row shows hatched cell at that middle position', () => {
    const headers = ['A', 'B', 'C']
    const rows = [['1', 'X', '3']]

    const editorState: EditorState = {
      currentEditingCell: null,
      selectedCells: new Set<string>(),
      fullySelectedRows: new Set<number>(),
      fullySelectedCols: new Set<number>(),
      selectionRange: null,
      sortState: { column: 0, direction: 'none' },
      columnWidths: {},
      headerConfig: { hasColumnHeaders: true, hasRowHeaders: false }
    }

    // Simulate git diff: old table had columns A,C and old row content "| 1 | 3 |"
    // New table has A,B,C (B inserted at index 1). columnDiff.oldHeaders set to ['A','C']
    const gitDiff = [
      { row: 0, status: GitDiffStatus.DELETED, oldContent: '| 1 | 3 |', isDeletedRow: true },
      { row: 0, status: GitDiffStatus.ADDED, newContent: '| 1 | 2 | 3 |' }
    ] as any

    const columnDiff = {
      oldColumnCount: 2,
      newColumnCount: 3,
      addedColumns: [1],
      deletedColumns: [],
      oldHeaders: ['A', 'C']
    }

    render(
      <table>
        <TableBody
          headers={headers}
          rows={rows}
          editorState={editorState}
          onCellUpdate={() => {}}
          onCellSelect={() => {}}
          onCellEdit={() => {}}
          onAddRow={() => {}}
          onDeleteRow={() => {}}
          onRowSelect={() => {}}
          initialCellInput={null}
          gitDiff={gitDiff}
          columnDiff={columnDiff}
        />
      </table>
    )

    // Deleted row should be rendered before the current row
    const deletedRows = document.querySelectorAll('tr.git-diff-deleted-row')
    expect(deletedRows.length).toBeGreaterThan(0)
    const firstDeleted = deletedRows[0]
    // The cells inside the deleted row should be: '1' , hatched cell, '3'
    const cells = Array.from(firstDeleted.querySelectorAll('td'))
    // filter out the row-number cell
    const dataCells = cells.filter(td => !td.classList.contains('row-number'))
    // We expect three data cells (new column count)
    expect(dataCells.length).toBe(3)
    // First data cell contains '1'
    expect(dataCells[0].textContent?.trim()).toBe('1')
    // Second data cell should be hatched (class git-diff-column-not-exist)
    expect(dataCells[1].classList.contains('git-diff-column-not-exist')).toBe(true)
    // Third data cell contains '3'
    expect(dataCells[2].textContent?.trim()).toBe('3')
  })

  test('when a column is deleted in the middle, deleted row shows the deleted column data in-place', () => {
    const headers = ['A', 'C'] // current headers after deletion (B removed)
    const rows = [['1', '3']]

    const editorState: EditorState = {
      currentEditingCell: null,
      selectedCells: new Set<string>(),
      fullySelectedRows: new Set<number>(),
      fullySelectedCols: new Set<number>(),
      selectionRange: null,
      sortState: { column: 0, direction: 'none' },
      columnWidths: {},
      headerConfig: { hasColumnHeaders: true, hasRowHeaders: false }
    }

    // Old table had A,B,C; new table has A,C (B deleted)
    const gitDiff = [
      { row: 0, status: GitDiffStatus.DELETED, oldContent: '| 1 | 2 | 3 |', isDeletedRow: true },
      { row: 0, status: GitDiffStatus.ADDED, newContent: '| 1 | 3 |' }
    ] as any

    const columnDiff = {
      oldColumnCount: 3,
      newColumnCount: 2,
      addedColumns: [],
      deletedColumns: [1],
      oldHeaders: ['A', 'B', 'C']
    }

    render(
      <table>
        <TableBody
          headers={headers}
          rows={rows}
          editorState={editorState}
          onCellUpdate={() => {}}
          onCellSelect={() => {}}
          onCellEdit={() => {}}
          onAddRow={() => {}}
          onDeleteRow={() => {}}
          onRowSelect={() => {}}
          initialCellInput={null}
          gitDiff={gitDiff}
          columnDiff={columnDiff}
        />
      </table>
    )

    const deletedRows = document.querySelectorAll('tr.git-diff-deleted-row')
    expect(deletedRows.length).toBeGreaterThan(0)
    const firstDeleted = deletedRows[0]
    const cells = Array.from(firstDeleted.querySelectorAll('td'))
    const dataCells = cells.filter(td => !td.classList.contains('row-number'))

    // We expect OLD row to show 3 data cells (old columns)
    expect(dataCells.length).toBe(3)
    expect(dataCells[0].textContent?.trim()).toBe('1')
    // Middle (deleted) column should show '2' (deleted data)
    expect(dataCells[1].textContent?.trim()).toBe('2')
    expect(dataCells[2].textContent?.trim()).toBe('3')
  })
})
