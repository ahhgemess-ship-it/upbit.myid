import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

const SUCCESS_MARKERS = [
  'success', 'successful', 'completed', 'paid', 'payment received', 'transfer complete',
  'berhasil', 'sukses', 'pembayaran diterima', 'transaksi selesai', 'bayaran berjaya',
  '成功', '支付成功', '付款成功', '交易成功', '已支付', '完成',
  '成功しました', '支払い完了', '取引完了', '支払済',
  'успешно', 'выполнен', 'оплачено',
  'सफल', 'भुगतान सफल', 'लेनदेन सफल',
  'erfolgreich', 'bezahlt', 'zahlung abgeschlossen',
  'thành công', 'thanh cong', 'đã thanh toán', 'da thanh toan', 'giao dịch thành công', 'hoàn tất', 'hoan tat',
]

const FAILURE_MARKERS = [
  'failed', 'declined', 'cancelled', 'canceled', 'pending',
  'gagal', 'ditolak', 'dibatalkan', 'tertunda', 'menunggu',
  '失败', '已取消', '待处理', '处理中',
  '失敗', 'キャンセル', '保留中',
  'ошибка', 'отклонен', 'отменен', 'ожидание',
  'विफल', 'अस्वीकृत', 'रद्द', 'लंबित',
  'fehlgeschlagen', 'abgelehnt', 'storniert', 'ausstehend',
  'thất bại', 'that bai', 'bị từ chối', 'đã hủy', 'dang cho', 'đang chờ',
]

