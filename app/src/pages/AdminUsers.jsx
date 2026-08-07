import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, ChevronRight, ShieldCheck, Mail, Calendar, Coins,
  Gift, RefreshCw, ShoppingBag, Banknote, Clock, X, Wallet, Edit3,
  RotateCcw, Ban, Check, AlertCircle, TrendingUp, ArrowUpRight, ArrowDownLeft,
  User as UserIcon,
} from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import AdminGate from '../components/AdminGate.jsx'
import Pager from '../components/Pager.jsx'

const formatIDR = (n) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function AdminUsers() {
  const { isAdmin, ready } = useAuth()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  // Detail panel
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [balanceAdjust, setBalanceAdjust] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  useEffect(() => { setPage(1) }, [q])

  useEffect(() => {
    if (!isAdmin) return
    let on = true
    setLoading(true)
    const params = `q=${encodeURIComponent(q)}&page=${page}`
    api.adminUsers(params).then((d) => { if (on) setData(d); setLoading(false) }).catch(() => { if (on) setLoading(false) })
    return () => { on = false }
  }, [q, page, isAdmin])

  const openDetail = (id) => {
    setSelectedId(id)
  }

  // Fetch detail when selectedId changes (with cleanup)
  useEffect(() => {
    if (!selectedId || !isAdmin) return
    let on = true
    setDetailLoading(true)
    setDetail(null)
    setEditing(false)
    setSaveMsg(null)
    api.adminGetUser(selectedId).then((d) => {
      if (!on) return
      setDetail(d)
      setEditName(d.user.name)
      setEditRole(d.user.role)
      setBalanceAdjust('')
      setAdjustNote('')
      setDetailLoading(false)
    }).catch((e) => {
      if (!on) return
      setDetail({ error: e.message })
      setDetailLoading(false)
    })
    return () => { on = false }
  }, [selectedId, isAdmin])

  const closeDetail = () => {
    setSelectedId(null)
    setDetail(null)
    setEditing(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const payload = {}
      if (editName !== detail.user.name) payload.name = editName
      if (editRole !== detail.user.role) payload.role = editRole
      const adj = parseInt(balanceAdjust, 10)
      if (adj && !isNaN(adj)) {
        payload.balanceAdjust = adj
        payload.adjustNote = adjustNote || null
      }
      const res = await api.adminUpdateUser(selectedId, payload)
      setDetail(prev => ({ ...prev, user: { ...prev.user, ...res.user } }))
      setSaveMsg({ type: 'success', text: 'Perubahan disimpan ✓' })
      setEditing(false)
      if (adj) {
        // Refresh list setelah adjustment saldo
        const params = `q=${encodeURIComponent(q)}&page=${page}`
        api.adminUsers(params).then(setData).catch(() => {})
      }
    } catch (e) {
      setSaveMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const changePage = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (!ready) return null
  if (!isAdmin) return <AdminGate />

  const users = data?.users || []

  return (
    <div className="container section">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={28} color="var(--indigo)" />
          <span className="eyebrow">Panel Admin</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/admin/products" className="pill" style={{ padding: '9px 16px', fontSize: 13 }}>
            <ShoppingBag size={15} /> Produk & Kupon
          </Link>
          <Link to="/admin/orders" className="pill" style={{ padding: '9px 16px', fontSize: 13 }}>
            <ShieldCheck size={15} /> Pesanan
          </Link>
        </div>
      </div>
      <h1 className="display h-lg">KELOLA PENGGUNA</h1>

      {/* Search */}
      <div className="input-ic" style={{ marginTop: 20, marginBottom: 20, maxWidth: 480 }}>
        <span style={{ paddingLeft: 14 }}><Search size={16} color="var(--muted)" /></span>
        <input
          className="input"
          placeholder="Cari user (email / nama)..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ paddingLeft: 8 }}
        />
        {q && (
          <button onClick={() => setQ('')} style={{ paddingRight: 12, cursor: 'pointer', background: 'none', border: 'none' }}>
            <X size={15} color="var(--muted)" />
          </button>
        )}
      </div>

      {/* User list */}
      {loading ? (
        <p className="text-muted">Memuat…</p>
      ) : users.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <UserIcon size={34} style={{ color: 'var(--muted)' }} />
          <p className="display" style={{ fontSize: 18, marginTop: 12 }}>{q ? 'TIDAK DITEMUKAN' : 'BELUM ADA USER'}</p>
          {q && <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>Coba kata kunci lain.</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <button
                onClick={() => openDetail(u.id)}
                className="card order-row"
                style={{ cursor: 'pointer', width: '100%', textAlign: 'left' }}
              >
                <span style={{
                  display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 999,
                  background: u.role === 'ADMIN' ? 'var(--indigo)' : 'var(--lime)',
                  color: u.role === 'ADMIN' ? '#fff' : 'var(--ink)',
                  fontSize: 15, fontWeight: 800, flexShrink: 0,
                }}>
                  {(u.name || u.email)[0].toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="display" style={{ fontSize: 15 }}>{u.name}</span>
                    {u.role === 'ADMIN' && <span className="chip" style={{ fontSize: 10, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)' }}>ADMIN</span>}
                  </div>
                  <div className="text-muted" style={{ fontSize: 12.5, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Mail size={11} /> {u.email}
                    <span>·</span>
                    <Wallet size={11} /> {formatIDR(u.balance)}
                    <span>·</span>
                    <ShoppingBag size={11} /> {u._count.orders} order
                    <span>·</span>
                    <Gift size={11} /> streak {u.checkInStreak}/7
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <Pager page={data?.page || 1} totalPages={data?.totalPages || 1} onChange={changePage} />

      {/* ============ Detail Panel (overlay) ============ */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDetail}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)',
              display: 'grid', placeItems: 'center', padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: .96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: .96, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{
                width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto',
                padding: 'clamp(20px, 4vw, 32px)', borderRadius: 20, position: 'relative',
              }}
            >
              {/* Close */}
              <button onClick={closeDetail} style={{ position: 'absolute', top: 16, right: 16, cursor: 'pointer', background: 'var(--surface-2)', border: '1.5px solid var(--line-soft)', borderRadius: 999, width: 34, height: 34, display: 'grid', placeItems: 'center' }}>
                <X size={17} />
              </button>

              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                  <RefreshCw size={28} style={{ animation: 'spin 1s infinite linear' }} />
                  <p style={{ marginTop: 12 }}>Memuat detail user...</p>
                </div>
              ) : detail?.error ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <AlertCircle size={32} style={{ color: '#dc2626' }} />
                  <p style={{ marginTop: 12, fontWeight: 700 }}>{detail.error}</p>
                </div>
              ) : detail ? (
                <>
                  {/* User info header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: 999,
                      background: detail.user.role === 'ADMIN' ? 'var(--indigo)' : 'var(--lime)',
                      color: detail.user.role === 'ADMIN' ? '#fff' : 'var(--ink)',
                      fontSize: 21, fontWeight: 800, flexShrink: 0,
                      border: '2px solid var(--ink)',
                    }}>
                      {(detail.user.name || detail.user.email)[0].toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      {editing ? (
                        <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)}
                          style={{ fontSize: 18, fontWeight: 800, width: '100%', padding: '6px 10px', marginBottom: 6 }}
                        />
                      ) : (
                        <div className="display" style={{ fontSize: 20, marginBottom: 4 }}>{detail.user.name}</div>
                      )}
                      <div className="text-muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail size={12} /> {detail.user.email}
                        <span>·</span>
                        <Calendar size={12} /> {new Date(detail.user.createdAt).toLocaleDateString('id-ID')}
                      </div>
                      {editing && (
                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                          style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--line-soft)', fontSize: 13, fontWeight: 600, background: 'var(--surface-2)' }}>
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="stat-cards" style={{ marginBottom: 20 }}>
                    <StatCard icon={Wallet} label="Saldo" value={formatIDR(detail.user.balance)} accent />
                    <StatCard icon={TrendingUp} label="Total Belanja" value={formatIDR(detail.summary.totalSpent)} />
                    <StatCard icon={ShoppingBag} label="Total Order" value={detail.summary.totalOrders} />
                    <StatCard icon={RotateCcw} label="Refund" value={`${detail.summary.refundCount} (${detail.summary.refundPending} pending)`} />
                    <StatCard icon={Gift} label="Check-in" value={`Streak ${detail.user.checkInStreak}/7`} />
                    <StatCard icon={Clock} label="User sejak" value={new Date(detail.user.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' })} />
                  </div>

                  {/* Save message */}
                  <AnimatePresence>
                    {saveMsg && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13.5, fontWeight: 600,
                          background: saveMsg.type === 'success' ? 'rgba(37,211,102,.12)' : 'rgba(255,77,77,.12)',
                          color: saveMsg.type === 'success' ? '#16a34a' : '#dc2626' }}>
                        {saveMsg.text}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Edit controls */}
                  {editing && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginBottom: 16, overflow: 'hidden' }}>
                      <div className="card" style={{ padding: 16, background: 'var(--surface-2)', borderColor: 'var(--indigo)' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Coins size={15} /> Adjustment Saldo
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <div className="input-ic" style={{ flex: 1, minWidth: 120 }}>
                            <span style={{ paddingLeft: 10, fontWeight: 700, fontSize: 13 }}>Rp</span>
                            <input className="input" type="number" placeholder="+50000 atau -20000" value={balanceAdjust} onChange={(e) => setBalanceAdjust(e.target.value)} style={{ paddingLeft: 4 }} />
                          </div>
                          <input className="input" placeholder="Catatan (opsional)" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
                            style={{ flex: 2, minWidth: 150, padding: '6px 12px' }} />
                        </div>
                        <div className="text-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                          Positif = tambah saldo, negatif = kurangi. Otomatis tercatat di riwayat transaksi.
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Edit / Save buttons */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    {editing ? (
                      <>
                        <button onClick={handleSave} disabled={saving} className="pill pill-indigo" style={{ padding: '9px 20px', fontSize: 13.5 }}>
                          <Check size={15} /> {saving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                        <button onClick={() => { setEditing(false); setBalanceAdjust(''); setSaveMsg(null) }} className="pill" style={{ padding: '9px 20px', fontSize: 13.5 }}>
                          <X size={15} /> Batal
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setEditing(true)} className="pill" style={{ padding: '9px 20px', fontSize: 13.5 }}>
                        <Edit3 size={15} /> Edit User
                      </button>
                    )}
                  </div>

                  {/* Order history */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <ShoppingBag size={16} /> Riwayat Pesanan ({detail.orders.length})
                    </div>
                    {detail.orders.length === 0 ? (
                      <div className="text-muted" style={{ fontSize: 13, padding: '10px 0' }}>Belum ada pesanan.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {detail.orders.slice(0, 10).map((o) => (
                          <Link key={o.id} to={`/admin/${o.id}`}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                              padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', textDecoration: 'none',
                              border: '1px solid var(--line-soft)', color: 'inherit', flexWrap: 'wrap',
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>{o.id}</span>
                              <span className={`chip ${o.status === 'COMPLETED' ? 'st-done' : o.status === 'CANCELLED' ? 'st-pending' : 'st-proc'}`} style={{ fontSize: 10 }}>
                                {o.status === 'COMPLETED' ? 'Selesai' : o.status === 'CANCELLED' ? 'Batal' : 'Proses'}
                              </span>
                              {o.refundStatus && o.refundStatus !== 'NONE' && (
                                <span className="chip" style={{ fontSize: 10, background: 'var(--lime)', borderColor: 'var(--ink)' }}>
                                  {o.refundStatus === 'APPROVED' ? 'Refund ✓' : o.refundStatus === 'REQUESTED' ? 'Refund?' : 'Refund ✗'}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>{formatIDR(o.total)}</span>
                              <span className="text-muted" style={{ fontSize: 11 }}>
                                {new Date(o.createdAt).toLocaleDateString('id-ID')}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Balance history */}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <RefreshCw size={16} /> Riwayat Saldo ({detail.balanceTransactions.length})
                    </div>
                    {detail.balanceTransactions.length === 0 ? (
                      <div className="text-muted" style={{ fontSize: 13, padding: '10px 0' }}>Belum ada transaksi saldo.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {detail.balanceTransactions.slice(0, 15).map((tx) => {
                          const isIn = tx.type === 'refund' || tx.type === 'checkin'
                          const typeLabel = tx.type === 'refund' ? 'Refund' : tx.type === 'purchase' ? 'Bayar' : tx.type === 'withdraw' ? 'Tarik' : tx.type === 'checkin' ? 'Check-in' : 'Transaksi'
                          return (
                            <div key={tx.id}
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                                padding: '8px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', flexWrap: 'wrap',
                              }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isIn ? <ArrowDownLeft size={14} color="#16a34a" /> : <ArrowUpRight size={14} color="var(--indigo)" />}
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{typeLabel}</span>
                                <span className="text-muted" style={{ fontSize: 11.5 }}>{tx.note}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: isIn ? '#16a34a' : 'var(--ink)' }}>
                                  {isIn ? '+' : '−'}{formatIDR(Math.abs(tx.amount))}
                                </span>
                                <span className="text-muted" style={{ fontSize: 10.5 }}>
                                  {new Date(tx.createdAt).toLocaleDateString('id-ID')}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ icon: Ic, label, value, accent }) {
  return (
    <div className={`stat-card ${accent ? 'is-accent' : ''}`} style={{ padding: '12px 14px' }}>
      <span className="stat-card-ic"><Ic size={16} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="stat-card-label" style={{ fontSize: 11 }}>{label}</div>
        <div className="stat-card-value" style={{ fontSize: 14 }}>{value}</div>
      </div>
    </div>
  )
}
