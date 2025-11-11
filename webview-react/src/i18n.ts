import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import zhCN from './locales/zh-cn.json';

// Get language from VS Code
const getVSCodeLanguage = (): string => {
  try {
    // Try to get language from HTML attribute set by VS Code
    // Use optional chaining to handle cases where document is not ready
    const lang = document?.documentElement?.getAttribute('data-vscode-language');
    if (lang) {
      const lowerLang = lang.toLowerCase();
      // Map VS Code language codes to our supported languages
      if (lowerLang.startsWith('ja')) return 'ja';
      if (lowerLang.startsWith('zh-cn') || lowerLang.startsWith('zh_cn')) return 'zh-cn';
      if (lowerLang.startsWith('zh')) return 'zh-cn'; // Chinese variants
      if (lowerLang.startsWith('en')) return 'en';
    }
  } catch (e) {
    console.warn('[i18n] Failed to get VS Code language from attribute', e);
  }

  // Fallback to browser language
  try {
    const browserLang = navigator?.language?.toLowerCase();
    if (browserLang?.startsWith('ja')) return 'ja';
    if (browserLang?.startsWith('zh')) return 'zh-cn';
  } catch (e) {
    console.warn('[i18n] Failed to get browser language', e);
  }

  // Default to English
  return 'en';
};

// Initialize i18n synchronously but safely
// Since the script tag is at the end of body, DOM should be ready
const detectedLanguage = getVSCodeLanguage();

if (process.env.NODE_ENV === 'development') {
  console.log('[i18n] Initializing with language:', detectedLanguage);
  console.log('[i18n] Document ready state:', document?.readyState);
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
      'zh-cn': { translation: zhCN }
    },
    lng: detectedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    // Only enable debug in development
    debug: process.env.NODE_ENV === 'development'
  });

export default i18n;
