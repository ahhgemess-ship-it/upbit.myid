import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight, Star, ShoppingCart, Check, ShieldCheck, Ban, Zap, ChevronDown } from 'lucide-react'
import BrandLogo from './BrandLogo.jsx'
import { applyDiscount, officialOf } from '../data/products.js'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useDiscount } from '../context/CatalogContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { localizedProduct, localizeTier, localizeNote, localizePeriod, durationBadge } from '../i18n/productContent.js'
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
  const purchased = isPurchased(product._srcId || product.id)
  // Produk flash sale dibedakan visualnya dari produk reguler (badge + aksen).
  const isFlash = product.flashSale === true || (product.flashSale == null && product.category === 'Promo')
  // ── Pilihan durasi via dropdown — produk multi-durasi = satu kartu ──
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
  // Badge durasi ringkas tier TERPILIH: "3 Bulan" → "3bln"/"3m". Null untuk tier non-durasi.
  const durBadge = durationBadge(tier.label, t)

  // Harga flash hanya berlaku untuk tier utama (pertama); durasi lain memakai harga katalog.
  const isFlashSale = product.flashSale === true && Number(product.flashPrice) > 0
  const isFlashTier = isFlashSale && tierIdx === 0
  const tierPriceOf = (ti, i) => (isFlashSale && i === 0
    ? { ...ti, price: product.flashPrice, priceIntl: product.flashPriceIntl ?? ti.priceIntl }
    : ti)
  const effectiveTier = tierPriceOf(tier, tierIdx)
  const percent = isFlashSale ? 0 : discountFor(product.id)
  // Produk flash sale: harga official (durasi sama di katalog reguler) jadi harga dicoret.
  const official = isFlashSale ? officialOf(product) : null
  const flashStrike = isFlashTier && Number(official?.price) > Number(effectiveTier.price)
  const tierBase = amountOf(effectiveTier)
  const flashBase = amountOf({ price: official?.price ?? 0, priceIntl: official?.priceIntl ?? 0 })
  const salePrice = applyDiscount(tierBase, percent)

  // Tier terpilih dengan harga setelah diskon (kedua mata uang), supaya keranjang konsisten.
  const chosenTier = () => ({
    ...effectiveTier,
    ...(isFlashTier ? { label: `${effectiveTier.label} (Flash Sale)` } : {}),
    price: applyDiscount(effectiveTier.price, percent),
    original: effectiveTier.price,
    priceIntl: applyDiscount(effectiveTier.priceIntl, percent),
    originalIntl: effectiveTier.priceIntl,
  })

  const handleAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (purchased) return
    addItem(product, chosenTier())
    setAdded(true)
    toast(`${product.name} ${t('product.addToCart')}`, 'success', 1800)
    setTimeout(() => setAdded(false), 1400)
  }

  const handleBuy = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (purchased) return
    addItem(product, chosenTier())
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
            {tier.label && (
              <span className="chip chip-lime" style={{ fontSize: 11, fontWeight: 700 }}>{durBadge || localizeTier(tier.label, t)}</span>
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

          {/* Dropdown pilihan durasi — hanya untuk produk multi-durasi.
              Menu dibuka ke ATAS (bottom-based) supaya tidak terpotong overflow kartu. */}
          {tiers.length > 1 && (
            <div ref={tierRef} style={{ position: 'relative', marginBottom: 10 }}>
              <button
                type="button"
                className="tier-trigger"
                aria-expanded={tierOpen}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTierOpen((o) => !o) }}
                style={{ padding: '9px 12px', borderRadius: 12 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{localizeTier(tier.label, t)}</span>
                  {tier.note && <span className="chip chip-lime" style={{ fontSize: 10.5, padding: '2px 8px', flexShrink: 0 }}>{localizeNote(tier.note, t)}</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className="display" style={{ fontSize: 14 }}>{fmt(salePrice)}</span>
                  <motion.span animate={{ rotate: tierOpen ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                    <ChevronDown size={16} />
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
                      const eff = tierPriceOf(ti, i)
                      const optPrice = applyDiscount(amountOf(eff), isFlashSale ? 0 : percent)
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
                              {!isFlashSale && percent > 0 && <span className="pc-strike" style={{ fontSize: 11.5 }}>{fmt(amountOf(ti))}</span>}
                              {isFlashSale && i === 0 && flashStrike && <span className="pc-strike" style={{ fontSize: 11.5 }}>{fmt(flashBase)}</span>}
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

          <div className="pc-price-row">
            <span className="pc-price-main">
              <span className="display pc-price" style={{ fontSize: 22 }}>{fmt(salePrice)}</span>
              <span className="text-muted pc-period" style={{ fontSize: 13 }}> /{localizePeriod(product.period, t)}</span>
            </span>
            {(percent > 0 || flashStrike) && (
              <span className="pc-disc">
                <span className="pc-strike" style={{ fontSize: 12.5 }}>{fmt(percent > 0 ? tierBase : flashBase)}</span>
                {percent > 0 && <span className="disc-badge">-{percent}%</span>}
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
