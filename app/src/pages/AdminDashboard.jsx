import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, Clock, ListChecks, RotateCcw, Package, Users, Package2,
  ChevronRight, Plus, AlertTriangle, Inbox, ShoppingBag, TrendingUp,
} from 'lucide-react'
import { formatIDR } from '../data/products.js'
import { formatMYR, formatPrice } from '../i18n/pricing.js'
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
  const [lastUpdated, setLastUpdated] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')

  const loadDashboard = useCallback(async ({ includeTotals = false } = {}) => {
    if (!isAdmin) return
    setSyncing(true)
    try {
      const [nextStats, nextRecent] = await Promise.all([
        api.adminStats('range=week'),
        api.adminOrders('page=1&pageSize=6'),
      ])
      setStats(nextStats)
      setRecent(nextRecent)
      setLastUpdated(new Date(nextStats.generatedAt || Date.now()))
      setSyncError('')
      if (includeTotals) {
        const [users, products] = await Promise.all([api.adminUsers('page=1&pageSize=1'), api.adminProducts()])
        setUserTotal(users.total)
        setProductTotal(products.products.length)
      }
    } catch {
      setSyncError('Rekap belum dapat diperbarui. Periksa koneksi lalu coba lagi.')
    } finally {
      setSyncing(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    loadDashboard({ includeTotals: true })
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadDashboard()
    }, 15_000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') loadDashboard()
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [isAdmin, loadDashboard])

  if (!ready) return null
  if (!isAdmin) return <AdminGate />

  const byStatus = stats?.byStatus || {}
  const orders = recent?.orders || []
  const periodEnd = stats?.period?.end ? new Date(new Date(stats.period.end).getTime() - 1) : null
  const dateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
  const periodLabel = stats?.period?.start && periodEnd
    ? `${dateFormat.format(new Date(stats.period.start))} sampai ${dateFormat.format(periodEnd)}`
    : 'Senin sampai Minggu'
  const updateLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' })
    : 'belum tersinkron'

  return (
    <div className="admin-dash">
      {/* Greeting */}
      <div className="admin-dash-head">
        <div>
          <h2 className="admin-dash-greet">Selamat datang, {user?.name?.split(' ')[0] || 'Admin'}</h2>
          <p className="admin-dash-sub">Rekap minggu berjalan, {periodLabel}.</p>
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

      <div className={`admin-live-meta ${syncError ? 'is-error' : ''}`} aria-live="polite">
        <span className="admin-live-dot" aria-hidden="true" />
        <span>{syncError || `Data diperbarui otomatis setiap 15 detik. Sinkron terakhir ${updateLabel} WIB.`}</span>
        {syncError && <button type="button" onClick={() => loadDashboard()} disabled={syncing}>{syncing ? 'Memuat' : 'Coba lagi'}</button>}
      </div>

      {/* Stat cards utama */}
      <div className="admin-kpis">
        <Kpi icon={Wallet} label="Omzet Selesai Minggu Ini" accent>
          <RevenueValue rev={stats?.revenue} />
        </Kpi>
        <Kpi icon={ListChecks} label="Pesanan Minggu Ini">
          <span className="kpi-num">{stats ? stats.totalOrders : '…'}</span>
        </Kpi>
        <Kpi icon={Clock} label="Omzet Menunggu Minggu Ini">
          <RevenueValue rev={stats?.pendingRevenue} />
        </Kpi>
        <Kpi icon={RotateCcw} label="Pengajuan Refund" tone={stats?.refundPending > 0 ? 'warn' : ''}>
          <span className="kpi-num">{stats ? stats.refundPending || 0 : '…'}</span>
        </Kpi>
      </div>

      {/* Baris kedua: ringkasan status + angka cepat */}
      <div className="admin-dash-grid">
        {/* Status pesanan */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3>Status Pesanan Minggu Ini</h3>
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
            <MiniStat icon={Users} label="Pengguna" value={userTotal === null ? '…' : userTotal} />
            <MiniStat icon={Package} label="Produk" value={productTotal === null ? '…' : productTotal} />
            <MiniStat icon={AlertTriangle} label="Stok Menipis" value={stats ? stats.lowStock || 0 : '…'} />
          </div>
        </div>

        {/* Top produk */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3>Produk Terlaris Minggu Ini</h3>
            <TrendingUp size={16} className="text-muted" />
          </div>
          {stats === null ? (
            <div className="admin-empty">
              <p>Memuat penjualan minggu ini…</p>
            </div>
          ) : stats.topProducts?.length ? (
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
                    {p.revenueMYR > 0 && <span className="rev-myr">{formatMYR(p.revenueMYR)}</span>}
                    {!p.revenueIDR && !p.revenueUSD && !p.revenueCNY && !p.revenueMYR && <span className="text-muted">0</span>}
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
        {recent === null ? (
          <div className="admin-empty">
            <p>Memuat pesanan terbaru…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="admin-empty">
            <Inbox size={26} />
            <p>Belum ada pesanan.</p>
          </div>
        ) : (
          <div className="admin-recent">
            {orders.map((o) => {
              const st = STATUS[o.status] || STATUS.PROCESSING
              return (
                <div key={o.id}>
                  <Link to={`/admin/${o.id}`} className="admin-recent-row">
                    <span className="admin-recent-ic"><ShoppingBag size={17} /></span>
                    <div className="admin-recent-main">
                      <div className="admin-recent-id">
                        {o.id}
                        <span className={`order-status ${st.cls}`}>{st.label}</span>
                        {o.refundStatus === 'REQUESTED' && <span className="chip" style={{ fontSize: 10, background: 'var(--lime)', borderColor: 'var(--ink)' }}>refund?</span>}
                      </div>
                      <div className="text-muted admin-recent-sub">
                        {o.user?.email || 'Email tidak tersedia'} · {o.items.length} item · {o.payment?.method === 'crypto' ? `Crypto ${o.payment.asset}` : t('co.payQrisChip')}
                      </div>
                    </div>
                    <div className="admin-recent-right">
                      <span className="admin-recent-total">{formatPrice(o.total, o.currency)}</span>
                      <span className="text-muted admin-recent-date">{new Date(o.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <ChevronRight size={17} className="text-muted" />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function RevenueValue({ rev }) {
  if (!rev) return <span className="kpi-num">…</span>
  const idr = rev?.IDR || 0
  const usd = rev?.USD || 0
  const cny = rev?.CNY || 0
  const myr = rev?.MYR || 0
  if (!idr && !usd && !cny && !myr) return <span className="kpi-num">{formatIDR(0)}</span>
  return (
    <span className="kpi-multi">
      {idr > 0 && <span>{formatIDR(idr)}</span>}
      {usd > 0 && <span className="rev-usd">{fmtUSD(usd)}</span>}
      {cny > 0 && <span className="rev-cny">{fmtCNY(cny)}</span>}
      {myr > 0 && <span className="rev-myr">{formatMYR(myr)}</span>}
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
