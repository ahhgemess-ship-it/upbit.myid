import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus, Trash2, ShoppingCart, ArrowUpRight, LogIn } from 'lucide-react'
import BrandLogo from '../components/BrandLogo.jsx'
import Asterisk from '../components/Asterisk.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { localizeTier } from '../i18n/productContent.js'
import { usePricing, amountFor } from '../i18n/pricing.js'

export default function Cart() {
  const { items, updateQty, removeItem, clear, count } = useCart()
  const { user } = useAuth()
  const { t } = useLang()
  const { fmt, region } = usePricing()
  const priceOf = (it) => amountFor(it, region)
  const origOf = (it) => amountFor({ price: it.original, priceIntl: it.originalIntl }, region)
  const total = items.reduce((s, it) => s + priceOf(it) * it.qty, 0)
  const navigate = useNavigate()

  const handleCheckout = () => {
    navigate('/checkout')
  }

  if (count === 0) {
    return (
      <div className="container section" style={{ textAlign: 'center', maxWidth: 540 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 76, height: 76, borderRadius: 999, margin: '0 auto 22px', background: 'var(--surface-2)', border: '1.5px solid var(--ink)' }}>
          <ShoppingCart size={32} />
        </span>
        <h1 className="display h-md">{t('cart.emptyTitle')}</h1>
        <p className="text-muted" style={{ marginTop: 12 }}>{t('cart.emptyText')}</p>
        <Link to="/store" className="pill pill-indigo" style={{ marginTop: 24 }}>
          {t('footer.startShopping')} <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
        </Link>
      </div>
    )
  }

  return (
    <div className="container section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Asterisk size={28} />
        <h1 className="display h-lg">{t('cart.title')} ({count})</h1>
      </div>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 30, alignItems: 'start' }}>
        {/* items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.div
                key={it.key}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="card cart-item"
                style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}
              >
                <BrandLogo src={it.logo} name={it.name} brand={it.brand} size={54} />
                <div className="cart-item-info" style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="display cart-item-name" style={{ fontSize: 17 }}>{it.name}</h3>
                  <div className="text-muted" style={{ fontSize: 13 }}>{it.vendor} · {localizeTier(it.tierLabel, t)}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span className="display cart-item-price" style={{ fontSize: 16 }}>{fmt(priceOf(it))}</span>
                    {origOf(it) > priceOf(it) && (
                      <>
                        <span className="pc-strike" style={{ fontSize: 12.5 }}>{fmt(origOf(it))}</span>
                        <span className="disc-badge">-{Math.round((1 - priceOf(it) / origOf(it)) * 100)}%</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="cart-item-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <QtyBtn onClick={() => updateQty(it.key, -1)}><Minus size={15} /></QtyBtn>
                    <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 600 }}>{it.qty}</span>
                    <QtyBtn onClick={() => updateQty(it.key, 1)}><Plus size={15} /></QtyBtn>
                  </div>
                  <button onClick={() => removeItem(it.key)} aria-label="Hapus"
                    style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, border: '1.5px solid var(--line-soft)', flexShrink: 0 }}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <button onClick={clear} className="btn-link" style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: 14, borderColor: 'var(--muted)', color: 'var(--muted)' }}>
            {t('cart.clear')}
          </button>
        </div>

        {/* summary */}
        <div className="card" style={{ padding: 24, position: 'sticky', top: 90 }}>
          <h3 className="display" style={{ fontSize: 18, marginBottom: 18 }}>{t('cart.summary')}</h3>
          <Row label={`${t('cart.subtotal')} (${count} item)`} value={fmt(total)} />
          <Row label={t('cart.serviceFee')} value={t('cart.free')} />
          <div style={{ borderTop: '1.5px solid var(--line-soft)', margin: '16px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600 }}>{t('cart.total')}</span>
            <span className="display" style={{ fontSize: 26 }}>{fmt(total)}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCheckout}
            className="pill pill-indigo"
            style={{ width: '100%', justifyContent: 'center', marginTop: 22, padding: '15px', fontSize: 16 }}
          >
            {t('cart.checkout')}
            <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

function QtyBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, border: '1.5px solid var(--line-soft)' }}>
      {children}
    </button>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, marginBottom: 10 }}>
      <span className="text-muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}
