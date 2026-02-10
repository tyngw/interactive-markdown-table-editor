/**
 * StatusContext.test.tsx
 * StatusProvider / useStatus のテスト
 * 各種状態更新メソッド（updateStatus, updateSortState, clearStatus等）と
 * Provider外でのエラースローを検証
 */

import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StatusProvider, useStatus } from '../../contexts/StatusContext'

// テスト用のコンシューマーコンポーネント
let statusCtx: ReturnType<typeof useStatus> | null = null
const StatusConsumer: React.FC = () => {
  const ctx = useStatus()
  statusCtx = ctx
  return (
    <div>
      <span data-testid="message">{ctx.status.message || ''}</span>
      <span data-testid="type">{ctx.status.type || ''}</span>
      <span data-testid="selection">{ctx.status.selection || ''}</span>
      <span data-testid="table-info">
        {ctx.tableInfo ? `${ctx.tableInfo.rows}x${ctx.tableInfo.columns}` : 'none'}
      </span>
      <span data-testid="save-status">{ctx.saveStatus || 'null'}</span>
      <span data-testid="sort-state">
        {ctx.sortState ? `${ctx.sortState.column}-${ctx.sortState.direction}` : 'none'}
      </span>
    </div>
  )
}

describe('StatusContext', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    statusCtx = null
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const renderConsumer = () => {
    return render(
      <StatusProvider>
        <StatusConsumer />
      </StatusProvider>
    )
  }

  describe('StatusProvider', () => {
    it('初期状態が正しい', () => {
      renderConsumer()
      expect(screen.getByTestId('message')).toHaveTextContent('')
      expect(screen.getByTestId('table-info')).toHaveTextContent('none')
      expect(screen.getByTestId('save-status')).toHaveTextContent('null')
      expect(screen.getByTestId('sort-state')).toHaveTextContent('none')
    })

    it('updateStatusでメッセージが設定される', () => {
      renderConsumer()
      act(() => {
        statusCtx!.updateStatus('info', 'テストメッセージ')
      })
      expect(screen.getByTestId('message')).toHaveTextContent('テストメッセージ')
      expect(screen.getByTestId('type')).toHaveTextContent('info')
    })

    it('updateStatus後3000msでメッセージがクリアされる', () => {
      renderConsumer()
      act(() => {
        statusCtx!.updateStatus('error', 'エラー発生')
      })
      expect(screen.getByTestId('message')).toHaveTextContent('エラー発生')

      act(() => {
        jest.advanceTimersByTime(3000)
      })
      expect(screen.getByTestId('message')).toHaveTextContent('')
      expect(screen.getByTestId('type')).toHaveTextContent('')
    })

    it('updateSelectionで選択情報が更新される', () => {
      renderConsumer()
      act(() => {
        statusCtx!.updateSelection('A1:C3')
      })
      expect(screen.getByTestId('selection')).toHaveTextContent('A1:C3')
    })

    it('updateTableInfoでテーブル情報が更新される', () => {
      renderConsumer()
      act(() => {
        statusCtx!.updateTableInfo(5, 3)
      })
      expect(screen.getByTestId('table-info')).toHaveTextContent('5x3')
    })

    it('updateSaveStatusで保存状態が更新される', () => {
      renderConsumer()
      act(() => {
        statusCtx!.updateSaveStatus('saving')
      })
      expect(screen.getByTestId('save-status')).toHaveTextContent('saving')
    })

    it('updateSaveStatusでsavedを設定後2000msでnullになる', () => {
      renderConsumer()
      act(() => {
        statusCtx!.updateSaveStatus('saved')
      })
      expect(screen.getByTestId('save-status')).toHaveTextContent('saved')

      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(screen.getByTestId('save-status')).toHaveTextContent('null')
    })

    it('updateSortStateでソート状態が更新される', () => {
      renderConsumer()
      act(() => {
        statusCtx!.updateSortState({ column: 2, direction: 'desc' })
      })
      expect(screen.getByTestId('sort-state')).toHaveTextContent('2-desc')
    })

    it('clearStatusで全状態がクリアされる', () => {
      renderConsumer()
      // まず状態を設定
      act(() => {
        statusCtx!.updateStatus('warning', '警告メッセージ')
        statusCtx!.updateSelection('B2:D4')
        statusCtx!.updateTableInfo(10, 5)
        statusCtx!.updateSaveStatus('error')
        statusCtx!.updateSortState({ column: 1, direction: 'asc' })
      })
      expect(screen.getByTestId('message')).toHaveTextContent('警告メッセージ')
      expect(screen.getByTestId('save-status')).toHaveTextContent('error')
      expect(screen.getByTestId('sort-state')).toHaveTextContent('1-asc')

      // clearStatusを呼ぶ
      act(() => {
        statusCtx!.clearStatus()
      })
      // status, saveStatus, sortState がクリアされる
      // (selection は clearStatus 内で setStatus({}) により消える)
      expect(screen.getByTestId('message')).toHaveTextContent('')
      expect(screen.getByTestId('save-status')).toHaveTextContent('null')
      expect(screen.getByTestId('sort-state')).toHaveTextContent('none')
    })
  })

  describe('useStatus (コンテキスト外)', () => {
    it('StatusProvider外で使用するとエラーがスローされる', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      expect(() => {
        render(<StatusConsumer />)
      }).toThrow('useStatus must be used within a StatusProvider')

      errorSpy.mockRestore()
    })
  })
})
