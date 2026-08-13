import nodemailer from 'nodemailer'

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, CLIENT_ORIGIN } = process.env
const FROM = MAIL_FROM || 'EvolusiAI <no-reply@upbitstore.local>'
const SITE = (CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0]

// Transport hanya dibuat bila SMTP dikonfigurasi. Tanpa itu → mode log (dev).
let transport = null
if (SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  })
}

const idr = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

async function send(to, subject, html) {
  if (!to) return
  if (!transport) {
    console.log(`[MAIL:dev] → ${to} | ${subject} (SMTP belum dikonfigurasi, email tidak dikirim)`)
    return
  }
  try {
    await transport.sendMail({ from: FROM, to, subject, html })
    console.log(`[MAIL] terkirim → ${to} | ${subject}`)
  } catch (e) {
    console.error('[MAIL] gagal:', e.message)
  }
}

const shell = (title, bodyHtml) => `
<div style="background:#efece6;padding:28px;font-family:Inter,Arial,sans-serif;color:#2b2b28">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1.5px solid #2b2b28;border-radius:18px;overflow:hidden">
    <div style="background:#2b2b28;padding:18px 24px">
      <span style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:18px;color:#fff;letter-spacing:.02em">EVOLUSI<span style="color:#c5f82a">AI</span></span>
    </div>
    <div style="padding:24px">
      <h1 style="font-size:19px;margin:0 0 12px">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e0ddd4;color:#8a887e;font-size:12px">
      Email otomatis dari EvolusiAI. Mohon jangan balas email ini.
    </div>
  </div>
</div>`

const itemRows = (items) => items.map((it) =>
  `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${it.name} <span style="color:#8a887e">· ${it.tierLabel} · ${it.qty}×</span></td>
   <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600">${idr(it.price * it.qty)}</td></tr>`).join('')

export function sendOrderCreated(order) {
  const html = shell('Pesanan diterima — sedang diproses', `
    <p style="font-size:14px;line-height:1.6;color:#57564f">
      Terima kasih! Pesanan <strong>${order.id}</strong> sudah kami terima dan sedang
      ${order.estimate ? `diproses (estimasi <strong>${order.estimate}</strong>)` : 'diproses'}.
      Detail akses akan dikirim ke email ini setelah selesai.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0">
      ${itemRows(order.items)}
      <tr><td style="padding:10px 0;font-weight:700">Total</td><td style="padding:10px 0;text-align:right;font-weight:700;font-size:16px">${idr(order.total)}</td></tr>
    </table>
    <a href="${SITE}/orders/${order.id}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;font-size:14px">Lihat status pesanan</a>
  `)
  send(order.deliveryEmail, `Pesanan ${order.id} diterima — EvolusiAI`, html)
}

export function sendOrderCompleted(order) {
  const creds = order.items.map((it) => {
    if (!it.credential) return ''
    const c = it.credential
    const lines = c.kind === 'apikey'
      ? `<div><span style="color:#8a887e">API Key:</span> <code>${c.apiKey || ''}</code></div>`
      : `<div><span style="color:#8a887e">Email:</span> <code>${c.email || ''}</code></div>
         <div><span style="color:#8a887e">Password:</span> <code>${c.password || ''}</code></div>`
    return `<div style="background:#f6f4ef;border:1px solid #e0ddd4;border-radius:12px;padding:14px;margin:10px 0">
      <strong style="font-size:14px">${it.name}</strong>
      <div style="font-size:13px;line-height:1.7;margin-top:6px;font-family:monospace">${lines}</div>
      ${c.note ? `<div style="font-size:12px;color:#8a887e;margin-top:6px">${c.note}</div>` : ''}
    </div>`
  }).join('')

  const html = shell('Pesanan selesai — akses kamu siap', `
    <p style="font-size:14px;line-height:1.6;color:#57564f">
      Pesanan <strong>${order.id}</strong> telah selesai. Berikut detail akses produkmu.
      Simpan baik-baik dan jangan dibagikan.
    </p>
    ${creds || '<p style="font-size:14px">Detail akses tersedia di halaman pesanan.</p>'}
    <a href="${SITE}/orders/${order.id}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;font-size:14px;margin-top:8px">Buka pesanan</a>
  `)
  send(order.deliveryEmail, `Pesanan ${order.id} selesai — akses kamu siap`, html)
}
