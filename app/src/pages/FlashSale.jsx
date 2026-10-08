import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, ArrowUpRight, Clock, Flame, Tag, Sparkles, ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react'
import BrandLogo from '../components/BrandLogo.jsx'
import Countdown from '../components/Countdown.jsx'
import FlashSaleCard from '../components/FlashSaleCard.jsx'
import Asterisk from '../components/Asterisk.jsx'
import SortDropdown from '../components/SortDropdown.jsx'
import { flashFrom, getSaleEndTime, sortFlashNeat } from '../data/products.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'

// Opsi sortir khusus flash sale: harga = harga FLASH (yang dibayar pembeli),
// bukan harga normal. Label tetap pakai key i18n `sort.*` yang sudah ada di
// 9 bahasa → konsisten dengan halaman Store.
const FLASH_SORT_OPTIONS = [
  { key: 'relevan', label: 'sort.relevan', icon: Sparkles, fn: null },
  { key: 'termurah', label: 'sort.termurah', icon: ArrowDownWideNarrow, fn: (a, b) => a.salePrice - b.salePrice },
  { key: 'termahal', label: 'sort.termahal', icon: ArrowUpWideNarrow, fn: (a, b) => b.salePrice - a.salePrice },
]

export function getBrandKey(p) {
  const n = (p.name || '').toLowerCase()
  const v = (p.vendor || '').toLowerCase()
  if (n.includes('chatgpt') || n.includes('openai') || v.includes('openai')) return 'ChatGPT'
  if (n.includes('claude') || n.includes('anthropic') || v.includes('anthropic')) return 'Claude'
  if (n.includes('gemini') || n.includes('google') || v.includes('google')) return 'Gemini'
  if (n.includes('cursor') || v.includes('anysphere')) return 'Cursor'
  if (n.includes('higgsfield') || v.includes('higgsfield')) return 'Higgsfield'
  if (n.includes('kiro') || v.includes('kiro')) return 'Kiro'
  return p.vendor || p.name.split(' ')[0]
}

