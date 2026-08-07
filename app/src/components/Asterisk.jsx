// Motif dekoratif asterisk (pengganti emoji/sparkle). Pure SVG.
export default function Asterisk({ size = 40, color = 'var(--indigo)', spin = false, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={`aster ${spin ? 'aster-spin' : ''} ${className}`}
      style={{ color }}
      aria-hidden="true"
    >
      <path
        d="M24 4v40M4 24h40M9.6 9.6l28.8 28.8M38.4 9.6 9.6 38.4"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Sparkle({ size = 26, color = 'var(--lime-deep)', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2c.5 5 1.8 6.3 6.8 6.8C13.8 9.3 12.5 10.6 12 15.6 11.5 10.6 10.2 9.3 5.2 8.8 10.2 8.3 11.5 7 12 2Z"
        fill={color}
        stroke="var(--ink)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
