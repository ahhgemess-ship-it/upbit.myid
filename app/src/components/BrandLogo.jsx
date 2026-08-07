import { useState } from 'react'

// Menampilkan logo brand dari CDN di atas kotak warna brand.
// Jika gambar gagal load, fallback ke inisial brand (tanpa emoji).
export default function BrandLogo({ src, name, brand = '#4f46e5', size = 56, radius = 16, logoScale = 0.56 }) {
  const [failed, setFailed] = useState(false)
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <span
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: radius,
        background: brand,
        border: '1.5px solid var(--ink)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {failed ? (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: '#fff',
            fontSize: size * 0.34,
            letterSpacing: '.02em',
          }}
        >
          {initials}
        </span>
      ) : (
        <img
          src={src}
          alt={`${name} logo`}
          onError={() => setFailed(true)}
          width={size * logoScale}
          height={size * logoScale}
          style={{ width: size * logoScale, height: size * logoScale, objectFit: 'contain' }}
          loading="lazy"
        />
      )}
    </span>
  )
}
