import { useEffect, useState } from 'react';

export const LANGUAGE_STORAGE_KEY = 'cy-language';
export function readLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh';
  } catch { return 'zh'; }
}

export function useLanguage() {
  const [locale, setLocale] = useState(readLanguage);
  useEffect(() => {
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale); }
    catch { /* Private/restricted storage: switching still works in memory. */ }
  }, [locale]);
  return [locale, setLocale];
}
