import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, X, Zap, Package, Check, Pencil, Save, Ban, Upload, Image as ImageIcon } from 'lucide-react'
import { formatIDR, applyDiscount } from '../data/products.js'
import { USD_TO_IDR } from '../i18n/pricing.js'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import AdminGate from '../components/AdminGate.jsx'

const BADGES = [
  { value: '', label: 'Tanpa badge' },
  { value: 'PRIVATE', label: 'Private', color: '#16a34a' },
  { value: 'SHARING', label: 'Sharing', color: '#d97706' },
]

// Kelola produk mana yang masuk halaman Flash Sale — tanpa mengubah kategori.
export default function AdminFlashSale() {
  const { isAdmin, ready } = useAuth()
  const { toast } = useToast()
  const { refresh } = useCatalog()
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [drafts, setDrafts] = useState({})

  const load = () => api.adminProducts().then((d) => {
    setRows(d.products)
    setDrafts(Object.fromEntries(d.products.map((p) => [p.id, {
      flashPrice: p.flashPrice ?? p.price,
      stock: p.stock === -1 ? '' : p.stock,
      stockOut: !!p.stockOut,
      name: p.name || '',
      description: p.description || '',
      price: p.price ?? 0,
      logo: p.logo || '',
      badge: p.badge || '',
    }])))
  }).catch(() => setRows([]))
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

  const setDraft = (id, key, value) => setDrafts((ds) => ({ ...ds, [id]: { ...ds[id], [key]: value } }))

  const onPickLogo = async (p, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Pilih file gambar (PNG/JPG)', 'error'); return }
    if (file.size > 3 * 1024 * 1024) { toast('Ukuran gambar maks 3MB', 'error'); return }
    setUploadingId(p.id)
    try {
      const { url } = await api.adminUploadProductImage(file)
      setDraft(p.id, 'logo', url)
      toast('Gambar produk terunggah — klik Simpan untuk menerapkan', 'success')
    } catch (err) {
      toast(err.message || 'Gagal mengunggah gambar', 'error')
    } finally {
      setUploadingId(null)
      e.target.value = ''
    }
  }

  const saveSettings = async (p) => {
    const d = drafts[p.id] || {}
    const flashPrice = Math.max(0, parseInt(d.flashPrice, 10) || 0)
    const price = Math.max(0, parseInt(d.price, 10) || 0)
    const stock = d.stock === '' ? -1 : parseInt(d.stock, 10)
    const name = (d.name || '').trim()
    if (!name) { toast('Nama produk tidak boleh kosong', 'error'); return }
    if (!Number.isSafeInteger(flashPrice) || flashPrice <= 0) {
      toast('Harga Flash Sale harus lebih besar dari 0', 'error')
      return
    }
    if (!Number.isSafeInteger(price) || price <= 0) {
      toast('Harga normal (original) harus lebih besar dari 0', 'error')
      return
    }
    if (!Number.isSafeInteger(stock) || stock < -1) {
      toast('Stok harus angka 0 atau lebih, atau -1 untuk tak terbatas', 'error')
      return
    }
    setSavingId(p.id)
    try {
      const badgeDef = BADGES.find((b) => b.value === (d.badge || ''))
      // Harga normal baru harus sinkron dengan tier utama (dropdown durasi di
      // halaman detail memakai tiers[].price) — jangan biarkan basi.
      const nextTiers = (Array.isArray(p.tiers) && p.tiers.length
        ? [{ ...p.tiers[0], price, priceIntl: Math.max(1, Math.round((price * 100) / USD_TO_IDR)) }, ...p.tiers.slice(1)]
        : [{ label: 'Produk', price, priceIntl: Math.max(1, Math.round((price * 100) / USD_TO_IDR)) }])
      const { product } = await api.adminUpdateProduct(p.id, {
        flashPrice,
        // USD mengikuti harga Rp (flash) yang baru — jangan pakai nilai lama yang basi.
        flashPriceIntl: Math.max(1, Math.round((flashPrice * 100) / USD_TO_IDR)),
        price,
        priceIntl: Math.max(1, Math.round((price * 100) / USD_TO_IDR)),
        name,
        description: (d.description || '').trim(),
        logo: (d.logo || '').trim() || null,
        badge: badgeDef?.value || null,
        badgeColor: badgeDef?.color || null,
        stock,
        stockOut: !!d.stockOut,
        tiers: nextTiers,
      })
      setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, ...product } : r)))
      setDraft(p.id, 'flashPrice', product.flashPrice ?? product.price)
      setDraft(p.id, 'stock', product.stock === -1 ? '' : product.stock)
      setDraft(p.id, 'stockOut', !!product.stockOut)
      setDraft(p.id, 'name', product.name || '')
      setDraft(p.id, 'description', product.description || '')
      setDraft(p.id, 'price', product.price ?? 0)
      setDraft(p.id, 'logo', product.logo || '')
      setDraft(p.id, 'badge', product.badge || '')
      setEditingId(null)
      refresh()
      toast(`Perubahan "${product.name}" disimpan`, 'success')
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
      <p className="text-muted" style={{ fontSize: 14, marginTop: 8, maxWidth: 700 }}>
        Pilih produk Flash Sale tanpa mengubah kategori. Foto, nama, deskripsi, harga original & flash, badge, stok bisa diedit lewat ikon pensil.
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

      <div className="input-ic" style={{ marginTop: 20, marginBottom: 20, maxWidth: 480 }}>
        <span style={{ paddingLeft: 14 }}><Search size={16} color="var(--muted)" /></span>
        <input className="input" placeholder="Cari produk (nama / vendor / kategori)..." value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 8 }} />
        {q && <button onClick={() => setQ('')} style={{ paddingRight: 12, cursor: 'pointer', background: 'none', border: 'none' }}><X size={15} color="var(--muted)" /></button>}
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
            const d = drafts[p.id] || { flashPrice: p.flashPrice ?? p.price, stock: p.stock === -1 ? '' : p.stock, stockOut: !!p.stockOut, name: p.name, description: p.description || '', price: p.price, logo: p.logo || '', badge: p.badge || '' }
            const editing = editingId === p.id
            const multiTier = Array.isArray(p.tiers) && p.tiers.length > 1
            const badgeDef = BADGES.find((b) => b.value === (p.badge || ''))
            return (
              <div key={p.id} className="card prod-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                {editing ? (
                  <span className="logo-upload-preview" style={{ background: p.brand || 'var(--surface-2)', width: 46, height: 46 }}>
                    {d.logo ? <img src={d.logo} alt="" /> : <ImageIcon size={20} color="rgba(255,255,255,.85)" />}
                  </span>
                ) : (
                  <span className="prod-swatch" style={{ background: p.brand || 'var(--surface-2)', overflow: 'hidden' }}>
                    {p.logo && <img src={p.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="display" style={{ fontSize: 14.5 }}>{editing ? 'Edit produk' : p.name}</span>
                    {!p.active && <span className="chip" style={{ fontSize: 10, background: 'var(--surface-2)' }}>nonaktif</span>}
                    {on && <span className="chip chip-lime" style={{ fontSize: 10 }}><Zap size={10} fill="currentColor" /> flash sale</span>}
                    {!editing && badgeDef?.value && (
                      <span className="chip" style={{ fontSize: 10, background: badgeDef.color, borderColor: badgeDef.color, color: '#fff', fontWeight: 800 }}>{badgeDef.label}</span>
                    )}
                  </div>
                  {!editing ? (
                    <span className="text-muted" style={{ fontSize: 12.5, display: 'block' }}>
                      {p.vendor} · {p.category} · Normal <s>{formatIDR(p.price)}</s> · Harga FS {formatIDR(p.flashPrice ?? p.price)} · {p.stock === -1 ? 'stok ∞' : `stok ${p.stock}`}
                      {p.stockOut && ' · STOK HABIS'}
                    </span>
                  ) : (
                    <div className="fs-edit-form">
                      <div className="fs-edit-row">
                        <input ref={null} type="file" accept="image/*" hidden id={`fs-logo-${p.id}`} onChange={(e) => onPickLogo(p, e)} />
                        <button type="button" className="pill" style={{ padding: '7px 12px', fontSize: 12 }} disabled={uploadingId === p.id} onClick={() => document.getElementById(`fs-logo-${p.id}`)?.click()}>
                          <Upload size={14} /> {uploadingId === p.id ? 'Mengunggah…' : 'Ganti foto'}
                        </button>
                        {d.logo && <button type="button" className="btn-link" style={{ fontSize: 12 }} onClick={() => setDraft(p.id, 'logo', '')}>Hapus foto</button>}
                      </div>
                      <div className="fs-edit-grid">
                        <label className="fs-grow">
                          <span>Nama produk</span>
                          <input className="input" value={d.name} onChange={(e) => setDraft(p.id, 'name', e.target.value)} />
                        </label>
                        <label>
                          <span>Badge</span>
                          <select className="input" value={d.badge || ''} onChange={(e) => setDraft(p.id, 'badge', e.target.value)}>
                            {BADGES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="fs-grow">
                        <span>Deskripsi</span>
                        <textarea className="input" rows={2} value={d.description} onChange={(e) => setDraft(p.id, 'description', e.target.value)} style={{ resize: 'vertical' }} />
                      </label>
                      <div className="fs-edit-grid">
                        <label>
                          <span>Harga original — dicoret (Rp)</span>
                          <input className="input" type="number" min="1" value={d.price} onChange={(e) => setDraft(p.id, 'price', e.target.value)} />
                        </label>
                        <label>
                          <span>Harga Flash Sale (Rp){multiTier ? ` — tier utama (${p.tiers[0].label})` : ''}</span>
                          <input className="input" type="number" min="1" value={d.flashPrice} onChange={(e) => setDraft(p.id, 'flashPrice', e.target.value)} />
                          {multiTier && <small style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Tier lain ({p.tiers.slice(1).map((ti) => ti.label).join(', ')}) tetap memakai harga katalognya.</small>}
                        </label>
                        <label>
                          <span>Stok (-1 = ∞)</span>
                          <input className="input" type="number" min="-1" value={d.stock} onChange={(e) => setDraft(p.id, 'stock', e.target.value)} />
                        </label>
                        <label className="fs-out-check"><input type="checkbox" checked={d.stockOut} onChange={(e) => setDraft(p.id, 'stockOut', e.target.checked)} /><Ban size={15} /> Stok habis</label>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                  {editing ? (
                    <>
                      <button className="pill pill-indigo" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => saveSettings(p)} disabled={savingId === p.id || uploadingId === p.id}><Save size={14} /> {savingId === p.id ? '…' : 'Simpan'}</button>
                      <button className="icon-btn" onClick={() => setEditingId(null)} disabled={savingId === p.id} aria-label="Batal"><X size={16} /></button>
                    </>
                  ) : (
                    <button className="icon-btn" onClick={() => setEditingId(p.id)} aria-label={`Edit produk ${p.name}`}><Pencil size={16} /></button>
                  )}
                  <button onClick={() => toggle(p, !on)} disabled={savingId === p.id || !p.active} className={`fs-toggle ${on ? 'is-on' : ''}`} aria-label={on ? `Keluarkan ${p.name} dari flash sale` : `Masukkan ${p.name} ke flash sale`}>
                    <span className="fs-toggle-knob">{savingId === p.id ? '…' : on ? <Check size={12} strokeWidth={3} /> : ''}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-muted" style={{ fontSize: 12, marginTop: 18 }}>
        Harga original adalah harga yang dicoret di kartu (diambil juga sebagai harga official bila produk sama ada di katalog reguler). Badge <strong>Private/Sharing</strong> tampil di kartu Flash Sale.
      </p>

      <style>{`
        .fs-toggle { width: 52px; height: 30px; border-radius: 999px; cursor: pointer; background: var(--surface-2); border: 1.5px solid var(--line-soft); position: relative; transition: background .18s ease, border-color .18s ease; display: flex; align-items: center; padding: 0 3px; }
        .fs-toggle:disabled { opacity: .45; cursor: not-allowed; }
        .fs-toggle.is-on { background: var(--lime); border-color: var(--ink); justify-content: flex-end; }
        .fs-toggle-knob { width: 22px; height: 22px; border-radius: 999px; background: #fff; border: 1.5px solid var(--line-soft); display: grid; place-items: center; font-size: 11px; color: var(--ink); transition: all .18s ease; }
        .fs-toggle.is-on .fs-toggle-knob { border-color: var(--ink); color: var(--ink); }
        .fs-edit-form { display: flex; flex-direction: column; gap: 9px; margin-top: 10px; }
        .fs-edit-form > label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; color: var(--muted); }
        .fs-edit-row { display: flex; align-items: center; gap: 10px; }
        .fs-edit-grid { display: flex; gap: 9px; flex-wrap: wrap; align-items: flex-end; }
        .fs-edit-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; color: var(--muted); }
        .fs-edit-grid .input, .fs-edit-form .input { width: 160px; padding: 8px 10px; font-size: 13px; }
        .fs-edit-form textarea.input, .fs-grow .input { width: 100%; }
        .fs-grow { flex: 1 1 240px; }
        .fs-out-check { flex-direction: row !important; align-items: center; height: 38px; color: var(--danger, #dc2626) !important; cursor: pointer; }
        .fs-out-check input { accent-color: #dc2626; }
        @media (max-width: 620px) { .fs-edit-grid .input { width: 130px; } }
      `}</style>
    </div>
  )
}
