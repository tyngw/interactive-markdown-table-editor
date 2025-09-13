import { createContext, useContext, ReactNode } from 'react'
import { useVSCodeTheme } from '../hooks/useVSCodeTheme'

interface ThemeContextType {
  theme: any
  isLoaded: boolean
  getStyle: (styleKey: string, fallback?: string) => string
  applyThemeVariables: (data: any) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, isLoaded, applyThemeVariables } = useVSCodeTheme()

  const getStyle = (styleKey: string, fallback: string = '#000000') => {
    try {
      // First, try to get the value from CSS variables (which can be overridden by external CSS)
      const cssVarName = `--vscode-${styleKey.replace('.', '-')}`
      const computedStyle = getComputedStyle(document.documentElement)
      const cssValue = computedStyle.getPropertyValue(cssVarName).trim()
      
      // Debug logging for first few calls
      if (Math.random() < 0.1) { // Log 10% of calls to avoid spam
        console.log(`=== STYLE DEBUG: getStyle('${styleKey}') ===`)
        console.log(`CSS Variable: ${cssVarName}`)
        console.log(`CSS Value: "${cssValue}"`)
        console.log(`Theme Value: "${theme[styleKey as keyof typeof theme]}"`)
        console.log(`Fallback: "${fallback}"`)
      }
      
      if (cssValue) {
        return cssValue
      }
      
      // Fallback to theme object value
      const themeValue = theme[styleKey as keyof typeof theme] || fallback
      return themeValue
    } catch (error) {
      console.warn('=== STYLE DEBUG: Error getting theme style ===', error)
      return fallback
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, isLoaded, getStyle, applyThemeVariables }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    // Fallback theme if context is not available
    return {
      theme: {},
      isLoaded: true,
      getStyle: (styleKey: string, fallback: string = '#000000') => fallback,
      applyThemeVariables: (data: any) => {
        console.warn('Theme context not available, cannot apply variables:', data)
      }
    }
  }
  return context
}