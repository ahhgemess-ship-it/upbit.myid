import { useState, useEffect } from 'react'
import { Plus, Trash2, UserSearch } from 'lucide-react'
import { api } from '../api.js'
import { useLang } from '../context/LanguageContext.jsx'
import { formatPrice } from '../i18n/pricing.js'

// Modal tambah pesanan manual (offline/walk-in): pilih pembeli + produk,
// lalu buat pesanan yang langsung bisa dicetak struknya.
export default function AdminAddOrder({ onClose, onCreated }) {
  const { t } = useLang()
  const [users, setUsers] = useState([])
  const [userQ, setUserQ] = useState('')
  const [userId, setUserId] = useState(null)
  const [userPicked, setUserPicked] = useState(null)
  const [products, setProducts] = useState([])
  const [pid, setPid] = useState('')
  const [tierIdx, setTierIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const [rows, setRows] = useState([])
  const [deliveryEmail, setDeliveryEmail] = useState('')
  const [note, setNote] = useState('')
  const [markCompleted, setMarkCompleted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  // Daftar user (sekali) + katalog produk aktif
  useEffect(() => {
    api.adminUsers('pageSize=100').then((d) => setUsers(d.users || [])).catch(() => {})
    api.products().then(setProducts).catch(() => {})
  }, [])

  const filteredUsers = userQ.trim()
    ? users.filter((u) => `${u.email} ${u.name || ''}`.toLowerCase().includes(userQ.trim().toLowerCase())).slice(0, 6)
    : []

  const prod = products.find((p) => p.id === pid)
  const tier = prod?.tiers?.[tierIdx] || prod?.tiers?.[0]

  const addRow = () => {
    if (!prod || !tier) return
    setRows((r) => [...r, { productId: prod.id, name: prod.name, tierLabel: tier.label, tierIndex: tierIdx, price: tier.price, qty }])
    setPid(''); setTierIdx(0); setQty(1)
  }
  const total = rows.reduce((s, r) => s + r.price * r.qty, 0)

  const pickUser = (u) => {
    setUserId(u.id)
    setUserPicked(u)
    if (!deliveryEmail) setDeliveryEmail(u.email)
    setUserQ('')
  }

  const submit = async () => {
    setErr(null)
    if (!userId) return setErr(t('ao.buyer') + '?')
    if (!rows.length) return setErr(t('ao.products') + '?')
    setBusy(true)
    try {
      const { order } = await api.adminCreateOrder({
        userId, deliveryEmail, note, markCompleted,
        items: rows.map((r) => ({ id: r.productId, tierIndex: r.tierIndex, qty: r.qty })),
      })
      onCreated(order)
    } catch (e) {
      setErr(e.message || 'Gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,20,18,.62)', display: 'grid', placeItems: 'center', padding: 18, overflowY: 'auto' }} onClick={onClose}>
      <div className="card" style={{ width: 'min(520px, 100%)', padding: 22, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="display" style={{ fontSize: 16, marginBottom: 14 }}>{t('ao.add')}</h3>

        {/* Pembeli */}
        <label className="field-label">{t('ao.buyer')}</label>
        {userPicked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--surface-2)', borderRadius: 10, marginBottom: 10 }}>
            <UserSearch size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userPicked.name || userPicked.email}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>{userPicked.email}</div>
            </div>
            <button className="btn-link" style={{ fontSize: 12 }} onClick={() => { setUserId(null); setUserPicked(null) }}>✕</button>
          </div>
        ) : (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <div className="input-ic">
              <UserSearch size={16} />
              <input className="input" placeholder={t('ao.searchBuyer')} value={userQ} onChange={(e) => setUserQ(e.target.value)} />
            </div>
            {filteredUsers.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, background: 'var(--surface)', border: '1.5px solid var(--line-soft)', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
                {filteredUsers.map((u) => (
                  <button key={u.id} type="button" onClick={() => pickUser(u)}
                    style={{ cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--line-soft)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{u.name || u.email}</div>
                    <div className="text-muted" style={{ fontSize: 11.5 }}>{u.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Produk */}
        <label className="field-label">{t('ao.products')}</label>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto auto auto', alignItems: 'end' }}>
          <div>
            <select className="input" value={pid} onChange={(e) => { setPid(e.target.value); setTierIdx(0) }}>
              <option value="">{t('ao.pickProduct')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {prod?.tiers?.length > 1 && (
            <select className="input" value={tierIdx} onChange={(e) => setTierIdx(parseInt(e.target.value, 10))} style={{ width: 'auto' }}>
              {prod.tiers.map((tr, i) => <option key={i} value={i}>{tr.label}</option>)}
            </select>
          )}
          <input className="input" type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} style={{ width: 64 }} title={t('ao.qty')} />
          <button className="pill" onClick={addRow} disabled={!prod}><Plus size={15} /> {t('ao.addItem')}</button>
        </div>

        {/* Daftar item */}
        {rows.length > 0 && (
          <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{r.name}</b> <span className="text-muted">· {r.tierLabel} · {r.qty}×</span>
                </div>
                <span style={{ fontWeight: 700 }}>{formatPrice(r.price * r.qty, 'IDR')}</span>
                <button className="btn-link" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Email + catatan */}
        <label className="field-label" style={{ marginTop: 12 }}>{t('ao.deliveryEmail')}</label>
        <input className="input" type="email" value={deliveryEmail} onChange={(e) => setDeliveryEmail(e.target.value)} />
        <label className="field-label" style={{ marginTop: 10 }}>{t('ao.note')}</label>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ resize: 'vertical' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={markCompleted} onChange={(e) => setMarkCompleted(e.target.checked)} />
          {t('ao.markCompleted')}
        </label>

        {/* Total + aksi */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 4px' }}>
          <span className="text-muted" style={{ fontSize: 13 }}>{t('ao.total')}</span>
          <b className="display" style={{ fontSize: 18 }}>{formatPrice(total, 'IDR')}</b>
        </div>
        {err && <div style={{ color: '#d4452f', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pill" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Batal</button>
          <button className="pill pill-indigo" style={{ flex: 1, justifyContent: 'center' }} disabled={busy || !userId || !rows.length} onClick={submit}>
            <Plus size={15} /> {t('ao.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
