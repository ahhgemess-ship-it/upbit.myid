import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Check, Zap, Ban } from 'lucide-react'
import BrandLogo from './BrandLogo.jsx'
import { durationBadge } from '../i18n/productContent.js'
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
  // Badge durasi ringkas dari tier utama: "3 Bulan" → "3bln"/"3m", "1 Bulan" → "1bln"/"1m".
  const durBadge = durationBadge(product.tiers?.[0]?.label, t)

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

  const sale = amountFor({ price: product.salePrice, priceIntl: product.salePriceIntl }, region)
  const orig = amountFor({ price: product.originalPrice, priceIntl: product.originalPriceIntl }, region)

  // Tier promo sintetis dengan harga diskon (kedua mata uang)
  const saleTier = {
    label: `${product.tiers[0].label} (Flash Sale)`,
    price: product.salePrice, original: product.originalPrice,
    priceIntl: product.salePriceIntl, originalIntl: product.originalPriceIntl,
  }

  const handleAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (unavailable) return
    addItem(product, saleTier)
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
  }

  const handleBuy = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (unavailable) return
    addItem(product, saleTier)
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

        {/* Nama produk AI + badge durasi (1bln/3bln/1thn) — pengganti badge kategori
            "Promo". Badge durasi menempel di nama tiap kartu & tetap tampil di mobile. */}
        <h3 className="display sale-name">
          <span className="sale-name-text">{product.name}</span>
          {durBadge && <span className="sale-dur">{durBadge}</span>}
        </h3>

        {/* harga */}
        <div className="sale-price-row">
          <span className="display sale-price">{fmt(sale)}</span>
          <span className="sale-price-old">{fmt(orig)}</span>
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
