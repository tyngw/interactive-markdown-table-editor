/**
 * SortActions.test.tsx
 * SortActionsコンポーネントのテスト
 * ソート状態表示、ソート確定ボタン、元に戻すボタンの動作を検証
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import SortActions from '../components/SortActions'
import { DynamicThemeProvider } from '../contexts/DynamicThemeContext'

describe('SortActions', () => {
  const mockOnCommitSort = jest.fn()
  const mockOnRestoreOriginal = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const renderSortActions = (props = {}) => {
    return render(
      <DynamicThemeProvider>
        <SortActions
          onCommitSort={mockOnCommitSort}
          onRestoreOriginal={mockOnRestoreOriginal}
          {...props}
        />
      </DynamicThemeProvider>
    )
  }

  it('ソート状態バッジが表示される', () => {
    renderSortActions()
    // i18n ja: sortActions.viewingSorted = "📊 ソート済みデータを表示中"
    expect(screen.getByText(/ソート済みデータを表示中/)).toBeInTheDocument()
  })

  it('元の順序を復元ボタンが表示される', () => {
    renderSortActions()
    // i18n ja: sortActions.restoreOriginal = "📄 元の順序を復元"
    expect(screen.getByText(/元の順序を復元/)).toBeInTheDocument()
  })

  it('ソート順をファイルに保存ボタンが表示される', () => {
    renderSortActions()
    // i18n ja: sortActions.saveSortToFile = "💾 ソート順をファイルに保存"
    expect(screen.getByText(/ソート順をファイルに保存/)).toBeInTheDocument()
  })

  it('元の順序を復元ボタンをクリックするとonRestoreOriginalが呼ばれる', async () => {
    const user = userEvent.setup()
    renderSortActions()
    await user.click(screen.getByText(/元の順序を復元/))
    expect(mockOnRestoreOriginal).toHaveBeenCalledTimes(1)
  })

  it('ソート順をファイルに保存ボタンをクリックするとonCommitSortが呼ばれる', async () => {
    const user = userEvent.setup()
    renderSortActions()
    await user.click(screen.getByText(/ソート順をファイルに保存/))
    expect(mockOnCommitSort).toHaveBeenCalledTimes(1)
  })

  it('sort-actions visibleクラスが適用されている', () => {
    const { container } = renderSortActions()
    const sortActionsDiv = container.querySelector('.sort-actions.visible')
    expect(sortActionsDiv).toBeInTheDocument()
  })

  it('sort-status-badgeクラスが適用されている', () => {
    const { container } = renderSortActions()
    const badge = container.querySelector('.sort-status-badge')
    expect(badge).toBeInTheDocument()
  })

  it('ボタンにsort-action-btnクラスが適用されている', () => {
    const { container } = renderSortActions()
    const buttons = container.querySelectorAll('.sort-action-btn')
    expect(buttons).toHaveLength(2)
  })

  it('元の順序を復元ボタンにsecondaryクラスが適用されている', () => {
    const { container } = renderSortActions()
    const secondaryButton = container.querySelector('.sort-action-btn.secondary')
    expect(secondaryButton).toBeInTheDocument()
    expect(secondaryButton?.textContent).toMatch(/元の順序を復元/)
  })
})
