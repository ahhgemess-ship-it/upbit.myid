import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Zap, ArrowUpRight } from 'lucide-react'
import ProductCard from '../components/ProductCard.jsx'
import FlashSaleCard from '../components/FlashSaleCard.jsx'
import Asterisk from '../components/Asterisk.jsx'
import SortDropdown, { SORT_OPTIONS } from '../components/SortDropdown.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { flashFrom, isFlashProduct } from '../data/products.js'

export default function Store() {
  const { products, categories } = useCatalog()
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('Semua')
  const [sort, setSort] = useState('relevan')

  const matches = (p) => {
    const q = query.trim().toLowerCase()
    return (cat === 'Semua' || p.category === cat) &&
      (!q || p.name.toLowerCase().includes(q) || (p.vendor || '').toLowerCase().includes(q))
  }
  const applySort = (list) => {
    const fn = SORT_OPTIONS.find((o) => o.key === sort)?.fn
    return fn ? [...list].sort(fn) : list
  }

  // Katalog dipisah dua section: produk FLASH SALE (kartu khusus flash) dan
  // produk REGULER — supaya tidak tercampur dan tidak membingungkan.
  const flashList = useMemo(() => applySort(flashFrom(products).filter(matches)), [products, query, cat, sort])
  const regList = useMemo(() => applySort(products.filter((p) => !isFlashProduct(p) && matches(p))), [products, query, cat, sort])

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

      {flashList.length === 0 && regList.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="display" style={{ fontSize: 20 }}>{t('store.noResults')}</p>
          <p className="text-muted" style={{ marginTop: 8 }}>{t('store.noResultsSub')}</p>
        </div>
      ) : (
        <>
          {flashList.length > 0 && (
            <section style={{ marginBottom: 52 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <span
                  className="chip"
                  style={{
                    background: 'var(--ink)', color: 'var(--lime)', borderColor: 'var(--ink)',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 800, letterSpacing: '.06em', padding: '7px 13px',
                  }}
                >
                  <Zap size={13} fill="currentColor" /> FLASH SALE
                </span>
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {flashList.length} {t('flash.statProducts')}
                </span>
                <Link to="/flash-sale" className="btn-link" style={{ marginLeft: 'auto' }}>
                  {t('flash.viewAll')} <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="product-grid">
                {flashList.map((p, i) => (
                  <FlashSaleCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </section>
          )}

          {regList.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Asterisk size={22} />
                <span className="eyebrow">{t('store.regularSection')}</span>
              </div>
              <div className="product-grid">
                {regList.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
