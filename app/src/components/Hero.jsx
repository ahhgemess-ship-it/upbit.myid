import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import Asterisk, { Sparkle } from './Asterisk.jsx'
import { useLang } from '../context/LanguageContext.jsx'

// Foto maskot di bawah judul utama (menggantikan kotak logo produk).
// Urutan diselang-seling: krem → hijau → peach → hijau → peach.
const MASCOTS = [
  { src: '/mascots/duo.webp', alt: 'Maskot Claude dan OpenAI' },
  { src: '/mascots/openai-girl.webp', alt: 'Maskot OpenAI' },
  { src: '/mascots/claude-girl.webp', alt: 'Maskot Claude' },
  { src: '/mascots/openai-boy.webp', alt: 'Maskot OpenAI' },
  { src: '/mascots/claude-boy.webp', alt: 'Maskot Claude' },
]

const fade = (d = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: d },
})

export default function Hero() {
  const { t } = useLang()
  return (
    <section style={{ position: 'relative', overflow: 'hidden', paddingTop: 40, paddingBottom: 20 }}>
      {/* dekorasi */}
      <div style={{ position: 'absolute', top: 80, right: 60 }} className="float">
        <Sparkle size={30} />
      </div>

      <div className="container hero-inner">
        <div className="hero-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <Asterisk size={42} spin />
          <span className="eyebrow">{t('hero.eyebrow')}</span>
        </div>

        <motion.h1 {...fade(0.05)} className="display h-xl hero-title" style={{ maxWidth: 920 }}>
          {t('hero.titleA')}{' '}
          <span style={{
            display: 'inline-grid', placeItems: 'center', width: 64, height: 38,
            background: 'var(--lime)', borderRadius: 999, border: '1.5px solid var(--ink)',
            verticalAlign: 'middle',
          }}>
            <ArrowRight size={22} strokeWidth={2.6} />
          </span>{' '}
          {t('hero.titleB')}
        </motion.h1>

        <motion.div
          {...fade(0.12)}
          className="hero-actions"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, marginTop: 30 }}
        >
          <div className="stat-row" style={{ display: 'flex', gap: 30 }}>
            <Stat value="3K+" label={t('hero.statCustomers')} />
            <Stat value="2K+" label={t('hero.statTransactions')} />
            <Stat value="4.9" label={t('hero.statRating')} />
          </div>
          <div className="hero-cta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/store" className="pill pill-indigo">
              {t('hero.shopNow')}
              <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
            </Link>
            <Link to="/about" className="pill">{t('hero.howToOrder')}</Link>
          </div>
        </motion.div>

        {/* showcase row — foto maskot (desktop grid, scroll-snap mobile) */}
        <div className="hero-showcase">
          {MASCOTS.map((m, i) => (
            <motion.div
              key={m.src}
              className={`hero-showcase-cell ${i % 2 === 1 ? 'is-tall' : ''}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
            >
              <div
                className="hero-showcase-card"
                style={{ padding: 0, overflow: 'hidden', background: 'var(--surface-2)' }}
              >
                <img
                  src={m.src}
                  alt={m.alt}
                  loading={i > 1 ? 'lazy' : undefined}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="display" style={{ fontSize: 26 }}>{value}</div>
      <div className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
    </div>
  )
}
