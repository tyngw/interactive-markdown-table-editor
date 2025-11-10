import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import zhCN from './locales/zh-cn.json';

// Get language from VS Code API if available
const getVSCodeLanguage = (): string => {
  try {
    // Check if we're in a VS Code webview
    if (typeof window !== 'undefined' && (window as any).acquireVsCodeApi) {
      // VS Code will set the language via the data-vscode-language attribute
      const lang = document.documentElement.getAttribute('data-vscode-language');
      if (lang) {
        // Map VS Code language codes to our supported languages
        if (lang.startsWith('ja')) return 'ja';
        if (lang.startsWith('zh')) return 'zh-cn';
        return 'en';
      }
    }
  } catch (e) {
    console.warn('Failed to get VS Code language', e);
  }

  // Fallback to browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('ja')) return 'ja';
  if (browserLang.startsWith('zh')) return 'zh-cn';
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
      'zh-cn': { translation: zhCN }
    },
    lng: getVSCodeLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
