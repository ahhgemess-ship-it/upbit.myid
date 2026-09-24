const BRANDS = [
  { name: 'Gemini', src: '/logos/gemini-white.png' },
  { name: 'Claude', src: '/logos/claude-white.png' },
  { name: 'Kiro', src: '/logos/kiro-white.png' },
  { name: 'OpenAI', src: '/logos/openai-white.png' },
  { name: 'Higgsfield', src: '/logos/higgsfield-white.png' },
  { name: 'Spotify', src: '/logos/spotify-white.svg' },
  { name: 'Viu', src: '/logos/viu-white.svg' },
  { name: 'Netflix', src: '/logos/netflix-white.svg' },
  { name: 'Duolingo', src: '/logos/duolingo-white.svg' },
  { name: 'DeepSeek', src: '/logos/deepseek-white.png' },
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
            <img className="marquee-logo" src={b.src} alt="" draggable="false" />
          </span>
        ))}
      </div>
    </div>
  )
}
