import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Lock, LogIn, ShoppingBag, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import Asterisk from './Asterisk.jsx'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'

const INITIAL_SHOW = 3

function Stars({ value, onChange, size = 26, readOnly = false }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => !readOnly && setHover(n)}
            onMouseLeave={() => !readOnly && setHover(0)}
            style={{ cursor: readOnly ? 'default' : 'pointer', lineHeight: 0, padding: readOnly ? 0 : 2 }}
            aria-label={`${n} bintang`}
          >
            <Star
              size={size}
              fill={active ? 'var(--lime-deep)' : 'none'}
              stroke="var(--ink)"
              strokeWidth={1.6}
            />
          </button>
        )
      })}
    </div>
  )
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function ReviewSection({ product }) {
  const { user } = useAuth()
  const { t } = useLang()

  const [reviews, setReviews] = useState([])
  const [purchased, setPurchased] = useState(false)
  const [existing, setExisting] = useState(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const loadReviews = useCallback(() => {
    api.reviews(product.id).then((d) => setReviews(d.reviews)).catch(() => setReviews([]))
  }, [product.id])

  useEffect(() => { loadReviews() }, [loadReviews])

  useEffect(() => {
    if (!user) { setPurchased(false); setExisting(null); return }
    let on = true
    api.reviewEligibility(product.id)
      .then((d) => {
        if (!on) return
        setPurchased(d.purchased)
        setExisting(d.review)
        if (d.review) { setRating(d.review.rating); setComment(d.review.comment || '') }
      })
      .catch(() => {})
    return () => { on = false }
  }, [user, product.id])

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : product.rating

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (rating < 1) return setError(t('rev.pickStars'))
    try {
      await api.submitReview(product.id, rating, comment)
      setExisting({ rating, comment })
      setSaved(true)
      loadReviews()
      setTimeout(() => setSaved(false), 1800)
    } catch (err) {
      setError(err.message || t('rev.submitFail'))
    }
  }

  return (
    <div style={{ marginTop: 70 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Asterisk size={26} />
        <h2 className="display h-md">{t('rev.title')}</h2>
      </div>

      {/* ringkasan rating */}
      <div className="review-summary">
        <div>
          <span className="display" style={{ fontSize: 44, lineHeight: 1 }}>{avg}</span>
          <span className="text-muted" style={{ fontSize: 16 }}> / 5</span>
        </div>
        <div>
          <Stars value={Math.round(avg)} readOnly size={20} />
          <div className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>
            {reviews.length > 0
              ? `${reviews.length} ${t('rev.count')}`
              : t('rev.none')}
          </div>
        </div>
      </div>

      {/* area form / lock */}
      <div className="review-box">
        {!user ? (
          // BELUM LOGIN
          <div className="review-locked">
            <span className="review-lock-ic"><LogIn size={22} /></span>
            <div style={{ flex: 1 }}>
              <h3 className="display" style={{ fontSize: 17 }}>{t('rev.loginTitle')}</h3>
              <p className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
                {t('rev.loginText')}
              </p>
            </div>
            <Link to="/login" state={{ from: `/product/${product.id}` }} className="pill pill-indigo" style={{ flexShrink: 0 }}>
              {t('nav.login')}
            </Link>
          </div>
        ) : !purchased ? (
          // LOGIN TAPI BELUM BELI → WARNING
          <div className="review-locked review-warning">
            <span className="review-lock-ic" style={{ background: 'var(--lime)' }}><Lock size={20} /></span>
            <div style={{ flex: 1 }}>
              <h3 className="display" style={{ fontSize: 17 }}>{t('rev.buyTitle')}</h3>
              <p style={{ fontSize: 14, marginTop: 4, color: 'var(--ink-soft)' }}>
                {t('rev.buyText')}
              </p>
            </div>
            <Link to={`/product/${product.id}`} className="pill" style={{ flexShrink: 0, gap: 8 }}>
              <ShoppingBag size={16} /> {t('rev.buyFirst')}
            </Link>
          </div>
        ) : (
          // LOGIN + SUDAH BELI → FORM
          <form onSubmit={handleSubmit} className="review-form">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="chip chip-lime" style={{ fontSize: 11 }}>{t('rev.verifiedBuyer')}</span>
              {existing && <span className="text-muted" style={{ fontSize: 12.5 }}>{t('rev.updatable')}</span>}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="eyebrow" style={{ display: 'block', marginBottom: 10 }}>{t('rev.giveRating')}</label>
              <Stars value={rating} onChange={setRating} />
            </div>
            <textarea
              className="input"
              rows={3}
              placeholder={t('rev.commentPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ resize: 'vertical', marginBottom: 14 }}
            />
            <AnimatePresence>
              {error && (
                <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginBottom: 14 }}>
                  <AlertCircle size={16} /> {error}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button whileTap={{ scale: 0.97 }} type="submit" className="pill pill-indigo">
              {saved ? <><Check size={18} strokeWidth={2.6} /> {t('rev.saved')}</> : (existing ? t('rev.update') : t('rev.submit'))}
            </motion.button>
          </form>
        )}
      </div>

      {/* daftar ulasan */}
      {reviews.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            {(showAll ? reviews : reviews.slice(0, INITIAL_SHOW)).map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: (i % 4) * 0.05 }}
                className="card"
                style={{ padding: 18 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {r.avatar ? (
                      <img
                        className="avatar"
                        src={r.avatar}
                        alt={r.name}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                        style={{ objectFit: 'cover', padding: 0 }}
                      />
                    ) : (
                      <span className="avatar" style={{ background: 'var(--ink)' }}>
                        {r.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.name}</div>
                      <span className="chip chip-lime" style={{ fontSize: 10, padding: '2px 7px', marginTop: 3 }}>{t('rev.verified')}</span>
                    </div>
                  </div>
                  <Stars value={r.rating} readOnly size={16} />
                </div>
                {r.comment && <p style={{ fontSize: 14.5, lineHeight: 1.55, marginTop: 12, color: 'var(--ink-soft)' }}>{r.comment}</p>}
                <div className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>{fmtDate(r.date)}</div>
              </motion.div>
            ))}
          </div>

          {/* Load More button */}
          {reviews.length > INITIAL_SHOW && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAll((v) => !v)}
              className="pill"
              style={{
                marginTop: 18, width: '100%', justifyContent: 'center',
                padding: '12px 20px', fontSize: 14, fontWeight: 600,
                background: 'var(--surface)', borderColor: 'var(--line-soft)',
              }}
            >
              {showAll ? (
                <><ChevronUp size={18} /> {t('rev.showLess')}</>
              ) : (
                <><ChevronDown size={18} /> {t('rev.showAll')} ({reviews.length})</>
              )}
            </motion.button>
          )}
        </div>
      )}
    </div>
  )
}
