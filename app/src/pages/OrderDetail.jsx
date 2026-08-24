import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckCircle2, Clock, Copy, Check, KeyRound, User as UserIcon,
  Eye, EyeOff, ArrowUpRight, Package, ExternalLink, ShieldCheck, UserCog, XCircle,
  RotateCcw, Send, Wallet, Search, Ban, AlertCircle,
} from 'lucide-react'
import BrandLogo from '../components/BrandLogo.jsx'
import { formatPrice } from '../i18n/pricing.js'
import { CRYPTO } from '../data/payment.js'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useBalance } from '../context/BalanceContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { localizeTier } from '../i18n/productContent.js'
import { usePurchased } from '../context/usePurchased.js'

export default function OrderDetail() {
  const { id } = useParams()
  const { user, ready } = useAuth()
  const { balance } = useBalance()
  const { toast } = useToast()
  const { t } = useLang()
  const [order, setOrder] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | missing
  const { markPurchased } = usePurchased()
  const [stockAnimation, setStockAnimation] = useState('searching') // searching | found | done
  const [copied, setCopied] = useState('')

  const showStockAnim = order && (order.status === 'PROCESSING' || (order.status === 'CANCELLED' && order.refundReason === 'Stok habis'))
  const isStockOutOrder = order && order.status === 'CANCELLED' && order.refundReason === 'Stok habis'

  useEffect(() => {
    if (!order || !showStockAnim) return
    // Jangan replay animasi kalau sudah pernah ditampilkan
    const animKey = `upbit_stock_anim_${order.id}`
    if (localStorage.getItem(animKey)) { setStockAnimation('done'); return }
    setStockAnimation('searching')
    const t1 = setTimeout(() => {
      setStockAnimation('found')
      localStorage.setItem(animKey, '1')
    }, 3000)
    // Tandai produk sebagai dibeli (stok habis per user)
    for (const it of order.items) {
      if (it.productId) markPurchased(it.productId)
    }
    return () => clearTimeout(t1)
  }, [order?.id, showStockAnim, markPurchased])

  useEffect(() => {
    if (!ready) return
    if (!user) { setState('missing'); return }
    let on = true
    api.getOrder(id)
      .then((d) => { if (on) { setOrder(d.order); setState('ok') } })
      .catch(() => on && setState('missing'))
    return () => { on = false }
  }, [id, user, ready])

  if (state === 'loading') {
    return <div className="container section" style={{ textAlign: 'center' }}><p className="text-muted">{t('common.loading')}</p></div>
  }
  if (state === 'missing' || !order) {
    return <Missing t={t} text={user ? t('od.notFound') : t('od.signInToView')} to={user ? '/orders' : '/login'} cta={user ? t('od.back') : t('nav.login')} />
  }

  const done = order.status === 'COMPLETED'
  const processing = order.status === 'PROCESSING'
  const cancelled = order.status === 'CANCELLED'

  const copy = async (text, tag) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(tag); setTimeout(() => setCopied(''), 1500)
      toast(t('od.copied'), 'success', 1200)
    } catch { toast(t('od.copyFail'), 'error') }
  }

  const explorer = order.payment?.method === 'crypto'
    ? (CRYPTO.assets.find((a) => a.symbol === order.payment.asset)?.explorer || '')
    : ''

  const statusLabel = done ? t('status.completed') : cancelled ? t('status.cancelled') : t('status.processing')
  const statusCls = done ? 'st-done' : cancelled ? 'st-pending' : 'st-proc'

  return (
    <div className="container section" style={{ maxWidth: 880 }}>
      <Link to="/orders" className="btn-link" style={{ fontSize: 13, marginBottom: 20, borderColor: 'var(--muted)', color: 'var(--muted)' }}>
        ← {t('od.back')}
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card"
        style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <span style={{
          display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: 999,
          background: done ? 'var(--lime)' : 'var(--surface-2)', border: '1.5px solid var(--ink)', flexShrink: 0,
        }}>
          {done ? <CheckCircle2 size={28} strokeWidth={2.4} /> : cancelled ? <XCircle size={26} /> : <Clock size={26} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="display" style={{ fontSize: 20 }}>{order.id}</h1>
            <span className={`order-status ${statusCls}`}>{statusLabel}</span>
          </div>
          <p className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>
            {done ? t('od.doneDesc')
              : cancelled ? t('od.cancelledDesc')
                : `${t('od.processingDesc')}${order.estimate ? ` · ${t('od.estimate')} ${order.estimate}` : ''}.`}
          </p>
        </div>
      </motion.div>

      {processing && (
        <div className="estimate-band" style={{ marginBottom: 18 }}>
          <span className="estimate-ic"><Clock size={18} /></span>
          <div>
            <strong style={{ fontSize: 13.5 }}>
              {order.activation === 'own' ? t('od.bandUpgrade') : t('od.bandProcessing')}
              {order.estimate ? ` · ${t('od.estimate')} ${order.estimate}` : ''}
            </strong>
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              {t('od.bandNote')}{' '}
              <strong style={{ color: 'var(--ink)' }}>{order.deliveryEmail}</strong> {t('od.afterDone')}
            </div>
          </div>
        </div>
      )}

      {/* Animasi cari stok (PROCESSING atau stock-out CANCELLED) */}
      {showStockAnim && stockAnimation !== 'done' && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{
            marginBottom: 18, padding: 'clamp(20px, 3vw, 30px)',
            borderColor: stockAnimation === 'found' ? '#f59e0b' : 'var(--line-soft)',
            background: stockAnimation === 'found'
              ? 'linear-gradient(135deg, rgba(245,158,11,.06), rgba(239,68,68,.04))'
              : 'var(--surface)',
            overflow: 'hidden', position: 'relative',
          }}
        >
          {stockAnimation === 'searching' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{
                display: 'grid', placeItems: 'center', width: 50, height: 50, borderRadius: 999,
                background: 'var(--surface-2)', border: '1.5px solid var(--indigo)', flexShrink: 0,
                animation: 'pulse 1.4s ease-in-out infinite',
              }}>
                <Search size={22} color="var(--indigo)" />
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--indigo)' }}>
                  {t('stock.searching')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                  {t('stock.searchingDesc')}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, delay: i * 0.25, repeat: Infinity }}
                      style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--indigo)' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {stockAnimation === 'found' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}
            >
              {isStockOutOrder ? (
                <>
                  <span style={{
                    display: 'grid', placeItems: 'center', width: 50, height: 50, borderRadius: 999,
                    background: 'rgba(245,158,11,.15)', border: '1.5px solid #f59e0b', flexShrink: 0,
                  }}>
                    <Ban size={22} color="#f59e0b" />
                  </span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#b45309' }}>
                      {t('stock.empty')}
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-soft)', marginTop: 6 }}>
                      {t('stock.emptyDesc')}
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Link to="/balance" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13,
                        color: '#fff', background: 'var(--indigo)', padding: '9px 18px', borderRadius: 999,
                        textDecoration: 'none', border: '1.5px solid var(--indigo)',
                      }}>
                        <Wallet size={15} /> {t('stock.viewBalance')}
                      </Link>
                      <button onClick={() => setStockAnimation('done')} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)',
                        marginLeft: 'auto',
                      }}>
                        ✕ {t('stock.close')}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <span style={{
                    display: 'grid', placeItems: 'center', width: 50, height: 50, borderRadius: 999,
                    background: 'rgba(37,211,102,.12)', border: '1.5px solid var(--lime)', flexShrink: 0,
                  }}>
                    <CheckCircle2 size={22} color="var(--lime)" />
                  </span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#1a7f3f' }}>
                      {t('stock.processing')}
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-soft)', marginTop: 6 }}>
                      {t('stock.processingDesc')}
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => setStockAnimation('done')} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)',
                        marginLeft: 'auto',
                      }}>
                        ✕ {t('stock.close')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </motion.div>
      )}

      {done && (
        <div style={{ background: 'linear-gradient(135deg, rgba(37,211,102,.08), rgba(99,102,241,.06))', border: '1.5px solid var(--line-soft)', borderRadius: 14, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 999, background: 'var(--lime)', border: '1.5px solid var(--ink)', flexShrink: 0, marginTop: 2 }}>
            <Wallet size={17} strokeWidth={2.4} />
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>Saldo & Refund</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
              Kalau pesanan kamu direfund, dana akan masuk ke <strong>Saldo</strong>.
              Saldo bisa dipakai untuk belanja berikutnya.
              Penarikan saldo tersedia setelah total transaksi mencapai <strong>Rp 310.000</strong>.
            </div>
            <Link to="/balance" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--indigo)', marginTop: 8 }}>
              Lihat Saldo <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {order.adminNote && (
        <div className="trust-band" style={{ marginBottom: 18 }}>
          <ShieldCheck size={16} color="var(--indigo)" />
          <span style={{ fontSize: 13 }}>{t('od.adminNote')} {order.adminNote}</span>
        </div>
      )}

      <RefundSection order={order} onUpdated={setOrder} toast={toast} />

      <div className="order-detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {order.items.map((it) => (
            <div key={it.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <BrandLogo src={it.logo} name={it.name} brand={it.brand} size={50} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="display" style={{ fontSize: 16 }}>{it.name}</h3>
                  <div className="text-muted" style={{ fontSize: 12.5 }}>{localizeTier(it.tierLabel, t)} · {it.qty}× · {formatPrice(it.price * it.qty, order.currency)}</div>
                </div>
              </div>
              {it.credential && <Credential cred={it.credential} copy={copy} copied={copied} tagBase={it.id} />}
              {processing && (
                <div className="cred-pending">
                  <Clock size={14} />
                  <span>{t('od.credPending')} <strong>{order.deliveryEmail}</strong> {t('od.afterProcessed')}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 22, alignSelf: 'start' }}>
          <h3 className="display" style={{ fontSize: 16, marginBottom: 14 }}>{t('od.orderDetail')}</h3>
          <SumRow label={t('od.deliveryEmail')} value={order.deliveryEmail} truncate />
          <SumRow label={t('od.activation')} value={order.activation === 'own' ? t('od.ownAccount') : t('od.newAccount')} />
          {order.activation === 'own' && order.ownAccount && (
            <div className="own-summary">
              <div className="cred-field-label" style={{ marginBottom: 6 }}><UserCog size={13} /> {t('od.upgradedAccount')}</div>
              <SumRow label={t('od.accountEmail')} value={order.ownAccount.email} truncate />
              {order.ownAccount.note && <SumRow label={t('od.note')} value={order.ownAccount.note} truncate />}
            </div>
          )}
          <div className="co-divider" />
          <SumRow label={t('od.method')} value={order.payment?.method === 'crypto' ? `Crypto · ${order.payment.asset}` : t('co.payQrisChip')} />
          {order.payment?.method === 'crypto' && (
            <>
              <SumRow label={t('od.network')} value={CRYPTO.networkShort} />
              <SumRow label={t('od.amount')} value={`${order.payment.amount} ${order.payment.asset}`} />
            </>
          )}
          {order.payment?.method === 'qris' && order.payment.proofName && (
            <SumRow label={t('od.proof')} value={order.payment.proofName} truncate />
          )}
          {order.payment?.txHash && (
            <div style={{ margin: '10px 0' }}>
              <div className="text-muted" style={{ fontSize: 12.5, marginBottom: 4 }}>Tx Hash</div>
              <div className="addr-box" style={{ padding: '8px 10px' }}>
                <code className="addr-text" style={{ fontSize: 11.5 }}>{order.payment.txHash}</code>
                <button className="copy-btn" onClick={() => copy(order.payment.txHash, 'tx')} style={{ padding: '5px 9px' }}>
                  {copied === 'tx' ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
              {explorer && (
                <a href={explorer + order.payment.txHash} target="_blank" rel="noreferrer"
                  className="btn-link" style={{ fontSize: 12, marginTop: 8, borderColor: 'var(--indigo)', color: 'var(--indigo)' }}>
                  {t('od.viewExplorer')} <ExternalLink size={13} />
                </a>
              )}
            </div>
          )}
          <div className="co-divider" />
          <SumRow label={t('cart.subtotal')} value={formatPrice(order.subtotal, order.currency)} />
          {order.discount > 0 && <SumRow label={`${t('od.coupon')} ${order.coupon}`} value={`− ${formatPrice(order.discount, order.currency)}`} accent />}
          <div className="co-divider" />
          <div className="co-total">
            <span style={{ fontWeight: 600 }}>{t('cart.total')}</span>
            <span className="display" style={{ fontSize: 22 }}>{formatPrice(order.total, order.currency)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RefundSection({ order, onUpdated, toast }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const rs = order.refundStatus
  // Status pengajuan refund (selalu tampil jika ada)
  if (rs && rs !== 'NONE') {
    const map = {
      REQUESTED: { cls: 'rf-pending', label: t('rf.pending') },
      APPROVED: { cls: 'rf-ok', label: t('rf.approved') },
      REJECTED: { cls: 'rf-no', label: t('rf.rejected') },
    }[rs]
    return (
      <div className={`refund-band ${map.cls}`} style={{ marginBottom: 18 }}>
        <RotateCcw size={16} />
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 13 }}>{map.label}</strong>
          {order.refundReason && <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{t('rf.yourReason')} {order.refundReason}</div>}
          {order.refundNote && <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{t('rf.adminNote')} {order.refundNote}</div>}
        </div>
      </div>
    )
  }

  // Belum mengajukan & pesanan belum dibatalkan → tampilkan tombol ajukan
  if (order.status === 'CANCELLED') return null

  const submit = async () => {
    if (reason.trim().length < 5) { toast(t('rf.reasonMin'), 'error'); return }
    setBusy(true)
    try {
      const { order: updated } = await api.requestRefund(order.id, reason.trim())
      onUpdated(updated)
      toast(t('rf.sent'), 'success')
    } catch (e) {
      toast(e.message || t('rf.failed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 18 }}>
      {!open ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span className="text-muted" style={{ fontSize: 13 }}>{t('rf.problem')}</span>
          <button className="pill" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setOpen(true)}>
            <RotateCcw size={15} /> {t('rf.request')}
          </button>
        </div>
      ) : (
        <div>
          <div className="cred-field-label" style={{ marginBottom: 8 }}><RotateCcw size={14} /> {t('rf.title')}</div>
          <textarea
            className="input" rows={3} placeholder={t('rf.placeholder')}
            value={reason} onChange={(e) => setReason(e.target.value)}
            style={{ resize: 'vertical', width: '100%' }}
          />
          <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
            {t('rf.note')}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="pill pill-indigo" style={{ padding: '9px 16px', fontSize: 13 }} disabled={busy} onClick={submit}>
              <Send size={15} /> {busy ? t('rf.sending') : t('rf.send')}
            </button>
            <button className="btn-link" style={{ borderColor: 'var(--muted)', color: 'var(--muted)' }} onClick={() => setOpen(false)}>{t('rf.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Credential({ cred, copy, copied, tagBase }) {
  const { t } = useLang()
  const [show, setShow] = useState(false)
  const isKey = cred.kind === 'apikey'
  return (
    <div className="cred-box">
      <div className="cred-head">
        <KeyRound size={15} />
        <span style={{ fontWeight: 700, fontSize: 13 }}>{isKey ? 'API Key' : t('od.premiumAccount')} — {t('od.delivered')}</span>
      </div>
      {isKey ? (
        <CredField icon={<KeyRound size={14} />} label="API Key" value={cred.apiKey || ''} mask={!show}
          onCopy={() => copy(cred.apiKey, `${tagBase}-key`)} copied={copied === `${tagBase}-key`}
          toggle={() => setShow((s) => !s)} showState={show} />
      ) : (
        <>
          <CredField icon={<UserIcon size={14} />} label={t('od.email')} value={cred.email || ''}
            onCopy={() => copy(cred.email, `${tagBase}-email`)} copied={copied === `${tagBase}-email`} />
          <CredField icon={<KeyRound size={14} />} label={t('od.password')} value={cred.password || ''} mask={!show}
            onCopy={() => copy(cred.password, `${tagBase}-pw`)} copied={copied === `${tagBase}-pw`}
            toggle={() => setShow((s) => !s)} showState={show} />
        </>
      )}
      {cred.note && <p className="text-muted" style={{ fontSize: 11.5, marginTop: 8 }}>{cred.note}</p>}
    </div>
  )
}

function CredField({ icon, label, value, mask, onCopy, copied, toggle, showState }) {
  return (
    <div className="cred-field">
      <span className="cred-field-label">{icon} {label}</span>
      <div className="cred-field-val">
        <code>{mask ? '•'.repeat(Math.min(value.length, 22)) : value}</code>
        <div style={{ display: 'flex', gap: 4 }}>
          {toggle && (
            <button className="cred-mini" onClick={toggle} aria-label="Tampilkan/sembunyikan">
              {showState ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          <button className="cred-mini" onClick={onCopy} aria-label="Salin">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function SumRow({ label, value, accent, truncate }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, marginBottom: 9 }}>
      <span className="text-muted" style={{ flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: accent ? 'var(--indigo)' : 'var(--ink)', ...(truncate ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}) }}>{value}</span>
    </div>
  )
}

function Missing({ text, to, cta, t }) {
  return (
    <div className="container section" style={{ textAlign: 'center', maxWidth: 520 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 72, height: 72, borderRadius: 999, margin: '0 auto 20px', background: 'var(--surface-2)', border: '1.5px solid var(--ink)' }}>
        <Package size={30} />
      </span>
      <h1 className="display h-md">{t('od.missingTitle')}</h1>
      <p className="text-muted" style={{ marginTop: 12 }}>{text}</p>
      <Link to={to} className="pill pill-indigo" style={{ marginTop: 24 }}>
        {cta} <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
      </Link>
    </div>
  )
}
