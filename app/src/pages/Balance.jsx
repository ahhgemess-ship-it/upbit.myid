import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, ArrowUpRight, Clock, AlertCircle, Check, History,
  QrCode, Landmark, RefreshCw, ShoppingBag, Banknote, Lock, Info, DollarSign,
  Calendar, Gift, Star, Send, ExternalLink, Plus, CreditCard, Coins,
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
  // ── Top-up saldo ──
  const [topupOpen, setTopupOpen] = useState(false)
  const [tuBase, setTuBase] = useState('')        // nominal dasar (string input)
  const [tuMethod, setTuMethod] = useState('qris')
  const [tuAsset, setTuAsset] = useState(CRYPTO.assets[0]?.id || 'bnb')
  const [tuTxRef, setTuTxRef] = useState('')      // tx hash / no. referensi
  const [tuProof, setTuProof] = useState(null)    // file bukti (QRIS)
  const [tuBusy, setTuBusy] = useState(false)
  const [tuMsg, setTuMsg] = useState(null)
  const [tuHistory, setTuHistory] = useState(null)
  const tuFileRef = useRef(null)

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

  const openTopup = async () => {
    setTopupOpen(true)
    setTuMsg(null)
    try { const rows = await api.topupHistory(); setTuHistory(rows) } catch { setTuHistory([]) }
    // Mobile: gulir ke kartu top-up supaya formnya langsung terlihat
    setTimeout(() => document.getElementById('topup-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const submitTopup = async () => {
    setTuMsg(null)
    if (tuBaseNum < TU_MIN) { setTuMsg({ type: 'error', text: `Minimal top-up ${formatCurrency(TU_MIN, 'id')}` }); return }
    if (tuMethod === 'qris' && !tuProof) { setTuMsg({ type: 'error', text: 'Upload bukti transfer dulu ya' }); return }
    if (tuMethod === 'crypto' && tuTxRef.trim().length < 10) { setTuMsg({ type: 'error', text: 'Tx Hash tidak valid' }); return }
    if (tuMethod !== 'qris' && tuMethod !== 'crypto' && tuTxRef.trim().length < 6) { setTuMsg({ type: 'error', text: 'Isi nomor referensi pembayaran' }); return }
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
      setTuMsg({ type: 'success', text: t('tu.sent') })
      setTuBase(''); setTuTxRef(''); setTuProof(null); if (tuFileRef.current) tuFileRef.current.value = ''
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

  return (
    <div className="container section">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Asterisk size={28} />
        <span className="eyebrow">{t('balance.eyebrow')}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <h1 className="display h-lg">{t('balance.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* Top Up: tombol pintasan selalu terlihat (mobile termasuk) */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => (topupOpen ? setTopupOpen(false) : openTopup())}
            style={{
              cursor: 'pointer', background: 'var(--lime)', color: 'var(--ink)',
              border: '1.5px solid var(--ink)', borderRadius: 999, padding: '9px 18px',
              fontSize: 13.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            <Wallet size={15} /> {t('tu.go')}
          </motion.button>
          <button onClick={refresh} className="btn-link" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, padding: '6px 0' }}>
            <RefreshCw size={15} /> {t('balance.refresh')}
          </button>
        </div>
      </div>

      {/* ============ Check-in Card ============ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card checkin-card"
        style={{ marginBottom: 24, padding: 'clamp(18px, 3vw, 26px)', overflow: 'hidden', position: 'relative' }}
      >
        <span style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(197,248,42,.15), transparent 70%)', pointerEvents: 'none' }} />
        <span style={{ position: 'absolute', bottom: -20, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,.12), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 13, background: canCheckIn ? 'var(--lime)' : 'var(--surface-2)', border: '1.5px solid ' + (canCheckIn ? 'var(--ink)' : 'var(--line-soft)'), flexShrink: 0, position: 'relative' }}>
              <Calendar size={20} color={canCheckIn ? 'var(--ink)' : 'var(--muted)'} />
              {canCheckIn && <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: 999, background: '#ef4444', border: '1.5px solid #fff' }} />}
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '.01em' }}>{t('checkin.title')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                {canCheckIn ? `${t('checkin.todayReward')} ${fmt(checkInReward)} ${t('checkin.todaySuffix')}` : t('checkin.done')}
              </div>
            </div>
          </div>

          {/* Streak progress */}
          <div style={{ flex: 1, minWidth: 180, maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7, gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', letterSpacing: '.03em' }}>
                {t('checkin.day')}{checkInStreak} / {checkInCycle}
              </span>
              {checkInStreak >= checkInCycle - 1 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star size={11} fill="#16a34a" /> {t('checkin.tomorrowBonus')} {fmt(checkInBonus)}!
                </span>
              )}
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

          {/* Button */}
          <div style={{ flexShrink: 0 }}>
            <AnimatePresence>
              {checkInMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: checkInMsg.type === 'success' ? '#16a34a' : '#dc2626', textAlign: 'right' }}
                >
                  {checkInMsg.text}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              whileTap={{ scale: canCheckIn ? 0.95 : 1 }}
              onClick={handleCheckIn}
              disabled={!canCheckIn}
              style={{
                cursor: canCheckIn ? 'pointer' : 'default',
                background: canCheckIn ? 'var(--ink)' : 'var(--surface-2)',
                color: canCheckIn ? 'var(--lime)' : 'var(--muted)',
                border: '1.5px solid ' + (canCheckIn ? 'var(--ink)' : 'var(--line-soft)'),
                borderRadius: 999, padding: '10px 22px', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: 7, transition: 'background .15s ease, color .15s ease',
              }}
            >
              <Gift size={16} />
              {canCheckIn ? t('checkin.claim') : t('checkin.tomorrow')}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ============ Telegram Link Card ============ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ marginBottom: 24, padding: 'clamp(16px, 2.5vw, 22px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 13, background: tgLinked ? 'var(--lime)' : 'var(--surface-2)', border: '1.5px solid ' + (tgLinked ? 'var(--ink)' : 'var(--line-soft)'), flexShrink: 0 }}>
            <Send size={19} color={tgLinked ? 'var(--ink)' : 'var(--muted)'} />
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>
              {tgLinked ? t('tg.linked') : t('tg.link')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
              {tgLinked ? t('tg.synced') : t('tg.expired')}
            </div>
          </div>
        </div>

        {!tgLinked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {tgCode && !tgCode.error && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', letterSpacing: '.04em' }}>{t('tg.codeIs')}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 20, letterSpacing: '.18em' }}>{tgCode.code}</div>
              </div>
            )}
            {tgCode && !tgCode.error
              ? (
                <a
                  href={`https://t.me/${tgCode.botUsername || 'EvolusiAI_StoreBot'}`}
                  target="_blank" rel="noreferrer"
                  className="pill pill-indigo"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', fontSize: 13.5, fontWeight: 800 }}
                >
                  <ExternalLink size={15} /> {t('tg.openBot')}
                </a>
              )
              : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleTgLink}
                  disabled={tgBusy}
                  style={{
                    cursor: tgBusy ? 'wait' : 'pointer',
                    background: 'var(--ink)', color: 'var(--lime)', border: '1.5px solid var(--ink)',
                    borderRadius: 999, padding: '10px 20px', fontSize: 13.5, fontWeight: 800,
                    display: 'flex', alignItems: 'center', gap: 7, opacity: tgBusy ? 0.6 : 1,
                  }}
                >
                  <Send size={15} /> {t('tg.link')}
                </motion.button>
              )}
          </div>
        )}
      </motion.div>

      {/* ============ Top Up Card ============ */}
      <motion.div
        id="topup-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ marginBottom: 24, padding: 'clamp(18px, 3vw, 26px)', scrollMarginTop: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 13, background: 'var(--lime)', border: '1.5px solid var(--ink)', flexShrink: 0 }}>
              <Wallet size={20} color="var(--ink)" />
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{t('tu.title')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                {t('tu.subtitle').replace('{min}', '')}
              </div>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => (topupOpen ? setTopupOpen(false) : openTopup())}
            style={{
              cursor: 'pointer', background: topupOpen ? 'var(--surface-2)' : 'var(--ink)', color: topupOpen ? 'var(--ink)' : 'var(--lime)',
              border: '1.5px solid var(--ink)', borderRadius: 999, padding: '10px 20px', fontSize: 13.5, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            <Plus size={15} style={{ transform: topupOpen ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }} /> {t('tu.go')}
          </motion.button>
        </div>

        <AnimatePresence>
          {topupOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingTop: 20 }}>
                {/* Template nominal (dalam mata uang aktif) */}
                <label className="field-label">{t('tu.amount')}</label>
                <div style={{ display: 'flex', gap: 7, margin: '8px 0 10px', flexWrap: 'wrap' }}>
                  {tuTemplates.map((tplIdr) => {
                    const loc = idrToLocale(tplIdr)
                    const active = tuBaseNum === tplIdr
                    const hasBonus = tplIdr >= TU_BONUS_MIN
                    return (
                      <button
                        key={tplIdr}
                        onClick={() => setTuBase(String(localeToIdr(loc)))}
                        style={{
                          cursor: 'pointer', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 800,
                          background: active ? 'var(--indigo)' : 'var(--surface-2)',
                          color: active ? '#fff' : 'var(--ink)',
                          border: '1.5px solid ' + (active ? 'var(--indigo)' : 'var(--line-soft)'),
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        {fmtLoc(loc)}
                        {hasBonus && <span style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--lime)', color: 'var(--ink)', borderRadius: 999, padding: '2px 6px', border: '1px solid var(--ink)' }}>{'+10%'}</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Input manual (mata uang aktif) */}
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{t('tu.custom')}</div>
                <div className="input-ic">
                  <span style={{ fontWeight: 700, fontSize: 15, paddingLeft: 12 }}>{CURRENCY[lang]?.symbol || 'Rp'}</span>
                  <input
                    className="input"
                    type="number"
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

                {/* Metode pembayaran */}
                <label className="field-label" style={{ marginTop: 16 }}>{t('tu.method')}</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {[['qris', t('balance.qris'), QrCode], ['alipay', t('tu.alipay'), Wallet], ['paygo', t('tu.paygo'), CreditCard], ['crypto', t('co.payCrypto') || 'Crypto', Coins]].map(([m, label, Icon]) => (
                    <button
                      key={m}
                      onClick={() => setTuMethod(m)}
                      style={{
                        cursor: 'pointer', flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '11px 12px', borderRadius: 12, fontWeight: 700, fontSize: 13,
                        background: tuMethod === m ? 'var(--ink)' : 'var(--surface-2)',
                        color: tuMethod === m ? '#fff' : 'var(--ink)',
                        border: '1.5px solid ' + (tuMethod === m ? 'var(--ink)' : 'var(--line-soft)'),
                      }}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>

                {/* Detail per metode */}
                {tuMethod === 'qris' && tuTotal >= TU_MIN && (
                  <div style={{ marginTop: 14, display: 'grid', placeItems: 'center', gap: 8, padding: 16, background: '#fff', borderRadius: 14, border: '1.5px solid var(--line-soft)' }}>
                    <QRCodeSVG value={QRIS.buildPayload(tuIdrEquiv)} size={170} level="M" bgColor="#ffffff" fgColor="#2b2b28" />
                    <span className="display" style={{ fontSize: 14, color: '#2b2b28' }}>{QRIS.merchant}</span>
                    <span style={{ fontSize: 12.5, color: '#2b2b28', fontWeight: 700 }}>{formatCurrency(tuTotal, 'id')}</span>
                    <span style={{ fontSize: 11.5, color: '#6b6b66', textAlign: 'center' }}>{t('tu.qrisNote')}</span>
                  </div>
                )}
                {tuMethod === 'alipay' && (
                  <div className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                    Alipay: bayar ke merchant <b>Vercelex Community</b> sebesar <b>{formatCurrency(tuTotal, 'id')}</b>, lalu isi nomor referensi di bawah.
                  </div>
                )}
                {tuMethod === 'paygo' && (
                  <div className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                    Pay&Go: bayar sebesar <b>{formatCurrency(tuTotal, 'id')}</b>, lalu isi nomor referensi di bawah.
                  </div>
                )}
                {tuMethod === 'crypto' && tuTotal >= TU_MIN && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1.5px solid var(--line-soft)' }}>
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

                {/* Referensi / bukti */}
                {tuMethod !== 'qris' ? (
                  <div style={{ marginTop: 14 }}>
                    <label className="field-label">{t('tu.txRef')}</label>
                    <input
                      className="input"
                      type="text"
                      value={tuTxRef}
                      onChange={(e) => setTuTxRef(e.target.value)}
                      placeholder={tuMethod === 'crypto' ? '0xabc123...' : 'Contoh: 20260911xxxx'}
                    />
                  </div>
                ) : (
                  <div style={{ marginTop: 14 }}>
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

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={submitTopup}
                  disabled={tuBusy || tuBaseNum < TU_MIN}
                  style={{
                    cursor: tuBusy || tuBaseNum < TU_MIN ? 'not-allowed' : 'pointer',
                    marginTop: 16, width: '100%', background: tuBaseNum >= TU_MIN ? 'var(--ink)' : 'var(--surface-2)',
                    color: tuBaseNum >= TU_MIN ? 'var(--lime)' : 'var(--muted)', border: '1.5px solid var(--ink)',
                    borderRadius: 999, padding: '13px 20px', fontSize: 14.5, fontWeight: 800, opacity: tuBusy ? 0.6 : 1,
                  }}
                >
                  {tuBusy ? '…' : `${t('tu.go')} ${tuTotal >= TU_MIN ? formatCurrency(tuTotal, 'id') : ''}`}
                </motion.button>

                {/* Riwayat top-up */}
                {Array.isArray(tuHistory) && tuHistory.length > 0 && (
                  <div style={{ marginTop: 20 }}>
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="balance-grid">
        {/* ============ Hero balance card ============ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="card balance-hero"
          style={{ padding: 'clamp(26px, 4vw, 38px)', background: 'var(--ink)', color: 'var(--bg)', borderColor: 'var(--ink)' }}
        >
          <span className="balance-hero-deco" style={{ width: 190, height: 190, top: -80, right: -70, background: 'radial-gradient(circle, rgba(79,70,229,.45), transparent 65%)' }} />
          <span className="balance-hero-deco" style={{ width: 130, height: 130, bottom: -60, left: -45, background: 'radial-gradient(circle, rgba(197,248,42,.22), transparent 65%)' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
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

          <div className="display" style={{ position: 'relative', fontSize: 'clamp(2.2rem, 5.5vw, 3.4rem)', color: 'var(--lime)', lineHeight: 1.05, letterSpacing: '.01em' }}>
            {loaded ? fmt(balance) : <span style={{ opacity: .4 }}>•••••</span>}
          </div>
          <div style={{ position: 'relative', fontSize: 13, color: '#c9c7bd', marginTop: 8 }}>
            {t('balance.totalTx')}: <strong style={{ color: 'var(--bg)' }}>{fmt(totalSpent)}</strong>
          </div>
        </motion.div>

        {/* ============ Withdraw card (simplified) ============ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="card"
          style={{ padding: 'clamp(22px, 3vw, 30px)' }}
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
      </div>

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

      {/* ============ History ============ */}
      <div style={{ marginTop: 36 }}>
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
    </div>
  )
}
