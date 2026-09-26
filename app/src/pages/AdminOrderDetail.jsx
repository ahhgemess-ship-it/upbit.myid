import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, ExternalLink, UserCog,
  KeyRound, AtSign, Lock, Save, Send, FileImage, RotateCcw,
  Printer, Pencil, Trash2,
} from 'lucide-react'
import ReceiptModal from '../components/ReceiptModal.jsx'
import BrandLogo from '../components/BrandLogo.jsx'
import AdminGate from '../components/AdminGate.jsx'
import { formatIDR } from '../data/products.js'
import { formatPrice } from '../i18n/pricing.js'
import { CRYPTO } from '../data/payment.js'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const STATUS = {
  PROCESSING: { label: 'Diproses', cls: 'st-proc' },
  COMPLETED: { label: 'Selesai', cls: 'st-done' },
  CANCELLED: { label: 'Dibatalkan', cls: 'st-pending' },
}

export default function AdminOrderDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { isAdmin, ready } = useAuth()
  const { t, lang } = useLang()
  const { toast } = useToast()
  const [order, setOrder] = useState(null)
  const [state, setState] = useState('loading')
  const [creds, setCreds] = useState({}) // itemId → { kind,email,password,apiKey,note }
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [proofUrl, setProofUrl] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ buyerName: '', buyerEmail: '', deliveryEmail: '', adminNote: '', status: 'PROCESSING', paymentMethod: 'qris', paymentAsset: '', paymentTxHash: '', paidAt: '' })
  const [showDelete, setShowDelete] = useState(false)

  // Format DateTime → nilai untuk <input type=datetime-local> (waktu lokal)
  const toLocalInput = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  const load = () => {
    api.adminOrder(id)
      .then((d) => {
        setOrder(d.order); setState('ok'); setNote(d.order.adminNote || '')
        const init = {}
        d.order.items.forEach((it) => {
          const isApi = it.productId.startsWith('api-')
          init[it.id] = it.credential
            ? { kind: it.credential.kind, email: it.credential.email || '', password: it.credential.password || '', apiKey: it.credential.apiKey || '', note: it.credential.note || '' }
            : { kind: isApi ? 'apikey' : 'account', email: '', password: '', apiKey: '', note: '' }
        })
        setCreds(init)
      })
      .catch(() => setState('missing'))
  }
  useEffect(() => { if (isAdmin) load() }, [id, isAdmin]) // eslint-disable-line

  // Bukti transaksi diambil terotentikasi (admin) sebagai blob, bukan dari URL publik.
  useEffect(() => {
    if (!order?.payment?.proofName) return
    let url
    api.adminProofBlob(order.id).then((blob) => { url = URL.createObjectURL(blob); setProofUrl(url) }).catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [order?.id, order?.payment?.proofName]) // eslint-disable-line

  if (!ready) return null
  if (!isAdmin) return <AdminGate />
  if (state === 'loading') return <div className="container section"><p className="text-muted">Memuat…</p></div>
  if (state === 'missing' || !order) return <div className="container section"><p className="text-muted">Pesanan tidak ditemukan.</p></div>

  const st = STATUS[order.status] || STATUS.PROCESSING
  const setCred = (itemId, patch) => setCreds((c) => ({ ...c, [itemId]: { ...c[itemId], ...patch } }))

  const buildItemsPayload = () => order.items.map((it) => {
    const c = creds[it.id] || {}
    return { id: it.id, kind: c.kind, email: c.email, password: c.password, apiKey: c.apiKey, note: c.note }
  })

  const deliver = async (complete) => {
    setBusy(true)
    try {
      const { order: updated } = await api.adminDeliver(order.id, buildItemsPayload(), complete)
      setOrder(updated)
      toast(complete ? 'Pesanan diselesaikan & kredensial dikirim' : 'Kredensial disimpan', 'success')
    } catch (e) { toast(e.message || 'Gagal', 'error') } finally { setBusy(false) }
  }

  const updateStatus = async (status) => {
    setBusy(true)
    try {
      const { order: updated } = await api.adminUpdate(order.id, { status, adminNote: note })
      setOrder(updated)
      toast(`Status diubah → ${STATUS[status]?.label || status}`, 'success')
    } catch (e) { toast(e.message || 'Gagal', 'error') } finally { setBusy(false) }
  }

  const saveNote = async () => {
    setBusy(true)
    try {
      const { order: updated } = await api.adminUpdate(order.id, { adminNote: note })
      setOrder(updated); toast('Catatan disimpan', 'success')
    } catch (e) { toast(e.message || 'Gagal', 'error') } finally { setBusy(false) }
  }

  const processRefund = async (action) => {
    setBusy(true)
    try {
      const { order: updated } = await api.adminProcessRefund(order.id, action, note)
      setOrder(updated)
      toast(action === 'approve' ? 'Refund disetujui (pesanan dibatalkan)' : 'Pengajuan refund ditolak', 'success')
    } catch (e) { toast(e.message || 'Gagal', 'error') } finally { setBusy(false) }
  }

  return (
    <div className="container section" style={{ maxWidth: 920 }}>
      <Link to="/admin" className="btn-link" style={{ fontSize: 13, marginBottom: 20, borderColor: 'var(--muted)', color: 'var(--muted)' }}>← Semua Pesanan</Link>

      <div className="card" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <ShieldCheck size={24} color="var(--indigo)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="display" style={{ fontSize: 19 }}>{order.id}</h1>
            <span className={`order-status ${st.cls}`}>{st.label}</span>
          </div>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 3 }}>
            {order.user?.name} · {order.user?.email} · {new Date(order.createdAt).toLocaleString('id-ID')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="display" style={{ fontSize: 20 }}>{formatPrice(order.total, order.currency)}</div>
          <button className="pill" onClick={() => setShowReceipt(true)} title={t('ao.receipt')}>
            <Printer size={15} /> {t('ao.receipt')}
          </button>
          <button className="pill" onClick={() => {
            setEditForm({
              buyerName: order.user?.name || '',
              buyerEmail: order.user?.email || '',
              deliveryEmail: order.deliveryEmail,
              adminNote: order.adminNote || '',
              status: order.status,
              paymentMethod: order.payment?.method || 'qris',
              paymentAsset: order.payment?.asset || '',
              paymentTxHash: order.payment?.txHash || '',
              paidAt: toLocalInput(order.paidAt || order.createdAt),
            })
            setShowEdit(true)
          }} title={t('ao.edit')}>
            <Pencil size={15} /> {t('ao.edit')}
          </button>
          <button className="pill" style={{ borderColor: '#d4452f', color: '#d4452f' }}
            onClick={() => setShowDelete(true)} title="Hapus transaksi permanen">
            <Trash2 size={15} /> Hapus
          </button>
        </div>
      </div>

      {showReceipt && <ReceiptModal order={order} onClose={() => setShowReceipt(false)} />}

      {showEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,20,18,.62)', display: 'grid', placeItems: 'center', padding: 18 }} onClick={() => setShowEdit(false)}>
          <div className="card" style={{ width: 'min(440px, 100%)', padding: 22 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="display" style={{ fontSize: 16, marginBottom: 14 }}>{t('ao.editTitle')} — {order.id}</h3>
            {order.status === 'COMPLETED' && (
              <div style={{ fontSize: 12.5, color: '#b45309', background: 'rgba(255,193,7,.12)', border: '1px solid rgba(255,193,7,.3)', borderRadius: 10, padding: '9px 12px', marginBottom: 12 }}>
                {t('ao.lockedNote')}
              </div>
            )}
            <label className="field-label">Nama pembeli</label>
            <input className="input" value={editForm.buyerName}
              onChange={(e) => setEditForm((f) => ({ ...f, buyerName: e.target.value }))} placeholder="Nama di struk" />
            <label className="field-label" style={{ marginTop: 10 }}>Email pembeli (akun)</label>
            <input className="input" type="email" value={editForm.buyerEmail}
              onChange={(e) => setEditForm((f) => ({ ...f, buyerEmail: e.target.value }))} />
            <label className="field-label" style={{ marginTop: 10 }}>{t('ao.deliveryEmail')}</label>
            <input className="input" type="email" disabled={order.status === 'COMPLETED'} value={editForm.deliveryEmail}
              onChange={(e) => setEditForm((f) => ({ ...f, deliveryEmail: e.target.value }))} />
            <label className="field-label" style={{ marginTop: 10 }}>{t('ao.note')}</label>
            <textarea className="input" rows={2} value={editForm.adminNote}
              onChange={(e) => setEditForm((f) => ({ ...f, adminNote: e.target.value }))} style={{ resize: 'vertical' }} />

            {/* ── Data transaksi untuk struk: metode + tanggal ── */}
            <div style={{ borderTop: '1.5px solid var(--line-soft)', margin: '14px 0 12px' }} />
            <label className="field-label">{t('ao.payMethod')}</label>
            <div className="seg" style={{ marginBottom: 10 }}>
              {[['qris', 'QRIS'], ['crypto', 'Crypto'], ['manual', t('ao.payManual')]].map(([m, label]) => (
                <button key={m} type="button" className={`seg-btn ${editForm.paymentMethod === m ? 'is-active' : ''}`}
                  onClick={() => setEditForm((f) => ({ ...f, paymentMethod: m }))}>
                  {label}
                </button>
              ))}
            </div>
            {editForm.paymentMethod === 'crypto' && (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '110px 1fr' }}>
                <div>
                  <label className="field-label">{t('ao.payAsset')}</label>
                  <select className="input" value={editForm.paymentAsset} onChange={(e) => setEditForm((f) => ({ ...f, paymentAsset: e.target.value }))}>
                    <option value="">—</option>
                    {CRYPTO.assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">{t('ao.payRef')}</label>
                  <input className="input" value={editForm.paymentTxHash} onChange={(e) => setEditForm((f) => ({ ...f, paymentTxHash: e.target.value }))}
                    placeholder="0x…" style={{ fontFamily: 'monospace', fontSize: 12.5 }} />
                </div>
              </div>
            )}
            {editForm.paymentMethod === 'qris' && (
              <div>
                <label className="field-label">{t('ao.payRef')}</label>
                <input className="input" value={editForm.paymentTxHash} onChange={(e) => setEditForm((f) => ({ ...f, paymentTxHash: e.target.value }))}
                  placeholder={lang === 'id' ? 'No. referensi (opsional)' : 'Reference no. (optional)'} />
              </div>
            )}
            <label className="field-label" style={{ marginTop: 10 }}>{t('ao.payDate')}</label>
            <input className="input" type="datetime-local" value={editForm.paidAt}
              onChange={(e) => setEditForm((f) => ({ ...f, paidAt: e.target.value }))} />
            {order.status !== 'COMPLETED' && (
              <>
                <label className="field-label" style={{ marginTop: 10 }}>Status</label>
                <div className="seg" style={{ marginBottom: 14 }}>
                  {['PROCESSING', 'CANCELLED'].map((s) => (
                    <button key={s} type="button" className={`seg-btn ${editForm.status === s ? 'is-active' : ''}`}
                      onClick={() => setEditForm((f) => ({ ...f, status: s }))}>
                      {s === 'PROCESSING' ? 'Diproses' : 'Dibatalkan'}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pill" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowEdit(false)}>Batal</button>
              <button className="pill pill-indigo" style={{ flex: 1, justifyContent: 'center' }} disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const payload = {
                      ...editForm,
                      paidAt: editForm.paidAt ? new Date(editForm.paidAt).toISOString() : null,
                    }
                    const { order: updated } = await api.adminEditOrder(order.id, payload)
                    setOrder(updated)
                    setShowEdit(false)
                    toast(t('ao.updated'), 'success')
                  } catch (e) { toast(e.message || 'Gagal', 'error') } finally { setBusy(false) }
                }}>
                <Save size={15} /> {t('ao.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,20,18,.62)', display: 'grid', placeItems: 'center', padding: 18 }} onClick={() => setShowDelete(false)}>
          <div className="card" style={{ width: 'min(420px, 100%)', padding: 22 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="display" style={{ fontSize: 16, marginBottom: 10, color: '#d4452f' }}>HAPUS TRANSAKSI?</h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              Pesanan <b>{order.id}</b> beserta item & datanya akan dihapus permanen.
              Tindakan ini tidak bisa dibatalkan dan mengurangi statistik omzet.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="pill" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowDelete(false)}>Batal</button>
              <button className="pill" style={{ flex: 1, justifyContent: 'center', background: '#d4452f', borderColor: '#d4452f', color: '#fff' }}
                disabled={busy} onClick={async () => {
                  setBusy(true)
                  try {
                    await api.adminDeleteOrder(order.id)
                    toast('Transaksi dihapus', 'success')
                    nav('/admin/orders')
                  } catch (e) { toast(e.message || 'Gagal', 'error'); setBusy(false) }
                }}>
                <Trash2 size={15} /> {busy ? 'Menghapus…' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="order-detail-grid">
        {/* LEFT: item + form kredensial */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {order.items.map((it) => {
            const c = creds[it.id] || {}
            return (
              <div key={it.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <BrandLogo src={it.logo} name={it.name} brand={it.brand} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="display" style={{ fontSize: 15 }}>{it.name}</h3>
                    <div className="text-muted" style={{ fontSize: 12.5 }}>{it.tierLabel} · {it.qty}×</div>
                  </div>
                </div>

                <div className="admin-cred">
                  <div className="seg">
                    <button className={`seg-btn ${c.kind === 'account' ? 'is-active' : ''}`} onClick={() => setCred(it.id, { kind: 'account' })}>Akun</button>
                    <button className={`seg-btn ${c.kind === 'apikey' ? 'is-active' : ''}`} onClick={() => setCred(it.id, { kind: 'apikey' })}>API Key</button>
                  </div>

                  {c.kind === 'apikey' ? (
                    <div className="input-ic" style={{ marginTop: 10 }}>
                      <KeyRound size={16} />
                      <input className="input" placeholder="API key" value={c.apiKey} onChange={(e) => setCred(it.id, { apiKey: e.target.value })} style={{ fontFamily: 'monospace', fontSize: 13 }} />
                    </div>
                  ) : (
                    <>
                      <div className="input-ic" style={{ marginTop: 10 }}>
                        <AtSign size={16} />
                        <input className="input" placeholder="Email akun" value={c.email} onChange={(e) => setCred(it.id, { email: e.target.value })} />
                      </div>
                      <div className="input-ic" style={{ marginTop: 8 }}>
                        <Lock size={16} />
                        <input className="input" placeholder="Password akun" value={c.password} onChange={(e) => setCred(it.id, { password: e.target.value })} />
                      </div>
                    </>
                  )}
                  <textarea className="input" rows={2} placeholder="Catatan (link akses / kode cadangan / 2FA)" value={c.note}
                    onChange={(e) => setCred(it.id, { note: e.target.value })} style={{ marginTop: 8, resize: 'vertical' }} />
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="pill" disabled={busy} onClick={() => deliver(false)}><Save size={16} /> Simpan Kredensial</button>
            <button className="pill pill-indigo" disabled={busy} onClick={() => deliver(true)}><Send size={16} /> Selesaikan & Kirim</button>
          </div>
        </div>

        {/* RIGHT: verifikasi pembayaran + data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 className="display" style={{ fontSize: 15, marginBottom: 12 }}>PEMBAYARAN</h3>
            <Row label="Email kirim" value={order.deliveryEmail} />
            <Row label="Metode" value={order.payment?.method === 'crypto' ? `Crypto ${order.payment.asset}` : t('co.payQrisChip')} />
            {order.payment?.method === 'crypto' && <Row label="Jumlah" value={`${order.payment.amount} ${order.payment.asset}`} />}
            {order.payment?.txHash && (
              <a href={(CRYPTO.assets.find((a) => a.symbol === order.payment.asset)?.explorer || '') + order.payment.txHash}
                target="_blank" rel="noreferrer" className="btn-link" style={{ fontSize: 12, marginTop: 4, marginBottom: 10, borderColor: 'var(--indigo)', color: 'var(--indigo)', wordBreak: 'break-all' }}>
                {order.payment.txHash.slice(0, 22)}… <ExternalLink size={12} />
              </a>
            )}
            {order.payment?.proofName && (
              proofUrl ? (
                <a href={proofUrl} target="_blank" rel="noreferrer" className="proof-link" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <img src={proofUrl} alt="Bukti transaksi" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 8, background: 'var(--surface)', marginBottom: 8 }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><FileImage size={16} /> Buka bukti transaksi <ExternalLink size={13} /></span>
                </a>
              ) : (
                <span className="proof-link"><FileImage size={16} /> Memuat bukti…</span>
              )
            )}
          </div>

          {order.refundStatus && order.refundStatus !== 'NONE' && (
            <div className="card" style={{ padding: 20, borderColor: order.refundStatus === 'REQUESTED' ? 'var(--indigo)' : 'var(--line)' }}>
              <h3 className="display" style={{ fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RotateCcw size={16} /> PENGAJUAN REFUND
              </h3>
              <Row label="Status" value={{ REQUESTED: 'Menunggu tinjauan', APPROVED: 'Disetujui', REJECTED: 'Ditolak' }[order.refundStatus]} />
              {order.refundReason && (
                <div style={{ fontSize: 13, marginTop: 6, padding: 10, background: 'var(--surface-2)', borderRadius: 10 }}>
                  <span className="text-muted" style={{ fontSize: 12 }}>Alasan pembeli:</span><br />{order.refundReason}
                </div>
              )}
              {order.refundNote && <p className="text-muted" style={{ fontSize: 12.5, marginTop: 8 }}>Catatanmu: {order.refundNote}</p>}
              {order.refundStatus === 'REQUESTED' && (
                <>
                  <p className="text-muted" style={{ fontSize: 12, margin: '10px 0 8px' }}>Catatan (opsional) diisi dari kolom “Status & Catatan” di bawah.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="pill pill-indigo" disabled={busy} onClick={() => processRefund('approve')} style={{ flex: 1, justifyContent: 'center' }}>
                      <CheckCircle2 size={15} /> Setujui
                    </button>
                    <button className="pill" disabled={busy} onClick={() => processRefund('reject')} style={{ flex: 1, justifyContent: 'center', borderColor: '#d4452f', color: '#d4452f' }}>
                      <XCircle size={15} /> Tolak
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {order.activation === 'own' && order.ownAccount && (
            <div className="card" style={{ padding: 20 }}>
              <h3 className="display" style={{ fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><UserCog size={16} /> AKUN PEMBELI</h3>
              <Row label="Email" value={order.ownAccount.email} />
              <Row label="Password" value={order.ownAccount.password} mono />
              {order.ownAccount.note && <Row label="Catatan" value={order.ownAccount.note} />}
            </div>
          )}

          <div className="card" style={{ padding: 20 }}>
            <h3 className="display" style={{ fontSize: 15, marginBottom: 12 }}>STATUS & CATATAN</h3>
            <textarea className="input" rows={2} placeholder="Catatan untuk pembeli (opsional)" value={note}
              onChange={(e) => setNote(e.target.value)} style={{ resize: 'vertical', marginBottom: 10 }} />
            <button className="pill" disabled={busy} onClick={saveNote} style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
              <Save size={15} /> Simpan Catatan
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pill" disabled={busy} onClick={() => updateStatus('PROCESSING')} style={{ flex: 1, justifyContent: 'center' }}><Clock size={15} /> Proses</button>
              <button className="pill" disabled={busy} onClick={() => updateStatus('CANCELLED')} style={{ flex: 1, justifyContent: 'center', borderColor: '#d4452f', color: '#d4452f' }}><XCircle size={15} /> Batal</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, marginBottom: 8 }}>
      <span className="text-muted" style={{ flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, wordBreak: 'break-all', textAlign: 'right', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  )
}
