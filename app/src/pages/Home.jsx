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
import { flashSale, getSaleEndTime } from '../data/products.js'

export default function Home() {
  const { products } = useCatalog()
  const { t } = useLang()
  const saleEnd = getSaleEndTime()
  const flashItems = flashSale.slice(0, 6)
  const maxDiscount = Math.max(...flashSale.map((p) => p.discount))
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
              <span style={{ color: 'var(--lime)', fontSize: 18, fontWeight: 800 }}>{flashSale.length}</span> {t('flash.statProducts')}
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
