import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import ProductCard from '../components/ProductCard.jsx'
import Asterisk from '../components/Asterisk.jsx'
import SortDropdown, { SORT_OPTIONS } from '../components/SortDropdown.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'

export default function Store() {
  const { products, categories } = useCatalog()
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('Semua')
  const [sort, setSort] = useState('relevan')

  const filtered = useMemo(() => {
    const list = products.filter((p) => {
      const matchCat = cat === 'Semua' || p.category === cat
      const q = query.trim().toLowerCase()
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q)
      return matchCat && matchQ
    })
    const fn = SORT_OPTIONS.find((o) => o.key === sort)?.fn
    return fn ? [...list].sort(fn) : list
  }, [products, query, cat, sort])

  const tabs = ['Semua', ...categories]

  return (
    <div className="container section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Asterisk size={30} />
        <span className="eyebrow">{t('store.eyebrow')}</span>
      </div>
      <h1 className="display h-lg" style={{ maxWidth: 620 }}>{t('store.title')}</h1>

      {/* controls */}
      <div style={{
        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', margin: '30px 0 26px',
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setCat(tab)}
              className="chip"
              style={{
                cursor: 'pointer',
                background: cat === tab ? 'var(--ink)' : 'var(--surface-2)',
                color: cat === tab ? '#fff' : 'var(--ink)',
              }}
            >
              {tab === 'Semua' ? t('store.all') : t('cat.' + tab)}
            </button>
          ))}
        </div>

        <div className="store-controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <SortDropdown value={sort} onChange={setSort} />

          <div className="store-search" style={{ position: 'relative', minWidth: 220, flex: '0 1 300px' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 42 }}
              placeholder={t('store.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="display" style={{ fontSize: 20 }}>{t('store.noResults')}</p>
          <p className="text-muted" style={{ marginTop: 8 }}>{t('store.noResultsSub')}</p>
        </div>
      ) : (
        <motion.div className="product-grid">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </motion.div>
      )}
    </div>
  )
}
