import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowUpRight } from 'lucide-react'

export default function AdminGate() {
  return (
    <div className="container section" style={{ textAlign: 'center', maxWidth: 520 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 76, height: 76, borderRadius: 999, margin: '0 auto 22px', background: 'var(--surface-2)', border: '1.5px solid var(--ink)' }}>
        <ShieldAlert size={32} />
      </span>
      <h1 className="display h-md">AKSES DITOLAK</h1>
      <p className="text-muted" style={{ marginTop: 12 }}>Halaman ini khusus admin. Masuk dengan akun admin untuk mengakses panel.</p>
      <Link to="/" className="pill pill-indigo" style={{ marginTop: 24 }}>
        Kembali ke Beranda <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
      </Link>
    </div>
  )
}
