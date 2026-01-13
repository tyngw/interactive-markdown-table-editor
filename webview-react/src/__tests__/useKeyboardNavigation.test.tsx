import React from 'react'
import { render, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useEffect } from 'react'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'

afterEach(() => {
  cleanup()
  // ensure no leftover listeners
  document.body.innerHTML = ''
})

function TestHarness(props: any) {
  const {
    tableData,
    currentEditingCell,
    selectionRange,
    selectionAnchor,
    onCellSelect,
    onCellEdit,
    onCopy,
    onPaste,
    onCut,
    onClearCells,
    onSelectAll,
    onSetSelectionAnchor,
    onUndo,
    onRedo,
    headerConfig,
    onOpenSearch
  } = props

  useKeyboardNavigation({
    tableData,
    currentEditingCell,
    selectionRange,
    selectionAnchor,
    onCellSelect,
    onCellEdit,
    onCopy,
    onPaste,
    onCut,
    onClearCells,
    onSelectAll,
    onSetSelectionAnchor,
    onUndo,
    onRedo,
    headerConfig,
    onOpenSearch
  })

  // mount a dummy element to take focus if needed
  useEffect(() => {
    const el = document.createElement('div')
    el.setAttribute('data-testid', 'host')
    document.body.appendChild(el)
    return () => { if (el.parentNode) el.parentNode.removeChild(el) }
  }, [])

  return null
}

describe('useKeyboardNavigation Enter behavior', () => {
  test('Enter should start editing even if focus is on element with cell-input class when not currently editing', () => {
    const mockOnCellEdit = jest.fn()

    const tableData = {
      headers: ['a', 'b'],
      rows: [['1', '2'], ['3', '4']]
    }

    const selectionRange = { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }

    render(
      <TestHarness
        tableData={tableData}
        currentEditingCell={null}
        selectionRange={selectionRange}
        selectionAnchor={null}
        onCellSelect={() => {}}
        onCellEdit={mockOnCellEdit}
        onCopy={() => {}}
        onPaste={() => {}}
        onCut={() => {}}
        onClearCells={() => {}}
        onSelectAll={() => {}}
        onSetSelectionAnchor={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
        headerConfig={{ hasColumnHeaders: true }}
      />
    )

    // create a focused textarea with cell-input class (the scenario that used to block Enter)
    const ta = document.createElement('textarea')
    ta.classList.add('cell-input')
    document.body.appendChild(ta)
    ta.focus()

    // dispatch Enter key
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    document.dispatchEvent(ev)

    expect(mockOnCellEdit).toHaveBeenCalledTimes(1)
  })

  test('Enter should NOT start editing if a cell is already being edited (currentEditingCell set)', () => {
    const mockOnCellEdit = jest.fn()

    const tableData = {
      headers: ['a', 'b'],
      rows: [['1', '2'], ['3', '4']]
    }

    const selectionRange = { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }

    render(
      <TestHarness
        tableData={tableData}
        currentEditingCell={{ row: 0, col: 0 }}
        selectionRange={selectionRange}
        selectionAnchor={null}
        onCellSelect={() => {}}
        onCellEdit={mockOnCellEdit}
        onCopy={() => {}}
        onPaste={() => {}}
        onCut={() => {}}
        onClearCells={() => {}}
        onSelectAll={() => {}}
        onSetSelectionAnchor={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
        headerConfig={{ hasColumnHeaders: true }}
      />
    )

    const ta = document.createElement('textarea')
    ta.classList.add('cell-input')
    document.body.appendChild(ta)
    ta.focus()

    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    document.dispatchEvent(ev)

    expect(mockOnCellEdit).toHaveBeenCalledTimes(0)
  })
})
