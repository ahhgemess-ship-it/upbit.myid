const encode = (value) => new TextEncoder().encode(value)

function canvasMarker() {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#4b31ff'
    ctx.fillRect(2, 2, 32, 12)
    ctx.fillStyle = '#111111'
    ctx.fillText('Upbit device', 4, 4)
    return canvas.toDataURL()
  } catch {
    return ''
  }
}

export async function createDeviceFingerprint() {
  if (!globalThis.crypto?.subtle) return ''
  let clientHints = {}
  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      clientHints = await navigator.userAgentData.getHighEntropyValues([
        'architecture', 'bitness', 'model', 'platformVersion',
      ])
    }
  } catch {
    clientHints = {}
  }

  const attributes = {
    platform: navigator.userAgentData?.platform || navigator.platform || '',
    mobile: navigator.userAgentData?.mobile ?? /Android|iPhone|iPad/i.test(navigator.userAgent),
    languages: navigator.languages || [navigator.language || ''],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    touchPoints: navigator.maxTouchPoints || 0,
    memory: navigator.deviceMemory || 0,
    cores: navigator.hardwareConcurrency || 0,
    clientHints,
    canvas: canvasMarker(),
  }
  const digest = await crypto.subtle.digest('SHA-256', encode(JSON.stringify(attributes)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
