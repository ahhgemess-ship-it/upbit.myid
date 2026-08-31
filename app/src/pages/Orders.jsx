import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, ChevronRight, ArrowUpRight, ShoppingBag } from 'lucide-react'
import Asterisk from '../components/Asterisk.jsx'
import Pager from '../components/Pager.jsx'
import { formatPrice } from '../i18n/pricing.js'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'

const STATUS = {
  PROCESSING: { key: 'status.processing', cls: 'st-proc' },
  COMPLETED: { key: 'status.completed', cls: 'st-done' },
  CANCELLED: { key: 'status.cancelled', cls: 'st-pending' },
}

export default function Orders() {
  const { user, ready } = useAuth()
  const { t } = useLang()
  const [orders, setOrders] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (!user) { setOrders([]); return }
    let on = true
    api.myOrders(page)
      .then((d) => { if (on) { setOrders(d.orders); setTotalPages(d.totalPages || 1) } })
      .catch(() => on && setOrders([]))
    return () => { on = false }
  }, [user, page])

  const changePage = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (!ready || orders === null) {
    return <div className="container section" style={{ textAlign: 'center' }}><p className="text-muted">{t('common.loading')}</p></div>
  }
  if (!user) {
    return <Empty title={t('orders.signInTitle')} text={t('orders.signInText')} to="/login" cta={t('nav.login')} />
  }
  if (orders.length === 0) {
    return <Empty title={t('orders.emptyTitle')} text={t('orders.emptyText')} to="/store" cta={t('footer.startShopping')} />
  }

  return (
    <div className="container section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Asterisk size={28} />
        <h1 className="display h-lg">{t('orders.title')}</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {orders.map((o, i) => {
          const st = STATUS[o.status] || STATUS.PROCESSING
          return (
            <motion.div key={o.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/orders/${o.id}`} className="card order-row">
                <span className="order-ic"><Package size={22} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="display" style={{ fontSize: 15 }}>{o.id}</span>
                    <span className={`order-status ${st.cls}`}>{t(st.key)}</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {o.items.length} {t('orders.products')} · {o.payment?.method === 'crypto' ? `Crypto ${o.payment.asset}` : t('co.payQrisChip')} · {fmtDate(o.createdAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="display" style={{ fontSize: 17 }}>{formatPrice(o.total, o.currency)}</div>
                  <ChevronRight size={18} style={{ color: 'var(--muted)', marginLeft: 'auto' }} />
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>

      <Pager page={page} totalPages={totalPages} onChange={changePage} />
    </div>
  )
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

function Empty({ title, text, to, cta }) {
  return (
    <div className="container section" style={{ textAlign: 'center', maxWidth: 540 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 76, height: 76, borderRadius: 999, margin: '0 auto 22px', background: 'var(--surface-2)', border: '1.5px solid var(--ink)' }}>
        <ShoppingBag size={32} />
      </span>
      <h1 className="display h-md">{title}</h1>
      <p className="text-muted" style={{ marginTop: 12 }}>{text}</p>
      <Link to={to} className="pill pill-indigo" style={{ marginTop: 24 }}>
        {cta} <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
      </Link>
    </div>
  )
}
