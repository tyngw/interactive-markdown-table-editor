import { useState, useEffect, useCallback } from 'react'

interface VSCodeTheme {
  // Editor colors
  'editor.background': string
  'editor.foreground': string
  'editor.lineHighlightBackground': string
  'editor.selectionBackground': string
  'editor.selectionHighlightBackground': string
  'editor.hoverHighlightBackground': string
  
  // Panel colors
  'panel.border': string
  'panel.background': string
  
  // Sidebar colors
  'sideBar.background': string
  'sideBar.foreground': string
  
  // Activity bar colors
  'activityBar.background': string
  'activityBar.foreground': string
  
  // List colors
  'list.activeSelectionBackground': string
  'list.activeSelectionForeground': string
  'list.inactiveSelectionBackground': string
  'list.hoverBackground': string
  'list.focusBackground': string
  'list.dropBackground': string
  
  // Button colors
  'button.background': string
  'button.foreground': string
  'button.hoverBackground': string
  'button.secondaryBackground': string
  'button.secondaryForeground': string
  'button.secondaryHoverBackground': string
  'button.border': string
  
  // Input colors
  'input.background': string
  'input.foreground': string
  'input.border': string
  
  // Focus colors
  'focusBorder': string
  
  // Status bar colors
  'statusBar.background': string
  'statusBar.foreground': string
  'statusBar.border': string
  'statusBarItem.prominentForeground': string
  'statusBarItem.errorForeground': string
  'statusBarItem.warningForeground': string
  
  // Menu colors
  'menu.background': string
  'menu.foreground': string
  'menu.border': string
  'menu.separatorBackground': string
  
  // Dropdown colors
  'dropdown.background': string
  'dropdown.foreground': string
  'dropdown.border': string
  'dropdown.listBackground': string
  
  // Tab colors
  'tab.activeBackground': string
  'tab.activeForeground': string
  'tab.activeBorderTop': string
  'tab.inactiveBackground': string
  'tab.inactiveForeground': string
  'tab.hoverBackground': string
  
  // Editor group header colors
  'editorGroupHeader.tabsBackground': string
  
  // Panel section header colors
  'panelSectionHeader.background': string
  
  // Notification colors
  'notifications.background': string
  'notifications.foreground': string
  'notifications.border': string
  
  // Widget colors
  'widget.shadow': string
  
  // Description colors
  'descriptionForeground': string
  
  // Disabled colors
  'disabledForeground': string
  
  // Error colors
  'errorForeground': string
  
  // Input validation colors
  'inputValidation.errorBackground': string
  'inputValidation.errorBorder': string
  
  // Input option colors
  'inputOption.activeBorder': string
  
  // Charts colors
  'charts.green': string
  'charts.orange': string
  'charts.red': string
}

