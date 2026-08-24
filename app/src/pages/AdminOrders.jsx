import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, ChevronRight, Inbox, Wallet, Clock, ListChecks, RotateCcw } from 'lucide-react'
import { formatIDR } from '../data/products.js'
import { formatPrice } from '../i18n/pricing.js'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import AdminGate from '../components/AdminGate.jsx'
import Pager from '../components/Pager.jsx'

const TABS = [
  { key: '', label: 'Semua' },
  { key: 'PROCESSING', label: 'Diproses' },
  { key: 'COMPLETED', label: 'Selesai' },
  { key: 'CANCELLED', label: 'Dibatalkan' },
  { key: 'refund', label: 'Refund' },
]
const STATUS = {
  PROCESSING: { label: 'Diproses', cls: 'st-proc' },
  COMPLETED: { label: 'Selesai', cls: 'st-done' },
  CANCELLED: { label: 'Dibatalkan', cls: 'st-pending' },
}

export default function AdminOrders() {
  const { isAdmin, ready } = useAuth()
  const { t } = useLang()
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)

  // Reset ke halaman 1 saat ganti filter
  useEffect(() => { setPage(1) }, [filter])

  useEffect(() => {
    if (!isAdmin) return
    let on = true
    const base = filter === 'refund' ? 'refund=requested' : filter ? `status=${filter}` : ''
    const params = `${base ? base + '&' : ''}page=${page}`
    api.adminOrders(params).then((d) => on && setData(d)).catch(() => on && setData({ orders: [], counts: {} }))
    return () => { on = false }
  }, [filter, page, isAdmin])

  const changePage = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  useEffect(() => {
    if (!isAdmin) return
    let on = true
    api.adminStats().then((s) => on && setStats(s)).catch(() => {})
    return () => { on = false }
  }, [isAdmin])

  if (!ready) return null
  if (!isAdmin) return <AdminGate />

  const orders = data?.orders || []
  const counts = data?.counts || {}
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="container section">
      <h1 className="display h-lg">KELOLA PESANAN</h1>

      {/* Statistik */}
      {stats && (
        <>
          <div className="stat-cards">
            <StatCard icon={Wallet} label="Omzet (selesai)" value={<RevenueValue rev={stats.revenue} />} accent />
            <StatCard icon={Clock} label="Menunggu proses" value={<RevenueValue rev={stats.pendingRevenue} />} />
            <StatCard icon={ListChecks} label="Total pesanan" value={stats.totalOrders} />
            <StatCard icon={RotateCcw} label="Pengajuan refund" value={stats.refundPending || 0} />
          </div>

          {stats.topProducts?.length > 0 && (
            <div className="card top-products">
              <h3 className="display" style={{ fontSize: 15, marginBottom: 12 }}>PRODUK TERLARIS</h3>
              {stats.topProducts.map((p, i) => (
                <div key={p.productId} className="top-row">
                  <span className="top-rank">{i + 1}</span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                  <span className="text-muted" style={{ fontSize: 13 }}>{p.qty} terjual</span>
                  <span className="display" style={{ fontSize: 13, minWidth: 130, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {p.revenueIDR > 0 && <span>{formatIDR(p.revenueIDR)}</span>}
                    {p.revenueUSD > 0 && <span style={{ color: 'var(--indigo)' }}>{fmtUSD(p.revenueUSD)}</span>}
                    {p.revenueCNY > 0 && <span style={{ color: '#d9480f' }}>{fmtCNY(p.revenueCNY)}</span>}
                    {!p.revenueIDR && !p.revenueUSD && !p.revenueCNY && <span className="text-muted">—</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '24px 0' }}>
        {TABS.map((t) => {
          const n = t.key === 'refund' ? (data?.refundCount || 0) : t.key ? (counts[t.key] || 0) : totalCount
          return (
            <button key={t.key} onClick={() => setFilter(t.key)} className="chip"
              style={{ cursor: 'pointer', background: filter === t.key ? 'var(--ink)' : 'var(--surface-2)', color: filter === t.key ? '#fff' : 'var(--ink)' }}>
              {t.label} <span style={{ opacity: 0.7 }}>· {n}</span>
            </button>
          )
        })}
      </div>

      {data === null ? (
        <p className="text-muted">Memuat…</p>
      ) : orders.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Inbox size={34} style={{ color: 'var(--muted)' }} />
          <p className="display" style={{ fontSize: 18, marginTop: 12 }}>TIDAK ADA PESANAN</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map((o, i) => {
            const st = STATUS[o.status] || STATUS.PROCESSING
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link to={`/admin/${o.id}`} className="card order-row">
                  <span className="order-ic"><Package size={22} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span className="display" style={{ fontSize: 15 }}>{o.id}</span>
                      <span className={`order-status ${st.cls}`}>{st.label}</span>
                      {o.refundStatus === 'REQUESTED' && <span className="chip" style={{ fontSize: 10, background: 'var(--lime)', borderColor: 'var(--ink)' }}>refund?</span>}
                      {o.estimate && <span className="chip" style={{ fontSize: 10 }}>manual</span>}
                    </div>
                    <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                      {o.user?.email} · {o.items.length} item · {o.payment?.method === 'crypto' ? `Crypto ${o.payment.asset}` : t('co.payQrisChip')} · {o.activation === 'own' ? 'akun sendiri' : 'akun baru'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="display" style={{ fontSize: 16 }}>{formatPrice(o.total, o.currency)}</div>
                    <ChevronRight size={18} style={{ color: 'var(--muted)', marginLeft: 'auto' }} />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}

      <Pager page={data?.page || 1} totalPages={data?.totalPages || 1} onChange={changePage} />
    </div>
  )
}

const fmtUSD = (cents) => '$' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCNY = (cents) => '¥' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Omzet tiga mata uang: Rupiah (lokal) + USD + Yuan (internasional).
function RevenueValue({ rev }) {
  const idr = rev?.IDR || 0
  const usd = rev?.USD || 0
  const cny = rev?.CNY || 0
  if (!idr && !usd && !cny) return <span>{formatIDR(0)}</span>
  return (
    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
      {idr > 0 && <span>{formatIDR(idr)}</span>}
      {usd > 0 && <span style={{ color: 'var(--indigo)', fontSize: '0.82em' }}>{fmtUSD(usd)}</span>}
      {cny > 0 && <span style={{ color: '#d9480f', fontSize: '0.82em' }}>{fmtCNY(cny)}</span>}
    </span>
  )
}

function StatCard({ icon: Ic, label, value, accent }) {
  return (
    <div className={`stat-card ${accent ? 'is-accent' : ''}`}>
      <span className="stat-card-ic"><Ic size={18} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">{value}</div>
      </div>
    </div>
  )
}
