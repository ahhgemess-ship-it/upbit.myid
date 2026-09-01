import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Zap, BadgeCheck, Headphones, ArrowUpRight, Flame, Clock } from 'lucide-react'
import Hero from '../components/Hero.jsx'
import Marquee from '../components/Marquee.jsx'
import ProductCard from '../components/ProductCard.jsx'
import FlashSaleCard from '../components/FlashSaleCard.jsx'
import Countdown from '../components/Countdown.jsx'
import Asterisk from '../components/Asterisk.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import { flashFrom, getSaleEndTime } from '../data/products.js'

export default function Home() {
  const { products } = useCatalog()
  const { t } = useLang()
  const saleEnd = getSaleEndTime()
  // Flash sale baca dari katalog DB (via CatalogContext) — edit produk Promo
  // di admin panel langsung tampil. Fallback awal = katalog statis.
  const flashList = flashFrom(products)
  const flashItems = flashList.slice(0, 6)
  const maxDiscount = flashList.length ? Math.max(...flashList.map((p) => p.discount)) : 0
  const benefits = [
    { icon: Zap, title: t('home.benefit1Title'), desc: t('home.benefit1Desc') },
    { icon: ShieldCheck, title: t('home.benefit2Title'), desc: t('home.benefit2Desc') },
    { icon: BadgeCheck, title: t('home.benefit3Title'), desc: t('home.benefit3Desc') },
    { icon: Headphones, title: t('home.benefit4Title'), desc: t('home.benefit4Desc') },
  ]
  const featured = products.slice(0, 6)

  return (
    <div>
      <Hero />

      <div style={{ marginTop: 30 }}>
        <Marquee />
      </div>

      {/* Banner privasi akun */}
      <section className="container" style={{ paddingTop: 32 }}>
        <motion.div
          className="private-banner"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <span className="pb-ic"><ShieldCheck size={18} strokeWidth={2.4} /></span>
          {t('acct.tag')}
        </motion.div>
      </section>

      {/* Flash Sale Section */}
      <section className="container section" style={{ paddingTop: 48 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ background: 'var(--ink)', border: '1.5px solid var(--ink)', borderRadius: 28, padding: 'clamp(24px, 4vw, 44px)', position: 'relative', overflow: 'hidden' }}
        >
          {/* Decorative */}
          <div style={{ position: 'absolute', top: 24, right: 28, opacity: 0.8 }} className="float">
            <Asterisk size={36} color="var(--lime)" spin />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 999, background: 'var(--lime)', border: '1.5px solid var(--bg)' }}>
                  <Flame size={17} fill="var(--ink)" color="var(--ink)" />
                </span>
                <span className="chip chip-lime" style={{ fontSize: 11 }}>{t('nav.flashSale')}</span>
              </div>
              <h2 className="display" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: 'var(--bg)', maxWidth: 520 }}>
                {t('flash.gridTitle')}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#c9c7bd', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={14} /> {t('flash.endsIn')}
              </span>
              <Countdown target={saleEnd} light />
              <Link to="/flash-sale" className="btn-link" style={{ color: 'var(--lime)', borderColor: 'var(--lime)', fontSize: 13.5, whiteSpace: 'nowrap' }}>
                {t('flash.viewAll')} <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>

          {/* Stats mini */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 26 }}>
            <span style={{ color: '#c9c7bd', fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: 'var(--lime)', fontSize: 18, fontWeight: 800 }}>{flashList.length}</span> {t('flash.statProducts')}
            </span>
            <span style={{ color: '#c9c7bd', fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: 'var(--lime)', fontSize: 18, fontWeight: 800 }}>{maxDiscount}%</span> {t('flash.statMaxDisc')}
            </span>
          </div>

          {/* Product grid */}
          <div className="product-grid">
            {flashItems.map((p, i) => (
              <FlashSaleCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* Telegram Bot Banner */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{
              background: 'linear-gradient(135deg, #24A1DE 0%, #1B92D1 100%)',
              border: '2px solid var(--ink)',
              borderRadius: 24,
              padding: 'clamp(22px, 4vw, 36px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 20,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative circles */}
            <div style={{ position: 'absolute', right: -20, top: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: 60, bottom: -60, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, flex: '1 1 280px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'rgba(255,255,255,0.18)', color: '#fff',
                fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 999,
                letterSpacing: 0.4, marginBottom: 14,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.87 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z"/></svg>
                {t('home.telegramBadge')}
              </span>
              <h3 style={{ fontSize: 'clamp(1.15rem, 2.5vw, 1.5rem)', fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: -0.3 }}>
                {t('home.telegramTitle')}
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14.5, lineHeight: 1.55, maxWidth: 440 }}>
                {t('home.telegramText')}
              </p>
            </div>

            <a
              href="https://t.me/upbitstorebot"
              target="_blank"
              rel="noopener noreferrer"
              className="pill"
              style={{
                position: 'relative', zIndex: 1,
                background: '#fff', borderColor: 'var(--ink)',
                color: '#24A1DE', fontWeight: 700,
                padding: '12px 22px', fontSize: 15,
                whiteSpace: 'nowrap',
              }}
            >
              {t('home.telegramCta')}
              <span className="pill-ic" style={{ background: '#24A1DE', color: '#fff' }}>
                <ArrowUpRight size={16} strokeWidth={2.6} />
              </span>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="card"
                style={{ padding: 22 }}
              >
                <span style={{
                  display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: 12,
                  background: 'var(--surface-2)', border: '1.5px solid var(--ink)', marginBottom: 16,
                }}>
                  <b.icon size={22} strokeWidth={2.1} />
                </span>
                <h3 className="display" style={{ fontSize: 17 }}>{b.title}</h3>
                <p className="text-muted" style={{ fontSize: 14, marginTop: 7, lineHeight: 1.5 }}>{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            gap: 20, marginBottom: 30, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Asterisk size={28} />
                <span className="eyebrow">{t('home.featuredEyebrow')}</span>
              </div>
              <h2 className="display h-lg" style={{ maxWidth: 520 }}>{t('home.featuredTitle')}</h2>
            </div>
            <Link to="/store" className="btn-link">{t('home.viewAll')} <ArrowUpRight size={18} /></Link>
          </div>

          <div className="product-grid">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{
              background: 'var(--indigo)', border: '1.5px solid var(--ink)', borderRadius: 28,
              padding: 'clamp(32px, 5vw, 60px)', position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', right: 30, top: 30, opacity: .9 }} className="float">
              <Asterisk size={40} color="var(--lime)" spin />
            </div>
            <span className="chip chip-lime">{t('home.ctaBadge')}</span>
            <h2 className="display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: '#fff', maxWidth: 640, marginTop: 18 }}>
              {t('home.ctaTitle')}
            </h2>
            <p style={{ color: '#dcdafa', fontSize: 16, maxWidth: 520, marginTop: 14, lineHeight: 1.6 }}>
              {t('home.ctaText')}
            </p>
            <Link to="/store" className="pill" style={{ marginTop: 26, background: 'var(--lime)', borderColor: 'var(--ink)' }}>
              {t('home.ctaBtn')}
              <span className="pill-ic" style={{ background: 'var(--ink)', color: 'var(--lime)' }}>
                <ArrowUpRight size={16} strokeWidth={2.6} />
              </span>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
