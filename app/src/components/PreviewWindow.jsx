import { useEffect, useState } from 'react'
import { X, RotateCw, ExternalLink, MonitorSmartphone } from 'lucide-react'

// Window preview "sisi pembeli" untuk admin panel: iframe same-origin ke halaman
// publik asli (/flash-sale, /product/:id) sehingga tampilannya 1:1 dengan yang
// dilihat pembeli — termasuk data live dari katalog DB.
//
// Realtime: iframe dimuat ulang otomatis setiap admin menyimpan perubahan
// (prop `refreshSignal` naik) dan bisa dimuat ulang manual lewat tombol refresh.
// Karena iframe adalah dunia terpisah, klik di dalamnya tidak mengganggu
// navigasi admin panel.
export default function PreviewWindow({ title, src, onClose, refreshSignal = 0 }) {
  const [nonce, setNonce] = useState(0)

  // reload saat sinyal berubah (dipicu setelah admin simpan / toggle)
  useEffect(() => {
    if (refreshSignal > 0) setNonce((n) => n + 1)
  }, [refreshSignal])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const abs = /^https?:/i.test(src) ? src : window.location.origin + src

  return (
    <div className="pv-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="pv-window" onClick={(e) => e.stopPropagation()}>
        <div className="pv-head">
          <span className="pv-dots" aria-hidden="true"><i /><i /><i /></span>
          <div className="pv-titles">
            <div className="pv-title display">{title}</div>
            <div className="pv-sub">
              <MonitorSmartphone size={11} style={{ flexShrink: 0 }} />
              <span>LIVE · tampilan sisi pembeli</span>
              <span className="pv-url">{abs}</span>
            </div>
          </div>
          <div className="pv-actions">
            <button type="button" className="icon-btn" onClick={() => setNonce((n) => n + 1)} title="Muat ulang preview" aria-label="Muat ulang preview"><RotateCw size={15} /></button>
            <a className="icon-btn" href={abs} target="_blank" rel="noreferrer" title="Buka di tab baru" aria-label="Buka di tab baru"><ExternalLink size={15} /></a>
            <button type="button" className="icon-btn" onClick={onClose} title="Tutup (Esc)" aria-label="Tutup preview"><X size={16} /></button>
          </div>
        </div>
        <div className="pv-body">
          <iframe key={nonce} src={src} title={title} className="pv-frame" />
        </div>
      </div>
      <style>{`
        .pv-backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(10,10,12,.62); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 18px; }
        .pv-window { width: min(1080px, 96vw); height: min(86vh, 900px); background: #fff; border: 1.5px solid var(--ink); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(0,0,0,.45); }
        .pv-head { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--ink); color: #fff; border-bottom: 1.5px solid var(--ink); }
        .pv-dots { display: flex; gap: 5px; flex-shrink: 0; }
        .pv-dots i { width: 10px; height: 10px; border-radius: 999px; background: rgba(255,255,255,.28); display: block; }
        .pv-dots i:first-child { background: var(--lime); }
        .pv-titles { flex: 1; min-width: 0; }
        .pv-title { font-size: 14px; letter-spacing: .01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pv-sub { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,.62); margin-top: 2px; min-width: 0; }
        .pv-url { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pv-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .pv-head .icon-btn { color: #fff; border-color: rgba(255,255,255,.25); background: rgba(255,255,255,.08); }
        .pv-head .icon-btn:hover { background: rgba(255,255,255,.18); }
        .pv-body { flex: 1; min-height: 0; background: #fff; }
        .pv-frame { width: 100%; height: 100%; border: 0; display: block; }
        @media (max-width: 640px) { .pv-window { width: 100vw; height: 92vh; border-radius: 0; } .pv-url { display: none; } }
      `}</style>
    </div>
  )
}
