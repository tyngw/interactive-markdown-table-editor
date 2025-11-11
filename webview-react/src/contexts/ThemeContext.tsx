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

      if (cssValue) {
        return cssValue
      }

      // Fallback to theme object value
      const themeValue = theme[styleKey as keyof typeof theme] || fallback
      return themeValue
    } catch (error) {
      console.warn('Error getting theme style', error)
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