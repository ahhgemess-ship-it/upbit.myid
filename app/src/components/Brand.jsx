export default function Brand({ light = false, compact = false, className = '' }) {
  return (
    <span className={`brand-lockup ${light ? 'brand-lockup-light' : ''} ${compact ? 'brand-lockup-compact' : ''} ${className}`.trim()}>
      <img src="/evolusitech-store-mark.svg" alt="" className="brand-mark" aria-hidden="true" />
      <span className="brand-wordmark" aria-hidden="true">
        <span>EVOLUSITECH</span><span>STORE</span>
      </span>
      <span className="sr-only">EvolusiTech Store</span>
    </span>
  )
}
