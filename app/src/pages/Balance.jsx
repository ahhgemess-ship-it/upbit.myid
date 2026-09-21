import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, ArrowUpRight, ArrowRight, Clock, AlertCircle, Check, History,
  QrCode, Landmark, RefreshCw, ShoppingBag, Banknote, Lock, Info, DollarSign,
  Calendar, Gift, Star, Send, ExternalLink, Plus, CreditCard, Coins, ArrowLeft,
} from 'lucide-react'
import Asterisk from '../components/Asterisk.jsx'
import { useBalance } from '../context/BalanceContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { formatCurrency, CURRENCY } from '../i18n/translations.js'
import { api } from '../api.js'
import { QRIS, CRYPTO, toCryptoAmount } from '../data/payment.js'
import { QRCodeSVG } from 'qrcode.react'

const txMeta = {
  refund: { labelKey: 'tx.refund', icon: RefreshCw },
  purchase: { labelKey: 'tx.purchase', icon: ShoppingBag },
  withdraw: { labelKey: 'tx.withdraw', icon: Banknote },
  checkin: { labelKey: 'tx.checkin', icon: Gift },
}

const FILTER_OPTIONS = [
  { value: 'all', labelKey: 'tx.all' },
  { value: 'refund', labelKey: 'tx.refund' },
  { value: 'purchase', labelKey: 'tx.purchase' },
  { value: 'withdraw', labelKey: 'tx.withdraw' },
  { value: 'checkin', labelKey: 'tx.checkin' },
]

