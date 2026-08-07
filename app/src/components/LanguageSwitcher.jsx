import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { useLang } from '../context/LanguageContext.jsx'

// Tombol ganti bahasa — tampil untuk user login maupun non-login.
export default function LanguageSwitcher({ variant = 'desktop' }) {
  const { lang, setLang, langs, t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = langs.find((l) => l.code === lang) || langs[0]

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const pick = (code) => { setLang(code); setOpen(false) }

  return (
    <div ref={ref} className={`lang-switch ${variant === 'mobile' ? 'is-mobile' : ''}`}>
      <button className="lang-btn" onClick={() => setOpen((o) => !o)} aria-label={t('nav.language')} aria-expanded={open}>
        <Globe size={17} strokeWidth={2.2} />
        <span className="lang-tag">{current.tag}</span>
        <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="lang-menu"
          >
            <li className="lang-menu-head">{t('nav.language')}</li>
            {langs.map((l) => (
              <li key={l.code}>
                <button className={`lang-item ${l.code === lang ? 'is-active' : ''}`} onClick={() => pick(l.code)}>
                  <span className="lang-item-tag">{l.tag}</span>
                  <span className="lang-item-name">
                    <span>{l.name}</span>
                    <span className="lang-item-country">{l.country}</span>
                  </span>
                  {l.code === lang && <Check size={15} strokeWidth={3} color="var(--indigo)" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
