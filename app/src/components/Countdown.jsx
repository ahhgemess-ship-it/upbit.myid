import { useState, useEffect } from 'react'
import { useLang } from '../context/LanguageContext.jsx'

// Hitung mundur ke `target` (Date). Menampilkan jam:menit:detik.
function diff(target) {
  const ms = Math.max(0, target.getTime() - Date.now())
  const totalSec = Math.floor(ms / 1000)
  return {
    h: Math.floor(totalSec / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
    done: ms === 0,
  }
}

const pad = (n) => String(n).padStart(2, '0')

export default function Countdown({ target, light = false }) {
  const { t: tr } = useLang()
  const [t, setT] = useState(() => diff(target))

  useEffect(() => {
    const id = setInterval(() => setT(diff(target)), 1000)
    return () => clearInterval(id)
  }, [target])

  const ink = light ? 'var(--bg)' : 'var(--ink)'
  const box = light ? 'rgba(255,255,255,.12)' : 'var(--ink)'
  const boxInk = light ? 'var(--bg)' : '#fff'

  const Unit = ({ value, label }) => (
    <div style={{ textAlign: 'center' }}>
      <div
        className="display"
        style={{
          fontSize: 'clamp(1.4rem, 5vw, 2rem)', minWidth: 'clamp(46px, 13vw, 64px)',
          padding: '10px 8px', borderRadius: 14, background: box, color: boxInk,
          border: light ? 'none' : '1.5px solid var(--ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {pad(value)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: ink, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }} role="timer" aria-label="Sisa waktu flash sale">
      <Unit value={t.h} label={tr('flash.hours')} />
      <span className="display" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', color: ink, paddingTop: 8 }}>:</span>
      <Unit value={t.m} label={tr('flash.minutes')} />
      <span className="display" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', color: ink, paddingTop: 8 }}>:</span>
      <Unit value={t.s} label={tr('flash.seconds')} />
    </div>
  )
}