export default function Balance() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const {
    balance, totalSpent, withdrawEligible, minWithdraw,
    history, loaded, fetchBalance, fetchHistory, withdraw,
    checkInStreak, canCheckIn, checkInReward, checkInBonus, checkInCycle,
    fetchCheckInStatus, doCheckIn,
  } = useBalance()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('qris')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [filter, setFilter] = useState('all')
  const [checkInMsg, setCheckInMsg] = useState(null)
  const [lockedAlert, setLockedAlert] = useState(false)
  // Telegram link (satu dompet dengan bot)
  const [tgLinked, setTgLinked] = useState(null)
  const [tgCode, setTgCode] = useState(null)
  const [tgBusy, setTgBusy] = useState(false)
  // ── Top-up saldo (wizard 3 langkah) ──
  const [tuStep, setTuStep] = useState(1)         // 1: nominal · 2: bayar · 3: konfirmasi
  const [tuDir, setTuDir] = useState(1)           // arah animasi antar langkah: 1 maju · -1 mundur
  const [tuBase, setTuBase] = useState('')        // nominal dasar (string input)
  const [tuMethod, setTuMethod] = useState('qris')
  const [tuAsset, setTuAsset] = useState(CRYPTO.assets[0]?.id || 'bnb')
  const [tuTxRef, setTuTxRef] = useState('')      // tx hash / no. referensi
  const [tuProof, setTuProof] = useState(null)    // file bukti (QRIS)
  const [tuBusy, setTuBusy] = useState(false)
  const [tuMsg, setTuMsg] = useState(null)
  const [tuHistory, setTuHistory] = useState(null)
  const [tuView, setTuView] = useState(false)   // false: dompet · true: halaman Top Up
  const tuFileRef = useRef(null)

  // Draf top-up: keluar halaman tidak mengulang dari awal
  const TU_DRAFT_KEY = 'upbit_topup_draft_v1'
  const [tuDraftLoaded, setTuDraftLoaded] = useState(false)
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(TU_DRAFT_KEY) || 'null')
      if (d) {
        if (typeof d.step === 'number' && d.step >= 1 && d.step <= 3) setTuStep(d.step)
        if (typeof d.base === 'string') setTuBase(d.base)
        if (typeof d.method === 'string') setTuMethod(d.method)
        if (typeof d.asset === 'string') setTuAsset(d.asset)
        if (typeof d.txRef === 'string') setTuTxRef(d.txRef)
      }
    } catch { /* draf korup → abaikan */ }
    setTuDraftLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Status koneksi Telegram
  useEffect(() => {
    if (!user) return
    api.telegramStatus().then((s) => setTgLinked(!!s?.linked)).catch(() => setTgLinked(false))
  }, [user])

  // Cleanup lockedAlert timeout
  useEffect(() => {
    if (!lockedAlert) return
    const id = setTimeout(() => setLockedAlert(false), 4000)
    return () => clearTimeout(id)
  }, [lockedAlert])

  const fmt = (n) => formatCurrency(n, lang)
  const fmtCompact = (n) => {
    // Compact untuk quick amount: hilangkan .### di IDR, tampilkan penuh untuk non-IDR
    if (lang === 'id' || lang === 'ms') {
      const s = fmt(n)
      return s.replace('.000', 'rb').replace('Rp ', '')
    }
    return fmt(n)
  }
  const parsedAmount = parseInt(amount, 10) || 0
  const canWithdraw = withdrawEligible && balance > 0 && parsedAmount > 0 && parsedAmount <= balance
  const quickAmounts = [25000, 50000, 100000]

  // Filtered history
  const filteredHistory = useMemo(() => {
    if (filter === 'all') return history
    return history.filter(tx => tx.type === filter)
  }, [history, filter])

  const handleWithdraw = async () => {
    if (!canWithdraw || submitting) return
    setSubmitting(true)
    setMessage(null)
    try {
      await withdraw(parsedAmount, method)
      setAmount('')
      setMessage({ type: 'success', text: `${t('balance.withdrawSuccess')} ${fmt(parsedAmount)}` })
      fetchHistory()
    } catch (e) {
      setMessage({ type: 'error', text: e.message || t('balance.withdrawFailed') })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCheckIn = async () => {
    setCheckInMsg(null)
    try {
      const res = await doCheckIn()
      if (res) {
        setCheckInMsg({ type: 'success', text: `+${fmt(res.reward)} ${t('checkin.success')} ${res.newCycle ? `🎉 ${t('checkin.bonusDay7')}` : ''}` })
        fetchBalance()
      }
    } catch (e) {
      setCheckInMsg({ type: 'error', text: e.message || t('checkin.failed') })
    }
  }

  const handleLockedClick = () => {
    setLockedAlert(true)
  }

  // Buat kode hubungkan Telegram (berlaku 15 menit)
  const handleTgLink = async () => {
    setTgBusy(true)
    try {
      const res = await api.telegramLinkCode()
      setTgCode(res)
    } catch {
      setTgCode({ error: true })
    } finally {
      setTgBusy(false)
    }
  }

  // ── Top-up: kalkulasi ──
  const TU_MIN = 5000
  const TU_BONUS_MIN = 50000
  const TU_BONUS_PCT = 10
  const tuBaseNum = parseInt(tuBase, 10) || 0
  const tuBonusPct = tuBaseNum >= TU_BONUS_MIN ? TU_BONUS_PCT : 0
  const tuBonus = Math.round((tuBaseNum * tuBonusPct) / 100)
  const tuTotal = tuBaseNum > 0 ? tuBaseNum + tuBonus : 0
  const tuTemplates = [5000, 10000, 20000, 50000, 1000000]
  // Konversi IDR → ekuivalen bahasa/mata uang aktif (USD sen / CNY fen / MYR sen)
  const idrToLocale = (idr) =>
    lang === 'id' ? idr
      : lang === 'ms' ? Math.round((idr / 4370) * 100)
      : lang === 'zh' ? Math.round((idr / 17650) * 6.72 * 100)
      : Math.round((idr / 17650) * 100)
  const localeToIdr = (v) =>
    lang === 'id' ? v
      : lang === 'ms' ? Math.round((v / 100) * 4370)
      : lang === 'zh' ? Math.round((v / 100 / 6.72) * 17650)
      : Math.round((v / 100) * 17650)
  const fmtLoc = (loc) => formatCurrency(localeToIdr(loc), lang)
  const tuAssetObj = CRYPTO.assets.find((a) => a.id === tuAsset) || CRYPTO.assets[0]
  const tuCryptoAmount = tuAssetObj && tuTotal > 0 ? toCryptoAmount(tuTotal, tuAssetObj) : '0'
  const tuIdrEquiv = tuTotal // QRIS selalu IDR (merchant Indonesia)

  // Simpan draf top-up (setiap perubahan, selama nominal valid)
  useEffect(() => {
    if (!tuDraftLoaded) return
    try {
      if (tuBaseNum >= TU_MIN) {
        localStorage.setItem(TU_DRAFT_KEY, JSON.stringify({ step: tuStep, base: tuBase, method: tuMethod, asset: tuAsset, txRef: tuTxRef }))
      } else {
        localStorage.removeItem(TU_DRAFT_KEY)
      }
    } catch { /* kuota penuh → abaikan */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuDraftLoaded, tuStep, tuBase, tuMethod, tuAsset, tuTxRef, tuBaseNum])
  const tuMethodLabel = tuMethod === 'qris' ? t('balance.qris')
    : tuMethod === 'alipay' ? t('tu.alipay')
    : tuMethod === 'paygo' ? t('tu.paygo')
    : `${t('co.payCrypto') || 'Crypto'} · ${tuAssetObj?.symbol || ''}`

  // Buka halaman Top Up (tampilan berganti penuh) + muat riwayat
  const openTopup = async () => {
    setTuMsg(null)
    try { const rows = await api.topupHistory(); setTuHistory(rows) } catch { setTuHistory([]) }
    setTuView(true)
    window.scrollTo({ top: 0 })
  }

  // Tutup halaman Top Up → kembali ke dompet (draf TIDAK direset,
  // biar masuk lagi lanjut dari langkah terakhir sesuai permintaan)
  const closeTopup = () => {
    setTuView(false)
    setTuMsg(null)
    window.scrollTo({ top: 0 })
  }

  // Navigasi langkah wizard (dengan validasi minimum + arah animasi)
  const goStep = (n) => {
    if (n >= 2 && tuBaseNum < TU_MIN) {
      setTuMsg({ type: 'error', text: t('tu.minWarn').replace('{min}', formatCurrency(TU_MIN, 'id')) })
      return
    }
    setTuMsg(null)
    setTuDir(n >= tuStep ? 1 : -1)
    setTuStep(n)
  }

  const scrollWithdraw = () => setTimeout(() => document.getElementById('withdraw-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  const scrollHistory = () => {
    setShowHistory(true)
    fetchHistory()
    setTimeout(() => document.getElementById('wallet-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const submitTopup = async () => {
    setTuMsg(null)
    if (tuBaseNum < TU_MIN) { setTuMsg({ type: 'error', text: `Minimal top-up ${formatCurrency(TU_MIN, 'id')}` }); return }
    if (tuMethod === 'qris' && !tuProof) { setTuMsg({ type: 'error', text: t('tu.uploadProof') }); return }
    if (tuMethod === 'crypto' && tuTxRef.trim().length < 10) { setTuMsg({ type: 'error', text: t('tu.txRef') }); return }
    if (tuMethod !== 'qris' && tuMethod !== 'crypto' && tuTxRef.trim().length < 6) { setTuMsg({ type: 'error', text: t('tu.txRef') }); return }
    setTuBusy(true)
    try {
      const fd = new FormData()
      fd.append('baseAmount', String(tuBaseNum))
      fd.append('method', tuMethod)
      fd.append('txRef', tuTxRef.trim())
      if (tuMethod === 'crypto') {
        fd.append('asset', tuAsset)
        fd.append('payAmount', `${tuCryptoAmount} ${tuAssetObj.symbol}`)
      } else {
        fd.append('payAmount', `${formatCurrency(tuTotal, lang)} (${tuMethod.toUpperCase()})`)
      }
      if (tuProof) fd.append('proof', tuProof)
      await api.createTopup(fd)
      try { localStorage.removeItem(TU_DRAFT_KEY) } catch { /* abaikan */ }
      setTuMsg({ type: 'success', text: t('tu.sent') })
      setTuBase(''); setTuTxRef(''); setTuProof(null); if (tuFileRef.current) tuFileRef.current.value = ''
      setTuStep(1)
      const rows = await api.topupHistory(); setTuHistory(rows)
      fetchBalance()
    } catch (e) {
      setTuMsg({ type: 'error', text: e.message || t('tu.failed') })
    } finally {
      setTuBusy(false)
    }
  }

  const refresh = () => { fetchBalance(); fetchHistory(); fetchCheckInStatus() }

  if (!user) {
    return (
      <div className="container section" style={{ display: 'grid', placeItems: 'center', minHeight: '50vh', textAlign: 'center' }}>
        <div className="card" style={{ padding: 'clamp(28px, 5vw, 48px)', maxWidth: 420, textAlign: 'center' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: 999, background: 'var(--lime)', border: '1.5px solid var(--ink)', margin: '0 auto 16px' }}>
            <Wallet size={24} color="var(--ink)" />
          </span>
          <h1 className="display h-md" style={{ marginBottom: 8 }}>{t('balance.loginTitle')}</h1>
          <p className="text-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{t('balance.loginSub')}</p>
        </div>
      </div>
    )
  }

  const TU_STEPS = [
    { n: 1, label: t('tu.step1') },
    { n: 2, label: t('tu.step2') },
    { n: 3, label: t('tu.step3') },
  ]

  return (
    <div className="container section">
      {tuView && (
        <button
          onClick={closeTopup}
          className="btn-link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, padding: '6px 0', marginBottom: 12 }}
        >
          <ArrowLeft size={16} /> {t('tu.backToWallet')}
        </button>
      )}
      {!tuView && (
      <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Asterisk size={26} />
            <span className="eyebrow">{t('balance.eyebrow')}</span>
          </div>
          <h1 className="display h-lg">{t('balance.title')}</h1>
        </div>
        <button onClick={refresh} className="btn-link" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, padding: '6px 0' }}>
          <RefreshCw size={15} /> {t('balance.refresh')}
        </button>
      </div>

      {/* ============ Hero Wallet Card ============ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card balance-hero"
        style={{ padding: 'clamp(24px, 4vw, 38px)', background: 'var(--ink)', color: 'var(--bg)', borderColor: 'var(--ink)', marginBottom: 24 }}
      >
        <span className="balance-hero-deco" style={{ width: 190, height: 190, top: -80, right: -70, background: 'radial-gradient(circle, rgba(79,70,229,.45), transparent 65%)' }} />
        <span className="balance-hero-deco" style={{ width: 130, height: 130, bottom: -60, left: -45, background: 'radial-gradient(circle, rgba(197,248,42,.22), transparent 65%)' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 999, background: 'var(--lime)', border: '1.5px solid var(--bg)' }}>
              <Wallet size={20} color="var(--ink)" />
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.02em' }}>{t('balance.activeBalance')}</span>
          </div>
          <span className="chip" style={{
            fontSize: 11, fontWeight: 700, padding: '5px 10px',
            background: withdrawEligible ? 'var(--lime)' : 'rgba(255,255,255,.1)',
            color: withdrawEligible ? 'var(--ink)' : 'rgba(255,255,255,.75)',
            border: '1.5px solid ' + (withdrawEligible ? 'var(--bg)' : 'rgba(255,255,255,.25)'),
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {withdrawEligible
              ? <><Check size={11} strokeWidth={3} /> {t('balance.withdrawOpen')}</>
              : <><Lock size={11} /> {t('balance.withdrawLocked')}</>
            }
          </span>
        </div>

        <div className="display" style={{ position: 'relative', fontSize: 'clamp(2.3rem, 6vw, 3.6rem)', color: 'var(--lime)', lineHeight: 1.05, letterSpacing: '.01em' }}>
          {loaded ? fmt(balance) : <span style={{ opacity: .4 }}>•••••</span>}
        </div>
        <div style={{ position: 'relative', fontSize: 13, color: '#c9c7bd', marginTop: 8 }}>
          {t('balance.totalTx')}: <strong style={{ color: 'var(--bg)' }}>{fmt(totalSpent)}</strong>
        </div>

        {/* Aksi dompet: Top Up · Tarik · Riwayat */}
        <div className="wallet-actions">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={openTopup}
            style={{
              cursor: 'pointer', background: 'var(--lime)', color: 'var(--ink)',
              border: '1.5px solid var(--bg)', borderRadius: 999, padding: '12px 18px',
              fontSize: 13.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <Plus size={16} strokeWidth={2.8} /> {t('tu.go')}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={scrollWithdraw}
            style={{
              cursor: 'pointer', background: 'transparent', color: 'var(--bg)',
              border: '1.5px solid rgba(255,255,255,.32)', borderRadius: 999, padding: '12px 18px',
              fontSize: 13.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <ArrowUpRight size={16} /> {t('balance.withdrawBtn')}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={scrollHistory}
            style={{
              cursor: 'pointer', background: 'transparent', color: 'var(--bg)',
              border: '1.5px solid rgba(255,255,255,.32)', borderRadius: 999, padding: '12px 18px',
              fontSize: 13.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <History size={16} /> {t('balance.history')}
          </motion.button>
        </div>
      </motion.div>

      {/* ============ Check-in + Telegram (dua kartu ringkas) ============ */}
      <div className="wallet-cards">
        {/* Check-in */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card checkin-card"
          style={{ padding: 'clamp(18px, 3vw, 24px)', overflow: 'hidden', position: 'relative' }}
        >
          <span style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(197,248,42,.15), transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 13, background: canCheckIn ? 'var(--lime)' : 'var(--surface-2)', border: '1.5px solid ' + (canCheckIn ? 'var(--ink)' : 'var(--line-soft)'), flexShrink: 0, position: 'relative' }}>
              <Calendar size={19} color={canCheckIn ? 'var(--ink)' : 'var(--muted)'} />
              {canCheckIn && <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: 999, background: '#ef4444', border: '1.5px solid #fff' }} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>{t('checkin.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                {canCheckIn ? `${t('checkin.todayReward')} ${fmt(checkInReward)} ${t('checkin.todaySuffix')}` : t('checkin.done')}
              </div>
            </div>
            {checkInStreak >= checkInCycle - 1 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <Star size={11} fill="#16a34a" /> {fmtCompact(checkInBonus)}
              </span>
            )}
          </div>

          {/* Streak progress */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7, gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', letterSpacing: '.03em' }}>
                {t('checkin.day')}{checkInStreak} / {checkInCycle}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {Array.from({ length: checkInCycle }, (_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1, height: 8, borderRadius: 999,
                    background: i < checkInStreak
                      ? 'linear-gradient(135deg, var(--lime-deep), var(--lime))'
                      : i === checkInStreak && canCheckIn
                        ? 'var(--lime)' : 'var(--surface-2)',
                    border: (i === checkInStreak && canCheckIn) ? '1.5px solid var(--lime-deep)' : 'none',
                    transition: 'background .3s ease',
                    boxShadow: i < checkInStreak ? '0 0 6px rgba(197,248,42,.3)' : 'none',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              {Array.from({ length: checkInCycle }, (_, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: i === checkInCycle - 1 ? 800 : 600, color: i < checkInStreak ? 'var(--lime-deep)' : i === checkInStreak && canCheckIn ? 'var(--ink)' : 'var(--muted)', textAlign: 'center', minWidth: 20 }}>
                  {i === checkInCycle - 1 ? `🎁${fmtCompact(checkInBonus)}` : `+${fmtCompact(checkInReward)}`}
                </span>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {checkInMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                style={{ fontSize: 12, fontWeight: 700, marginTop: 10, color: checkInMsg.type === 'success' ? '#16a34a' : '#dc2626' }}
              >
                {checkInMsg.text}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: canCheckIn ? 0.96 : 1 }}
            onClick={handleCheckIn}
            disabled={!canCheckIn}
            style={{
              cursor: canCheckIn ? 'pointer' : 'default', marginTop: 14, width: '100%',
              background: canCheckIn ? 'var(--ink)' : 'var(--surface-2)',
              color: canCheckIn ? 'var(--lime)' : 'var(--muted)',
              border: '1.5px solid ' + (canCheckIn ? 'var(--ink)' : 'var(--line-soft)'),
              borderRadius: 999, padding: '11px 20px', fontSize: 13.5, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'background .15s ease, color .15s ease',
            }}
          >
            <Gift size={16} />
            {canCheckIn ? t('checkin.claim') : t('checkin.tomorrow')}
          </motion.button>
        </motion.div>

        {/* Telegram */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ padding: 'clamp(18px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 13, background: tgLinked ? 'var(--lime)' : 'var(--surface-2)', border: '1.5px solid ' + (tgLinked ? 'var(--ink)' : 'var(--line-soft)'), flexShrink: 0 }}>
              <Send size={18} color={tgLinked ? 'var(--ink)' : 'var(--muted)'} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>
                {tgLinked ? t('tg.linked') : t('tg.link')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                {tgLinked ? t('tg.synced') : t('tg.expired')}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {!tgLinked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', width: '100%' }}>
                {tgCode && !tgCode.error && (
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', letterSpacing: '.04em' }}>{t('tg.codeIs')}</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 22, letterSpacing: '.18em' }}>{tgCode.code}</div>
                  </div>
                )}
                {tgCode && !tgCode.error
                  ? (
                    <a
                      href={`https://t.me/${tgCode.botUsername || 'EvolusiAI_StoreBot'}`}
                      target="_blank" rel="noreferrer"
                      className="pill pill-indigo"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 18px', fontSize: 13, fontWeight: 800, flex: 1, minWidth: 150 }}
                    >
                      <ExternalLink size={15} /> {t('tg.openBot')}
                    </a>
                  )
                  : (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={handleTgLink}
                      disabled={tgBusy}
                      style={{
                        cursor: tgBusy ? 'wait' : 'pointer', flex: 1, minWidth: 150,
                        background: 'var(--ink)', color: 'var(--lime)', border: '1.5px solid var(--ink)',
                        borderRadius: 999, padding: '11px 20px', fontSize: 13, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: tgBusy ? 0.6 : 1,
                      }}
                    >
                      <Send size={15} /> {t('tg.link')}
                    </motion.button>
                  )}
              </div>
            )}
            {tgLinked && (
              <div className="text-muted" style={{ fontSize: 12.5 }}>
                {t('tg.synced')}
              </div>
            )}
          </div>
        </motion.div>
      </div>
      </>
      )}

      <div className={'balance-grid' + (tuView ? ' balance-grid-solo' : '')}>
        {/* ============ Top Up — Wizard 3 Langkah (mode halaman) ============ */}
        {tuView && (
        <motion.div
          id="topup-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="card"
          style={{ padding: 'clamp(18px, 3vw, 26px)', scrollMarginTop: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 13, background: 'var(--lime)', border: '1.5px solid var(--ink)', flexShrink: 0 }}>
              <Wallet size={19} color="var(--ink)" />
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{t('tu.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                {t('tu.subtitle').replace('{min}', '')}
              </div>
            </div>
          </div>

          {/* Stepper */}
          <div className="tu-steps" role="tablist" aria-label="Top-up steps">
            {TU_STEPS.map((s, i) => (
              <Fragment key={s.n}>
                {i > 0 && <div className={'tu-step-line' + (tuStep > s.n ? ' done' : '')} />}
                <button
                  type="button" role="tab" aria-selected={tuStep === s.n}
                  className={'tu-step' + (tuStep === s.n ? ' active' : tuStep > s.n ? ' done' : '')}
                  onClick={() => goStep(s.n)}
                >
                  <span className="tu-step-dot">{tuStep > s.n ? <Check size={15} strokeWidth={3} /> : s.n}</span>
                  <span className="tu-step-label">{s.label}</span>
                </button>
              </Fragment>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tuStep}
              initial={{ opacity: 0, x: tuDir * 26, scale: 0.995 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: tuDir * -26, scale: 0.995 }}
              transition={{ duration: 0.22, ease: [0.3, 0.9, 0.35, 1] }}
            >
              {/* ── LANGKAH 1: Nominal ── */}
              {tuStep === 1 && (
                <div>
                  <label className="field-label">{t('tu.amount')}</label>
                  <div className="tu-templates">
                    {tuTemplates.map((tplIdr) => {
                      const loc = idrToLocale(tplIdr)
                      const active = tuBaseNum === tplIdr
                      const hasBonus = tplIdr >= TU_BONUS_MIN
                      return (
                        <button
                          key={tplIdr}
                          onClick={() => setTuBase(String(tplIdr))}
                          style={{
                            cursor: 'pointer', borderRadius: 12, padding: '10px 8px', fontSize: 13, fontWeight: 800,
                            background: active ? 'var(--indigo)' : 'var(--surface-2)',
                            color: active ? '#fff' : 'var(--ink)',
                            border: '1.5px solid ' + (active ? 'var(--indigo)' : 'var(--line-soft)'),
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'background .15s ease, color .15s ease',
                          }}
                        >
                          <span>{fmtLoc(loc)}</span>
                          {hasBonus && <span style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--lime)', color: 'var(--ink)', borderRadius: 999, padding: '2px 7px', border: '1px solid var(--ink)' }}>+10%</span>}
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{t('tu.custom')}</div>
                  <div className="input-ic">
                    <span style={{ fontWeight: 700, fontSize: 15, paddingLeft: 12 }}>{CURRENCY[lang]?.symbol || 'Rp'}</span>
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder={lang === 'id' ? 'Contoh: 25000' : 'e.g. 25000'}
                      value={lang === 'id' ? tuBase : (tuBaseNum > 0 ? idrToLocale(tuBaseNum) : '')}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 0
                        setTuBase(v > 0 ? String(localeToIdr(v)) : '')
                      }}
                      style={{ paddingLeft: 4 }}
                    />
                  </div>
                  {tuBaseNum > 0 && tuBaseNum < TU_MIN && (
                    <div style={{ color: '#dc2626', fontWeight: 700, fontSize: 12.5, marginTop: 6 }}>
                      {t('tu.minWarn').replace('{min}', formatCurrency(TU_MIN, 'id'))}
                    </div>
                  )}

                  {/* Ringkasan bonus */}
                  {tuBaseNum >= TU_MIN && (
                    <div style={{
                      marginTop: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--surface-2)',
                      border: '1.5px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{t('tu.amount')}: <b style={{ color: 'var(--ink)' }}>{formatCurrency(tuBaseNum, 'id')}</b></span>
                      {tuBonusPct > 0 && (
                        <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 800 }}>
                          {t('tu.bonus')} +{tuBonusPct}%: +{formatCurrency(tuBonus, 'id')}
                        </span>
                      )}
                      <span style={{ fontSize: 13.5, fontWeight: 800 }}>
                        {t('tu.total')}: <span style={{ color: 'var(--indigo)' }}>{formatCurrency(tuTotal, 'id')}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── LANGKAH 2: Pembayaran ── */}
              {tuStep === 2 && (
                <div>
                  <div className="tu-step2-head">
                    <label className="field-label" style={{ marginBottom: 0 }}>{t('tu.method')}</label>
                    <span className="tu-total-chip">{formatCurrency(tuTotal, 'id')}</span>
                  </div>
                  <div className="tu-methods">
                    {[['qris', t('balance.qris'), QrCode], ['alipay', t('tu.alipay'), Wallet], ['paygo', t('tu.paygo'), CreditCard], ['crypto', t('co.payCrypto') || 'Crypto', Coins]].map(([m, label, Icon]) => (
                      <button
                        key={m}
                        onClick={() => setTuMethod(m)}
                        style={{
                          cursor: 'pointer', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                          padding: '10px 8px', borderRadius: 12, fontWeight: 700, fontSize: 12.5,
                          background: tuMethod === m ? 'var(--ink)' : 'var(--surface-2)',
                          color: tuMethod === m ? '#fff' : 'var(--ink)',
                          border: '1.5px solid ' + (tuMethod === m ? 'var(--ink)' : 'var(--line-soft)'),
                          transition: 'background .15s ease, color .15s ease',
                        }}
                      >
                        <Icon size={18} /> {label}
                      </button>
                    ))}
                  </div>

                  {/* Detail per metode — QRIS langsung terlihat tanpa scroll */}
                  <div className="tu-side">
                    {tuMethod === 'qris' && tuTotal >= TU_MIN && (
                      <div className="tu-qris">
                        <QRCodeSVG value={QRIS.buildPayload(tuIdrEquiv)} size={150} level="M" bgColor="#ffffff" fgColor="#2b2b28" style={{ width: '100%', height: 'auto' }} />
                        <span className="display" style={{ fontSize: 12.5, color: '#2b2b28' }}>{QRIS.merchant}</span>
                        <span style={{ fontSize: 13, color: '#2b2b28', fontWeight: 800 }}>{formatCurrency(tuTotal, 'id')}</span>
                        <span style={{ fontSize: 10.5, color: '#6b6b66', textAlign: 'center', lineHeight: 1.45 }}>{t('tu.qrisNote')}</span>
                      </div>
                    )}
                    {tuMethod === 'alipay' && (
                      <div className="text-muted" style={{ fontSize: 12.5, padding: '2px 4px' }}>
                        Alipay: bayar ke merchant <b>EvolusiAi Store</b> sebesar <b>{formatCurrency(tuTotal, 'id')}</b>, lalu isi nomor referensi di langkah berikutnya.
                      </div>
                    )}
                    {tuMethod === 'paygo' && (
                      <div className="text-muted" style={{ fontSize: 12.5, padding: '2px 4px' }}>
                        Pay&Go: bayar sebesar <b>{formatCurrency(tuTotal, 'id')}</b>, lalu isi nomor referensi di langkah berikutnya.
                      </div>
                    )}
                    {tuMethod === 'crypto' && tuTotal >= TU_MIN && (
                      <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1.5px solid var(--line-soft)' }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        {CRYPTO.assets.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setTuAsset(a.id)}
                            style={{
                              cursor: 'pointer', borderRadius: 999, padding: '6px 13px', fontSize: 12.5, fontWeight: 800,
                              background: tuAsset === a.id ? 'var(--indigo)' : 'transparent', color: tuAsset === a.id ? '#fff' : 'var(--ink)',
                              border: '1.5px solid ' + (tuAsset === a.id ? 'var(--indigo)' : 'var(--line-soft)'),
                            }}
                          >{a.label}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{CRYPTO.network}</div>
                      <div style={{
                        fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', marginTop: 6,
                        padding: '9px 11px', background: 'var(--bg)', borderRadius: 9, border: '1.5px solid var(--line-soft)',
                      }}>{tuAssetObj?.address}</div>
                      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800 }}>
                        {tuCryptoAmount} {tuAssetObj?.symbol}
                        <span className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}> ≈ {formatCurrency(tuTotal, 'id')}</span>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── LANGKAH 3: Konfirmasi ── */}
              {tuStep === 3 && (
                <div>
                  <label className="field-label">{t('tu.review')}</label>
                  <div className="tu-review" style={{ marginTop: 8 }}>
                    <div className="tu-review-row">
                      <span style={{ color: 'var(--ink-soft)' }}>{t('tu.amount')}</span>
                      <b>{formatCurrency(tuBaseNum, 'id')}</b>
                    </div>
                    {tuBonusPct > 0 && (
                      <div className="tu-review-row">
                        <span style={{ color: 'var(--ink-soft)' }}>{t('tu.bonus')} +{tuBonusPct}%</span>
                        <b style={{ color: '#16a34a' }}>+{formatCurrency(tuBonus, 'id')}</b>
                      </div>
                    )}
                    <div className="tu-review-row" style={{ borderTop: '1.5px solid var(--line-soft)', paddingTop: 9 }}>
                      <span style={{ color: 'var(--ink-soft)' }}>{t('tu.total')}</span>
                      <b style={{ color: 'var(--indigo)', fontSize: 15 }}>{formatCurrency(tuTotal, 'id')}</b>
                    </div>
                    <div className="tu-review-row">
                      <span style={{ color: 'var(--ink-soft)' }}>{t('tu.method')}</span>
                      <b>{tuMethodLabel}</b>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--muted)', margin: '12px 0 0' }}>{t('tu.reviewHint')}</div>

                  {tuMethod !== 'qris' ? (
                    <div style={{ marginTop: 10 }}>
                      <label className="field-label">{t('tu.txRef')}</label>
                      <input
                        className="input"
                        type="text"
                        value={tuTxRef}
                        onChange={(e) => setTuTxRef(e.target.value)}
                        placeholder={tuMethod === 'crypto' ? '0xabc123...' : (lang === 'id' ? 'Contoh: 20260911xxxx' : 'e.g. 20260911xxxx')}
                      />
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <label className="field-label">{t('tu.uploadProof')}</label>
                      <input
                        ref={tuFileRef}
                        className="input"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setTuProof(e.target.files?.[0] || null)}
                      />
                    </div>
                  )}

                  {/* Riwayat top-up */}
                  {Array.isArray(tuHistory) && tuHistory.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '.04em', color: 'var(--ink-soft)', marginBottom: 8 }}>{t('tu.history')}</div>
                      {tuHistory.slice(0, 5).map((r) => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1.5px solid var(--line-soft)', fontSize: 13, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id}</span>
                          <span style={{ fontWeight: 700 }}>{formatCurrency(r.amount, 'id')}{r.bonusPct > 0 ? ` (+${r.bonusPct}%)` : ''}</span>
                          <span style={{ fontWeight: 700, color: r.status === 'APPROVED' ? '#16a34a' : r.status === 'REJECTED' ? '#dc2626' : '#b45309' }}>
                            {r.status === 'APPROVED' ? t('tu.approved') : r.status === 'REJECTED' ? t('tu.rejected') : t('tu.pending')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {tuMsg && (
            <div style={{
              padding: 10, borderRadius: 10, marginTop: 12, fontSize: 13.5,
              background: tuMsg.type === 'success' ? 'rgba(37,211,102,.1)' : 'rgba(255,77,77,.1)',
              color: tuMsg.type === 'success' ? '#16a34a' : '#dc2626',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {tuMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />} {tuMsg.text}
            </div>
          )}

          {/* Navigasi wizard */}
          <div className="tu-nav">
            {tuStep > 1 && (
              <button
                type="button"
                onClick={() => goStep(tuStep - 1)}
                style={{
                  cursor: 'pointer', flexShrink: 0, background: 'var(--surface-2)', color: 'var(--ink)',
                  border: '1.5px solid var(--line-soft)', borderRadius: 999, padding: '12px 20px',
                  fontSize: 13.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {t('tu.back')}
              </button>
            )}
            {tuStep < 3 ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => goStep(tuStep + 1)}
                disabled={tuStep === 1 && tuBaseNum < TU_MIN}
                style={{
                  cursor: tuStep === 1 && tuBaseNum < TU_MIN ? 'not-allowed' : 'pointer', flex: 1,
                  background: tuStep === 1 && tuBaseNum < TU_MIN ? 'var(--surface-2)' : 'var(--ink)',
                  color: tuStep === 1 && tuBaseNum < TU_MIN ? 'var(--muted)' : 'var(--lime)',
                  border: '1.5px solid ' + (tuStep === 1 && tuBaseNum < TU_MIN ? 'var(--line-soft)' : 'var(--ink)'),
                  borderRadius: 999, padding: '12px 20px', fontSize: 14, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                {t('tu.next')} <ArrowRight size={16} />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={submitTopup}
                disabled={tuBusy || tuBaseNum < TU_MIN}
                style={{
                  cursor: tuBusy || tuBaseNum < TU_MIN ? 'not-allowed' : 'pointer', flex: 1,
                  background: tuBaseNum >= TU_MIN ? 'var(--ink)' : 'var(--surface-2)',
                  color: tuBaseNum >= TU_MIN ? 'var(--lime)' : 'var(--muted)',
                  border: '1.5px solid ' + (tuBaseNum >= TU_MIN ? 'var(--ink)' : 'var(--line-soft)'),
                  borderRadius: 999, padding: '12px 20px', fontSize: 14, fontWeight: 800, opacity: tuBusy ? 0.6 : 1,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                {tuBusy ? t('tu.sending') : `${t('tu.go')} · ${formatCurrency(tuTotal, 'id')}`}
                <ArrowRight size={16} />
              </motion.button>
            )}
          </div>
        </motion.div>
        )}

        {!tuView && (
        <motion.div
          id="withdraw-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="card"
          style={{ padding: 'clamp(22px, 3vw, 30px)', scrollMarginTop: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <h3 className="display" style={{ fontSize: 19, display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: 'var(--indigo)', color: '#fff' }}>
                <ArrowUpRight size={16} strokeWidth={2.6} />
              </span>
              {t('balance.withdrawTitle')}
            </h3>

            {/* Tombol Tarik Saldo — selalu di kanan */}
            {withdrawEligible && balance > 0 ? (
              <motion.button
                whileTap={{ scale: canWithdraw ? 0.97 : 1 }}
                onClick={handleWithdraw}
                disabled={!canWithdraw || submitting}
                className="pill pill-indigo"
                style={{
                  justifyContent: 'center', padding: '10px 24px', fontSize: 14, fontWeight: 800,
                  opacity: canWithdraw ? 1 : 0.5, flexShrink: 0,
                }}
              >
                {submitting ? t('balance.processing') : `${t('balance.withdrawBtn')} ${parsedAmount > 0 ? fmt(parsedAmount) : ''}`}
                <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleLockedClick}
                className="pill pill-indigo"
                style={{
                  justifyContent: 'center', padding: '10px 24px', fontSize: 14, fontWeight: 800,
                  opacity: withdrawEligible && balance <= 0 ? 0.5 : 1, flexShrink: 0,
                  background: 'var(--surface-2)', color: 'var(--muted)', borderColor: 'var(--line-soft)',
                }}
              >
                <Lock size={14} style={{ marginRight: 5 }} />
                {t('balance.withdrawLockedBtn')}
              </motion.button>
            )}
          </div>

          {/* Locked alert — muncul di atas saat tombol terkunci diklik */}
          <AnimatePresence>
            {lockedAlert && !withdrawEligible && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 14 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  padding: '12px 16px', borderRadius: 10, fontSize: 13,
                  background: 'rgba(255,193,7,.12)', color: '#b45309',
                  border: '1px solid rgba(255,193,7,.3)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Info size={15} style={{ flexShrink: 0 }} />
                  {t('balance.withdrawLockedAlert')} {fmt(minWithdraw)}{t('balance.withdrawLockedAlertSuffix')}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Konten form withdraw — hanya tampil jika eligible & punya saldo */}
          {withdrawEligible && balance > 0 && loaded ? (
            <div style={{ marginTop: 16 }}>
              <label className="field-label">{t('balance.amount')}</label>
              <div style={{ display: 'flex', gap: 7, margin: '8px 0 12px', flexWrap: 'wrap' }}>
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(String(q))}
                    style={{
                      cursor: 'pointer', borderRadius: 999, padding: '6px 13px', fontSize: 12.5, fontWeight: 700,
                      background: parsedAmount === q ? 'var(--indigo)' : 'var(--surface-2)',
                      color: parsedAmount === q ? '#fff' : 'var(--ink)',
                      border: '1.5px solid ' + (parsedAmount === q ? 'var(--indigo)' : 'var(--line-soft)'),
                      transition: 'background .15s ease, color .15s ease',
                    }}
                  >
                    {fmtCompact(q)}
                  </button>
                ))}
                <button
                  onClick={() => setAmount(String(balance))}
                  style={{
                    cursor: 'pointer', borderRadius: 999, padding: '6px 13px', fontSize: 12.5, fontWeight: 700,
                    background: parsedAmount === balance ? 'var(--indigo)' : 'var(--surface-2)',
                    color: parsedAmount === balance ? '#fff' : 'var(--ink)',
                    border: '1.5px solid ' + (parsedAmount === balance ? 'var(--indigo)' : 'var(--line-soft)'),
                    transition: 'background .15s ease, color .15s ease',
                  }}
                >
                  {t('balance.max')}
                </button>
              </div>

              <div className="input-ic">
                <span style={{ fontWeight: 700, fontSize: 15, paddingLeft: 12 }}>{CURRENCY[lang]?.symbol || 'Rp'}</span>
                <input
                  className="input"
                  type="number"
                  placeholder="Contoh: 100000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1000}
                  max={balance}
                  style={{ paddingLeft: 4 }}
                />
              </div>
              <div style={{ fontSize: 12, marginTop: 6, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <span className="text-muted">{t('balance.available')}: <strong style={{ color: 'var(--ink)' }}>{fmt(balance)}</strong></span>
                {parsedAmount > balance && (
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>{t('balance.exceedsBalance')}</span>
                )}
              </div>

              <label className="field-label" style={{ marginTop: 16 }}>{t('balance.method')}</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 18 }}>
                {[['qris', t('balance.qris'), QrCode], ['bank_transfer', t('balance.bank'), Landmark]].map(([m, label, Icon]) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    style={{
                      cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '11px 12px', borderRadius: 12, fontWeight: 700, fontSize: 13.5,
                      background: method === m ? 'var(--ink)' : 'var(--surface-2)',
                      color: method === m ? '#fff' : 'var(--ink)',
                      border: '1.5px solid ' + (method === m ? 'var(--ink)' : 'var(--line-soft)'),
                      transition: 'background .15s ease, color .15s ease',
                    }}
                  >
                    <Icon size={17} /> {label}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    style={{
                      padding: 10, borderRadius: 10, marginBottom: 14, fontSize: 13.5,
                      background: message.type === 'success' ? 'rgba(37,211,102,.1)' : 'rgba(255,77,77,.1)',
                      color: message.type === 'success' ? '#16a34a' : '#dc2626',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : loaded && balance <= 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--muted)', marginTop: 16 }}>
              <DollarSign size={36} />
              <p style={{ marginTop: 12, fontSize: 14 }}>{t('balance.emptyBalance')}</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>{t('balance.emptyHint')}</p>
            </div>
          ) : !loaded ? (
            <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--muted)', marginTop: 16 }}>
              <DollarSign size={36} />
              <p style={{ marginTop: 12, fontSize: 14 }}>{t('balance.loading')}</p>
            </div>
          ) : null}
        </motion.div>
        )}
      </div>

      {!tuView && (
      <>
      {/* ============ Info: cara kerja ============ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="card"
        style={{ marginTop: 24, padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}
      >
        <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 11, background: 'var(--surface-2)', flexShrink: 0 }}>
          <Info size={18} color="var(--indigo)" />
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>{t('balance.howWorks')}</div>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {[
              { n: '1', tk: 'balance.step1t', dk: 'balance.step1d' },
              { n: '2', tk: 'balance.step2t', dk: 'balance.step2d' },
              { n: '3', tk: 'balance.step3t', dk: 'balance.step3d' },
            ].map((s) => (
              <div key={s.n} style={{ display: 'flex', gap: 10 }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 999, background: 'var(--lime)', border: '1.5px solid var(--ink)', fontSize: 11.5, fontWeight: 800, flexShrink: 0 }}>
                  {s.n}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t(s.tk)}</div>
                  <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 2 }}>
                    {s.n === '3' ? `${t(s.dk)} ${fmt(minWithdraw)}.` : t(s.dk)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      </>
      )}

      {!tuView && (
      <>
      {/* ============ History ============ */}
      <div id="wallet-history" style={{ marginTop: 36, scrollMarginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory() }}
            className="btn-link"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}
          >
            <History size={18} />
            {t('balance.history')}
            <span style={{ transform: showHistory ? 'rotate(180deg)' : '', transition: '.2s' }}>▾</span>
          </button>
          {showHistory && filteredHistory.length > 0 && (
            <span className="chip" style={{ fontSize: 11.5 }}>{filteredHistory.length} transaksi</span>
          )}
        </div>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              {/* Filter chips */}
              <div style={{ display: 'flex', gap: 6, margin: '14px 0 10px', flexWrap: 'wrap' }}>
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    style={{
                      cursor: 'pointer', borderRadius: 999, padding: '5px 13px', fontSize: 12, fontWeight: 700,
                      background: filter === opt.value ? 'var(--ink)' : 'var(--surface-2)',
                      color: filter === opt.value ? 'var(--lime)' : 'var(--ink-soft)',
                      border: '1.5px solid ' + (filter === opt.value ? 'var(--ink)' : 'var(--line-soft)'),
                      transition: 'background .15s ease, color .15s ease',
                    }}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 10, paddingBottom: 4 }}>
                {filteredHistory.length === 0 && (
                  <div className="card" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                    <History size={30} style={{ margin: '0 auto 10px', opacity: .5 }} />
                    <p style={{ fontSize: 14 }}>{filter === 'all' ? t('balance.noHistory') : t('balance.noFilterResult')}</p>
                    <p style={{ fontSize: 12.5, marginTop: 4 }}>{t('balance.noHistoryHint')}</p>
                  </div>
                )}
                {filteredHistory.map((tx, i) => {
                  const meta = txMeta[tx.type] || { labelKey: 'tx.transaction', icon: DollarSign }
                  const Icon = meta.icon
                  const isIn = tx.type === 'refund' || tx.type === 'checkin'
                  const badgeBg = isIn ? 'rgba(37,211,102,.14)' : 'rgba(79,70,229,.1)'
                  const badgeColor = isIn ? '#16a34a' : 'var(--indigo)'
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="card"
                      style={{
                        padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        gap: 12, flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 11, background: badgeBg, color: badgeColor, flexShrink: 0 }}>
                          <Icon size={17} />
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{t(meta.labelKey)}</div>
                          <div className="text-muted" style={{ fontSize: 12, marginTop: 1 }}>{tx.note}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: isIn ? '#16a34a' : 'var(--ink)' }}>
                          {isIn ? '+' : '−'}{fmt(Math.abs(tx.amount))}
                        </span>
                        <span className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={10} />
                          {new Date(tx.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </>
      )}
    </div>
  )
}
