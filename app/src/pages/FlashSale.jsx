import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, ArrowUpRight, Clock, Flame, Tag } from 'lucide-react'
import Countdown from '../components/Countdown.jsx'
import FlashSaleCard from '../components/FlashSaleCard.jsx'
import Asterisk from '../components/Asterisk.jsx'
import { flashFrom, getSaleEndTime } from '../data/products.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'

export default function FlashSale() {
  const { t } = useLang()
  const { products } = useCatalog()
  // Baca dari katalog DB (via CatalogContext) supaya edit harga/nama/deskripsi
  // produk Promo di admin panel langsung tampil. Fallback awal = statis.
  const flashSale = useMemo(() => flashFrom(products), [products])
  const end = useMemo(() => getSaleEndTime(), [])
  const maxDiscount = flashSale.length ? Math.max(...flashSale.map((p) => p.discount)) : 0

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
            <Stat value={`${flashSale.length}`} label={t('flash.statProducts')} />
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
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 30 }}>
          <h2 className="display h-lg" style={{ maxWidth: 520 }}>{t('flash.gridTitle')}</h2>
          <Link to="/store" className="btn-link">{t('flash.viewAll')} <ArrowUpRight size={18} /></Link>
        </div>

        <div className="product-grid">
          {flashSale.map((p, i) => (
            <FlashSaleCard key={p.id} product={p} index={i} />
          ))}
        </div>
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
