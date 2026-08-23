import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  QrCode, Coins, Copy, Check, Upload, ShieldCheck, ArrowUpRight, ChevronLeft,
  Tag, X, AlertCircle, FileCheck2, Wallet, Mail, UserPlus, UserCog,
  Clock, AtSign, Lock, KeyRound, ClipboardList,
} from 'lucide-react'
import Asterisk from '../components/Asterisk.jsx'
import { getProduct } from '../data/products.js'
import { QRIS, CRYPTO, toCryptoAmount } from '../data/payment.js'
import { api } from '../api.js'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useBalance } from '../context/BalanceContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { localizeTier } from '../i18n/productContent.js'
import { usePricing, amountFor, USD_TO_IDR, USD_TO_CNY, MYR_RATE } from '../i18n/pricing.js'

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim())

export default function Checkout() {
  const navigate = useNavigate()
  const { items, clear } = useCart()
  const { user } = useAuth()
  const { balance, fetchBalance } = useBalance()
  const { toast } = useToast()
  const [useSaldo, setUseSaldo] = useState(false)
  const { t } = useLang()
  const { fmt, region, currency } = usePricing()
  const priceOf = (it) => amountFor(it, region)
  const total = items.reduce((s, it) => s + priceOf(it) * it.qty, 0)

  // wizard
  const [stepIdx, setStepIdx] = useState(0)

  // langkah pengiriman
  const [email, setEmail] = useState(user?.email || '')
  const [activation, setActivation] = useState('new') // 'new' | 'own'
  const [own, setOwn] = useState({ email: '', password: '', note: '' })

  // pembayaran
  const [method, setMethod] = useState('qris') // 'qris' | 'crypto'
  const [asset, setAsset] = useState(CRYPTO.assets[0])
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState(null)
  const [copied, setCopied] = useState('')
  const [proof, setProof] = useState(null) // { name, dataUrl? }
  const [checkPhase, setCheckPhase] = useState('show') // 'show' | 'loading' | 'done'
  const [txHash, setTxHash] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (user?.email) setEmail((e) => e || user.email)
  }, [user])

  // Kupon nominal tetap (fixed) hanya untuk IDR; persen berlaku semua.
  const couponActive = coupon && !(currency !== 'IDR' && coupon.type === 'fixed')
  const discount = couponActive ? (coupon?.discount || 0) : 0
  const payable = Math.max(0, total - discount)
  // Saldo disimpan dalam IDR di backend — konversi ke mata uang pesanan untuk tampil & hitung.
  const toCur = (idr) =>
    currency === 'USD' ? Math.round((idr * 100) / USD_TO_IDR)
      : currency === 'CNY' ? Math.round((idr * USD_TO_CNY * 100) / USD_TO_IDR)
        : currency === 'MYR' ? Math.round((idr * 100) / MYR_RATE)
          : idr
  const balanceInCur = toCur(balance)
  // Balance discount — harus setelah payable (fix TDZ crash), dalam mata uang pesanan.
  const balanceDiscount = useSaldo ? Math.min(balanceInCur, payable) : 0
  const finalPayable = Math.max(0, payable - balanceDiscount)
  // Nominal crypto/QRIS: konversi ke ekuivalen IDR dulu (USD, CNY, MYR → IDR).
  const payableIdrEquiv =
    currency === 'USD' ? Math.round((finalPayable / 100) * USD_TO_IDR)
      : currency === 'CNY' ? Math.round((finalPayable / 100 / USD_TO_CNY) * USD_TO_IDR)
        : currency === 'MYR' ? Math.round((finalPayable / 100) * MYR_RATE)
          : finalPayable
  // Jumlah saldo sebenarnya yang dipakai (IDR) — dikirim ke server via useBalance.
  const balanceDiscountIdr =
    currency === 'USD' ? Math.round((balanceDiscount / 100) * USD_TO_IDR)
      : currency === 'CNY' ? Math.round((balanceDiscount / 100 / USD_TO_CNY) * USD_TO_IDR)
        : currency === 'MYR' ? Math.round((balanceDiscount / 100) * MYR_RATE)
          : balanceDiscount
  const ref = useMemo(
    () => (items.map((i) => i.id.length).reduce((a, b) => a + b, 0) + items.length)
      .toString().padStart(4, '0'),
    [items],
  )
  const manualItems = useMemo(() => items.filter((i) => getProduct(i.id)?.estimate), [items])
  const estimate = manualItems.length ? (getProduct(manualItems[0].id)?.estimate || '10–20 menit') : null
  const eligibleOwn = useMemo(() => items.some((i) => getProduct(i.id)?.category !== 'API'), [items])

  // Guard: keranjang kosong
  if (items.length === 0) {
    return <Gate title={t('co.gateEmptyTitle')} text={t('co.gateEmptyText')} to="/store" cta={t('footer.startShopping')} />
  }
  // Guard: belum login — server wajib auth untuk buat pesanan
  if (!user) {
    return <Gate title={t('co.gateLoginTitle')} text={t('co.gateLoginText')} to="/login" cta={t('nav.login')} />
  }

  const useOwn = activation === 'own' && eligibleOwn
  const emailValid = isEmail(email)
  const ownValid = !useOwn || (isEmail(own.email) && own.password.trim().length > 0)
  const cryptoAmount = toCryptoAmount(payableIdrEquiv, asset)
  const paymentOk = method === 'qris' ? (checkPhase === 'done' && !!proof) : txHash.trim().length >= 10
  const canConfirm = emailValid && ownValid && paymentOk

  // definisi langkah (lewati 'aktivasi' bila tak ada produk yang mendukung)
  // definisi langkah: Email → Aktivasi → Ringkasan → Payment
  const stepDefs = [
    { key: 'email', label: t('co.stepEmail'), icon: Mail },
    ...(eligibleOwn ? [{ key: 'activation', label: t('co.stepActivation'), icon: UserCog }] : []),
    { key: 'review', label: t('co.stepReview'), icon: ClipboardList },
    { key: 'payment', label: t('co.stepPay'), icon: QrCode },
  ]
  const idx = Math.min(stepIdx, stepDefs.length - 1)
  const currentKey = stepDefs[idx].key
  const isLast = idx === stepDefs.length - 1

  // Ringkasan hanya butuh email & aktivasi valid — proof/Tx Hash baru dicek di step Payment.
  const stepValid = (key) =>
    key === 'email' ? emailValid
      : key === 'activation' ? ownValid
        : key === 'review' ? emailValid && ownValid
          : canConfirm
  const currentValid = stepValid(currentKey)

  const goNext = () => {
    if (!currentValid) return
    setStepIdx((i) => Math.min(i + 1, stepDefs.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goBack = () => {
    setStepIdx((i) => Math.max(i - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCoupon = async () => {
    try {
      const res = await api.validateCoupon(couponInput, total)
      setCoupon(res)
      toast(`${t('co.couponApplied')} — ${res.label}`, 'success')
    } catch (e) {
      setCoupon(null)
      toast(e.message || t('co.couponInvalid'), 'error')
    }
  }
  const removeCoupon = () => { setCoupon(null); setCouponInput('') }

  const copy = async (text, tag) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(tag); setTimeout(() => setCopied(''), 1500)
      toast(t('co.copiedClipboard'), 'success', 1400)
    } catch { toast(t('od.copyFail'), 'error') }
  }

  // Kompres gambar client-side: foto HP 3-5MB → ~150KB JPEG.
  // Upload cepat, tidak bikin localStorage penuh (kuota 5MB), tidak timeout Vercel.
  const compressImage = (file) => new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      try {
        const MAX = 900
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const scale = MAX / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('compress'))), 'image/jpeg', 0.82)
      } catch (err) { reject(err) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('read')) }
    img.src = url
  })

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { toast(t('co.proofImageOnly'), 'error'); return }
    try {
      const smallBlob = await compressImage(f)
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result
        try { localStorage.setItem('upbit_proof_' + ref, dataUrl) } catch { /* kuota penuh → abaikan */ }
        setProof({ name: f.name.replace(/\.[^.]+$/, '') + '.jpg', dataUrl, blob: smallBlob })
        toast(t('co.proofAttached'), 'success', 1600)
      }
      reader.readAsDataURL(smallBlob)
    } catch {
      toast(t('co.proofReadFail'), 'error')
    }
  }

  const handleCheckPayment = () => {
    setCheckPhase('loading')
    setTimeout(() => {
      setCheckPhase('done')
      toast(t('co.checkSuccess'), 'success', 2000)
    }, 2000)
  }

  const handleConfirm = async () => {
    if (!canConfirm || submitting) return
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('items', JSON.stringify(items.map((i) => ({
        id: i.id, logo: i.logo, brand: i.brand, tierLabel: i.tierLabel, qty: i.qty,
      }))))
      form.append('deliveryEmail', email.trim())
      form.append('activation', useOwn ? 'own' : 'new')
      if (useOwn) {
        form.append('ownEmail', own.email.trim())
        form.append('ownPassword', own.password)
        form.append('ownNote', own.note.trim())
      }
      form.append('method', method)
      form.append('currency', currency)
      if (coupon?.code) form.append('couponCode', coupon.code)
      if (method === 'qris') {
        if (proof?.blob) {
          // Pakai blob yang sudah dikompres (cepat, tanpa roundtrip fetch)
          form.append('proof', proof.blob, proof.name)
        } else if (proof?.dataUrl) {
          const blob = await (await fetch(proof.dataUrl)).blob()
          form.append('proof', blob, proof.name)
        } else if (proof) {
          form.append('proof', proof)
        }
      } else {
        form.append('asset', asset.symbol)
        form.append('amount', cryptoAmount)
        form.append('txHash', txHash.trim())
      }
      // Saldo dipotong ATOMIK di server bersama pembuatan order (field useBalance, dalam IDR).
      if (useSaldo && balanceDiscount > 0) {
        form.append('useBalance', String(balanceDiscountIdr))
      }
      const { order } = await api.createOrder(form)
      toast(t('co.paymentSent'), 'success', 3200)
      if (useSaldo && balanceDiscount > 0) fetchBalance().catch(() => {})
      // Navigasi dulu, baru clear — cegah flash Gate (keranjang kosong) sebelum pindah halaman
      navigate(`/orders/${order.id}`, { replace: true })
      setTimeout(() => clear(), 100)
    } catch (e) {
      setSubmitting(false)
      toast(e.message || t('co.orderFailed'), 'error')
    }
  }

  return (
    <div className="container section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Asterisk size={28} />
        <span className="eyebrow">{t('co.eyebrow')}</span>
      </div>
      <h1 className="display h-lg" style={{ marginBottom: 26 }}>{t('co.title')}</h1>

      <div className="wizard">
        {/* Stepper */}
        <div className="wizard-steps">
          {stepDefs.map((s, i) => (
            <div key={s.key} className={`wstep ${i === idx ? 'is-active' : ''} ${i < idx ? 'is-done' : ''}`}>
              <span className="wstep-dot">{i < idx ? <Check size={17} strokeWidth={3} /> : i + 1}</span>
              <span className="wstep-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Konten langkah */}
        <div className="wizard-body card">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentKey}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
            >
              {/* ===== STEP: EMAIL ===== */}
              {currentKey === 'email' && (
                <div>
                  <StepHead icon={Mail} title={t('co.emailTitle')}
                    sub={t('co.emailSub')} />
                  <label className="field-label" style={{ marginTop: 18 }}>{t('co.emailLabel')}</label>
                  <div className="input-ic">
                    <Mail size={17} />
                    <input className="input" type="email" placeholder="kamu@email.com"
                      value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  {email.length > 0 && !emailValid && (
                    <p className="field-err"><AlertCircle size={13} /> {t('co.emailInvalid')}</p>
                  )}
                  {estimate && (
                    <div className="estimate-band" style={{ marginTop: 18 }}>
                      <span className="estimate-ic"><Clock size={18} /></span>
                      <div>
                        <strong style={{ fontSize: 13.5 }}>{t('co.estimateWork')} {estimate}</strong>
                        <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                          {manualItems.map((i) => i.name).join(', ')} {t('co.estimateManual')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== STEP: AKTIVASI ===== */}
              {currentKey === 'activation' && (
                <div>
                  <StepHead icon={UserCog} title={t('co.actTitle')}
                    sub={t('co.actSub')} />
                  <div className="act-grid" style={{ marginTop: 18 }}>
                    <button type="button" className={`act-opt ${activation === 'new' ? 'is-active' : ''}`} onClick={() => setActivation('new')}>
                      <span className="act-opt-ic"><UserPlus size={18} /></span>
                      <span className="act-opt-title">{t('co.actNew')}</span>
                      <span className="act-opt-desc">{t('co.actNewDesc')}</span>
                    </button>
                    <button type="button" className={`act-opt ${activation === 'own' ? 'is-active' : ''}`} onClick={() => setActivation('own')}>
                      <span className="act-opt-ic"><UserCog size={18} /></span>
                      <span className="act-opt-title">{t('co.actOwn')}</span>
                      <span className="act-opt-desc">{t('co.actOwnDesc')}</span>
                    </button>
                  </div>
                  <AnimatePresence>
                    {useOwn && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
                        <div className="own-form">
                          <label className="field-label">{t('co.ownEmailLabel')}</label>
                          <div className="input-ic">
                            <AtSign size={17} />
                            <input className="input" type="email" placeholder="akun-kamu@email.com"
                              value={own.email} onChange={(e) => setOwn((s) => ({ ...s, email: e.target.value }))} />
                          </div>
                          {own.email.length > 0 && !isEmail(own.email) && (
                            <p className="field-err"><AlertCircle size={13} /> {t('co.emailInvalid')}</p>
                          )}
                          <label className="field-label" style={{ marginTop: 14 }}>{t('co.ownPwLabel')}</label>
                          <div className="input-ic">
                            <Lock size={17} />
                            <input className="input" type="password" placeholder={t('co.ownPwPlaceholder')}
                              value={own.password} onChange={(e) => setOwn((s) => ({ ...s, password: e.target.value }))} />
                          </div>
                          <label className="field-label" style={{ marginTop: 14 }}>{t('co.ownNoteLabel')}</label>
                          <div className="input-ic input-ic-top">
                            <KeyRound size={17} />
                            <textarea className="input" rows={2} placeholder={t('co.ownNotePlaceholder')}
                              value={own.note} onChange={(e) => setOwn((s) => ({ ...s, note: e.target.value }))} />
                          </div>
                          <p className="text-muted" style={{ fontSize: 11.5, marginTop: 10, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--indigo)' }} />
                            {t('co.ownSecure')}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ===== STEP: PEMBAYARAN ===== */}
              {currentKey === 'payment' && (
                <div>
                  <StepHead icon={QrCode} title={t('co.payTitle')} sub={t('co.paySub')} />
                  <div className="pay-tabs" style={{ marginTop: 18 }}>
                    <button className={`pay-tab ${method === 'qris' ? 'is-active' : ''}`} onClick={() => setMethod('qris')}>
                      <QrCode size={19} /> {t('co.payQrisTab')}
                    </button>
                    <button className={`pay-tab ${method === 'crypto' ? 'is-active' : ''}`} onClick={() => setMethod('crypto')}>
                      <Coins size={19} /> {t('co.payCrypto')}
                    </button>
                  </div>

                  <AnimatePresence mode="wait">
                    {method === 'qris' ? (
                      <motion.div key="qris" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ marginTop: 18 }}>
                        <p className="text-muted" style={{ fontSize: 13.5 }}>{t('co.qrisScan')}</p>
                        <div className="qris-box">
                          <div className="qris-head">
                            <span className="display" style={{ fontSize: 15 }}>{QRIS.merchant}</span>
                            <span className="chip chip-lime" style={{ fontSize: 10.5 }}>{t('co.payQrisChip')}</span>
                          </div>
                          <div className="qris-qr">
                            <QRCodeSVG value={QRIS.buildPayload(payableIdrEquiv)} size={188} level="M" bgColor="#ffffff" fgColor="#2b2b28" />
                          </div>
                          <div className="qris-amount">
                            <span className="text-muted" style={{ fontSize: 12.5 }}>{t('co.totalPay')}</span>
                            <span className="display" style={{ fontSize: 22 }}>{fmt(finalPayable)}</span>
                          </div>
                          <div className="text-muted" style={{ fontSize: 11.5, textAlign: 'center' }}>NMID {QRIS.nmid} · Ref #{ref}</div>
                        </div>

                        {checkPhase === 'show' && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleCheckPayment}
                            className="pill pill-indigo"
                            style={{ width: '100%', marginTop: 18, padding: '14px 20px', fontSize: 15, fontWeight: 600, justifyContent: 'center' }}
                          >
                            <Clock size={18} /> {t('co.checkPayment')}
                          </motion.button>
                        )}

                        {checkPhase === 'loading' && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ textAlign: 'center', padding: '24px 0', marginTop: 14 }}
                          >
                            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 12px' }} />
                            <p className="text-muted" style={{ fontSize: 14 }}>{t('co.checkingPayment')}</p>
                          </motion.div>
                        )}

                        {checkPhase === 'done' && (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ marginTop: 14 }}
                          >
                            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
                            <button type="button" className={`upload-drop ${proof ? 'has-file' : ''}`} onClick={() => fileRef.current?.click()}>
                              {proof ? (
                                <><FileCheck2 size={20} /><span>{proof.name}</span><span className="text-muted" style={{ fontSize: 12 }}>{t('co.clickToChange')}</span></>
                              ) : (
                                <><Upload size={20} /><span style={{ fontWeight: 600 }}>{t('co.uploadProofNow')}</span><span className="text-muted" style={{ fontSize: 12 }}>{t('co.maxFile')}</span></>
                              )}
                            </button>
                          </motion.div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div key="crypto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ marginTop: 18 }}>
                        <p className="text-muted" style={{ fontSize: 13.5 }}>{t('co.cryptoNetwork')} <strong>{CRYPTO.network}</strong>. {t('co.cryptoNetworkNote')}</p>
                        <div className="asset-row">
                          {CRYPTO.assets.map((a) => (
                            <button key={a.id} className={`asset-chip ${asset.id === a.id ? 'is-active' : ''}`} onClick={() => setAsset(a)}>
                              <Wallet size={16} /> {a.label}
                            </button>
                          ))}
                        </div>
                        <div className="crypto-amount">
                          <div>
                            <span className="text-muted" style={{ fontSize: 12.5 }}>{t('co.sendExactly')}</span>
                            <div className="display" style={{ fontSize: 24 }}>{cryptoAmount} <span style={{ fontSize: 15 }}>{asset.symbol}</span></div>
                          </div>
                          <button className="copy-btn" onClick={() => copy(cryptoAmount, 'amount')}>
                            {copied === 'amount' ? <Check size={15} /> : <Copy size={15} />}{copied === 'amount' ? t('co.copied') : t('co.copy')}
                          </button>
                        </div>
                        <div className="text-muted" style={{ fontSize: 11.5, marginTop: -4, marginBottom: 4 }}>≈ {fmt(finalPayable)} · {t('co.rateNote')}</div>
                        <label className="field-label">{t('co.walletAddr')} ({asset.symbol})</label>
                        <div className="addr-box">
                          <code className="addr-text">{asset.address}</code>
                          <button className="copy-btn" onClick={() => copy(asset.address, 'addr')}>
                            {copied === 'addr' ? <Check size={15} /> : <Copy size={15} />}{copied === 'addr' ? t('co.copied') : t('co.copy')}
                          </button>
                        </div>
                        <label className="field-label" style={{ marginTop: 16 }}>{t('co.txHashLabel')}</label>
                        <input className="input" placeholder={t('co.txHashPlaceholder')}
                          value={txHash} onChange={(e) => setTxHash(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 13.5 }} />
                        <p className="text-muted" style={{ fontSize: 12, marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                          {t('co.txHashNote')}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ===== STEP: RINGKASAN (terakhir) ===== */}
              {currentKey === 'review' && (
                <div>
                  <StepHead icon={ClipboardList} title={t('co.reviewTitle')} sub={t('co.reviewSub')} />

                  <div className="co-items" style={{ marginTop: 18 }}>
                    {items.map((it) => (
                      <div key={it.key} className="co-item">
                        <div style={{ minWidth: 0 }}>
                          <div className="co-item-name">{it.name}</div>
                          <div className="text-muted" style={{ fontSize: 12 }}>{localizeTier(it.tierLabel, t)} · {it.qty}×</div>
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{fmt(priceOf(it) * it.qty)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="review-meta">
                    <MetaRow icon={Mail} label={t('co.metaEmail')} value={email} />
                    <MetaRow icon={UserCog} label={t('co.metaActivation')}
                      value={useOwn ? `${t('co.metaOwn')} (${own.email})` : t('co.metaNew')} />
                    <MetaRow icon={method === 'qris' ? QrCode : Coins} label={t('co.metaPayment')}
                      value={method === 'qris' ? `${t('co.payQrisChip')} · ${proof?.name || ''}` : `Crypto ${asset.symbol} · ${cryptoAmount}`} />
                  </div>

                  {estimate && (
                    <div className="estimate-band" style={{ marginTop: 16 }}>
                      <span className="estimate-ic"><Clock size={18} /></span>
                      <div>
                        <strong style={{ fontSize: 13.5 }}>{t('co.estimateWork')} {estimate}</strong>
                        <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                          {t('co.reviewEstimate')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pakai Saldo */}
                  {balance > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                        <input type="checkbox" checked={useSaldo} onChange={(e) => setUseSaldo(e.target.checked)}
                          style={{ width: 18, height: 18, accentColor: 'var(--indigo)' }} />
                        <Wallet size={16} /> Pakai Saldo ({fmt(balanceInCur)})
                      </label>
                      {useSaldo && balanceDiscount > 0 && (
                        <span style={{ fontWeight: 600, color: 'var(--indigo)' }}>- {fmt(balanceDiscount)}</span>
                      )}
                    </div>
                  )}

                  {/* Kupon */}
                  <div style={{ margin: '18px 0 6px' }}>
                    {coupon ? (
                      <div className="coupon-applied">
                        <Tag size={15} />
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{coupon.code}</span>
                        <span className="text-muted" style={{ fontSize: 12.5 }}>· {coupon.label}</span>
                        <button onClick={removeCoupon} className="coupon-x" aria-label="Hapus kupon"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="coupon-row">
                        <input className="input" placeholder={t('co.couponPlaceholder')} value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCoupon()}
                          style={{ padding: '11px 14px', fontSize: 14 }} />
                        <button className="pill" onClick={handleCoupon} style={{ padding: '10px 18px', flexShrink: 0 }}>{t('co.couponApply')}</button>
                      </div>
                    )}
                    <div className="text-muted" style={{ fontSize: 11.5, marginTop: 8 }}>{t('co.couponHint')}</div>
                  </div>

                  <div className="co-divider" />
                  <Row label={t('cart.subtotal')} value={fmt(total)} />
                  {discount > 0 && <Row label={t('co.couponDiscount')} value={`− ${fmt(discount)}`} accent />}
                  {useSaldo && balanceDiscount > 0 && <Row label={t('co.balanceUsed')} value={`− ${fmt(balanceDiscount)}`} accent />}
                  <Row label={t('cart.serviceFee')} value={t('cart.free')} />
                  <div className="co-divider" />
                  <div className="co-total">
                    <span style={{ fontWeight: 600 }}>{t('co.totalShopping')}</span>
                    <span className="display" style={{ fontSize: 28 }}>{fmt(finalPayable)}</span>
                  </div>


                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigasi wizard */}
        <div className="wizard-nav">
          {idx > 0 ? (
            <button className="pill" onClick={goBack}><ChevronLeft size={17} /> {t('co.back')}</button>
          ) : (
            <Link to="/cart" className="pill"><ChevronLeft size={17} /> {t('nav.cart')}</Link>
          )}

          {isLast ? (
            <motion.button whileTap={{ scale: canConfirm ? 0.97 : 1 }} onClick={handleConfirm}
              disabled={!canConfirm || submitting} className="pill pill-indigo wizard-cta">
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,.35) rgba(255,255,255,.35) rgba(255,255,255,.35) #fff', marginRight: 8 }} />
                  {t('co.processing')}
                </>
              ) : (
                <>{t('co.confirmPay')} <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span></>
              )}
            </motion.button>
          ) : (
            <button onClick={goNext} disabled={!currentValid} className="pill pill-indigo wizard-cta">
              {t('co.next')} <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
            </button>
          )}
        </div>

        {!currentValid && (
          <p className="text-muted wizard-hint">
            {currentKey === 'email' ? t('co.hintEmail')
              : currentKey === 'activation' ? t('co.hintActivation')
                : currentKey === 'payment' ? (method === 'qris' ? (checkPhase === 'show' ? t('co.hintCheckPayment') : t('co.hintProof')) : t('co.hintTx'))
                  : t('co.hintReview')}
          </p>
        )}
      </div>
    </div>
  )
}

function StepHead({ icon: Ic, title, sub }) {
  return (
    <div className="step-head">
      <span className="step-head-ic"><Ic size={20} /></span>
      <div>
        <h2 className="display" style={{ fontSize: 20 }}>{title}</h2>
        <p className="text-muted" style={{ fontSize: 13.5, marginTop: 3, lineHeight: 1.5 }}>{sub}</p>
      </div>
    </div>
  )
}

function MetaRow({ icon: Ic, label, value }) {
  return (
    <div className="meta-row">
      <span className="meta-row-ic"><Ic size={15} /></span>
      <span className="meta-row-label">{label}</span>
      <span className="meta-row-value">{value}</span>
    </div>
  )
}

function Row({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, marginBottom: 10 }}>
      <span className="text-muted">{label}</span>
      <span style={{ fontWeight: 600, color: accent ? 'var(--indigo)' : 'var(--ink)' }}>{value}</span>
    </div>
  )
}

function Gate({ title, text, to, cta }) {
  return (
    <div className="container section" style={{ textAlign: 'center', maxWidth: 540 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 76, height: 76, borderRadius: 999, margin: '0 auto 22px', background: 'var(--surface-2)', border: '1.5px solid var(--ink)' }}>
        <Wallet size={32} />
      </span>
      <h1 className="display h-md">{title}</h1>
      <p className="text-muted" style={{ marginTop: 12 }}>{text}</p>
      <Link to={to} className="pill pill-indigo" style={{ marginTop: 24 }}>
        {cta} <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
      </Link>
    </div>
  )
}
