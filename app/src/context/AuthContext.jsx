import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { api, getToken, setToken } from '../api.js'

const AuthContext = createContext(null)
const SESSION_KEY = 'upbit_session'

const avatarFor = (name) =>
  (name || 'U')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

const withInitials = (u) => (u ? { ...u, initials: avatarFor(u.name) } : null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // Saat mount: jika ada token, validasi ke backend (/me) & ambil profil terbaru.
  // Tidak ada auto guest user — user tetap null sampai login manual.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        const cached = JSON.parse(localStorage.getItem(SESSION_KEY))
        if (cached) setUser(withInitials(cached))
      } catch { /* ignore */ }

      if (getToken()) {
        try {
          const { user: fresh } = await api.me()
          if (!cancelled) {
            setUser(withInitials(fresh))
            localStorage.setItem(SESSION_KEY, JSON.stringify(fresh))
          }
        } catch {
          if (!cancelled) {
            setToken(null)
            localStorage.removeItem(SESSION_KEY)
            setUser(null)
          }
        }
      }
      if (!cancelled) setReady(true)
    }
    boot()
    return () => { cancelled = true }
  }, [])

  // Login Google: kirim credential JWT GSI ke backend untuk diverifikasi.
  const loginWithGoogle = useCallback(async (credential) => {
    const { token, user: u } = await api.googleLogin(credential)
    setToken(token)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(withInitials(u))
    return u
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, isAdmin: user?.role === 'ADMIN', loginWithGoogle, logout }),
    [user, ready, loginWithGoogle, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
