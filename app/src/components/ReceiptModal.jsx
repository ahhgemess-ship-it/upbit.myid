import { useEffect, useRef, useState } from 'react'
import { Printer, Download, X, Loader2 } from 'lucide-react'
import { formatPrice } from '../i18n/pricing.js'
import { useLang } from '../context/LanguageContext.jsx'

const dashed = { borderTop: '1.5px dashed #9a9a92', margin: '10px 0' }

// Struk pembelian profesional — dipakai di panel admin.
// Cetak: window.print (hanya struk yang tampil via CSS print).
// PDF: jsPDF dimuat lazy saat dibutuhkan (hemat bundle utama).
export default function ReceiptModal({ order, onClose }) {
  const { t } = useLang()
  const [pdfBusy, setPdfBusy] = useState(false)
  const sheetRef = useRef(null)

  // Esc untuk menutup
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!order) return null

  const dateStr = new Date(order.createdAt).toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const methodLabel = order.payment?.method === 'crypto'
    ? `Crypto ${order.payment.asset || ''}`.trim()
    : order.payment?.method === 'manual'
      ? t('rc.manual')
      : t('co.payQrisChip')
  const payRef = order.payment?.txHash
    ? order.payment.txHash
    : order.payment?.proofName
      ? t('rc.proofAttached')
      : '—'
  const subtotal = order.subtotal ?? order.total
  const discount = order.discount || 0

  const buildPdf = async () => {
    setPdfBusy(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      let y = 0

      // Logo (file lokal di /public — aman dibaca sebagai gambar)
      try {
        const img = new Image()
        img.src = '/logo.png'
        await new Promise((ok, err) => { img.onload = ok; img.onerror = err })
        doc.addImage(img, 'PNG', 40, 36, 34, 34)
      } catch { /* logo gagal → lanjut tanpa logo */ }

      doc.setFont('helvetica', 'bold'); doc.setFontSize(17)
      doc.text('EVOLUSIAI', 84, 50)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110)
      doc.text('Marketplace Produk Digital  ·  evolusiai.xyz', 84, 63)
      doc.setTextColor(20)

      y = 92
      doc.setDrawColor(40); doc.setLineWidth(1.2); doc.line(40, y, W - 40, y)
      y += 24
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
      doc.text(t('rc.title').toUpperCase(), 40, y)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
      doc.text(dateStr, W - 40, y, { align: 'right' })
      doc.setTextColor(20); y += 14
      doc.setFontSize(10)
      doc.text(`${t('rc.orderId')}: ${order.id}`, 40, y)
      y += 18

      // Pembeli
      doc.setDrawColor(200); doc.setLineWidth(0.8); doc.line(40, y, W - 40, y)
      y += 16
      doc.setFontSize(9.5)
      doc.text(`${t('rc.buyer')}: ${order.user?.name || '-'}`, 40, y)
      y += 13
      doc.text(`${t('rc.email')}: ${order.user?.email || '-'}`, 40, y)
      y += 13
      doc.text(`${t('od.deliveryEmail')}: ${order.deliveryEmail}`, 40, y)
      y += 20

      // Item
      doc.setDrawColor(40); doc.line(40, y, W - 40, y)
      y += 16
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
      doc.text(t('rc.item'), 40, y)
      doc.text(t('rc.qty'), W - 190, y, { align: 'right' })
      doc.text(t('rc.subtotalLbl'), W - 40, y, { align: 'right' })
      y += 6
      doc.setFont('helvetica', 'normal')
      for (const it of order.items || []) {
        y += 15
        doc.setFontSize(9.5)
        doc.text(`${it.name} — ${it.tierLabel}`, 40, y)
        doc.text(`${it.qty}x`, W - 190, y, { align: 'right' })
        doc.text(formatPrice(it.price * it.qty, order.currency || 'IDR'), W - 40, y, { align: 'right' })
      }
      y += 12
      doc.setDrawColor(200); doc.line(40, y, W - 40, y)
      y += 18
      doc.setFontSize(10)
      doc.text(`${t('rc.subtotalLbl')}`, W - 40, y, { align: 'right' })
      doc.text(formatPrice(subtotal, order.currency || 'IDR'), W - 40, y + 13, { align: 'right' })
      y += 13
      if (discount > 0) {
        y += 13
        doc.text(`${t('rc.discount')} -${formatPrice(discount, order.currency || 'IDR')}`, W - 40, y, { align: 'right' })
      }
      y += 24
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
      doc.text(t('rc.total'), W - 40, y, { align: 'right' })
      y += 16
      doc.setFontSize(13)
      doc.text(formatPrice(order.total, order.currency || 'IDR'), W - 40, y, { align: 'right' })
      y += 26

      // Pembayaran
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
      doc.text(`${t('rc.method')}:`, 40, y)
      doc.setFont('helvetica', 'normal')
      doc.text(methodLabel, 40 + doc.getTextWidth(`${t('rc.method')}: `) + 4, y)
      y += 13
      doc.text(`${t('rc.reference')}: ${String(payRef).slice(0, 60)}`, 40, y, { maxWidth: W - 80 })
      y += 30
      doc.setDrawColor(40); doc.line(40, y, W - 40, y)
      y += 16
      doc.setFontSize(9); doc.setTextColor(110)
      doc.text(t('rc.thanks'), 40, y)
      y += 12
      doc.text(t('rc.noSignature'), 40, y)
      y += 12
      doc.setTextColor(20)

      doc.save(`struk-${order.id}.pdf`)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,20,18,.62)', display: 'grid', placeItems: 'center', padding: 18, overflowY: 'auto' }}>
      <div ref={sheetRef} className="receipt-print" style={{
        width: 'min(400px, 100%)', background: '#fff', color: '#1c1c19',
        borderRadius: 14, padding: '22px 22px 18px', fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 24px 70px rgba(0,0,0,.4)', maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* Kop struk */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <img src="/logo.png" alt="Logo EvolusiAI" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: '.04em' }}>EVOLUSIAI</div>
            <div style={{ fontSize: 10.5, color: '#6f6f68' }}>Marketplace Produk Digital · evolusiai.xyz</div>
          </div>
        </div>

        <div style={{ ...dashed, margin: '14px 0 10px' }} />

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 13.5, letterSpacing: '.14em' }}>{t('rc.title').toUpperCase()}</div>
          <div style={{ fontSize: 11, color: '#6f6f68', marginTop: 2 }}>{dateStr}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 3, fontFamily: 'monospace' }}>{order.id}</div>
        </div>

        <div style={dashed} />

        {/* Pembeli */}
        <RCRow label={t('rc.buyer')} value={order.user?.name || '-'} />
        <RCRow label={t('rc.email')} value={order.user?.email || '-'} />
        <RCRow label={t('od.deliveryEmail')} value={order.deliveryEmail} />

        <div style={dashed} />

        {/* Item */}
        {(order.items || []).map((it) => (
          <div key={it.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3 }}>{it.name}</div>
            <div style={{ fontSize: 11, color: '#6f6f68' }}>{it.tierLabel}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#6f6f68' }}>{it.qty} × {formatPrice(it.price, order.currency || 'IDR')}</span>
              <b>{formatPrice(it.price * it.qty, order.currency || 'IDR')}</b>
            </div>
          </div>
        ))}

        <div style={dashed} />

        {/* Ringkasan */}
        <RCRow label={t('rc.subtotalLbl')} value={formatPrice(subtotal, order.currency || 'IDR')} />
        {discount > 0 && <RCRow label={t('rc.discount')} value={`-${formatPrice(discount, order.currency || 'IDR')}`} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '6px 0 2px' }}>
          <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: '.06em' }}>{t('rc.total')}</span>
          <b style={{ fontSize: 16 }}>{formatPrice(order.total, order.currency || 'IDR')}</b>
        </div>

        <div style={dashed} />

        {/* Pembayaran */}
        <RCRow label={t('rc.method')} value={methodLabel} />
        <RCRow label={t('rc.reference')} value={<span style={{ fontFamily: 'monospace', fontSize: 10.5, wordBreak: 'break-all' }}>{payRef}</span>} />
        <RCRow label={t('rc.statusLbl')} value={{ PROCESSING: t('rc.stProcessing'), COMPLETED: t('rc.stCompleted'), CANCELLED: t('rc.stCancelled'), PENDING: t('rc.stPending') }[order.status] || order.status} />

        <div style={{ ...dashed, margin: '10px 0 8px' }} />

        {/* Kaki struk */}
        <div style={{ textAlign: 'center', fontSize: 10.5, color: '#6f6f68', lineHeight: 1.55 }}>
          <div style={{ fontWeight: 800, color: '#1c1c19' }}>{t('rc.thanks')}</div>
          <div>{t('rc.noSignature')}</div>
          <div style={{ marginTop: 3, fontSize: 9.5 }}>
            {t('rc.printedAt')} {new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Tombol aksi — tidak ikut tercetak */}
      <div className="receipt-no-print" style={{ position: 'fixed', right: 18, top: 18, display: 'flex', gap: 8, zIndex: 95 }}>
        <button onClick={onClose} style={btnGhost}><X size={16} /> {t('rc.close')}</button>
        <button onClick={() => window.print()} style={btnPrimary}><Printer size={15} /> {t('rc.print')}</button>
        <button onClick={buildPdf} disabled={pdfBusy} style={btnPrimary}>
          {pdfBusy ? <Loader2 size={15} className="spin" /> : <Download size={15} />} PDF
        </button>
      </div>
    </div>
  )
}

function RCRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 11.8, marginBottom: 4 }}>
      <span style={{ color: '#6f6f68', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

const btnPrimary = {
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
  background: '#1c1c19', color: '#c5f82a', border: '1.5px solid #1c1c19',
  borderRadius: 999, padding: '10px 18px', fontSize: 13.5, fontWeight: 800,
}
const btnGhost = {
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7,
  background: 'rgba(255,255,255,.92)', color: '#1c1c19',
  border: '1.5px solid #1c1c19', borderRadius: 999, padding: '10px 18px', fontSize: 13.5, fontWeight: 800,
}
