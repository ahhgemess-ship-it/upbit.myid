import { ChevronLeft, ChevronRight } from 'lucide-react'

// Kontrol paginasi sederhana: Sebelumnya / indikator halaman / Berikutnya.
export default function Pager({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null
  const go = (p) => { if (p >= 1 && p <= totalPages && p !== page) onChange(p) }
  return (
    <div className="pager">
      <button className="pager-btn" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Sebelumnya">
        <ChevronLeft size={16} /> Sebelumnya
      </button>
      <span className="pager-info">Halaman {page} dari {totalPages}</span>
      <button className="pager-btn" onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Berikutnya">
        Berikutnya <ChevronRight size={16} />
      </button>
    </div>
  )
}
