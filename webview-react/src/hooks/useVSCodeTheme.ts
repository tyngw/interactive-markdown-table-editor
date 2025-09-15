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
      console.log('=== THEME DEBUG: getThemeColors called ===')
      
      // Wait a bit for DOM to be ready
      if (!document.documentElement) {
        console.log('=== THEME DEBUG: DOM not ready, retrying in 50ms ===')
        setTimeout(getThemeColors, 50)
        return
      }
      
      // VSCode provides theme colors through CSS custom properties
  const hostEl = (document.getElementById('mte-root') || document.getElementById('root') || document.documentElement) as HTMLElement
  const computedStyle = getComputedStyle(hostEl)
      console.log('=== THEME DEBUG: Getting computed styles ===')
      
      const themeColors: Partial<VSCodeTheme> = {
        'editor.background': computedStyle.getPropertyValue('--vscode-editor-background').trim() || '#ffffff',
        'editor.foreground': computedStyle.getPropertyValue('--vscode-editor-foreground').trim() || '#000000',
        'editor.lineHighlightBackground': computedStyle.getPropertyValue('--vscode-editor-lineHighlightBackground').trim() || '#f0f0f0',
        'editor.selectionBackground': computedStyle.getPropertyValue('--vscode-editor-selectionBackground').trim() || '#add6ff',
        'editor.selectionHighlightBackground': computedStyle.getPropertyValue('--vscode-editor-selectionHighlightBackground').trim() || '#e0e0e0',
        'editor.hoverHighlightBackground': computedStyle.getPropertyValue('--vscode-editor-hoverHighlightBackground').trim() || '#f0f0f0',
        
        'panel.border': computedStyle.getPropertyValue('--vscode-panel-border').trim() || '#e0e0e0',
        'panel.background': computedStyle.getPropertyValue('--vscode-panel-background').trim() || '#ffffff',
        
        'sideBar.background': computedStyle.getPropertyValue('--vscode-sideBar-background').trim() || '#f8f8f8',
        'sideBar.foreground': computedStyle.getPropertyValue('--vscode-sideBar-foreground').trim() || '#000000',
        
        'activityBar.background': computedStyle.getPropertyValue('--vscode-activityBar-background').trim() || '#f0f0f0',
        'activityBar.foreground': computedStyle.getPropertyValue('--vscode-activityBar-foreground').trim() || '#000000',
        
        'list.activeSelectionBackground': computedStyle.getPropertyValue('--vscode-list-activeSelectionBackground').trim() || '#0078d4',
        'list.activeSelectionForeground': computedStyle.getPropertyValue('--vscode-list-activeSelectionForeground').trim() || '#ffffff',
        'list.inactiveSelectionBackground': computedStyle.getPropertyValue('--vscode-list-inactiveSelectionBackground').trim() || '#e4e6f1',
        'list.hoverBackground': computedStyle.getPropertyValue('--vscode-list-hoverBackground').trim() || '#f0f0f0',
        'list.focusBackground': computedStyle.getPropertyValue('--vscode-list-focusBackground').trim() || '#e0e0e0',
        'list.dropBackground': computedStyle.getPropertyValue('--vscode-list-dropBackground').trim() || '#d0d0d0',
        
        'button.background': computedStyle.getPropertyValue('--vscode-button-background').trim() || '#0078d4',
        'button.foreground': computedStyle.getPropertyValue('--vscode-button-foreground').trim() || '#ffffff',
        'button.hoverBackground': computedStyle.getPropertyValue('--vscode-button-hoverBackground').trim() || '#106ebe',
        'button.secondaryBackground': computedStyle.getPropertyValue('--vscode-button-secondaryBackground').trim() || '#f0f0f0',
        'button.secondaryForeground': computedStyle.getPropertyValue('--vscode-button-secondaryForeground').trim() || '#000000',
        'button.secondaryHoverBackground': computedStyle.getPropertyValue('--vscode-button-secondaryHoverBackground').trim() || '#e0e0e0',
        'button.border': computedStyle.getPropertyValue('--vscode-button-border').trim() || '#d0d0d0',
        
        'input.background': computedStyle.getPropertyValue('--vscode-input-background').trim() || '#ffffff',
        'input.foreground': computedStyle.getPropertyValue('--vscode-input-foreground').trim() || '#000000',
        'input.border': computedStyle.getPropertyValue('--vscode-input-border').trim() || '#d0d0d0',
        
        'focusBorder': computedStyle.getPropertyValue('--vscode-focusBorder').trim() || '#0078d4',
        
        'statusBar.background': computedStyle.getPropertyValue('--vscode-statusBar-background').trim() || '#007acc',
        'statusBar.foreground': computedStyle.getPropertyValue('--vscode-statusBar-foreground').trim() || '#ffffff',
        'statusBar.border': computedStyle.getPropertyValue('--vscode-statusBar-border').trim() || '#005a9e',
        'statusBarItem.prominentForeground': computedStyle.getPropertyValue('--vscode-statusBarItem-prominentForeground').trim() || '#ffffff',
        'statusBarItem.errorForeground': computedStyle.getPropertyValue('--vscode-statusBarItem-errorForeground').trim() || '#ff6b6b',
        'statusBarItem.warningForeground': computedStyle.getPropertyValue('--vscode-statusBarItem-warningForeground').trim() || '#ffab00',
        
        'menu.background': computedStyle.getPropertyValue('--vscode-menu-background').trim() || '#ffffff',
        'menu.foreground': computedStyle.getPropertyValue('--vscode-menu-foreground').trim() || '#000000',
        'menu.border': computedStyle.getPropertyValue('--vscode-menu-border').trim() || '#d0d0d0',
        'menu.separatorBackground': computedStyle.getPropertyValue('--vscode-menu-separatorBackground').trim() || '#e0e0e0',
        
        'dropdown.background': computedStyle.getPropertyValue('--vscode-dropdown-background').trim() || '#ffffff',
        'dropdown.foreground': computedStyle.getPropertyValue('--vscode-dropdown-foreground').trim() || '#000000',
        'dropdown.border': computedStyle.getPropertyValue('--vscode-dropdown-border').trim() || '#d0d0d0',
        'dropdown.listBackground': computedStyle.getPropertyValue('--vscode-dropdown-listBackground').trim() || '#f8f8f8',
        
        'tab.activeBackground': computedStyle.getPropertyValue('--vscode-tab-activeBackground').trim() || '#ffffff',
        'tab.activeForeground': computedStyle.getPropertyValue('--vscode-tab-activeForeground').trim() || '#000000',
        'tab.activeBorderTop': computedStyle.getPropertyValue('--vscode-tab-activeBorderTop').trim() || '#0078d4',
        'tab.inactiveBackground': computedStyle.getPropertyValue('--vscode-tab-inactiveBackground').trim() || '#f8f8f8',
        'tab.inactiveForeground': computedStyle.getPropertyValue('--vscode-tab-inactiveForeground').trim() || '#666666',
        'tab.hoverBackground': computedStyle.getPropertyValue('--vscode-tab-hoverBackground').trim() || '#f0f0f0',
        
        'editorGroupHeader.tabsBackground': computedStyle.getPropertyValue('--vscode-editorGroupHeader-tabsBackground').trim() || '#f8f8f8',
        'panelSectionHeader.background': computedStyle.getPropertyValue('--vscode-panelSectionHeader-background').trim() || '#f0f0f0',
        
        'notifications.background': computedStyle.getPropertyValue('--vscode-notifications-background').trim() || '#ffffff',
        'notifications.foreground': computedStyle.getPropertyValue('--vscode-notifications-foreground').trim() || '#000000',
        'notifications.border': computedStyle.getPropertyValue('--vscode-notifications-border').trim() || '#d0d0d0',
        
        'widget.shadow': computedStyle.getPropertyValue('--vscode-widget-shadow').trim() || 'rgba(0, 0, 0, 0.1)',
        
        'descriptionForeground': computedStyle.getPropertyValue('--vscode-descriptionForeground').trim() || '#666666',
        'disabledForeground': computedStyle.getPropertyValue('--vscode-disabledForeground').trim() || '#999999',
        'errorForeground': computedStyle.getPropertyValue('--vscode-errorForeground').trim() || '#ff6b6b',
        
        'inputValidation.errorBackground': computedStyle.getPropertyValue('--vscode-inputValidation-errorBackground').trim() || '#ffe6e6',
        'inputValidation.errorBorder': computedStyle.getPropertyValue('--vscode-inputValidation-errorBorder').trim() || '#ff6b6b',
        
        'inputOption.activeBorder': computedStyle.getPropertyValue('--vscode-inputOption-activeBorder').trim() || '#0078d4',
        
        'charts.green': computedStyle.getPropertyValue('--vscode-charts-green').trim() || '#28a745',
        'charts.orange': computedStyle.getPropertyValue('--vscode-charts-orange').trim() || '#fd7e14',
        'charts.red': computedStyle.getPropertyValue('--vscode-charts-red').trim() || '#dc3545',
      }

      console.log('=== THEME DEBUG: Theme colors extracted ===')
      console.log('Sample theme colors:', {
        'editor.background': themeColors['editor.background'],
        'editor.foreground': themeColors['editor.foreground'],
        'sideBar.background': themeColors['sideBar.background'],
        'panel.border': themeColors['panel.border']
      })
      
      setTheme(themeColors)
      setIsLoaded(true)
      setInitialLoadDone(true)
      console.log('=== THEME DEBUG: Theme loaded successfully ===')
    } catch (error) {
      console.error('=== THEME DEBUG: Failed to load VSCode theme colors ===', error)
      // VSCode Webview ではテーマ変数が提供される前提。フォールバックは行わず、ログのみに留める。
      setIsLoaded(true)
      setInitialLoadDone(true)
    }
  }, [initialLoadDone])

  // Function to apply theme variables (compatible with original implementation)
  const applyThemeVariables = useCallback((data: any) => {
    console.log('=== THEME DEBUG: Applying theme variables ===', data)
    
    try {
      // Handle cssText format (original implementation)
  if (data && data.cssText) {
    console.log('=== THEME DEBUG: Applying cssText ===', data.cssText)
        
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
        
        console.log('=== THEME DEBUG: Applied cssText to style element ===')
        
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
        
        console.log('=== THEME DEBUG: Theme updated from applied CSS variables ===')
      }
      
      // Handle direct variables format
      else if (data && typeof data === 'object') {
        console.log('=== THEME DEBUG: Applying direct variables ===')
        
  const root = (document.getElementById('mte-root') || document.getElementById('root') || document.documentElement) as HTMLElement
        Object.entries(data).forEach(([key, value]) => {
          // Convert key format if needed (e.g., 'editor.background' -> '--vscode-editor-background')
          const cssVarName = key.startsWith('--') ? key : `--vscode-${key.replace(/\./g, '-')}`
          root.style.setProperty(cssVarName, value as string)
          console.log(`Set ${cssVarName} = ${value}`)
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
      console.error('=== THEME DEBUG: Error applying theme variables ===', error)
    }
  }, [])

  // Expose the function for external use
  const exposedApplyThemeVariables = useCallback(applyThemeVariables, [applyThemeVariables])

  useEffect(() => {
    // Load theme colors only once during initial load
    if (!initialLoadDone) {
      console.log('=== THEME DEBUG: Initial theme load ===')
      const timeoutId = setTimeout(getThemeColors, 100)
      
      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [getThemeColors, initialLoadDone])

  return { theme, isLoaded, applyThemeVariables: exposedApplyThemeVariables }
}