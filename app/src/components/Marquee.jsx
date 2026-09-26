const BRANDS = [
  { name: 'Gemini', src: '/logos/gemini-color.svg' },
  { name: 'Claude', src: '/logos/claude-color.svg' },
  { name: 'Kiro', src: '/logos/kiro-white.png' },
  { name: 'OpenAI', src: '/logos/openai-white.png' },
  { name: 'Higgsfield', src: '/logos/higgsfield-white.png' },
  { name: 'Spotify', src: '/logos/spotify-green.svg' },
  { name: 'Viu', src: '/logos/viu-color.svg', wide: true },
  { name: 'Netflix', src: '/logos/netflix-color.svg' },
  { name: 'Duolingo', src: '/logos/duolingo-color.svg' },
  { name: 'DeepSeek', src: '/logos/deepseek-color.svg' },
  { name: 'Leonardo AI', src: '/logos/leonardo-white.png' },
  { name: 'Alight Motion', src: '/logos/alightmotion-white.svg' },
  { name: 'CapCut', src: '/logos/capcut-white.svg' },
]

export default function Marquee() {
  // Diduplikasi agar loop animasi translateX(-50%) mulus tanpa lompatan.
  const loop = [...BRANDS, ...BRANDS]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {loop.map((b, i) => (
          <span className="marquee-item" key={i}>
            <img
              className={b.wide ? 'marquee-logo wide' : 'marquee-logo'}
              src={b.src}
              alt={b.name}
              draggable="false"
            />
          </span>
        ))}
      </div>
    </div>
  )
}
