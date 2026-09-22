import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Check, Zap, Ban, ChevronDown } from 'lucide-react'
import BrandLogo from './BrandLogo.jsx'
import { durationBadge, localizeTier, localizeNote } from '../i18n/productContent.js'
import { useCart } from '../context/CartContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { usePricing, amountFor } from '../i18n/pricing.js'
import { usePurchased } from '../context/usePurchased.js'

// Hash FNV-1a sederhana → angka deterministik per id produk (stabil antar refresh).
const hashId = (s) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

export default function FlashSaleCard({ product, index = 0 }) {
  const { addItem } = useCart()
  const { t } = useLang()
  const { fmt, region } = usePricing()
  const navigate = useNavigate()
  const [added, setAdded] = useState(false)
  const { isPurchased } = usePurchased()
  const purchased = isPurchased(product._srcId || product.id)
  const stockOut = !!product.stockOut
  // ── Pilihan durasi via dropdown — produk flash multi-durasi = satu kartu ──
  const [tierIdx, setTierIdx] = useState(0)
  const [tierOpen, setTierOpen] = useState(false)
  const tierRef = useRef(null)
  useEffect(() => {
    const onClick = (e) => {
      if (tierRef.current && !tierRef.current.contains(e.target)) setTierOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const tiers = product.tiers || []
  const tier = tiers[tierIdx] || tiers[0] || { label: product.period || 'Produk', price: product.price, priceIntl: product.priceIntl }
  // Badge durasi ringkas dari tier TERPILIH: "3 Bulan" → "3bln"/"3m".
  const durBadge = durationBadge(tier.label, t)
  // Harga flash hanya untuk tier utama (pertama) — durasi lain memakai harga katalognya.
  const tierOf = (ti, i) => (i === 0
    ? { label: `${ti.label} (Flash Sale)`, price: product.salePrice, original: product.originalPrice, priceIntl: product.salePriceIntl, originalIntl: product.originalPriceIntl }
    : { ...ti, original: ti.price, originalIntl: ti.priceIntl })
  const selTier = tierOf(tier, tierIdx)

  const stock = Number.isFinite(product.stock) ? product.stock : -1
  const sold = Math.max(0, Number(product.sold) || 0)
  // `stock` dari DB adalah stok tersisa, bukan kuota awal. Jangan dikurangi `sold` lagi.
  // Produk unlimited (stock = -1) TETAP dipakai apa adanya untuk logika order;
  // untuk tampilan, sisa stoknya ditampilkan 5–20 (deterministik per produk via
  // hash id) supaya kartu flash sale selalu terasa langka, bukan "Stok ∞".
  const realStock = stock >= 0
  const left = realStock ? Math.max(0, stock) : 5 + (hashId(product.id) % 16)
  const pct = left === 0 ? 100 : Math.min(95, Math.max(5, Math.round(100 - (left / Math.max(left + sold, 1)) * 100)))
  const soldOutByStock = realStock && left === 0
  const unavailable = purchased || stockOut || soldOutByStock
  const almostGone = realStock && left > 0 && left <= Math.max(3, Math.ceil((left + sold) * 0.2))

  const sale = amountFor({ price: selTier.price, priceIntl: selTier.priceIntl }, region)
  const orig = amountFor({ price: selTier.original, priceIntl: selTier.originalIntl }, region)
  const isFlashTier = tierIdx === 0

  const handleAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (unavailable) return
    addItem(product, selTier)
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
  }

  const handleBuy = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (unavailable) return
    addItem(product, selTier)
    navigate('/cart')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.06 }}
      whileHover={unavailable ? {} : { y: -6 }}
      style={{ opacity: unavailable ? 0.45 : 1, filter: unavailable ? 'grayscale(0.85)' : 'none', position: 'relative' }}
    >
      <Link
        to={unavailable ? '#' : `/product/${product.id}`}
        className="card sale-card"
        onClick={(e) => unavailable && e.preventDefault()}
        style={{ pointerEvents: unavailable ? 'none' : 'auto', position: 'relative', overflow: 'hidden' }}
      >
        {unavailable && (
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,.55)', zIndex: 2, borderRadius: 18,
          }}>
            <div style={{ textAlign: 'center' }}>
              <Ban size={36} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--muted)', display: 'block' }}>{stockOut || soldOutByStock ? 'Stok Habis' : 'Sudah Dibeli'}</span>
            </div>
          </div>
        )}
        {/* badge diskon */}
        <span className="sale-badge">-{product.discount}%</span>

        <div className="sale-card-top">
          <BrandLogo src={product.logo} name={product.name} brand={product.brand} size={52} />
          {product.badge && product.badgeColor && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', marginTop: 2,
              background: product.badgeColor, color: '#fff',
              fontSize: 10, fontWeight: 800, letterSpacing: '.07em', lineHeight: 1,
              padding: '5px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.25)',
              boxShadow: '0 1px 0 rgba(0,0,0,.25)',
            }}>{product.badge}</span>
          )}
        </div>

        {/* Nama produk AI + badge durasi (1bln/3bln/1thn) tier TERPILIH — pengganti
            badge kategori "Promo". Badge durasi menempel di nama tiap kartu & tetap
            tampil di mobile. */}
        <h3 className="display sale-name">
          <span className="sale-name-text">{product.name}</span>
          {durBadge && <span className="sale-dur">{durBadge}</span>}
        </h3>

        {/* dropdown pilihan durasi — hanya bila produk punya >1 durasi.
            Menu dibuka ke ATAS supaya tidak terpotong overflow kartu. */}
        {tiers.length > 1 && (
          <div ref={tierRef} style={{ position: 'relative', margin: '2px 0 10px' }}>
            <button
              type="button"
              className="tier-trigger"
              aria-expanded={tierOpen}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTierOpen((o) => !o) }}
              style={{ padding: '8px 11px', borderRadius: 12 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{localizeTier(tier.label, t)}</span>
                {tier.note && <span className="chip chip-lime" style={{ fontSize: 10.5, padding: '2px 8px', flexShrink: 0 }}>{localizeNote(tier.note, t)}</span>}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span className="display" style={{ fontSize: 13.5 }}>{fmt(sale)}</span>
                <motion.span animate={{ rotate: tierOpen ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                  <ChevronDown size={15} />
                </motion.span>
              </span>
            </button>
            <AnimatePresence>
              {tierOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="tier-menu"
                  style={{ top: 'auto', bottom: 'calc(100% + 8px)' }}
                >
                  {tiers.map((ti, i) => {
                    const opt = tierOf(ti, i)
                    const optPrice = amountFor({ price: opt.price, priceIntl: opt.priceIntl }, region)
                    const optStrike = amountFor({ price: opt.original, priceIntl: opt.originalIntl }, region)
                    const showStrike = i === 0 && Number(opt.original) > Number(opt.price)
                    return (
                      <li key={ti.label}>
                        <button
                          type="button"
                          className={`tier-option ${tierIdx === i ? 'is-active' : ''}`}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTierIdx(i); setTierOpen(false) }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{localizeTier(ti.label, t)}</span>
                            {ti.note && <span style={{ fontSize: 11, color: 'var(--indigo)', fontWeight: 600, flexShrink: 0 }}>{localizeNote(ti.note, t)}</span>}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {showStrike && <span className="pc-strike" style={{ fontSize: 11.5 }}>{fmt(optStrike)}</span>}
                            <span className="display" style={{ fontSize: 13.5 }}>{fmt(optPrice)}</span>
                            {tierIdx === i && <Check size={15} strokeWidth={3} color="var(--indigo)" />}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* harga */}
        <div className="sale-price-row">
          <span className="display sale-price">{fmt(sale)}</span>
          {isFlashTier && <span className="sale-price-old">{fmt(orig)}</span>}
        </div>

        {/* progress stok */}
        <div className="sale-stock">
          <div className="sale-stock-bar">
            <motion.span
              className="sale-stock-fill"
              initial={{ width: 0 }}
              whileInView={{ width: `${pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </div>
          <div className="sale-stock-label">
            <span className={almostGone ? 'sale-hot' : ''}>
              {almostGone ? t('flash.almostGone') : t('flash.soldLabel')} {sold}
            </span>
            <span className="text-muted">{`${t('flash.left')} ${left}`}</span>
          </div>
        </div>

        {/* actions */}
        <div className="pc-actions">
          <button type="button" onClick={handleBuy} className="pc-buy sale-buy">
            <Zap size={15} strokeWidth={2.4} fill="currentColor" />
            <span className="pc-buy-full">{t('flash.buyDiscount')}</span>
            <span className="pc-buy-short">{t('product.buy')}</span>
          </button>
          <motion.button
            type="button"
            onClick={handleAdd}
            className="pc-add"
            whileTap={{ scale: 0.85 }}
            animate={added ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.4 }}
            aria-label="Tambah ke keranjang"
          >
            <AnimatePresence mode="wait" initial={false}>
              {added ? (
                <motion.span key="c" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} style={{ display: 'grid', placeItems: 'center' }}>
                  <Check size={20} strokeWidth={3} />
                </motion.span>
              ) : (
                <motion.span key="s" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'grid', placeItems: 'center' }}>
                  <ShoppingCart size={19} strokeWidth={2.2} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </Link>
    </motion.div>
  )
}
