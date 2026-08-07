import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDownUp, Sparkles, ArrowDownWideNarrow, ArrowUpWideNarrow, Star, Flame, Check,
} from 'lucide-react'
import { useLang } from '../context/LanguageContext.jsx'

// Konfigurasi opsi sortir + ikon. `label` adalah key i18n (sort.*).
export const SORT_OPTIONS = [
  { key: 'relevan', label: 'sort.relevan', icon: Sparkles, fn: null },
  { key: 'termurah', label: 'sort.termurah', icon: ArrowDownWideNarrow, fn: (a, b) => a.price - b.price },
  { key: 'termahal', label: 'sort.termahal', icon: ArrowUpWideNarrow, fn: (a, b) => b.price - a.price },
  { key: 'rating', label: 'sort.rating', icon: Star, fn: (a, b) => b.rating - a.rating },
  { key: 'terlaris', label: 'sort.terlaris', icon: Flame, fn: (a, b) => b.sold - a.sold },
]

export default function SortDropdown({ value, onChange }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = SORT_OPTIONS.find((o) => o.key === value) || SORT_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="sort-dd" ref={ref}>
      <button
        type="button"
        className={`sort-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="sort-trigger-lead">
          <ArrowDownUp size={16} style={{ color: 'var(--muted)' }} />
          <span className="sort-trigger-label">{t('sort.label')}</span>
          <span className="sort-trigger-value">{t(active.label)}</span>
        </span>
        <motion.span className="sort-caret" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            className="sort-menu"
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {SORT_OPTIONS.map((o) => {
              const Ic = o.icon
              const isActive = o.key === value
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`sort-option ${isActive ? 'is-active' : ''}`}
                    onClick={() => { onChange(o.key); setOpen(false) }}
                  >
                    <span className="sort-trigger-lead">
                      <span className="sort-option-ic"><Ic size={16} /></span>
                      {t(o.label)}
                    </span>
                    {isActive && <Check size={16} className="sort-option-ic" />}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
