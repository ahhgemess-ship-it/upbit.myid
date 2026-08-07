import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Tag, ArrowLeft, Plus, Trash2, Power, Sparkles, Copy, Check } from 'lucide-react'
import { formatIDR } from '../data/products.js'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import AdminGate from '../components/AdminGate.jsx'

export default function AdminCoupons() {
  const { isAdmin, ready } = useAuth()
  const { toast } = useToast()
  const [rows, setRows] = useState(null)
  const [copied, setCopied] = useState('')
  const [form, setForm] = useState({ code: '', type: 'percent', value: 10, minSpend: 0, usageLimit: 0, expiresAt: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))

  const load = () => api.adminCoupons().then((d) => setRows(d.coupons)).catch(() => setRows([]))
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  if (!ready) return null
  if (!isAdmin) return <AdminGate />

  const create = async () => {
    if (!form.value || form.value < 1) { toast('Nilai diskon harus > 0', 'error'); return }
    setBusy(true)
    try {
      const { coupon } = await api.adminCreateCoupon({
        code: form.code.trim() || undefined, type: form.type, value: parseInt(form.value, 10),
        minSpend: parseInt(form.minSpend, 10) || 0, usageLimit: parseInt(form.usageLimit, 10) || 0,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      })
      toast(`Kupon ${coupon.code} dibuat`, 'success')
      setForm({ code: '', type: 'percent', value: 10, minSpend: 0, usageLimit: 0, expiresAt: '' })
      load()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  const toggle = async (c) => {
    try { await api.adminUpdateCoupon(c.code, { active: !c.active }); load() }
    catch (e) { toast(e.message, 'error') }
  }
  const del = async (c) => {
    if (!confirm(`Hapus kupon ${c.code}?`)) return
    try { await api.adminDeleteCoupon(c.code); toast('Kupon dihapus', 'success'); load() }
    catch (e) { toast(e.message, 'error') }
  }
  const copy = async (code) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(''), 1500) } catch { /* */ }
  }

  return (
    <div className="container section">
      <Link to="/admin/products" className="btn-link" style={{ marginBottom: 20, border: 'none', display: 'inline-flex' }}>
        <ArrowLeft size={18} /> Kelola produk
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Tag size={26} color="var(--indigo)" />
        <span className="eyebrow">Panel Admin</span>
      </div>
      <h1 className="display h-lg">KELOLA KUPON</h1>
      <p className="text-muted" style={{ fontSize: 14, marginTop: 8, maxWidth: 600 }}>
        Buat kupon sendiri atau generate kode otomatis. Atur batas pemakaian, minimal belanja & kedaluwarsa.
      </p>

      {/* Form buat kupon */}
      <div className="card" style={{ padding: 20, marginTop: 24 }}>
        <div className="form-section-title" style={{ marginTop: 0 }}>Buat kupon baru</div>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Kode (kosong = generate)</span>
            <input className="input" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="UPBIT10" />
          </label>
          <label className="field">
            <span className="field-label">Tipe</span>
            <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="percent">Persen (%)</option>
              <option value="fixed">Potongan tetap (Rp)</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">{form.type === 'percent' ? 'Nilai (%)' : 'Nilai (Rp)'}</span>
            <input className="input" type="number" value={form.value} onChange={(e) => set('value', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Min. belanja (Rp)</span>
            <input className="input" type="number" value={form.minSpend} onChange={(e) => set('minSpend', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Batas pakai (0 = ∞)</span>
            <input className="input" type="number" value={form.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Kedaluwarsa (opsional)</span>
            <input className="input" type="datetime-local" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="pill pill-indigo" onClick={create} disabled={busy} style={{ padding: '10px 18px' }}>
            <Plus size={16} /> {busy ? 'Membuat…' : 'Buat Kupon'}
          </button>
          <button className="pill" onClick={() => { set('code', ''); create() }} disabled={busy} style={{ padding: '10px 18px' }}>
            <Sparkles size={16} /> Generate Otomatis
          </button>
        </div>
      </div>

      {/* Daftar kupon */}
      <div className="disc-table" style={{ marginTop: 22 }}>
        {rows === null ? (
          <p className="text-muted">Memuat…</p>
        ) : rows.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p className="display" style={{ fontSize: 16 }}>BELUM ADA KUPON</p>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 6 }}>Buat kupon pertamamu di atas.</p>
          </div>
        ) : (
          rows.map((c) => (
            <div key={c.code} className="card prod-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                <button className="coupon-code" onClick={() => copy(c.code)} title="Salin kode">
                  {c.code} {copied === c.code ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="display" style={{ fontSize: 14 }}>
                      {c.type === 'percent' ? `${c.value}%` : formatIDR(c.value)}
                    </span>
                    {!c.active && <span className="chip" style={{ fontSize: 10, background: 'var(--surface-2)' }}>nonaktif</span>}
                  </div>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {c.minSpend > 0 && `min ${formatIDR(c.minSpend)} · `}
                    dipakai {c.usedCount}{c.usageLimit > 0 ? `/${c.usageLimit}` : ''}
                    {c.expiresAt && ` · s/d ${new Date(c.expiresAt).toLocaleDateString('id-ID')}`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`icon-btn ${c.active ? '' : 'danger'}`} onClick={() => toggle(c)} aria-label="Aktif/nonaktif" title={c.active ? 'Nonaktifkan' : 'Aktifkan'}><Power size={16} /></button>
                <button className="icon-btn danger" onClick={() => del(c)} aria-label="Hapus"><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
