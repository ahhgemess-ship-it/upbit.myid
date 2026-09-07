import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Check, Upload, Image as ImageIcon, Zap, Ban } from 'lucide-react'
import { formatIDR, applyDiscount } from '../data/products.js'
import { USD_TO_IDR } from '../i18n/pricing.js'
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
  flashSale: false, stockOut: false, flashPrice: null, flashPriceIntl: null,
  tiers: [newTier()], features: [''],
}

// Produk termasuk flash sale? (sama dengan aturan katalog di data/products.js)
const isFlash = (p) => p.flashSale === true || (p.flashSale == null && p.category === 'Promo')

// Badge durasi ringkas untuk panel admin (Indonesia): "3 Bulan" → "3bln".
const durId = (label) => {
  const m = String(label || '').match(/(\d+(?:[.,]\d+)?)\s*(bulan|tahun|bln|thn)/i)
  return m ? m[1] + (/^(tahun|thn)$/i.test(m[2]) ? 'thn' : 'bln') : null
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
  const [filter, setFilter] = useState('semua') // 'semua' | 'flash' | 'reguler'

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

  // Flash sale dulu di daftar supaya gampang dibedakan, lalu urut nama.
  const sorted = [...(rows || [])].sort((a, b) => (isFlash(b) ? 1 : 0) - (isFlash(a) ? 1 : 0) || a.name.localeCompare(b.name))
  const shown = sorted.filter((p) => filter === 'semua' || (filter === 'flash' ? isFlash(p) : !isFlash(p)))
  const nFlash = (rows || []).filter(isFlash).length
  const nReg = (rows || []).length - nFlash

  return (
    <div className="container section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 className="display h-lg">KELOLA PRODUK</h1>
        <button className="pill pill-indigo" style={{ padding: '9px 16px', fontSize: 13.5 }} onClick={() => setEditing('new')}>
          <Plus size={16} /> Tambah Produk
        </button>
      </div>
      <p className="text-muted" style={{ fontSize: 14, marginTop: 8, maxWidth: 600 }}>
        Harga, stok, stok habis, terjual, diskon & jenis/durasi produk. Perubahan langsung tampil di storefront.
      </p>

      {/* Filter: pisahkan flash sale vs reguler biar tidak membingungkan */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
        {[
          ['semua', `Semua (${(rows || []).length})`],
          ['flash', `⚡ Flash Sale (${nFlash})`],
          ['reguler', `Reguler (${nReg})`],
        ].map(([k, label]) => (
          <button
            key={k}
            className="chip"
            style={{ cursor: 'pointer', background: filter === k ? 'var(--ink)' : 'var(--surface-2)', color: filter === k ? '#fff' : 'var(--ink)' }}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="text-muted" style={{ marginTop: 28 }}>Memuat…</p>
      ) : (
        <div className="disc-table" style={{ marginTop: 22 }}>
          {shown.map((p) => {
            const flash = isFlash(p)
            const cur = flash ? (p.flashPrice ?? p.price) : applyDiscount(p.price, p.discountPercent)
            const orig = flash
              ? (p.price > (p.flashPrice ?? Infinity) ? p.price : null)
              : (p.discountPercent > 0 ? p.price : null)
            const durs = (p.tiers || []).map((x) => durId(x.label)).filter(Boolean).join(' / ')
            return (
              <div key={p.id} className="card prod-row" style={flash ? { border: '1.5px solid var(--lime-deep)' } : undefined}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <span className="prod-swatch" style={{ background: p.brand || 'var(--surface-2)' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="display" style={{ fontSize: 15 }}>{p.name}</span>
                      {flash && (
                        <span className="chip" style={{ background: 'var(--lime)', borderColor: 'var(--ink)', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Zap size={10} fill="currentColor" /> FLASH SALE
                        </span>
                      )}
                      {p.stockOut && (
                        <span className="chip" style={{ background: '#fee2e2', borderColor: '#dc2626', color: '#b91c1c', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Ban size={10} /> STOK HABIS
                        </span>
                      )}
                      {!p.active && <span className="chip" style={{ fontSize: 10, background: 'var(--surface-2)' }}>nonaktif</span>}
                      {!flash && p.discountPercent > 0 && <span className="disc-badge">-{p.discountPercent}%</span>}
                    </div>
                    <span className="text-muted" style={{ fontSize: 12.5 }}>
                      {p.vendor} · {p.category}
                      {durs ? ` · ${durs}` : ''}
                      {' · '}{flash ? 'flash ' : ''}{formatIDR(cur)}
                      {orig ? <> · normal <s>{formatIDR(orig)}</s></> : null}
                      {' · '}{p.stock === -1 ? 'stok ∞' : p.stockOut ? 'stok habis' : `stok ${p.stock}`}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="icon-btn" onClick={() => setEditing(p)} aria-label="Edit"><Pencil size={16} /></button>
                  <button className="icon-btn danger" onClick={() => del(p)} aria-label="Hapus"><Trash2 size={16} /></button>
                </div>
              </div>
            )
          })}
          {shown.length === 0 && <p className="text-muted" style={{ padding: '20px 4px' }}>Tidak ada produk di filter ini.</p>}
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
    flashSale: !!p.flashSale, stockOut: !!p.stockOut,
    flashPrice: p.flashPrice ?? null, flashPriceIntl: p.flashPriceIntl ?? null, // Rp & sen — internal
    tiers: p.tiers?.length
      ? p.tiers.map((t) => ({ _uid: uid(), label: t.label, price: t.price, priceIntl: fromCents(t.priceIntl), note: t.note || '' }))
      : [{ _uid: uid(), label: p.period || 'Produk', price: p.price || 0, priceIntl: fromCents(p.priceIntl), note: '' }],
    features: p.features?.length ? p.features : [''],
  }
}

function ProductForm({ initial, isNew, onClose, onSaved, toast }) {
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const logoRef = useRef(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))

  // "Harga saat ini" sebagai input langsung:
  //  - flash sale → menulis flashPrice (harga flash tier utama)
  //  - reguler → dipecah jadi persen diskon (harga normal = dicoret)
  const [nowInput, setNowInput] = useState(() =>
    initial.flashSale
      ? String(initial.flashPrice ?? initial.price ?? '')
      : String(applyDiscount(initial.price || 0, initial.discountPercent || 0))
  )

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
  // USD mengikuti harga Rp (aturan toko): ganti harga Rp → harga internasional ikut kurs pasar.
  const usdOf = (idr) => ((Math.max(1, Math.round((parseFloat(idr) || 0) * 100 / USD_TO_IDR)) / 100)).toFixed(2)
  const setRpPrice = (v) => setF((s) => ({ ...s, price: v, priceIntl: usdOf(v) }))
  const setTierRpPrice = (i, v) => setTier(i, 'price', v) || setTier(i, 'priceIntl', usdOf(v))
  const addTier = () => setF((s) => ({ ...s, tiers: [...s.tiers, newTier()] }))
  const rmTier = (i) => setF((s) => ({ ...s, tiers: s.tiers.filter((_, j) => j !== i) }))
  const toCents = (usd) => Math.round((parseFloat(usd) || 0) * 100) // form pakai dolar, DB simpan sen

  const setPriceNow = (v) => {
    setNowInput(v)
    const n = parseInt(v, 10) || 0
    if (f.flashSale) {
      setF((s) => ({ ...s, flashPrice: n > 0 ? n : null, flashPriceIntl: n > 0 ? Math.round(n * 100 / USD_TO_IDR) : null }))
    } else {
      const base = parseInt(f.price, 10) || 0
      const pct = base > 0 && n > 0 && n < base ? Math.max(0, Math.min(90, Math.round((1 - n / base) * 100))) : 0
      setF((s) => ({ ...s, discountPercent: pct }))
    }
  }

  const onToggleFlash = (on) => {
    setF((s) => ({ ...s, flashSale: on, ...(on ? {} : { flashPrice: null, flashPriceIntl: null }) }))
    if (!on) setNowInput(String(applyDiscount(parseInt(f.price, 10) || 0, f.discountPercent || 0)))
  }

  // Pratinjau live supaya admin tahu persis apa yang tampil di kartu.
  const base = parseInt(f.price, 10) || 0
  const now = parseInt(nowInput, 10) || 0
  const hint = f.flashSale
    ? (base > 0 && now > 0 && now < base
        ? <>Tampil di kartu: normal <b>{formatIDR(base)}</b> dicoret → <b>-{Math.round((1 - now / base) * 100)}%</b>, harga bayar <b>{formatIDR(now)}</b>. Harga flash berlaku untuk tier utama; tier lain tetap harga katalog.</>
        : 'Harga normal akan dicoret otomatis oleh sistem flash sale (±3–4× harga flash) bila tidak diisi lebih tinggi.')
    : (f.discountPercent > 0
        ? <>Tampil di kartu: normal <b>{formatIDR(base)}</b> dicoret → harga saat ini <b>{formatIDR(applyDiscount(base, f.discountPercent))}</b> (diskon {f.discountPercent}%).</>
        : 'Tanpa diskon — harga normal = harga saat ini, tidak ada coretan.')

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
      active: !!f.active,
      discountPercent: Math.max(0, Math.min(90, parseInt(f.discountPercent, 10) || 0)),
      discountStart: f.discountStart ? new Date(f.discountStart).toISOString() : null,
      discountEnd: f.discountEnd ? new Date(f.discountEnd).toISOString() : null,
      flashSale: !!f.flashSale,
      stockOut: !!f.stockOut,
      flashPrice: f.flashSale ? (parseInt(nowInput, 10) || null) : null,
      flashPriceIntl: f.flashSale ? (parseInt(f.flashPriceIntl, 10) || null) : null,
      tiers, features,
    }
    setBusy(true)
    try {
      if (isNew) { await api.adminCreateProduct({ ...payload }); toast('Produk dibuat', 'success') }
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
          <div className="form-section-title" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>Identitas</div>
          <div className="form-grid">
            <Field label="Nama"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Vendor"><input className="input" value={f.vendor} onChange={(e) => set('vendor', e.target.value)} /></Field>
            <Field label="Kategori"><input className="input" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="AI Assistant / API / Developer…" /></Field>
            <Field label="Periode (satuan harga)"><input className="input" value={f.period} onChange={(e) => set('period', e.target.value)} placeholder="bln / 12 bln / paket" /></Field>
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

          <div className="form-section-title">Jenis produk / durasi (tier)</div>
          {f.tiers.map((t, i) => (
            <div key={t._uid || i} className="tier-edit-row">
              <input className="input" placeholder="Label (mis. 1 Bulan / 3 Bulan / 1 Tahun)" value={t.label} onChange={(e) => setTier(i, 'label', e.target.value)} />
              <input className="input" type="number" placeholder="Harga (Rp)" value={t.price} onChange={(e) => setTierRpPrice(i, e.target.value)} style={{ maxWidth: 150 }} title="Harga tier (Rp) — USD otomatis mengikuti" />
              <button className="icon-btn danger" onClick={() => rmTier(i)} disabled={f.tiers.length === 1}><Trash2 size={15} /></button>
            </div>
          ))}
          <button className="btn-link" style={{ marginTop: 4 }} onClick={addTier}><Plus size={15} /> Tambah tier</button>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Tier = varian/jenis produk (1bln, 3bln, 1thn…), jadi badge durasi di katalog. USD otomatis mengikuti harga Rp.
          </p>

          <div className="form-section-title">Harga & diskon</div>
          <label className="check-row" style={{ paddingTop: 0 }}>
            <input type="checkbox" checked={f.flashSale} onChange={(e) => onToggleFlash(e.target.checked)} />
            <Zap size={14} /> Produk Flash Sale — "harga saat ini" jadi harga flash
          </label>
          <div className="form-grid">
            <Field label="Harga normal — dicoret (Rp)"><input className="input" type="number" value={f.price} onChange={(e) => setRpPrice(e.target.value)} /></Field>
            <Field label={f.flashSale ? 'Harga saat ini — flash (Rp)' : 'Harga saat ini (Rp)'}>
              <input className="input" type="number" value={nowInput} onChange={(e) => setPriceNow(e.target.value)} />
            </Field>
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: -4 }}>{hint}</p>

          <div className="form-section-title">Stok & penjualan</div>
          <div className="form-grid">
            <Field label="Stok (kosong = ∞)"><input className="input" type="number" value={f.stock} onChange={(e) => set('stock', e.target.value)} /></Field>
            <Field label="Terjual"><input className="input" type="number" value={f.sold} onChange={(e) => set('sold', e.target.value)} /></Field>
          </div>
          <label className="check-row"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Aktif (tampil di toko)</label>
          <label className="check-row" style={{ paddingTop: 0 }}>
            <input type="checkbox" checked={f.stockOut} onChange={(e) => set('stockOut', e.target.checked)} />
            <Ban size={14} /> Stok habis (tutup pembelian sementara)
          </label>

          {/* Konten opsional — disembunyikan agar form tetap fokus */}
          <details style={{ marginTop: 14, borderTop: '1.5px solid var(--line-soft)', paddingTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
              Konten opsional — tagline, deskripsi, fitur, rating, estimasi, warna
            </summary>
            <div style={{ marginTop: 12 }}>
              <Field label="Tagline"><input className="input" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
              <Field label="Deskripsi"><textarea className="input" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} style={{ resize: 'vertical' }} /></Field>
              <div className="form-grid">
                <Field label="Rating"><input className="input" type="number" step="0.1" value={f.rating} onChange={(e) => set('rating', e.target.value)} /></Field>
                <Field label="Estimasi proses"><input className="input" value={f.estimate} onChange={(e) => set('estimate', e.target.value)} placeholder="10–20 menit" /></Field>
                <Field label="Brand warna"><input className="input" value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="#4f46e5" /></Field>
              </div>
              <div className="form-section-title">Fitur (satu per baris)</div>
              <textarea className="input" rows={4} value={f.features.join('\n')} onChange={(e) => set('features', e.target.value.split('\n'))} style={{ resize: 'vertical', width: '100%' }} />
            </div>
          </details>
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
