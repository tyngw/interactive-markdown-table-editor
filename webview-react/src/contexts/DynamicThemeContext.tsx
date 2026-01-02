/**
 * DynamicThemeContext.tsx
 * Emotion ThemeProvider に動的にテーマを更新するためのContext
 * onThemeVariables コールバックでテーマを受け取り、Emotion のテーマオブジェクトを更新する
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import { getVSCodeTheme, VSCodeTheme } from '../styles/theme'

interface DynamicThemeContextValue {
  theme: VSCodeTheme
  setTheme: (newTheme: VSCodeTheme) => void
}

const DynamicThemeContext = createContext<DynamicThemeContextValue | undefined>(undefined)

interface DynamicThemeProviderProps {
  children: React.ReactNode
}

export const DynamicThemeProvider: React.FC<DynamicThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<VSCodeTheme>(() => getVSCodeTheme())

  // VSCodeからのテーマ更新イベントを処理するコールバック
  const updateThemeCallback = useCallback((newTheme: VSCodeTheme) => {
    setTheme(newTheme)
    console.log('[DynamicThemeProvider] Theme updated:', {
      statusBarBackground: newTheme.statusBarBackground,
      editorBackground: newTheme.editorBackground,
    })
  }, [])

  return (
    <DynamicThemeContext.Provider value={{ theme, setTheme: updateThemeCallback }}>
      {children}
    </DynamicThemeContext.Provider>
  )
}

export const useDynamicTheme = (): DynamicThemeContextValue => {
  const context = useContext(DynamicThemeContext);
  if (!context) {
    throw new Error('useDynamicTheme must be used within DynamicThemeProvider');
  }
  return context;
}
