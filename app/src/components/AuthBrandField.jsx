import { motion } from 'framer-motion'

// Logo brand AI yang melayang di panel kiri halaman login (background gelap).
// Memakai logo putih monokrom + kotak warna brand. Tanpa gradient/emoji.
// Posisi dijaga di zona kosong (kanan & atas) agar tidak menimpa teks/ikon fitur.
const BRANDS = [
  { src: '/logos/claude-white.png',   bg: '#d97757', size: 54, top: '9%',  left: '70%', d: 0.0, dur: 5.2 },
  { src: '/logos/openai-white.png',   bg: '#10a37f', size: 48, top: '20%', left: '88%', d: 0.4, dur: 6.0 },
  { src: '/logos/gemini-white.png',   bg: '#1f6feb', size: 46, top: '40%', left: '83%', d: 0.8, dur: 5.6 },
  { src: '/logos/deepseek-white.png', bg: '#4d6bfe', size: 52, top: '64%', left: '86%', d: 0.2, dur: 6.4 },
  { src: '/logos/kiro-white.png',     bg: '#7c3aed', size: 44, top: '82%', left: '74%', d: 0.6, dur: 5.0 },
  { src: '/logos/leonardo-white.png', bg: '#2b2b28', size: 40, top: '88%', left: '90%', d: 1.0, dur: 6.8 },
]

export default function AuthBrandField() {
  return (
    <div className="auth-brand-field" aria-hidden="true">
      {BRANDS.map((b, i) => (
        <motion.span
          key={b.src}
          className="auth-brand-badge"
          style={{ top: b.top, left: b.left, width: b.size, height: b.size, background: b.bg }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 0.82, scale: 1, y: [0, -12, 0] }}
          transition={{
            opacity: { delay: 0.3 + i * 0.12, duration: 0.5 },
            scale: { delay: 0.3 + i * 0.12, type: 'spring', stiffness: 200, damping: 12 },
            y: { delay: b.d, duration: b.dur, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <img src={b.src} alt="" style={{ width: '54%', height: '54%', objectFit: 'contain' }} />
        </motion.span>
      ))}
    </div>
  )
}
