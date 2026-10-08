import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, Star, ShoppingCart, ShieldCheck, Zap, ChevronDown, ArrowUpRight } from 'lucide-react'
import BrandLogo from '../components/BrandLogo.jsx'
import ProductCard from '../components/ProductCard.jsx'
import ReviewSection from '../components/ReviewSection.jsx'
import Asterisk from '../components/Asterisk.jsx'
import { applyDiscount, officialOf } from '../data/products.js'
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
  // Plan terkunci ke yang diklik di katalog — tidak ada state pilihan durasi.
  const tierIdx = 0
  const [added, setAdded] = useState(false)
  const [descOpen, setDescOpen] = useState(false)

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
  // Stok habis (global): ditandai admin atau ter-trigger pembayaran berhasil.
  // Produk terkunci untuk semua user — tidak bisa dibuka/dibeli sampai di-restock.
  const stockHabis = !!product.stockOut || product.stock === 0
  // Harga flash hanya berlaku untuk tier utama (pertama). Tier lain tetap memakai
  // harga katalognya — edit harga flash di panel admin tidak menyamakan semua durasi.
  const isFlashTier = isFlashSale && tierIdx === 0
  const tierPriceOf = (ti, i) => (isFlashSale && i === 0
    ? { ...ti, price: product.flashPrice, priceIntl: product.flashPriceIntl ?? ti.priceIntl }
    : ti)
  const effectiveTier = tierPriceOf(tier, tierIdx)
  const percent = isFlashSale ? 0 : discountFor(product.id)
  // Produk flash sale: harga official (katalog reguler, durasi sama) jadi harga
  // dicoret — diskon reguler tidak berlaku di produk flash sale.
  // Katalog LIVE (DB) dikirim agar produk baru langsung cocok; bila tidak ada
  // produk reguler sejenis, jatuh ke harga normal produk itu sendiri.
  const official = isFlashSale
    ? (officialOf(product, products) || { price: product.price, priceIntl: product.priceIntl })
    : null
  const flashOff = official && official.price > effectiveTier.price
    ? Math.max(0, Math.round((1 - effectiveTier.price / official.price) * 100))
    : 0
  const flashBase = amountOf({ price: official?.price ?? 0, priceIntl: official?.priceIntl ?? 0 })
  const tierBase = amountOf(effectiveTier)
  const salePrice = applyDiscount(tierBase, percent)
  const srcKey = product._srcId || product.id
  const related = products.filter((p) => (p._srcId || p.id) !== srcKey && p.category === product.category).slice(0, 3)
  const fallbackRelated = products.filter((p) => (p._srcId || p.id) !== srcKey).slice(0, 3)
  const relatedList = related.length ? related : fallbackRelated

  // Tier terpilih dgn diskon (kedua mata uang).
  const chosenTier = () => ({
    ...effectiveTier,
    ...(isFlashTier ? { label: `${effectiveTier.label} (Flash Sale)` } : {}),
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

          {/* DURASI TERKUNCI ke plan yang diklik — tidak ada dropdown pilihan durasi.
              Katalog sudah 1 plan = 1 kartu; mau durasi lain, klik kartu plan lain.
              Info plan tampil sebagai pill statis di bawah. */}
          {product.tiers.length > 1 && <div style={{ marginTop: 8 }}>
            <span className="eyebrow">{t('pd.pickDuration')}</span>
            <div style={{ marginTop: 10 }}>
              <span
                className="chip chip-lime"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontSize: 13.5 }}
              >
                <span style={{ fontWeight: 700 }}>{localizeTier(tier.label, t)}</span>
                {tier.note && <span style={{ fontWeight: 600 }}>{localizeNote(tier.note, t)}</span>}
              </span>
            </div>
          </div>}

          {/* price + add */}
          {stockHabis && (
            <p className="text-muted" style={{ color: '#dc2626', fontWeight: 700, margin: '18px 0 -4px' }}>{t('pd.stockOut')}</p>
          )}
          <div className="card pd-buy-card">
            <div className="pd-price-block">
              <span className="text-muted" style={{ fontSize: 13 }}>{t('pd.total')}</span>
              <div className="pd-price-line">
                <div className="display pd-price-big">{fmt(salePrice)}</div>
                {percent > 0 ? (
                  <>
                    <span className="pc-strike" style={{ fontSize: 15 }}>{fmt(tierBase)}</span>
                    <span className="disc-badge">-{percent}%</span>
                  </>
                ) : (flashOff > 0 && (
                  <>
                    <span className="pc-strike" style={{ fontSize: 15 }}>{fmt(flashBase)}</span>
                    <span className="disc-badge">-{flashOff}%</span>
                  </>
                ))}
              </div>
            </div>
            <div className="pd-actions">
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleBuy} disabled={stockHabis} className="pill pill-indigo pd-buy">
                {t('product.buyNow')}
                <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleAdd}
                className="pd-cart-btn"
                disabled={stockHabis}
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

      {/* ulasan & rating — satu thread untuk semua varian durasi produk yang sama */}
      <ReviewSection product={product} familyId={srcKey} />

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
