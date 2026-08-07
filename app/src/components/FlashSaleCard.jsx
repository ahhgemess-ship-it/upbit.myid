import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Check, Zap, Ban } from 'lucide-react'
import BrandLogo from './BrandLogo.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { usePricing, amountFor } from '../i18n/pricing.js'
import { usePurchased } from '../context/usePurchased.js'

export default function FlashSaleCard({ product, index = 0 }) {
  const { addItem } = useCart()
  const { t } = useLang()
  const { fmt, region } = usePricing()
  const navigate = useNavigate()
  const [added, setAdded] = useState(false)
  const { isPurchased } = usePurchased()
  const purchased = isPurchased(product.id)

  const pct = Math.min(100, Math.round((product.sold / product.stock) * 100))
  const left = Math.max(0, product.stock - product.sold)
  const almostGone = pct >= 80

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
    if (purchased) return
    addItem(product, saleTier)
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
  }

  const handleBuy = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (purchased) return
    addItem(product, saleTier)
    navigate('/cart')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.06 }}
      whileHover={purchased ? {} : { y: -6 }}
      style={{ opacity: purchased ? 0.45 : 1, filter: purchased ? 'grayscale(0.85)' : 'none', position: 'relative' }}
    >
      <Link
        to={purchased ? '#' : `/product/${product.id}`}
        className="card sale-card"
        onClick={(e) => purchased && e.preventDefault()}
        style={{ pointerEvents: purchased ? 'none' : 'auto', position: 'relative', overflow: 'hidden' }}
      >
        {purchased && (
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,.55)', zIndex: 2, borderRadius: 18,
          }}>
            <div style={{ textAlign: 'center' }}>
              <Ban size={36} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--muted)', display: 'block' }}>Stok Habis</span>
            </div>
          </div>
        )}
        {/* badge diskon */}
        <span className="sale-badge">-{product.discount}%</span>

        <div className="sale-card-top">
          <BrandLogo src={product.logo} name={product.name} brand={product.brand} size={52} />
          <span className="chip" style={{ fontSize: 11 }}>{t('cat.' + product.category)}</span>
        </div>

        <h3 className="display sale-name">{product.name}</h3>

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
              {almostGone ? t('flash.almostGone') : t('flash.soldLabel')} {product.sold}
            </span>
            <span className="text-muted">{t('flash.left')} {left}</span>
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
