import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowUpRight, ShoppingCart, Mail, Wallet, Clock,
  AlertTriangle, UserCog, QrCode, MessageCircle,
} from 'lucide-react'
import Asterisk from '../components/Asterisk.jsx'
import { useLang } from '../context/LanguageContext.jsx'

export default function About() {
  const { t } = useLang()
  const steps = [
    { icon: ShoppingCart, title: t('about.step1Title'), desc: t('about.step1Desc') },
    { icon: Mail, title: t('about.step2Title'), desc: t('about.step2Desc') },
    { icon: QrCode, title: t('about.step3Title'), desc: t('about.step3Desc') },
    { icon: Clock, title: t('about.step4Title'), desc: t('about.step4Desc') },
  ]
  const warnings = [
    { icon: Mail, text: t('about.w1') },
    { icon: Clock, text: t('about.w2') },
    { icon: UserCog, text: t('about.w3') },
    { icon: Wallet, text: t('about.w4') },
    { icon: QrCode, text: t('about.w5') },
  ]
  const faqs = [
    [t('about.q1'), t('about.a1')],
    [t('about.q2'), t('about.a2')],
    [t('about.q3'), t('about.a3')],
    [t('about.q4'), t('about.a4')],
  ]
  return (
    <div className="container section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Asterisk size={30} spin />
        <span className="eyebrow">{t('about.eyebrow2')}</span>
      </div>
      <h1 className="display h-lg" style={{ maxWidth: 680 }}>
        {t('about.h1')}
      </h1>
      <p className="text-muted" style={{ fontSize: 16, maxWidth: 560, marginTop: 16, lineHeight: 1.6 }}>
        {t('about.introReal')}
      </p>

      {/* steps */}
      <div className="step-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, marginTop: 46 }}>
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className="card"
            style={{ padding: 26, position: 'relative' }}
          >
            <span className="display" style={{ position: 'absolute', top: 18, right: 22, fontSize: 40, color: 'var(--line-soft)' }}>
              0{i + 1}
            </span>
            <span style={{ display: 'grid', placeItems: 'center', width: 50, height: 50, borderRadius: 13, background: 'var(--indigo)', border: '1.5px solid var(--ink)', marginBottom: 18 }}>
              <s.icon size={24} color="#fff" strokeWidth={2.1} />
            </span>
            <h3 className="display" style={{ fontSize: 19 }}>{s.title}</h3>
            <p className="text-muted" style={{ fontSize: 14.5, marginTop: 8, lineHeight: 1.55 }}>{s.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* WARNING — biar user tidak bingung saat order */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="warn-card"
      >
        <div className="warn-head">
          <span className="warn-head-ic"><AlertTriangle size={20} strokeWidth={2.3} /></span>
          <div>
            <h2 className="display" style={{ fontSize: 20 }}>{t('about.warnTitle')}</h2>
            <p className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>
              {t('about.warnSub')}
            </p>
          </div>
        </div>
        <ul className="warn-list">
          {warnings.map((w, i) => (
            <li key={i} className="warn-item">
              <span className="warn-item-ic"><w.icon size={16} /></span>
              <span>{w.text}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* faq */}
      <div style={{ marginTop: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Asterisk size={26} />
          <h2 className="display h-md">{t('about.faqTitle')}</h2>
        </div>
        <div className="split-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {faqs.map(([q, a], i) => (
            <motion.div
              key={q}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 2) * 0.08 }}
              className="card"
              style={{ padding: 22 }}
            >
              <h3 className="display" style={{ fontSize: 16 }}>{q}</h3>
              <p className="text-muted" style={{ fontSize: 14.5, marginTop: 8, lineHeight: 1.55 }}>{a}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* kontak WA */}
      <div style={{ marginTop: 50, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
          <MessageCircle size={22} color="var(--lime)" strokeWidth={2.2} />
          <h2 className="display" style={{ fontSize: 20 }}>Pusat Bantuan</h2>
        </div>
        <p className="text-muted" style={{ fontSize: 14.5, maxWidth: 480, margin: '0 auto 22px', lineHeight: 1.6 }}>
          Butuh bantuan? Hubungi CS kami lewat WhatsApp atau Telegram. Tim kami siap membantu kamu!
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="https://wa.me/6283849870242"
            target="_blank"
            rel="noopener noreferrer"
            className="pill"
            style={{
              background: '#25D366', borderColor: '#25D366', color: '#fff',
              fontSize: 16, padding: '12px 28px', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            0838-4998-70242
          </a>
          <a
            href="https://t.me/evolusi_store"
            target="_blank"
            rel="noopener noreferrer"
            className="pill"
            style={{
              background: '#1d93d2', borderColor: '#1d93d2', color: '#fff',
              fontSize: 16, padding: '12px 28px', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            @evolusi_store
          </a>
        </div>
      </div>

      {/* cta */}
      <div className="card" style={{ marginTop: 50, padding: 'clamp(28px, 4vw, 44px)', background: 'var(--ink)', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="display" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: 'var(--bg)', maxWidth: 460 }}>
          {t('about.ctaH')}
        </h2>
        <Link to="/store" className="pill" style={{ background: 'var(--lime)', borderColor: 'var(--ink)' }}>
          {t('about.ctaBtn')}
          <span className="pill-ic" style={{ background: 'var(--ink)', color: 'var(--lime)' }}><ArrowUpRight size={16} strokeWidth={2.6} /></span>
        </Link>
      </div>
    </div>
  )
}
