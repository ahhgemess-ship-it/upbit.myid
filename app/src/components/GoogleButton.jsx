import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID, GOOGLE_ENABLED } from '../config.js'
import { useAuth } from '../context/AuthContext.jsx'

const GSI_SRC = 'https://accounts.google.com/gsi/client'

export default function GoogleButton({ onDone, onError }) {
  const { loginWithGoogle } = useAuth()
  const holderRef = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!GOOGLE_ENABLED) {
      setStatus('error')
      return
    }

    let cancelled = false

    const init = async () => {
      try {
        // Load GSI script jika belum ada
        if (!window.google?.accounts?.id) {
          await new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${GSI_SRC}"]`)
            if (existing) {
              existing.addEventListener('load', resolve)
              existing.addEventListener('error', reject)
              return
            }
            const s = document.createElement('script')
            s.src = GSI_SRC
            s.async = true
            s.defer = true
            s.onload = resolve
            s.onerror = reject
            document.head.appendChild(s)
          })
        }

        if (cancelled) return
        if (!window.google?.accounts?.id) {
          setStatus('error')
          return
        }

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (resp) => {
            try {
              await loginWithGoogle(resp.credential)
              if (onDone) onDone()
            } catch (e) {
              if (onError) onError(e.message || 'Login Google gagal.')
            }
          },
        })

        // Render tombol Google ke container TERPISAH (bukan React-managed)
        if (holderRef.current) {
          window.google.accounts.id.renderButton(holderRef.current, {
            theme: 'outline',
            size: 'large',
            width: holderRef.current.offsetWidth || 320,
            text: 'continue_with',
            shape: 'pill',
            logo_alignment: 'center',
          })
        }
        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {/* Container untuk Google renderButton — KOSONG, tidak ada children React
          supaya tidak konflik saat Google memanipulasi DOM-nya */}
      <div
        ref={holderRef}
        style={{
          minHeight: status === 'loading' || status === 'ready' ? 44 : 0,
          display: status === 'error' ? 'none' : 'block',
        }}
      />

      {/* Loading indicator — DI LUAR holderRef agar tidak di-remove Google */}
      {status === 'loading' && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '10px 0' }}>
          Memuat Google…
        </div>
      )}

      {/* Error fallback */}
      {status === 'error' && (
        <div style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <GoogleIcon />
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 6 }}>
            Gagal memuat Google Sign-In.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 14 }}>
            Periksa koneksi internet kamu dan coba lagi.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="pill"
            style={{ padding: '8px 20px', fontSize: 13 }}
          >
            Muat Ulang
          </button>
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.7 38 46.5 31.8 46.5 24.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.7 2.2-6.3 0-11.7-3.7-13.6-9.3l-7.9 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  )
}
