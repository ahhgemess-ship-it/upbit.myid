import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const campaigns = [
  {
    image: '/promotions/gemini-ultra.png',
    mobileImage: '/promotions/gemini-ultra-mobile.png',
    eyebrow: 'PRIVATE ACCESS',
    title: 'Gemini Ultra',
    offer: '6 Bulan Private',
    note: 'Akses premium untuk kebutuhan AI intensif.',
    tone: 'violet',
  },
  {
    image: '/promotions/gemini-pro.png',
    mobileImage: '/promotions/gemini-pro-mobile.png',
    eyebrow: 'LONG-TERM VALUE',
    title: 'Gemini',
    offer: '18 Bulan Pro',
    note: 'Durasi panjang, akses lebih leluasa.',
    tone: 'green',
  },
  {
    image: '/promotions/chatgpt-plus.png',
    mobileImage: '/promotions/chatgpt-plus-mobile.png',
    eyebrow: 'LIMITED CAMPAIGN',
    title: 'ChatGPT Plus',
    offer: '1 Bulan · Diskon up to 90%',
    note: 'Harga spesial selama campaign berlangsung.',
    tone: 'coral',
  },
]

export default function PromotionCarousel() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const campaign = campaigns[active]

  useEffect(() => {
    if (paused) return undefined
    const timer = window.setInterval(() => setActive((i) => (i + 1) % campaigns.length), 5200)
    return () => window.clearInterval(timer)
  }, [paused])

  const move = (delta) => setActive((i) => (i + delta + campaigns.length) % campaigns.length)

  return (
    <section className="container promotion-section" aria-label="Campaign promosi Upbit Store">
      <div
        className={`promotion-carousel promotion-${campaign.tone}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={campaign.image}
            className="promotion-slide"
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <picture className="promotion-art" aria-hidden="true">
              <source media="(max-width: 640px)" srcSet={campaign.mobileImage} />
              <img src={campaign.image} alt="" />
            </picture>
            <Link
              to="/store"
              className="promotion-link"
              aria-label={`Lihat promo ${campaign.title}, ${campaign.offer}`}
            />
          </motion.div>
        </AnimatePresence>

        <button type="button" className="promotion-arrow promotion-prev" onClick={() => move(-1)} aria-label="Promo sebelumnya">
          <ChevronLeft size={20} />
        </button>
        <button type="button" className="promotion-arrow promotion-next" onClick={() => move(1)} aria-label="Promo berikutnya">
          <ChevronRight size={20} />
        </button>
        <div className="promotion-dots" role="tablist" aria-label="Pilih promo">
          {campaigns.map((item, i) => (
            <button key={item.title + item.offer} type="button" role="tab" aria-selected={active === i} aria-label={`Promo ${i + 1}`} className={active === i ? 'is-active' : ''} onClick={() => setActive(i)} />
          ))}
        </div>
      </div>
    </section>
  )
}
