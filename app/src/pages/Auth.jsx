import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ShieldCheck, Zap, BadgeCheck } from 'lucide-react'
import Asterisk from '../components/Asterisk.jsx'
import GoogleButton from '../components/GoogleButton.jsx'
import AuthMascot from '../components/AuthMascot.jsx'
import AuthBrandField from '../components/AuthBrandField.jsx'
import { useLang } from '../context/LanguageContext.jsx'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/'
  const { t } = useLang()

  const [error, setError] = useState('')

  const onGoogleDone = () => navigate(redirectTo, { replace: true })

  return (
    <div className="auth-wrap">
      {/* Left brand panel */}
      <aside className="auth-aside">
        {/* logo brand AI melayang di latar */}
        <AuthBrandField />
        <div style={{ position: 'absolute', top: 40, right: 40 }} className="float">
          <Asterisk size={40} color="var(--lime)" spin />
        </div>

        <Link to="/" aria-label="EvolusiAI" style={{ position: 'relative', zIndex: 2 }}>
          <img src="/logo-white.png" alt="EvolusiAI" className="brand-logo" style={{ height: 44 }} />
        </Link>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <span className="chip chip-lime" style={{ fontSize: 11 }}>{t('auth.premiumBadge')}</span>
          <h2 className="display" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'var(--bg)', lineHeight: 1.05, marginTop: 16 }}>
            {t('auth.welcome')}
          </h2>
          <p style={{ color: '#b7b6ad', fontSize: 14.5, marginTop: 12, maxWidth: 360, lineHeight: 1.6 }}>
            {t('auth.subtitle')}
          </p>

          <ul style={{ display: 'grid', gap: 14, marginTop: 26 }}>
            {[[ShieldCheck, t('auth.feature1')], [Zap, t('auth.feature2')], [BadgeCheck, t('auth.feature3')]].map(([Ic, label]) => (
              <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#d3d1c8', fontSize: 15 }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 999, background: '#3a3a34', border: '1.5px solid #55554d' }}>
                  <Ic size={17} color="var(--lime)" />
                </span>
                {label}
              </li>
            ))}
          </ul>

          {/* baris logo brand terpercaya */}
          <div className="auth-trust-row">
            <span style={{ color: '#86857c', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600 }}>{t('auth.trustedBy')}</span>
            <div className="auth-trust-logos">
              {['claude-white', 'openai-white', 'gemini-white', 'deepseek-white', 'kiro-white'].map((l) => (
                <span key={l} className="auth-trust-logo"><img src={`/logos/${l}.png`} alt="" /></span>
              ))}
            </div>
          </div>
        </div>

        <span style={{ color: '#86857c', fontSize: 13, position: 'relative', zIndex: 2 }}>© 2026 EvolusiAI</span>
      </aside>

      {/* Right panel — Google login only */}
      <div className="auth-panel">
        {/* motif dekoratif */}
        <span className="auth-deco auth-deco-1 float"><Asterisk size={28} color="var(--indigo)" /></span>
        <span className="auth-deco auth-deco-2 float"><Asterisk size={20} color="var(--lime-deep)" spin /></span>
        <span className="auth-deco-ring" aria-hidden="true" />

        <div className="auth-card-wrap">
          <AuthMascot />
          <motion.div
            className="auth-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
          <div className="auth-head" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Asterisk size={24} />
            <span className="eyebrow">{t('auth.signInAccount')}</span>
          </div>
          <h1 className="display auth-title" style={{ fontSize: 'clamp(1.7rem, 3.4vw, 2.3rem)' }}>
            {t('auth.signIn')}
          </h1>
          <p className="text-muted auth-sub" style={{ fontSize: 14.5, marginTop: 8 }}>
            {t('auth.signInSubtitle')}
          </p>

          {error && (
            <motion.div className="auth-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 20 }}>
              <AlertCircle size={17} /> {error}
            </motion.div>
          )}

          <div style={{ marginTop: 30 }}>
            <GoogleButton onDone={onGoogleDone} onError={setError} />
          </div>

          <p className="text-muted" style={{ fontSize: 12.5, marginTop: 28, lineHeight: 1.5, textAlign: 'center' }}>
            {t('auth.terms')}
          </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
