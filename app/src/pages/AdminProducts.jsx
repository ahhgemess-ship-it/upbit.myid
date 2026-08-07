import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Package, ArrowLeft, Plus, Pencil, Trash2, X, Check, Tag, Upload, Image as ImageIcon } from 'lucide-react'
import { formatIDR, applyDiscount } from '../data/products.js'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import AdminGate from '../components/AdminGate.jsx'

let _tuid = 0
const uid = () => `t${++_tuid}`
const newTier = () => ({ _uid: uid(), label: '', price: 0, priceIntl: 0, note: '' })

const empty = {
  id: '', name: '', vendor: '', category: '', tagline: '', description: '',
  logo: '', brand: '#4f46e5', period: 'bln', price: 0, priceIntl: 0, estimate: '', rating: 5, sold: 0,
  stock: -1, active: true, discountPercent: 0, discountStart: '', discountEnd: '',
  tiers: [newTier()], features: [''],
}

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export default function AdminProducts() {
  const { isAdmin, ready } = useAuth()
  const { toast } = useToast()
  const { refresh } = useCatalog()
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | product

  const load = () => api.adminProducts().then((d) => setRows(d.products)).catch(() => setRows([]))
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  if (!ready) return null
  if (!isAdmin) return <AdminGate />

  const onSaved = async () => { setEditing(null); await load(); refresh() }

  const del = async (p) => {
    if (!confirm(`Hapus produk "${p.name}"? Tindakan ini permanen.`)) return
    try { await api.adminDeleteProduct(p.id); toast('Produk dihapus', 'success'); load(); refresh() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="container section">
      <Link to="/admin" className="btn-link" style={{ marginBottom: 20, border: 'none', display: 'inline-flex' }}>
        <ArrowLeft size={18} /> Kembali ke pesanan
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Package size={26} color="var(--indigo)" />
          <span className="eyebrow">Panel Admin</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/admin/coupons" className="pill" style={{ padding: '9px 16px', fontSize: 13.5 }}><Tag size={16} /> Kupon</Link>
          <button className="pill pill-indigo" style={{ padding: '9px 16px', fontSize: 13.5 }} onClick={() => setEditing('new')}>
            <Plus size={16} /> Tambah Produk
          </button>
        </div>
      </div>
      <h1 className="display h-lg">KELOLA PRODUK</h1>
      <p className="text-muted" style={{ fontSize: 14, marginTop: 8, maxWidth: 600 }}>
        Tambah/ubah/hapus produk, atur stok, harga, diskon & jadwalnya. Perubahan langsung tampil di storefront.
      </p>

      {rows === null ? (
        <p className="text-muted" style={{ marginTop: 28 }}>Memuat…</p>
      ) : (
        <div className="disc-table" style={{ marginTop: 26 }}>
          {rows.map((p) => (
            <div key={p.id} className="card prod-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <span className="prod-swatch" style={{ background: p.brand || 'var(--surface-2)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="display" style={{ fontSize: 15 }}>{p.name}</span>
                    {!p.active && <span className="chip" style={{ fontSize: 10, background: 'var(--surface-2)' }}>nonaktif</span>}
                    {p.discountPercent > 0 && <span className="disc-badge">-{p.discountPercent}%</span>}
                  </div>
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    {p.vendor} · {p.category} · {formatIDR(applyDiscount(p.price, p.discountPercent))}
                    {' / '}${(applyDiscount(p.priceIntl || 0, p.discountPercent) / 100).toFixed(2)}
                    {' · '}{p.stock === -1 ? 'stok ∞' : `stok ${p.stock}`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="icon-btn" onClick={() => setEditing(p)} aria-label="Edit"><Pencil size={16} /></button>
                <button className="icon-btn danger" onClick={() => del(p)} aria-label="Hapus"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProductForm
          initial={editing === 'new' ? empty : normalize(editing)}
          isNew={editing === 'new'}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          toast={toast}
        />
      )}
    </div>
  )
}

function normalize(p) {
  const fromCents = (c) => (c ? (c / 100) : 0) // DB sen → dolar untuk form
  return {
    ...empty, ...p,
    tagline: p.tagline || '', description: p.description || '', logo: p.logo || '', brand: p.brand || '#4f46e5',
    period: p.period || 'bln', estimate: p.estimate || '',
    priceIntl: fromCents(p.priceIntl),
    discountPercent: p.discountRaw ?? p.discountPercent ?? 0,
    discountStart: toLocalInput(p.discountStart), discountEnd: toLocalInput(p.discountEnd),
    tiers: p.tiers?.length ? p.tiers.map((t) => ({ _uid: uid(), label: t.label, price: t.price, priceIntl: fromCents(t.priceIntl), note: t.note || '' })) : [newTier()],
    features: p.features?.length ? p.features : [''],
  }
}

function ProductForm({ initial, isNew, onClose, onSaved, toast }) {
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const logoRef = useRef(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  const onPickLogo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Pilih file gambar (PNG/JPG)', 'error'); return }
    if (file.size > 3 * 1024 * 1024) { toast('Ukuran gambar maks 3MB', 'error'); return }
    setUploading(true)
    try {
      const { url } = await api.adminUploadProductImage(file)
      set('logo', url)
      toast('Gambar produk terunggah', 'success')
    } catch (err) {
      toast(err.message || 'Gagal mengunggah gambar', 'error')
    } finally {
      setUploading(false)
      if (logoRef.current) logoRef.current.value = ''
    }
  }

  const setTier = (i, k, v) => setF((s) => ({ ...s, tiers: s.tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }))
  const addTier = () => setF((s) => ({ ...s, tiers: [...s.tiers, newTier()] }))
  const rmTier = (i) => setF((s) => ({ ...s, tiers: s.tiers.filter((_, j) => j !== i) }))
  const toCents = (usd) => Math.round((parseFloat(usd) || 0) * 100) // form pakai dolar, DB simpan sen

  const save = async () => {
    const tiers = f.tiers.filter((t) => t.label.trim()).map((t) => ({ label: t.label.trim(), price: parseInt(t.price, 10) || 0, priceIntl: toCents(t.priceIntl), ...(t.note?.trim() ? { note: t.note.trim() } : {}) }))
    const features = f.features.map((x) => x.trim()).filter(Boolean)
    if (!f.name.trim() || !f.vendor.trim() || !f.category.trim()) { toast('Nama, vendor, kategori wajib', 'error'); return }
    if (!tiers.length) { toast('Minimal 1 tier harga', 'error'); return }
    const payload = {
      name: f.name.trim(), vendor: f.vendor.trim(), category: f.category.trim(),
      tagline: f.tagline.trim(), description: f.description.trim(),
      logo: f.logo.trim() || null, brand: f.brand.trim() || null, period: f.period.trim() || null,
      price: parseInt(f.price, 10) || tiers[0].price,
      priceIntl: toCents(f.priceIntl) || tiers[0].priceIntl,
      estimate: f.estimate.trim() || null,
      rating: Number(f.rating) || 0, sold: parseInt(f.sold, 10) || 0,
      stock: f.stock === '' ? -1 : parseInt(f.stock, 10),
      active: !!f.active, discountPercent: Math.max(0, Math.min(90, parseInt(f.discountPercent, 10) || 0)),
      discountStart: f.discountStart ? new Date(f.discountStart).toISOString() : null,
      discountEnd: f.discountEnd ? new Date(f.discountEnd).toISOString() : null,
      tiers, features,
    }
    setBusy(true)
    try {
      if (isNew) { await api.adminCreateProduct({ id: f.id.trim() || undefined, ...payload }); toast('Produk dibuat', 'success') }
      else { await api.adminUpdateProduct(initial.id, payload); toast('Produk diperbarui', 'success') }
      onSaved()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="display" style={{ fontSize: 18 }}>{isNew ? 'TAMBAH PRODUK' : 'EDIT PRODUK'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Nama"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Vendor"><input className="input" value={f.vendor} onChange={(e) => set('vendor', e.target.value)} /></Field>
            <Field label="Kategori"><input className="input" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="AI Assistant / API / Developer…" /></Field>
            <Field label="Periode"><input className="input" value={f.period} onChange={(e) => set('period', e.target.value)} placeholder="bln / 12 bln / paket" /></Field>
            {isNew && <Field label="ID (opsional)"><input className="input" value={f.id} onChange={(e) => set('id', e.target.value)} placeholder="otomatis dari nama" /></Field>}
            <Field label="Brand warna"><input className="input" value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="#4f46e5" /></Field>
            <Field label="Estimasi"><input className="input" value={f.estimate} onChange={(e) => set('estimate', e.target.value)} placeholder="10–20 menit" /></Field>
          </div>

          {/* Gambar produk — via upload, bukan URL */}
          <div className="field">
            <span className="field-label">Gambar / logo produk</span>
            <div className="logo-upload">
              <span className="logo-upload-preview" style={{ background: f.brand || 'var(--surface-2)' }}>
                {f.logo ? <img src={f.logo} alt="" /> : <ImageIcon size={22} color="rgba(255,255,255,.85)" />}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                <input ref={logoRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
                <button type="button" className="pill" style={{ padding: '8px 16px', fontSize: 13 }} disabled={uploading} onClick={() => logoRef.current?.click()}>
                  <Upload size={15} /> {uploading ? 'Mengunggah…' : (f.logo ? 'Ganti gambar' : 'Unggah gambar')}
                </button>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {f.logo && <button type="button" className="btn-link" style={{ fontSize: 12, borderColor: 'var(--muted)', color: 'var(--muted)' }} onClick={() => set('logo', '')}>Hapus</button>}
                  <span className="text-muted" style={{ fontSize: 11 }}>PNG/JPG, maks 3MB</span>
                </div>
              </div>
            </div>
          </div>
          <Field label="Tagline"><input className="input" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
          <Field label="Deskripsi"><textarea className="input" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} style={{ resize: 'vertical' }} /></Field>

          <div className="form-grid">
            <Field label="Harga lokal — Indonesia (Rp)"><input className="input" type="number" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
            <Field label="Harga internasional (USD $)"><input className="input" type="number" step="0.01" value={f.priceIntl} onChange={(e) => set('priceIntl', e.target.value)} placeholder="cth. 19.99" /></Field>
            <Field label="Stok (−1 = ∞)"><input className="input" type="number" value={f.stock} onChange={(e) => set('stock', e.target.value)} /></Field>
            <Field label="Rating"><input className="input" type="number" step="0.1" value={f.rating} onChange={(e) => set('rating', e.target.value)} /></Field>
            <Field label="Terjual"><input className="input" type="number" value={f.sold} onChange={(e) => set('sold', e.target.value)} /></Field>
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: -4 }}>
            Harga lokal (Rupiah) tampil saat bahasa Indonesia; harga internasional (USD) tampil saat user memilih bahasa lain.
          </p>

          {/* Diskon + jadwal */}
          <div className="form-section-title">Diskon & jadwal</div>
          <div className="form-grid">
            <Field label="Diskon (%)"><input className="input" type="number" min="0" max="90" value={f.discountPercent} onChange={(e) => set('discountPercent', e.target.value)} /></Field>
            <Field label="Mulai (opsional)"><input className="input" type="datetime-local" value={f.discountStart} onChange={(e) => set('discountStart', e.target.value)} /></Field>
            <Field label="Berakhir (opsional)"><input className="input" type="datetime-local" value={f.discountEnd} onChange={(e) => set('discountEnd', e.target.value)} /></Field>
            <Field label="Status">
              <label className="check-row"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Aktif (tampil di toko)</label>
            </Field>
          </div>

          {/* Tiers */}
          <div className="form-section-title">Tier harga</div>
          {f.tiers.map((t, i) => (
            <div key={t._uid || i} className="tier-edit-row">
              <input className="input" placeholder="Label (mis. 1 Bulan)" value={t.label} onChange={(e) => setTier(i, 'label', e.target.value)} />
              <input className="input" type="number" placeholder="Rp" value={t.price} onChange={(e) => setTier(i, 'price', e.target.value)} style={{ maxWidth: 120 }} title="Harga lokal (Rp)" />
              <input className="input" type="number" step="0.01" placeholder="$ USD" value={t.priceIntl} onChange={(e) => setTier(i, 'priceIntl', e.target.value)} style={{ maxWidth: 110 }} title="Harga internasional (USD)" />
              <input className="input" placeholder="Catatan" value={t.note} onChange={(e) => setTier(i, 'note', e.target.value)} />
              <button className="icon-btn danger" onClick={() => rmTier(i)} disabled={f.tiers.length === 1}><Trash2 size={15} /></button>
            </div>
          ))}
          <button className="btn-link" style={{ marginTop: 4 }} onClick={addTier}><Plus size={15} /> Tambah tier</button>

          {/* Features */}
          <div className="form-section-title">Fitur (satu per baris)</div>
          <textarea className="input" rows={4} value={f.features.join('\n')} onChange={(e) => set('features', e.target.value.split('\n'))} style={{ resize: 'vertical', width: '100%' }} />
        </div>
        <div className="modal-foot">
          <button className="btn-link" onClick={onClose}>Batal</button>
          <button className="pill pill-indigo" onClick={save} disabled={busy}><Check size={16} /> {busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
