import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import hi from './hi';

const saved = (() => {
  try {
    return localStorage.getItem('ll_lang');
  } catch {
    return null;
  }
})();
const initial = saved ?? (navigator.language?.startsWith('hi') ? 'hi' : 'en');

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(lng: 'en' | 'hi') {
  i18n.changeLanguage(lng);
  document.documentElement.lang = lng;
  try {
    localStorage.setItem('ll_lang', lng);
  } catch {
    /* private mode */
  }
}
document.documentElement.lang = initial;

export default i18n;
