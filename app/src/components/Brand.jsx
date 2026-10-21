export default function Brand({ light = false, compact = false, className = '' }) {
  return (
    <span className={`brand-lockup ${light ? 'brand-lockup-light' : ''} ${compact ? 'brand-lockup-compact' : ''} ${className}`.trim()}>
      <img src="/upbit-store-mark.png" alt="" className="brand-mark" aria-hidden="true" />
      <span className="brand-wordmark" aria-hidden="true">
        <span>UPBIT</span><span>STORE</span>
      </span>
      <span className="sr-only">Upbit Store</span>
    </span>
  )
}
