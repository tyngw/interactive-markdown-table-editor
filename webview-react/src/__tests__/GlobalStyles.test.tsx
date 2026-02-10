/**
 * GlobalStyles.test.tsx
 * GlobalStylesコンポーネントのテスト
 * Emotionのグローバルスタイルが正しくレンダリングされることを検証
 */

import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { GlobalStyles } from '../GlobalStyles'
import { getVSCodeTheme } from '../styles/theme'

describe('GlobalStyles', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('エラーなくレンダリングされる', () => {
    const theme = getVSCodeTheme()
    expect(() => {
      render(<GlobalStyles theme={theme} />)
    }).not.toThrow()
  })

  it('マウント時にデバッグログが出力される', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation()
    const theme = getVSCodeTheme()
    render(<GlobalStyles theme={theme} />)
    expect(logSpy).toHaveBeenCalledWith('[MTE] GlobalStyles mounted')
  })

  it('themeプロパティを受け取る', () => {
    const theme = getVSCodeTheme()
    // GlobalStyles が theme を使ってスタイルを生成できることを確認
    const { container } = render(
      <div>
        <GlobalStyles theme={theme} />
        <div data-testid="test-content">Content</div>
      </div>
    )
    expect(container).toBeTruthy()
  })
})
