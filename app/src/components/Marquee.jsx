const BRANDS = [
  { name: 'Gemini', src: '/logos/gemini-color.svg', chip: '#ffffff' },
  { name: 'Claude', src: '/logos/claude-white.png', chip: '#D97757' },
  { name: 'Kiro', src: '/logos/kiro-white.png', chip: '#23262D' },
  { name: 'OpenAI', src: '/logos/openai-white.png', chip: '#1C1C1E' },
  { name: 'Higgsfield', src: '/logos/higgsfield-white.png', chip: '#111214' },
  { name: 'Spotify', src: '/logos/spotify-black.svg', chip: '#1ED760' },
  { name: 'Viu', src: '/logos/viu-color.svg', chip: '#1A1A1A', wide: true },
  { name: 'Netflix', src: '/logos/netflix-white.svg', chip: '#E50914' },
  { name: 'Duolingo', src: '/logos/duolingo-white.svg', chip: '#58CC02' },
  { name: 'DeepSeek', src: '/logos/deepseek-color.svg', chip: '#ffffff' },
  { name: 'Leonardo AI', src: '/logos/leonardo-white.png', chip: '#1E2126' },
  { name: 'Alight Motion', src: '/logos/alightmotion-white.svg', chip: 'linear-gradient(135deg, #2233AA, #7A3CF0)' },
  { name: 'CapCut', src: '/logos/capcut-white.svg', chip: '#000000' },
]

export default function Marquee() {
  // Diduplikasi agar loop animasi translateX(-50%) mulus tanpa lompatan.
  const loop = [...BRANDS, ...BRANDS]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {loop.map((b, i) => (
          <span className="marquee-item" key={i}>
            <span
              className={b.wide ? 'marquee-logo-chip wide' : 'marquee-logo-chip'}
              style={{ background: b.chip }}
            >
              <img src={b.src} alt={b.name} draggable="false" />
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
