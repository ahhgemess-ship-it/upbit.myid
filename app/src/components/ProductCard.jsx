import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight, Star, ShoppingCart, Check, ShieldCheck, Ban, Zap } from 'lucide-react'
import BrandLogo from './BrandLogo.jsx'
import { applyDiscount } from '../data/products.js'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useDiscount } from '../context/CatalogContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { localizedProduct, localizeTier, localizePeriod, durationBadge } from '../i18n/productContent.js'
import { usePricing } from '../i18n/pricing.js'
import { usePurchased } from '../context/usePurchased.js'

export default function ProductCard({ product: rawProduct, index = 0 }) {
  const { addItem } = useCart()
  const { toast } = useToast()
  const { discountFor } = useDiscount()
  const { t, lang } = useLang()
  const { fmt, amountOf } = usePricing()
  const product = localizedProduct(rawProduct, lang)
  const navigate = useNavigate()
  const [added, setAdded] = useState(false)
  const { isPurchased } = usePurchased()
  const purchased = isPurchased(product.id)
  // Produk flash sale dibedakan visualnya dari produk reguler (badge + aksen).
  const isFlash = product.flashSale === true || (product.flashSale == null && product.category === 'Promo')
  // Badge durasi ringkas: "3 Bulan" → "3bln"/"3m". Null untuk tier non-durasi.
  const durBadge = durationBadge(product.tiers?.[0]?.label, t)

  const percent = discountFor(product.id)
  const base = amountOf(product)
  const salePrice = applyDiscount(base, percent)

  // Tier default dengan harga setelah diskon (kedua mata uang), supaya keranjang konsisten.
  const discountedTier = () => {
    const t0 = product.tiers[0]
    return {
      ...t0,
      price: applyDiscount(t0.price, percent),
      original: t0.price,
      priceIntl: applyDiscount(t0.priceIntl, percent),
      originalIntl: t0.priceIntl,
    }
  }

  const handleAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (purchased) return
    addItem(product, discountedTier())
    setAdded(true)
    toast(`${product.name} ${t('product.addToCart')}`, 'success', 1800)
    setTimeout(() => setAdded(false), 1400)
  }

  const handleBuy = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (purchased) return
    addItem(product, discountedTier())
    navigate('/cart')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.06 }}
      whileHover={{ y: -6 }}
    >
      <Link
        to={purchased ? '#' : `/product/${product.id}`}
        className="card product-card"
        onClick={(e) => purchased && e.preventDefault()}
        style={{
          display: 'flex', flexDirection: 'column', height: '100%',
          padding: 18, gap: 16,
          opacity: purchased ? 0.45 : 1,
          pointerEvents: purchased ? 'none' : 'auto',
          filter: purchased ? 'grayscale(0.85)' : 'none',
          position: 'relative',
          overflow: 'hidden',
          ...(isFlash && !purchased ? { border: '1.5px solid var(--lime-deep)' } : {}),
        }}
      >
        {/* Overlay Stok Habis */}
        {purchased && (
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,.55)', zIndex: 2, borderRadius: 18,
          }}>
            <div style={{ textAlign: 'center' }}>
              <Ban size={36} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--muted)', display: 'block' }}>Stok Habis</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginTop: 2 }}>Produk sudah dibeli</span>
            </div>
          </div>
        )}
        <div className="pc-top" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <BrandLogo src={product.logo} name={product.name} brand={product.brand} size={54} />
          <span className="corner-arrow">
            <ArrowUpRight size={18} strokeWidth={2.4} />
          </span>
        </div>

        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {isFlash ? (
              <span className="chip" style={{ background: 'var(--ink)', color: 'var(--lime)', borderColor: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em' }}>
                <Zap size={11} fill="currentColor" /> FLASH SALE
              </span>
            ) : (
              <span className="chip pc-chip">{t('cat.' + product.category)}</span>
            )}
            {product.tiers?.[0]?.label && (
              <span className="chip chip-lime" style={{ fontSize: 11, fontWeight: 700 }}>{durBadge || localizeTier(product.tiers[0].label, t)}</span>
            )}
          </div>
          <h3 className="display pc-name" style={{ fontSize: 20, marginTop: 12 }}>{product.name}</h3>
          <p className="text-muted pc-tagline" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.45 }}>
            {product.tagline}
          </p>
          {product.category !== 'API' && (
            <span className="acct-tag" style={{ marginTop: 10 }}>
              <ShieldCheck size={13} strokeWidth={2.4} /> {t('acct.tagShort')}
            </span>
          )}
        </div>

        <div className="pc-foot" style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1.5px solid var(--line-soft)' }}>
          <div className="pc-rating" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Star size={15} fill="var(--lime-deep)" stroke="var(--ink)" strokeWidth={1.4} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{product.rating}</span>
            <span className="text-muted pc-sold" style={{ fontSize: 13 }}>· {product.sold.toLocaleString('id-ID')} {t('product.sold')}</span>
          </div>

          <div className="pc-price-row">
            <span className="pc-price-main">
              <span className="display pc-price" style={{ fontSize: 22 }}>{fmt(salePrice)}</span>
              <span className="text-muted pc-period" style={{ fontSize: 13 }}> /{localizePeriod(product.period, t)}</span>
            </span>
            {percent > 0 && (
              <span className="pc-disc">
                <span className="pc-strike" style={{ fontSize: 12.5 }}>{fmt(base)}</span>
                <span className="disc-badge">-{percent}%</span>
              </span>
            )}
          </div>

          {/* actions: Beli Sekarang + tombol bulat add keranjang */}
          <div className="pc-actions">
            <button type="button" onClick={handleBuy} className="pc-buy">
              <span className="pc-buy-full">{t('product.buyNow')}</span>
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
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                    style={{ display: 'grid', placeItems: 'center' }}
                  >
                    <Check size={20} strokeWidth={3} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="cart"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    style={{ display: 'grid', placeItems: 'center' }}
                  >
                    <ShoppingCart size={19} strokeWidth={2.2} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