const compact = (text) => String(text || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

export function numericCandidates(text, currency = 'IDR') {
  const tokens = compact(text).match(/\d+(?:[.,]\d+)*/g) || []
  const decimalCurrency = currency !== 'IDR'
  return tokens.flatMap((token) => {
    let value = token
    if (!decimalCurrency) {
      const digits = value.replace(/[^\d]/g, '')
      return digits ? [Number(digits)] : []
    }

    const lastDot = value.lastIndexOf('.')
    const lastComma = value.lastIndexOf(',')
    const lastSeparator = Math.max(lastDot, lastComma)
    if (lastSeparator >= 0) {
      const decimals = value.length - lastSeparator - 1
      if (decimals === 2) {
        const whole = value.slice(0, lastSeparator).replace(/[^\d]/g, '') || '0'
        const fraction = value.slice(lastSeparator + 1).replace(/[^\d]/g, '')
        value = `${whole}.${fraction}`
      } else {
        value = value.replace(/[^\d]/g, '')
      }
    }
    const n = Number(value)
    return Number.isFinite(n) ? [n] : []
  })
}

export function inspectRecognizedProof({ text, confidence = 0, expectedAmount, currency = 'IDR' }) {
  const normalized = compact(text)
  const withoutSpaces = normalized.replace(/\s+/g, '')
  const includesMarker = (marker) => normalized.includes(marker) || withoutSpaces.includes(marker.replace(/\s+/g, ''))
  const hasSuccess = SUCCESS_MARKERS.some(includesMarker)
  const hasFailure = FAILURE_MARKERS.some(includesMarker)
  const expectedMajor = currency === 'IDR' ? Number(expectedAmount) : Number(expectedAmount) / 100
  const tolerance = currency === 'IDR' ? 1 : 0.011
  const amounts = numericCandidates(normalized, currency)
  const amountMatched = amounts.some((amount) => Math.abs(amount - expectedMajor) <= tolerance)
  const confidenceOk = Number(confidence) >= 40
  const accepted = confidenceOk && hasSuccess && !hasFailure && amountMatched

  let reason = 'Bukti pembayaran tidak dapat diverifikasi otomatis.'
  if (!confidenceOk) reason = 'Teks pada bukti kurang jelas. Unggah tangkapan layar asli dengan resolusi lebih tinggi.'
  else if (hasFailure) reason = 'Bukti menunjukkan transaksi belum berhasil.'
  else if (!hasSuccess) reason = 'Status transaksi berhasil tidak ditemukan pada bukti.'
  else if (!amountMatched) reason = 'Nominal pada bukti tidak cocok dengan total pembayaran.'

  return { accepted, reason: accepted ? null : reason, confidence: Math.round(Number(confidence) || 0), amountMatched }
}

const workerPromises = new Map()
const recognitionQueues = new Map()

async function getWorker(group) {
  if (!workerPromises.has(group)) {
    const promise = (async () => {
      const [tesseract, ...languageModules] = await Promise.all([
        import('tesseract.js'),
        import('@tesseract.js-data/eng'),
        import('@tesseract.js-data/chi_sim'),
        import('@tesseract.js-data/jpn'),
        import('@tesseract.js-data/rus'),
        import('@tesseract.js-data/hin'),
      ])
      const langDir = path.join(os.tmpdir(), 'upbit-tessdata-v2')
      fs.mkdirSync(langDir, { recursive: true })
      const languages = languageModules.map((module) => module.default || module)
      for (const language of languages) {
        const target = path.join(langDir, `${language.code}.traineddata.gz`)
        if (!fs.existsSync(target)) {
          const source = path.join(language.langPath, `${language.code}.traineddata.gz`)
          fs.copyFileSync(source, target)
        }
      }
      const groups = {
        common: ['eng', 'chi_sim', 'jpn'],
        cyrillic: ['eng', 'rus'],
        devanagari: ['eng', 'hin'],
      }
      const codes = (groups[group] || groups.common).join('+')
      return tesseract.createWorker(codes, tesseract.OEM.LSTM_ONLY, {
        langPath: langDir,
        gzip: true,
        cacheMethod: 'none',
        logger: () => {},
      })
    })().catch((error) => {
      workerPromises.delete(group)
      throw error
    })
    workerPromises.set(group, promise)
  }
  return workerPromises.get(group)
}

async function recognize(group, image) {
  const previous = recognitionQueues.get(group) || Promise.resolve()
  const run = async () => (await getWorker(group)).recognize(image)
  const pending = previous.then(run, run)
  recognitionQueues.set(group, pending.catch(() => {}))
  return pending
}

export function paymentProofHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export async function analyzePaymentProof(buffer, { expectedAmount, currency = 'IDR' }) {
  const prepared = await sharp(buffer)
    .grayscale()
    .normalize()
    .sharpen()
    .resize({ width: 1800, withoutEnlargement: true })
    .png()
    .toBuffer()

  const inspectResult = (result) => inspectRecognizedProof({
      text: result.data.text,
      confidence: result.data.confidence,
      expectedAmount,
      currency,
    })

  const commonResult = await recognize('common', prepared)
  let bestResult = commonResult
  let inspected = inspectResult(commonResult)
  if (!inspected.accepted) {
    for (const group of ['cyrillic', 'devanagari']) {
      const candidate = await recognize(group, prepared)
      const candidateInspection = inspectResult(candidate)
      if (candidateInspection.accepted) {
        bestResult = candidate
        inspected = candidateInspection
        break
      }
      if (candidateInspection.confidence > inspected.confidence) {
        bestResult = candidate
        inspected = candidateInspection
      }
    }
  }
  return {
    ...inspected,
    hash: paymentProofHash(buffer),
    textHash: crypto.createHash('sha256').update(compact(bestResult.data.text)).digest('hex'),
  }
}

const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org'
const STORE_WALLET = '0x02fd0906c6f873f35259889d7396f46b92a24aee'
const USDT_CONTRACT = '0x55d398326f99059ff775485246999027b3197955'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const CRYPTO_RATES = { BNB: { idrRate: 9_650_000, decimals: 4 }, USDT: { idrRate: 16_300, decimals: 2 } }

async function rpc(method, params) {
  const response = await fetch(BSC_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error('Jaringan BSC tidak dapat dihubungi')
  const payload = await response.json()
  if (payload.error) throw new Error(payload.error.message || 'Respons BSC tidak valid')
  return payload.result
}

export async function verifyCryptoPayment(txHash, { asset, expectedIdr }) {
  const hash = String(txHash || '').trim().toLowerCase()
  const symbol = String(asset || '').trim().toUpperCase()
  if (!/^0x[a-f0-9]{64}$/.test(hash)) return { accepted: false, reason: 'Format Tx Hash tidak valid.' }
  if (!CRYPTO_RATES[symbol]) return { accepted: false, reason: 'Aset crypto tidak didukung.' }

  const [tx, receipt] = await Promise.all([
    rpc('eth_getTransactionByHash', [hash]),
    rpc('eth_getTransactionReceipt', [hash]),
  ])
  if (!tx || !receipt) return { accepted: false, reason: 'Transaksi belum ditemukan di jaringan BSC.' }
  if (receipt.status !== '0x1') return { accepted: false, reason: 'Transaksi crypto gagal.' }

  const cfg = CRYPTO_RATES[symbol]
  const expected = Number((Number(expectedIdr) / cfg.idrRate).toFixed(cfg.decimals))
  let received = 0
  if (symbol === 'BNB') {
    if (String(tx.to || '').toLowerCase() !== STORE_WALLET) return { accepted: false, reason: 'Alamat penerima transaksi tidak cocok.' }
    received = Number(BigInt(tx.value || '0x0')) / 1e18
  } else {
    const recipientTopic = `0x${STORE_WALLET.slice(2).padStart(64, '0')}`
    const log = (receipt.logs || []).find((entry) =>
      String(entry.address || '').toLowerCase() === USDT_CONTRACT &&
      String(entry.topics?.[0] || '').toLowerCase() === TRANSFER_TOPIC &&
      String(entry.topics?.[2] || '').toLowerCase() === recipientTopic
    )
    if (!log) return { accepted: false, reason: 'Transfer USDT ke alamat toko tidak ditemukan.' }
    received = Number(BigInt(log.data || '0x0')) / 1e18
  }

  if (received + (10 ** -(cfg.decimals + 1)) < expected) {
    return { accepted: false, reason: 'Nominal transaksi crypto kurang dari total pembayaran.' }
  }
  return { accepted: true, reason: null, received: String(received), hash }
}
