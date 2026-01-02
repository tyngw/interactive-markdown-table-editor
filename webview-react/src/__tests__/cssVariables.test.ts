import { applyCssVariablesInline } from '../utils/cssVariables'

describe('applyCssVariablesInline', () => {
  it('extracts vscode variables and applies them inline', () => {
    const el = document.createElement('div')
    const cssText = ':root{--vscode-editor-background:#ffffff;--vscode-foreground:#000000;}#mte-root{--vscode-editor-background:#f0f0f0;}'

    const applied = applyCssVariablesInline(cssText, el)

    expect(applied).toBe(3)
    expect(el.style.getPropertyValue('--vscode-editor-background')).toBe('#f0f0f0')
    expect(el.style.getPropertyValue('--vscode-foreground')).toBe('#000000')
  })

  it('returns 0 when cssText is empty', () => {
    const el = document.createElement('div')
    const applied = applyCssVariablesInline('', el)
    expect(applied).toBe(0)
  })
})