export function useVSCodeTheme() {
  const [theme, setTheme] = useState<Partial<VSCodeTheme>>({})
  const [isLoaded, setIsLoaded] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Get theme colors from VSCode
  const getThemeColors = useCallback(() => {
    try {
      // Wait a bit for DOM to be ready
      /* istanbul ignore if -- jsdomでは常にdocumentElementが存在するため到達不能 */
      if (!document.documentElement) {
        setTimeout(getThemeColors, 50)
        return
      }
      
      // VSCode provides theme colors through CSS custom properties
  const hostEl = (document.getElementById('mte-root') || document.getElementById('root') || document.documentElement) as HTMLElement
  const computedStyle = getComputedStyle(hostEl)

      const themeColors: Partial<VSCodeTheme> = {
        'editor.background': computedStyle.getPropertyValue('--vscode-editor-background').trim(),
        'editor.foreground': computedStyle.getPropertyValue('--vscode-editor-foreground').trim(),
        'editor.lineHighlightBackground': computedStyle.getPropertyValue('--vscode-editor-lineHighlightBackground').trim(),
        'editor.selectionBackground': computedStyle.getPropertyValue('--vscode-editor-selectionBackground').trim(),
        'editor.selectionHighlightBackground': computedStyle.getPropertyValue('--vscode-editor-selectionHighlightBackground').trim(),
        'editor.hoverHighlightBackground': computedStyle.getPropertyValue('--vscode-editor-hoverHighlightBackground').trim(),
        'panel.border': computedStyle.getPropertyValue('--vscode-panel-border').trim(),
        'panel.background': computedStyle.getPropertyValue('--vscode-panel-background').trim(),
        'sideBar.background': computedStyle.getPropertyValue('--vscode-sideBar-background').trim(),
        'sideBar.foreground': computedStyle.getPropertyValue('--vscode-sideBar-foreground').trim(),
        'activityBar.background': computedStyle.getPropertyValue('--vscode-activityBar-background').trim(),
        'activityBar.foreground': computedStyle.getPropertyValue('--vscode-activityBar-foreground').trim(),
        'list.activeSelectionBackground': computedStyle.getPropertyValue('--vscode-list-activeSelectionBackground').trim(),
        'list.activeSelectionForeground': computedStyle.getPropertyValue('--vscode-list-activeSelectionForeground').trim(),
        'list.inactiveSelectionBackground': computedStyle.getPropertyValue('--vscode-list-inactiveSelectionBackground').trim(),
        'list.hoverBackground': computedStyle.getPropertyValue('--vscode-list-hoverBackground').trim(),
        'list.focusBackground': computedStyle.getPropertyValue('--vscode-list-focusBackground').trim(),
        'list.dropBackground': computedStyle.getPropertyValue('--vscode-list-dropBackground').trim(),
        'button.background': computedStyle.getPropertyValue('--vscode-button-background').trim(),
        'button.foreground': computedStyle.getPropertyValue('--vscode-button-foreground').trim(),
        'button.hoverBackground': computedStyle.getPropertyValue('--vscode-button-hoverBackground').trim(),
        'button.secondaryBackground': computedStyle.getPropertyValue('--vscode-button-secondaryBackground').trim(),
        'button.secondaryForeground': computedStyle.getPropertyValue('--vscode-button-secondaryForeground').trim(),
        'button.secondaryHoverBackground': computedStyle.getPropertyValue('--vscode-button-secondaryHoverBackground').trim(),
        'button.border': computedStyle.getPropertyValue('--vscode-button-border').trim(),
        'input.background': computedStyle.getPropertyValue('--vscode-input-background').trim(),
        'input.foreground': computedStyle.getPropertyValue('--vscode-input-foreground').trim(),
        'input.border': computedStyle.getPropertyValue('--vscode-input-border').trim(),
        'focusBorder': computedStyle.getPropertyValue('--vscode-focusBorder').trim(),
        'statusBar.background': computedStyle.getPropertyValue('--vscode-statusBar-background').trim(),
        'statusBar.foreground': computedStyle.getPropertyValue('--vscode-statusBar-foreground').trim(),
        'statusBar.border': computedStyle.getPropertyValue('--vscode-statusBar-border').trim(),
        'statusBarItem.prominentForeground': computedStyle.getPropertyValue('--vscode-statusBarItem-prominentForeground').trim(),
        'statusBarItem.errorForeground': computedStyle.getPropertyValue('--vscode-statusBarItem-errorForeground').trim(),
        'statusBarItem.warningForeground': computedStyle.getPropertyValue('--vscode-statusBarItem-warningForeground').trim(),
        'menu.background': computedStyle.getPropertyValue('--vscode-menu-background').trim(),
        'menu.foreground': computedStyle.getPropertyValue('--vscode-menu-foreground').trim(),
        'menu.border': computedStyle.getPropertyValue('--vscode-menu-border').trim(),
        'menu.separatorBackground': computedStyle.getPropertyValue('--vscode-menu-separatorBackground').trim(),
        'dropdown.background': computedStyle.getPropertyValue('--vscode-dropdown-background').trim(),
        'dropdown.foreground': computedStyle.getPropertyValue('--vscode-dropdown-foreground').trim(),
        'dropdown.border': computedStyle.getPropertyValue('--vscode-dropdown-border').trim(),
        'dropdown.listBackground': computedStyle.getPropertyValue('--vscode-dropdown-listBackground').trim(),
        'tab.activeBackground': computedStyle.getPropertyValue('--vscode-tab-activeBackground').trim(),
        'tab.activeForeground': computedStyle.getPropertyValue('--vscode-tab-activeForeground').trim(),
        'tab.activeBorderTop': computedStyle.getPropertyValue('--vscode-tab-activeBorderTop').trim(),
        'tab.inactiveBackground': computedStyle.getPropertyValue('--vscode-tab-inactiveBackground').trim(),
        'tab.inactiveForeground': computedStyle.getPropertyValue('--vscode-tab-inactiveForeground').trim(),
        'tab.hoverBackground': computedStyle.getPropertyValue('--vscode-tab-hoverBackground').trim(),
        'editorGroupHeader.tabsBackground': computedStyle.getPropertyValue('--vscode-editorGroupHeader-tabsBackground').trim(),
        'panelSectionHeader.background': computedStyle.getPropertyValue('--vscode-panelSectionHeader-background').trim(),
        'notifications.background': computedStyle.getPropertyValue('--vscode-notifications-background').trim(),
        'notifications.foreground': computedStyle.getPropertyValue('--vscode-notifications-foreground').trim(),
        'notifications.border': computedStyle.getPropertyValue('--vscode-notifications-border').trim(),
        'widget.shadow': computedStyle.getPropertyValue('--vscode-widget-shadow').trim(),
        'descriptionForeground': computedStyle.getPropertyValue('--vscode-descriptionForeground').trim(),
        'disabledForeground': computedStyle.getPropertyValue('--vscode-disabledForeground').trim(),
        'errorForeground': computedStyle.getPropertyValue('--vscode-errorForeground').trim(),
        'inputValidation.errorBackground': computedStyle.getPropertyValue('--vscode-inputValidation-errorBackground').trim(),
        'inputValidation.errorBorder': computedStyle.getPropertyValue('--vscode-inputValidation-errorBorder').trim(),
        'inputOption.activeBorder': computedStyle.getPropertyValue('--vscode-inputOption-activeBorder').trim(),
        'charts.green': computedStyle.getPropertyValue('--vscode-charts-green').trim(),
        'charts.orange': computedStyle.getPropertyValue('--vscode-charts-orange').trim(),
        'charts.red': computedStyle.getPropertyValue('--vscode-charts-red').trim(),
      }

      setTheme(themeColors)
      setIsLoaded(true)
      setInitialLoadDone(true)
    } catch (error) {
      console.error('Failed to load VSCode theme colors', error)
      // VSCode Webview ではテーマ変数が提供される前提。フォールバックは行わず、ログのみに留める。
      setIsLoaded(true)
      setInitialLoadDone(true)
    }
  }, [initialLoadDone])

  // Function to apply theme variables (compatible with original implementation)
  const applyThemeVariables = useCallback((data: any) => {
    try {
      // Handle cssText format (original implementation)
  if (data && data.cssText) {
        
    // Scope :root to #mte-root to avoid clobbering VS Code globals
    const scopeSelector = '#mte-root'
    const scopedCss = data.cssText.replace(/:root\s*\{/g, `${scopeSelector}{`)
        
  let styleEl = document.getElementById('mte-theme-override')
        if (!styleEl) {
          styleEl = document.createElement('style')
          styleEl.id = 'mte-theme-override'
          document.head.appendChild(styleEl)
        }
  styleEl.textContent = scopedCss

        // Extract updated theme colors immediately after applying CSS
        // but don't trigger getThemeColors() to avoid infinite loop
  const hostEl = (document.getElementById('mte-root') || document.getElementById('root') || document.documentElement) as HTMLElement
  const computedStyle = getComputedStyle(hostEl)
        const updatedTheme: Partial<VSCodeTheme> = {
          'editor.background': computedStyle.getPropertyValue('--vscode-editor-background').trim() || '#ffffff',
          'editor.foreground': computedStyle.getPropertyValue('--vscode-editor-foreground').trim() || '#000000',
          'sideBar.background': computedStyle.getPropertyValue('--vscode-sideBar-background').trim() || '#f8f8f8',
          'panel.border': computedStyle.getPropertyValue('--vscode-panel-border').trim() || '#e0e0e0',
          'list.activeSelectionBackground': computedStyle.getPropertyValue('--vscode-list-activeSelectionBackground').trim() || '#0078d4',
          'focusBorder': computedStyle.getPropertyValue('--vscode-focusBorder').trim() || '#0078d4',
        }
        
        // Update theme state without re-triggering getThemeColors
        setTheme(prevTheme => ({
          ...prevTheme,
          ...updatedTheme
        }))
      }

      // Handle direct variables format
      else if (data && typeof data === 'object') {
        
  const root = (document.getElementById('mte-root') || document.getElementById('root') || document.documentElement) as HTMLElement
        Object.entries(data).forEach(([key, value]) => {
          // Convert key format if needed (e.g., 'editor.background' -> '--vscode-editor-background')
          const cssVarName = key.startsWith('--') ? key : `--vscode-${key.replace(/\./g, '-')}`
          root.style.setProperty(cssVarName, value as string)
        })
        
        // Update theme state with the new values
        const newThemeValues: Partial<VSCodeTheme> = {}
        Object.entries(data).forEach(([key, value]) => {
          const themeKey = key.replace('--vscode-', '').replace(/-/g, '.') as keyof VSCodeTheme
          newThemeValues[themeKey] = value as string
        })
        
        setTheme(prevTheme => ({
          ...prevTheme,
          ...newThemeValues
        }))
      }

    } catch (error) {
      console.error('Error applying theme variables', error)
    }
  }, [])

  // Expose the function for external use
  const exposedApplyThemeVariables = useCallback(applyThemeVariables, [applyThemeVariables])

  useEffect(() => {
    // Load theme colors only once during initial load
    if (!initialLoadDone) {
      const timeoutId = setTimeout(getThemeColors, 100)

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [getThemeColors, initialLoadDone])

  return { theme, isLoaded, applyThemeVariables: exposedApplyThemeVariables }
}