export default function FlashSale() {
  const { t } = useLang()
  const { products } = useCatalog()
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [sort, setSort] = useState('relevan')

  // Semua produk flash sale sebelum filter brand
  const allFlash = useMemo(() => sortFlashNeat(flashFrom(products)), [products])

  // Ekstrak daftar brand yang tersedia di flash sale secara dinamis
  const brandList = useMemo(() => {
    const map = new Map()
    for (const p of allFlash) {
      const key = getBrandKey(p)
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: key,
          logo: p.logo,
          brand: p.brand || '#4f46e5',
          count: 0,
        })
      }
      map.get(key).count++
    }
    const list = Array.from(map.values())
    const preferred = ['ChatGPT', 'Claude', 'Gemini', 'Cursor', 'Higgsfield', 'Kiro']
    list.sort((a, b) => {
      const ia = preferred.indexOf(a.key)
      const ib = preferred.indexOf(b.key)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return b.count - a.count
    })
    return list
  }, [allFlash])

  // Filter produk berdasarkan brand terpilih & sortir
  const flashSale = useMemo(() => {
    let list = allFlash
    if (selectedBrand !== 'all') {
      list = list.filter((p) => getBrandKey(p) === selectedBrand)
    }
    const fn = FLASH_SORT_OPTIONS.find((o) => o.key === sort)?.fn
    return fn ? [...list].sort(fn) : list
  }, [allFlash, selectedBrand, sort])

  const end = useMemo(() => getSaleEndTime(), [])
  const maxDiscount = allFlash.length ? Math.max(...allFlash.map((p) => p.discount)) : 0

  return (
    <div>
      {/* HERO */}
      <section style={{ background: 'var(--ink)', color: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 40, right: 40, opacity: 0.9 }} className="float">
          <Asterisk size={44} color="var(--lime)" spin />
        </div>
        <div className="container" style={{ padding: '64px 24px 72px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 999, background: 'var(--lime)', border: '1.5px solid var(--bg)' }}>
              <Zap size={20} fill="var(--ink)" color="var(--ink)" />
            </span>
            <span className="eyebrow" style={{ color: 'var(--lime)' }}>{t('flash.eyebrow')}</span>
          </div>

          <h1 className="display" style={{ fontSize: 'clamp(2.4rem, 8vw, 5rem)', color: 'var(--bg)', lineHeight: 1, maxWidth: 820 }}>
            FLASH SALE{' '}
            <span style={{ color: 'var(--lime)' }}>{t('flash.save')} {maxDiscount}%</span>
          </h1>
          <p style={{ color: '#c9c7bd', fontSize: 17, maxWidth: 520, marginTop: 18, lineHeight: 1.6 }}>
            {t('flash.subtitle')}
          </p>

          {/* countdown */}
          <div style={{ marginTop: 34 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: '#c9c7bd', fontSize: 13.5, fontWeight: 600 }}>
              <Clock size={16} /> {t('flash.endsIn')}
            </div>
            <Countdown target={end} light />
          </div>

          {/* stats */}
          <div className="stat-row" style={{ display: 'flex', gap: 30, marginTop: 36, flexWrap: 'wrap' }}>
            <Stat value={`${allFlash.length}`} label={t('flash.statProducts')} />
            <Stat value={`${maxDiscount}%`} label={t('flash.statMaxDisc')} />
            <Stat value={t('flash.statStock')} label={t('flash.statStockLabel')} />
          </div>
        </div>
      </section>

      {/* GRID */}
      <section className="container section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Flame size={26} color="var(--indigo)" />
          <span className="eyebrow">{t('flash.hotEyebrow')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
          <h2 className="display h-lg" style={{ maxWidth: 520 }}>{t('flash.gridTitle')}</h2>
          <Link to="/store" className="btn-link">{t('flash.viewAll')} <ArrowUpRight size={18} /></Link>
        </div>

        {/* filter brand logo & opsi sortir — diletakkan di atas produk dekat filter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}>
          {/* Logo brand horizontal scrollable bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              overflowX: 'auto',
              maxWidth: '100%',
              paddingBottom: 4,
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Tombol Semua */}
            <motion.button
              type="button"
              onClick={() => setSelectedBrand('all')}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px 6px 10px',
                borderRadius: 999,
                cursor: 'pointer',
                background: selectedBrand === 'all' ? 'var(--ink)' : 'var(--surface-2)',
                color: selectedBrand === 'all' ? '#fff' : 'var(--ink)',
                border: selectedBrand === 'all' ? '1.5px solid var(--ink)' : '1.5px solid var(--line-soft)',
                boxShadow: selectedBrand === 'all' ? '0 4px 14px rgba(43,43,40,.2)' : 'none',
                transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span style={{
                display: 'grid',
                placeItems: 'center',
                width: 24,
                height: 24,
                borderRadius: 999,
                background: selectedBrand === 'all' ? 'var(--lime)' : 'var(--line-soft)',
              }}>
                <Sparkles size={13} color={selectedBrand === 'all' ? 'var(--ink)' : 'var(--ink-soft)'} />
              </span>
              <span style={{ fontSize: 13.5, fontWeight: selectedBrand === 'all' ? 700 : 600 }}>
                {t('store.all') || 'Semua'}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: 999,
                background: selectedBrand === 'all' ? 'rgba(255,255,255,.18)' : 'var(--surface)',
                color: selectedBrand === 'all' ? 'var(--lime)' : 'var(--muted)',
              }}>
                {allFlash.length}
              </span>
            </motion.button>

            {/* Tombol Tiap Brand */}
            {brandList.map((b) => {
              const isActive = selectedBrand === b.key
              return (
                <motion.button
                  key={b.key}
                  type="button"
                  onClick={() => setSelectedBrand(isActive ? 'all' : b.key)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 13px 5px 6px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    background: isActive ? 'var(--ink)' : 'var(--surface-2)',
                    color: isActive ? '#fff' : 'var(--ink)',
                    border: isActive ? '1.5px solid var(--ink)' : '1.5px solid var(--line-soft)',
                    boxShadow: isActive ? '0 4px 14px rgba(43,43,40,.2)' : 'none',
                    transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <BrandLogo
                    src={b.logo}
                    name={b.name}
                    brand={b.brand}
                    size={26}
                    radius={8}
                    logoScale={0.65}
                  />
                  <span style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 600 }}>
                    {b.name}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: isActive ? 'rgba(255,255,255,.18)' : 'var(--surface)',
                    color: isActive ? 'var(--lime)' : 'var(--muted)',
                  }}>
                    {b.count}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {/* filter urutan: termurah / termahal (harga flash) */}
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <SortDropdown value={sort} onChange={setSort} options={FLASH_SORT_OPTIONS} />
          </div>
        </div>

        {/* info filter aktif jika sedang memfilter brand tertentu */}
        {selectedBrand !== 'all' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            padding: '10px 16px',
            background: 'var(--surface)',
            borderRadius: 14,
            border: '1.5px solid var(--line-soft)',
          }}>
            <span style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>
              Menampilkan <strong>{flashSale.length}</strong> produk promo untuk <strong>{selectedBrand}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSelectedBrand('all')}
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--indigo)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              ✕ Tampilkan Semua
            </button>
          </div>
        )}

        {flashSale.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', borderRadius: 20, border: '1.5px solid var(--line-soft)' }}>
            <p style={{ color: 'var(--muted)', fontSize: 16 }}>Tidak ada produk promo untuk {selectedBrand}.</p>
            <button
              onClick={() => setSelectedBrand('all')}
              className="pill pill-indigo"
              style={{ marginTop: 14 }}
            >
              Lihat Semua Promo
            </button>
          </div>
        ) : (
          <div className="product-grid">
            {flashSale.map((p, i) => (
              <FlashSaleCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* INFO BAND */}
      <section className="container" style={{ paddingBottom: 84 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ background: 'var(--lime)', border: '1.5px solid var(--ink)', borderRadius: 28, padding: 'clamp(28px, 4vw, 48px)', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', right: 26, top: 26 }} className="float">
            <Tag size={36} color="var(--ink)" />
          </div>
          <span className="chip" style={{ background: 'var(--ink)', color: 'var(--lime)', borderColor: 'var(--ink)' }}>{t('flash.infoBadge')}</span>
          <h2 className="display" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginTop: 16, maxWidth: 620 }}>
            {t('flash.infoTitle')}
          </h2>
          <p style={{ fontSize: 15.5, marginTop: 14, maxWidth: 560, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
            {t('flash.infoText')}
          </p>
          <Link to="/store" className="pill pill-indigo" style={{ marginTop: 24 }}>
            {t('flash.exploreAll')}
            <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
          </Link>
        </motion.div>
      </section>
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="display" style={{ fontSize: 26, color: 'var(--bg)' }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#c9c7bd' }}>{label}</div>
    </div>
  )
}
