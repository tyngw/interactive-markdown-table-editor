/**
 * TableTabs.styles.test.ts
 * TableTabs.stylesのstyled componentsが正しくエクスポートされているかを検証
 */

import {
  TabsContainer,
  TabButton,
  BottomChrome,
} from '../components/TableTabs.styles'

describe('TableTabs.styles', () => {
  it('TabsContainerがエクスポートされている', () => {
    expect(TabsContainer).toBeDefined()
  })

  it('TabButtonがエクスポートされている', () => {
    expect(TabButton).toBeDefined()
  })

  it('BottomChromeがエクスポートされている', () => {
    expect(BottomChrome).toBeDefined()
  })
})
