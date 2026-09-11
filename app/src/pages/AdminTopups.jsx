import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Wallet, RefreshCw, Ban } from 'lucide-react'
import { api } from '../api.js'
import { useToast } from '../context/ToastContext.jsx'
import AdminGate from '../components/AdminGate.jsx'

const fmt = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')
const TABS = [
  { key: 'PENDING', label: 'Menunggu' },
  { key: 'APPROVED', label: 'Disetujui' },
  { key: 'REJECTED', label: 'Ditolak' },
  { key: 'ALL', label: 'Semua' },
]

export default function AdminTopups() {
  const { toast } = useToast()
  const [tab, setTab] = useState('PENDING')
  const [rows, setRows] = useState(null)
  const [nPending, setNPending] = useState(0)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    try {
      const q = tab === 'ALL' ? '' : `?status=${tab}`
      const res = await api.adminTopups(q)
      setRows(res.rows || [])
      setNPending(res.nPending || 0)
    } catch (e) {
      toast(e.message || 'Gagal memuat', 'error')
      setRows([])
    }
  }, [tab, toast])

  useEffect(() => { load() }, [load])

  const act = async (id, action) => {
    setBusy(id + action)
    try {
      if (action === 'approve') {
        const res = await api.adminApproveTopup(id)
        toast(`Disetujui — saldo user sekarang ${fmt(res.balance)}`, 'success')
      } else {
        await api.adminRejectTopup(id)
        toast('Top-up ditolak', 'success')
      }
      load()
    } catch (e) {
      toast(e.message || 'Gagal memproses', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminGate>
      <h1 className="display" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)' }}>Top Up Saldo</h1>
      <p className="text-muted" style={{ marginTop: 6, fontSize: 14 }}>
        Verifikasi pembayaran top-up user — saldo dikreditkan saat disetujui.
        {nPending > 0 && (
          <span style={{ marginLeft: 8, background: '#fef3c7', border: '1.5px solid #b45309', color: '#b45309', fontWeight: 800, fontSize: 12, borderRadius: 999, padding: '2px 10px' }}>
            {nPending} menunggu
          </span>
        )}
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              cursor: 'pointer', borderRadius: 999, padding: '7px 15px', fontSize: 13, fontWeight: 800,
              background: tab === tb.key ? 'var(--ink)' : 'var(--surface-2)',
              color: tab === tb.key ? '#fff' : 'var(--ink)',
              border: '1.5px solid ' + (tab === tb.key ? 'var(--ink)' : 'var(--line-soft)'),
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {tb.key === 'PENDING' && nPending > 0 ? `${tb.label} (${nPending})` : tb.label}
          </button>
        ))}
        <button onClick={load} style={{ cursor: 'pointer', borderRadius: 999, padding: '7px 12px', background: 'var(--surface-2)', border: '1.5px solid var(--line-soft)', display: 'inline-flex' }} aria-label="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {rows === null ? (
        <p className="text-muted" style={{ marginTop: 24 }}>Memuat…</p>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          <Wallet size={40} />
          <p style={{ marginTop: 12 }}>Tidak ada pengajuan top-up di tab ini.</p>
        </div>
      ) : (
        <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
          {rows.map((r) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="display" style={{ fontSize: 15, fontFamily: 'monospace' }}>{r.id}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 10px',
                      background: r.status === 'APPROVED' ? '#dcfce7' : r.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                      color: r.status === 'APPROVED' ? '#16a34a' : r.status === 'REJECTED' ? '#dc2626' : '#b45309',
                    }}>
                      {r.status === 'APPROVED' ? 'Disetujui' : r.status === 'REJECTED' ? 'Ditolak' : 'Menunggu'}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    {r.user?.name} · {r.user?.email} · {new Date(r.createdAt).toLocaleString('id-ID')}
                  </div>
                  <div style={{ fontSize: 13.5, marginTop: 8 }}>
                    <b>{fmt(r.baseAmount)}</b>
                    {r.bonusPct > 0 && <span style={{ color: '#16a34a', fontWeight: 800 }}> +{r.bonusPct}% → {fmt(r.amount)}</span>}
                    {' '}· {r.method.toUpperCase()}{r.asset ? ` (${r.asset})` : ''}
                  </div>
                  {r.payAmount && <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>Nominal dibayar: {r.payAmount}</div>}
                  {r.txRef && <div className="text-muted" style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2 }}>Ref: {r.txRef}</div>}
                </div>

                {r.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => act(r.id, 'approve')}
                      disabled={!!busy}
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: 13 }}
                    >
                      <Check size={15} /> Setujui
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => act(r.id, 'reject')}
                      disabled={!!busy}
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fee2e2', color: '#dc2626', border: '1.5px solid #dc2626', borderRadius: 999, padding: '9px 16px', fontWeight: 800, fontSize: 13 }}
                    >
                      <X size={15} /> Tolak
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AdminGate>
  )
}
