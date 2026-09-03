import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, Star, ShoppingCart, ShieldCheck, Zap, ChevronDown, ArrowUpRight } from 'lucide-react'
import BrandLogo from '../components/BrandLogo.jsx'
import ProductCard from '../components/ProductCard.jsx'
import ReviewSection from '../components/ReviewSection.jsx'
import Asterisk from '../components/Asterisk.jsx'
import { applyDiscount } from '../data/products.js'
import { useCart } from '../context/CartContext.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { localizedProduct, localizeTier, localizeNote } from '../i18n/productContent.js'
import { usePricing } from '../i18n/pricing.js'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const { fmt, amountOf } = usePricing()
  const { getProduct, products, discountFor } = useCatalog()
  const product = localizedProduct(getProduct(id), lang)
  const { addItem } = useCart()
  const [tierIdx, setTierIdx] = useState(0)
  const [added, setAdded] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const [tierOpen, setTierOpen] = useState(false)
  const tierRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (tierRef.current && !tierRef.current.contains(e.target)) setTierOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!product) {
    return (
      <div className="container section" style={{ textAlign: 'center' }}>
        <h1 className="display h-md">{t('pd.notFound')}</h1>
        <Link to="/store" className="pill pill-indigo" style={{ marginTop: 20 }}>{t('pd.backToStore')}</Link>
      </div>
    )
  }

  const tier = product.tiers[tierIdx]
  const isFlashSale = product.flashSale === true && Number(product.flashPrice) > 0
  const flashSoldOut = isFlashSale && (product.stockOut || product.stock === 0)
  const effectiveTier = isFlashSale
    ? { ...tier, price: product.flashPrice, priceIntl: product.flashPriceIntl ?? tier.priceIntl }
    : tier
  const percent = isFlashSale ? 0 : discountFor(product.id)
  const tierBase = amountOf(effectiveTier)
  const salePrice = applyDiscount(tierBase, percent)
  const related = products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 3)
  const fallbackRelated = products.filter((p) => p.id !== product.id).slice(0, 3)
  const relatedList = related.length ? related : fallbackRelated

  // Tier terpilih dgn diskon (kedua mata uang).
  const chosenTier = () => ({
    ...effectiveTier,
    ...(isFlashSale ? { label: `${effectiveTier.label} (Flash Sale)` } : {}),
    price: applyDiscount(effectiveTier.price, percent),
    original: effectiveTier.price,
    priceIntl: applyDiscount(effectiveTier.priceIntl, percent),
    originalIntl: effectiveTier.priceIntl,
  })

  const handleAdd = () => {
    addItem(product, chosenTier())
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  const handleBuy = () => {
    addItem(product, chosenTier())
    navigate('/cart')
  }

  return (
    <div className="container section">
      <button onClick={() => navigate(-1)} className="btn-link" style={{ marginBottom: 26, border: 'none' }}>
        <ArrowLeft size={18} /> {t('common.back')}
      </button>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
        {/* Visual */}
        <motion.div
          className="pd-visual"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: product.brand, border: '1.5px solid var(--ink)', borderRadius: 28,
            padding: 'clamp(36px, 6vw, 72px)', position: 'relative', overflow: 'hidden',
            minHeight: 360, display: 'grid', placeItems: 'center',
          }}
        >
          <div style={{ position: 'absolute', top: 24, right: 24 }} className="float">
            <Asterisk size={32} color="rgba(255,255,255,.85)" spin />
          </div>
          <BrandLogo src={product.logo} name={product.name} brand="transparent" size={140} radius={28} logoScale={0.7} />
          <span style={{ position: 'absolute', bottom: 24, left: 24 }} className="chip chip-lime">{t('cat.' + product.category)}</span>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <span className="eyebrow">{product.vendor}</span>
          <h1 className="display" style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', marginTop: 8 }}>{product.name}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <Star size={17} fill="var(--lime-deep)" stroke="var(--ink)" strokeWidth={1.4} />
            <span style={{ fontWeight: 600 }}>{product.rating}</span>
            <span className="text-muted">· {product.sold.toLocaleString('id-ID')} {t('product.sold')}</span>
          </div>

          {/* Deskripsi — collapsible */}
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setDescOpen((o) => !o)}
              className="desc-toggle"
            >
              <span className="eyebrow" style={{ color: 'var(--ink)' }}>{t('pd.descToggle')}</span>
              <motion.span animate={{ rotate: descOpen ? 180 : 0 }} transition={{ duration: 0.25 }} style={{ display: 'grid', placeItems: 'center' }}>
                <ChevronDown size={20} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {descOpen && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden', fontSize: 15.5, lineHeight: 1.65, color: 'var(--ink-soft)' }}
                >
                  <span style={{ display: 'block', paddingTop: 12 }}>{product.description}</span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* features */}
          <ul style={{ display: 'grid', gap: 10, margin: '22px 0' }}>
            {product.features.map((f) => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                <span style={{
                  display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 999,
                  background: 'var(--lime)', border: '1.5px solid var(--ink)', flexShrink: 0,
                }}>
                  <Check size={14} strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          {/* tier selector — dropdown */}
          <div style={{ marginTop: 8 }} ref={tierRef}>
            <span className="eyebrow">{t('pd.pickDuration')}</span>
            <div style={{ position: 'relative', marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setTierOpen((o) => !o)}
                className="tier-trigger"
                aria-expanded={tierOpen}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{localizeTier(tier.label, t)}</span>
                  {tier.note && <span className="chip chip-lime" style={{ fontSize: 11, padding: '3px 9px' }}>{localizeNote(tier.note, t)}</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {percent > 0 && <span className="pc-strike" style={{ fontSize: 13 }}>{fmt(tierBase)}</span>}
                  <span className="display" style={{ fontSize: 18 }}>{fmt(salePrice)}</span>
                  <motion.span animate={{ rotate: tierOpen ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
                    <ChevronDown size={20} />
                  </motion.span>
                </span>
              </button>

              <AnimatePresence>
                {tierOpen && (
                  <motion.ul
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="tier-menu"
                  >
                    {product.tiers.map((ti, i) => (
                      <li key={ti.label}>
                        <button
                          type="button"
                          onClick={() => { setTierIdx(i); setTierOpen(false) }}
                          className={`tier-option ${tierIdx === i ? 'is-active' : ''}`}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 600, fontSize: 14.5 }}>{localizeTier(ti.label, t)}</span>
                            {ti.note && <span style={{ fontSize: 11.5, color: 'var(--indigo)', fontWeight: 600 }}>{localizeNote(ti.note, t)}</span>}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {percent > 0 && <span className="pc-strike" style={{ fontSize: 12.5 }}>{fmt(amountOf(ti))}</span>}
                            <span className="display" style={{ fontSize: 15 }}>{fmt(applyDiscount(amountOf(ti), percent))}</span>
                            {tierIdx === i && <Check size={16} strokeWidth={3} color="var(--indigo)" />}
                          </span>
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* price + add */}
          {flashSoldOut && (
            <p className="text-muted" style={{ color: '#dc2626', fontWeight: 700, margin: '18px 0 -4px' }}>Stok Flash Sale sedang habis.</p>
          )}
          <div className="card pd-buy-card">
            <div className="pd-price-block">
              <span className="text-muted" style={{ fontSize: 13 }}>{t('pd.total')}</span>
              <div className="pd-price-line">
                <div className="display pd-price-big">{fmt(salePrice)}</div>
                {percent > 0 && (
                  <>
                    <span className="pc-strike" style={{ fontSize: 15 }}>{fmt(tierBase)}</span>
                    <span className="disc-badge">-{percent}%</span>
                  </>
                )}
              </div>
            </div>
            <div className="pd-actions">
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleBuy} disabled={flashSoldOut} className="pill pill-indigo pd-buy">
                {t('product.buyNow')}
                <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleAdd}
                className="pd-cart-btn"
                disabled={flashSoldOut}
                aria-label={t('pd.addToCart')}
                animate={added ? { scale: [1, 1.18, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {added ? (
                    <motion.span key="c" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} style={{ display: 'grid', placeItems: 'center' }}>
                      <Check size={20} strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <motion.span key="s" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'grid', placeItems: 'center' }}>
                      <ShoppingCart size={20} strokeWidth={2.2} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>

          {product.category !== 'API' && (
            <span className="acct-tag" style={{ marginTop: 16, fontSize: 12.5, padding: '7px 14px' }}>
              <ShieldCheck size={15} strokeWidth={2.4} /> {t('acct.tag')}
            </span>
          )}

          <div style={{ display: 'flex', gap: 20, marginTop: 18, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink-soft)' }}>
              <ShieldCheck size={17} /> {t('pd.warrantyActive')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink-soft)' }}>
              <Zap size={17} /> {t('pd.instantProcess')}
            </span>
          </div>
        </motion.div>
      </div>

      {/* ulasan & rating */}
      <ReviewSection product={product} />

      {/* related */}
      <div style={{ marginTop: 70 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Asterisk size={26} />
          <h2 className="display h-md">{t('pd.related')}</h2>
        </div>
        <div className="product-grid">
          {relatedList.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
