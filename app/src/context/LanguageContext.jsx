import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { T, LANGS, DEFAULT_LANG } from '../i18n/translations.js'

const LanguageContext = createContext(null)
const LANG_KEY = 'upbit_lang'

const validCodes = LANGS.map((l) => l.code)
const readLang = () => {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && validCodes.includes(saved)) return saved
    // tebak dari bahasa browser
    const nav = (navigator.language || '').slice(0, 2).toLowerCase()
    if (validCodes.includes(nav)) return nav
  } catch { /* ignore */ }
  return DEFAULT_LANG
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((code) => {
    if (!validCodes.includes(code)) return
    setLangState(code)
    try { localStorage.setItem(LANG_KEY, code) } catch { /* ignore */ }
  }, [])

  // t('key') → string sesuai bahasa aktif; fallback ke EN, lalu ke key.
  const t = useCallback((key) => {
    const entry = T[key]
    if (!entry) return key
    return entry[lang] || entry.en || key
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t, langs: LANGS }), [lang, setLang, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}

// Shortcut bila hanya butuh fungsi t.
export function useT() {
  return useLang().t
}
