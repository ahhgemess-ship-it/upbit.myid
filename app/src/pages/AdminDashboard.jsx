import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Wallet, Clock, ListChecks, RotateCcw, Package, Users, Package2, Tag,
  ChevronRight, Plus, AlertTriangle, Inbox, ShoppingBag, TrendingUp,
} from 'lucide-react'
import { formatIDR } from '../data/products.js'
import { formatPrice } from '../i18n/pricing.js'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import AdminGate from '../components/AdminGate.jsx'

const fmtUSD = (c) => '$' + ((c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCNY = (c) => '¥' + ((c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS = {
  PROCESSING: { label: 'Diproses', cls: 'st-proc' },
  COMPLETED: { label: 'Selesai', cls: 'st-done' },
  CANCELLED: { label: 'Dibatalkan', cls: 'st-pending' },
}

export default function AdminDashboard() {
  const { isAdmin, ready, user } = useAuth()
  const { t } = useLang()
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState(null)
  const [userTotal, setUserTotal] = useState(null)
  const [productTotal, setProductTotal] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    let on = true
    api.adminStats().then((s) => on && setStats(s)).catch(() => {})
    api.adminOrders('page=1&pageSize=6').then((d) => on && setRecent(d)).catch(() => {})
    api.adminUsers('page=1&pageSize=1').then((d) => on && setUserTotal(d.total)).catch(() => {})
    api.adminProducts().then((d) => on && setProductTotal(d.products.length)).catch(() => {})
    return () => { on = false }
  }, [isAdmin])

  if (!ready) return null
  if (!isAdmin) return <AdminGate />

  const byStatus = stats?.byStatus || {}
  const orders = recent?.orders || []

  return (
    <div className="admin-dash">
      {/* Greeting */}
      <div className="admin-dash-head">
        <div>
          <h2 className="admin-dash-greet">Selamat datang, {user?.name?.split(' ')[0] || 'Admin'} 👋</h2>
          <p className="admin-dash-sub">Ringkasan performa toko EvolusiAI hari ini.</p>
        </div>
        <div className="admin-dash-actions">
          <Link to="/admin/products" className="admin-btn admin-btn-ghost">
            <Package2 size={16} /> Produk
          </Link>
          <Link to="/admin/coupons" className="admin-btn admin-btn-primary">
            <Plus size={16} /> Kupon Baru
          </Link>
        </div>
      </div>

      {/* Stat cards utama */}
      <div className="admin-kpis">
        <Kpi icon={Wallet} label="Omzet (Selesai)" accent>
          <RevenueValue rev={stats?.revenue} />
        </Kpi>
        <Kpi icon={ListChecks} label="Total Pesanan">
          <span className="kpi-num">{stats ? stats.totalOrders : '—'}</span>
        </Kpi>
        <Kpi icon={Clock} label="Omzet Menunggu">
          <RevenueValue rev={stats?.pendingRevenue} />
        </Kpi>
        <Kpi icon={RotateCcw} label="Pengajuan Refund" tone={stats?.refundPending > 0 ? 'warn' : ''}>
          <span className="kpi-num">{stats ? stats.refundPending || 0 : '—'}</span>
        </Kpi>
      </div>

      {/* Baris kedua: ringkasan status + angka cepat */}
      <div className="admin-dash-grid">
        {/* Status pesanan */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3>Status Pesanan</h3>
            <Link to="/admin/orders" className="admin-card-link">Lihat semua <ChevronRight size={14} /></Link>
          </div>
          <div className="admin-status-list">
            {['PROCESSING', 'COMPLETED', 'CANCELLED'].map((k) => {
              const n = byStatus[k] || 0
              const total = stats?.totalOrders || 1
              const pct = Math.round((n / total) * 100)
              return (
                <div key={k} className="admin-status-row">
                  <div className="admin-status-top">
                    <span className="admin-status-label">
                      <span className={`status-dot ${STATUS[k].cls}`} /> {STATUS[k].label}
                    </span>
                    <span className="admin-status-count">{n}</span>
                  </div>
                  <div className="admin-status-bar"><span style={{ width: `${pct}%` }} className={STATUS[k].cls} /></div>
                </div>
              )
            })}
          </div>
          <div className="admin-mini-stats">
            <MiniStat icon={Users} label="Pengguna" value={userTotal === null ? '—' : userTotal} />
            <MiniStat icon={Package} label="Produk" value={productTotal === null ? '—' : productTotal} />
            <MiniStat icon={AlertTriangle} label="Stok Menipis" value={stats ? stats.lowStock || 0 : '—'} />
          </div>
        </div>

        {/* Top produk */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3>Produk Terlaris</h3>
            <TrendingUp size={16} className="text-muted" />
          </div>
          {stats?.topProducts?.length ? (
            <div className="admin-top-list">
              {stats.topProducts.slice(0, 6).map((p, i) => (
                <div key={p.productId} className="admin-top-row">
                  <span className={`admin-top-rank ${i < 3 ? 'is-top' : ''}`}>{i + 1}</span>
                  <div className="admin-top-name">
                    <span>{p.name}</span>
                    <span className="text-muted">{p.qty} terjual</span>
                  </div>
                  <div className="admin-top-rev">
                    {p.revenueIDR > 0 && <span>{formatIDR(p.revenueIDR)}</span>}
                    {p.revenueUSD > 0 && <span className="rev-usd">{fmtUSD(p.revenueUSD)}</span>}
                    {p.revenueCNY > 0 && <span className="rev-cny">{fmtCNY(p.revenueCNY)}</span>}
                    {!p.revenueIDR && !p.revenueUSD && !p.revenueCNY && <span className="text-muted">—</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty">
              <Package size={26} />
              <p>Belum ada data penjualan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pesanan terbaru */}
      <div className="admin-card">
        <div className="admin-card-head">
          <h3>Pesanan Terbaru</h3>
          <Link to="/admin/orders" className="admin-card-link">Semua pesanan <ChevronRight size={14} /></Link>
        </div>
        {orders.length === 0 ? (
          <div className="admin-empty">
            <Inbox size={26} />
            <p>Belum ada pesanan.</p>
          </div>
        ) : (
          <div className="admin-recent">
            {orders.map((o, i) => {
              const st = STATUS[o.status] || STATUS.PROCESSING
              return (
                <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Link to={`/admin/${o.id}`} className="admin-recent-row">
                    <span className="admin-recent-ic"><ShoppingBag size={17} /></span>
                    <div className="admin-recent-main">
                      <div className="admin-recent-id">
                        {o.id}
                        <span className={`order-status ${st.cls}`}>{st.label}</span>
                        {o.refundStatus === 'REQUESTED' && <span className="chip" style={{ fontSize: 10, background: 'var(--lime)', borderColor: 'var(--ink)' }}>refund?</span>}
                      </div>
                      <div className="text-muted admin-recent-sub">
                        {o.user?.email || '—'} · {o.items.length} item · {o.payment?.method === 'crypto' ? `Crypto ${o.payment.asset}` : t('co.payQrisChip')}
                      </div>
                    </div>
                    <div className="admin-recent-right">
                      <span className="admin-recent-total">{formatPrice(o.total, o.currency)}</span>
                      <span className="text-muted admin-recent-date">{new Date(o.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <ChevronRight size={17} className="text-muted" />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function RevenueValue({ rev }) {
  const idr = rev?.IDR || 0
  const usd = rev?.USD || 0
  const cny = rev?.CNY || 0
  if (!idr && !usd && !cny) return <span className="kpi-num">{formatIDR(0)}</span>
  return (
    <span className="kpi-multi">
      {idr > 0 && <span>{formatIDR(idr)}</span>}
      {usd > 0 && <span className="rev-usd">{fmtUSD(usd)}</span>}
      {cny > 0 && <span className="rev-cny">{fmtCNY(cny)}</span>}
    </span>
  )
}

function Kpi({ icon: Ic, label, children, accent, tone }) {
  return (
    <div className={`admin-kpi ${accent ? 'is-accent' : ''} ${tone === 'warn' ? 'is-warn' : ''}`}>
      <span className="admin-kpi-ic"><Ic size={20} /></span>
      <div className="admin-kpi-body">
        <div className="admin-kpi-label">{label}</div>
        <div className="admin-kpi-value">{children}</div>
      </div>
    </div>
  )
}

function MiniStat({ icon: Ic, label, value }) {
  return (
    <div className="admin-mini-stat">
      <Ic size={15} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}
