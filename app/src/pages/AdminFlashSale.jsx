import { useState, useEffect, useMemo } from 'react'
import { Search, X, Zap, Package, Check } from 'lucide-react'
import { formatIDR, applyDiscount } from '../data/products.js'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import AdminGate from '../components/AdminGate.jsx'

// Kelola produk mana yang masuk halaman Flash Sale — tanpa mengubah kategori.
// Toggle per produk disimpan ke field `flashSale` di DB.
export default function AdminFlashSale() {
  const { isAdmin, ready } = useAuth()
  const { toast } = useToast()
  const { refresh } = useCatalog()
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [savingId, setSavingId] = useState(null)

  const load = () => api.adminProducts().then((d) => setRows(d.products)).catch(() => setRows([]))
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  const toggle = async (p, next) => {
    setSavingId(p.id)
    try {
      await api.adminUpdateProduct(p.id, { flashSale: next })
      setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, flashSale: next } : r)))
      refresh()
      toast(next ? `"${p.name}" masuk Flash Sale` : `"${p.name}" dikeluarkan dari Flash Sale`, 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSavingId(null)
    }
  }

  const filtered = useMemo(() => {
    const list = rows || []
    const kw = q.trim().toLowerCase()
    if (!kw) return list
    return list.filter((p) => (p.name + ' ' + (p.vendor || '') + ' ' + (p.category || '')).toLowerCase().includes(kw))
  }, [rows, q])

  const inCount = (rows || []).filter((p) => p.flashSale).length

  if (!ready) return null
  if (!isAdmin) return <AdminGate />

  return (
    <div className="container section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 12, background: 'var(--lime)', color: 'var(--ink)' }}>
          <Zap size={19} fill="currentColor" />
        </span>
        <h1 className="display h-lg">KELOLA FLASH SALE</h1>
      </div>
      <p className="text-muted" style={{ fontSize: 14, marginTop: 8, maxWidth: 640 }}>
        Pilih produk mana yang tampil di halaman <strong>/flash-sale</strong>. Nyalakan toggle untuk memasukkan produk — <strong>kategori produk tidak berubah</strong>, jadi produk tetap muncul juga di katalog biasa.
      </p>

      <div className="stat-cards" style={{ marginTop: 22 }}>
        <div className="stat-card is-accent" style={{ padding: '14px 16px' }}>
          <span className="stat-card-ic"><Zap size={16} /></span>
          <div>
            <div className="stat-card-label" style={{ fontSize: 11 }}>Produk di Flash Sale</div>
            <div className="stat-card-value" style={{ fontSize: 16 }}>{inCount} / {rows?.length || 0}</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="input-ic" style={{ marginTop: 20, marginBottom: 20, maxWidth: 480 }}>
        <span style={{ paddingLeft: 14 }}><Search size={16} color="var(--muted)" /></span>
        <input
          className="input"
          placeholder="Cari produk (nama / vendor / kategori)..."
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

      {rows === null ? (
        <p className="text-muted" style={{ marginTop: 10 }}>Memuat…</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Package size={34} style={{ color: 'var(--muted)' }} />
          <p className="display" style={{ fontSize: 18, marginTop: 12 }}>{q ? 'TIDAK DITEMUKAN' : 'BELUM ADA PRODUK'}</p>
          {q && <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>Coba kata kunci lain.</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((p) => {
            const on = !!p.flashSale
            return (
              <div key={p.id} className="card prod-row">
                <span className="prod-swatch" style={{ background: p.brand || 'var(--surface-2)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="display" style={{ fontSize: 14.5 }}>{p.name}</span>
                    {!p.active && <span className="chip" style={{ fontSize: 10, background: 'var(--surface-2)' }}>nonaktif</span>}
                    {on && <span className="chip chip-lime" style={{ fontSize: 10 }}><Zap size={10} fill="currentColor" /> flash sale</span>}
                  </div>
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    {p.vendor} · {p.category} · {formatIDR(applyDiscount(p.price, p.discountPercent))}
                    {p.discountPercent > 0 ? ` (-${p.discountPercent}%)` : ''}
                    {' · '}{p.stock === -1 ? 'stok ∞' : `stok ${p.stock}`}
                  </span>
                </div>
                <button
                  onClick={() => toggle(p, !on)}
                  disabled={savingId === p.id || !p.active}
                  className={`fs-toggle ${on ? 'is-on' : ''}`}
                  style={{ flexShrink: 0 }}
                  aria-label={on ? `Keluarkan ${p.name} dari flash sale` : `Masukkan ${p.name} ke flash sale`}
                >
                  <span className="fs-toggle-knob">{savingId === p.id ? '…' : on ? <Check size={12} strokeWidth={3} /> : ''}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-muted" style={{ fontSize: 12, marginTop: 18 }}>
        Produk nonaktif tidak bisa dimasukkan. Perubahan langsung tampil di halaman flash sale.
      </p>

      <style>{`
        .fs-toggle {
          width: 52px; height: 30px; border-radius: 999px; cursor: pointer;
          background: var(--surface-2); border: 1.5px solid var(--line-soft);
          position: relative; transition: background .18s ease, border-color .18s ease;
          display: flex; align-items: center; padding: 0 3px;
        }
        .fs-toggle:disabled { opacity: .45; cursor: not-allowed; }
        .fs-toggle.is-on { background: var(--lime); border-color: var(--ink); justify-content: flex-end; }
        .fs-toggle-knob {
          width: 22px; height: 22px; border-radius: 999px; background: #fff;
          border: 1.5px solid var(--line-soft); display: grid; place-items: center;
          font-size: 11px; color: var(--ink); transition: all .18s ease;
        }
        .fs-toggle.is-on .fs-toggle-knob { border-color: var(--ink); color: var(--ink); }
      `}</style>
    </div>
  )
}