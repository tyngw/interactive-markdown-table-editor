/**
 * DynamicThemeContext.tsx
 * Emotion ThemeProvider に動的にテーマを更新するためのContext
 * onThemeVariables コールバックでテーマを受け取り、Emotion のテーマオブジェクトを更新する
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
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
  const [theme, setThemeState] = useState<VSCodeTheme>(() => {
    const initialTheme = getVSCodeTheme()
    console.log('[DynamicThemeProvider] Initializing with theme:', {
      statusBarBackground: initialTheme.statusBarBackground,
      statusBarForeground: initialTheme.statusBarForeground,
      statusBarBorder: initialTheme.statusBarBorder,
      chartsGreen: initialTheme.chartsGreen,
    })
    return initialTheme
  })

  // VSCodeからのテーマ更新イベントを処理するコールバック
  const setTheme = useCallback((newTheme: VSCodeTheme) => {
    console.log('[DynamicThemeProvider] setTheme called with:', {
      statusBarBackground: newTheme.statusBarBackground,
      statusBarForeground: newTheme.statusBarForeground,
      statusBarBorder: newTheme.statusBarBorder,
      chartsGreen: newTheme.chartsGreen,
      editorBackground: newTheme.editorBackground,
    })
    setThemeState(newTheme)
    console.log('[DynamicThemeProvider] setThemeState executed, state will update')
  }, [])

  // value オブジェクトを useMemo でメモ化して、不要な再レンダリングを防ぐ
  const value = useMemo<DynamicThemeContextValue>(() => {
    console.log('[DynamicThemeProvider] Creating new context value with theme:', {
      statusBarBackground: theme.statusBarBackground,
      statusBarForeground: theme.statusBarForeground,
    })
    return { theme, setTheme }
  }, [theme, setTheme])

  return (
    <DynamicThemeContext.Provider value={value}>
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
