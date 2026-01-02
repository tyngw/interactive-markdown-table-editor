/**
 * DynamicThemeContext.tsx
 * Emotion ThemeProvider に動的にテーマを更新するためのContext
 * onThemeVariables コールバックでテーマを受け取り、Emotion のテーマオブジェクトを更新する
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import { getVSCodeTheme, VSCodeTheme } from '../styles/theme'

interface DynamicThemeContextValue {
  theme: VSCodeTheme
  updateTheme: (cssText: string) => void
}

const DynamicThemeContext = createContext<DynamicThemeContextValue | undefined>(undefined)

interface DynamicThemeProviderProps {
  children: React.ReactNode
}

export const DynamicThemeProvider: React.FC<DynamicThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<VSCodeTheme>(() => getVSCodeTheme())

  const updateTheme = useCallback((cssText: string) => {
    console.log('[DynamicThemeProvider] updateTheme called with cssText');

    // CSS文字列をドキュメントに適用
    const style = document.createElement('style');
    style.textContent = cssText;
    style.id = 'mte-theme-variables';

    const existingStyle = document.getElementById('mte-theme-variables');
    if (existingStyle) {
      existingStyle.remove();
    }

    document.head.appendChild(style);

    // 次のマイクロタスク後に theme を再取得（CSS 変数が反映されるのを待つ）
    setTimeout(() => {
      const freshTheme = getVSCodeTheme();
      setTheme(freshTheme);
      console.log('[DynamicThemeProvider] Theme updated:', {
        statusBarBackground: freshTheme.statusBarBackground,
        editorBackground: freshTheme.editorBackground,
      });
    }, 0);
  }, [])

  return (
    <DynamicThemeContext.Provider value={{ theme, updateTheme }}>
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
