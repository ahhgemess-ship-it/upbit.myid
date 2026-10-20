import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { api, getToken, setToken } from '../api.js'
import { createDeviceFingerprint } from '../deviceFingerprint.js'

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

  // Saat mount: migrasikan token lama, lalu validasi cookie sesi ke backend.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        const cached = JSON.parse(localStorage.getItem(SESSION_KEY))
        if (cached) setUser(withInitials(cached))
      } catch { /* ignore */ }

      try {
        const response = getToken() ? await api.migrateSession() : await api.me()
        setToken(null)
        if (!cancelled) {
          setUser(withInitials(response.user))
          localStorage.setItem(SESSION_KEY, JSON.stringify(response.user))
        }
      } catch {
        if (!cancelled) {
          setToken(null)
          localStorage.removeItem(SESSION_KEY)
          setUser(null)
        }
      }
      if (!cancelled) setReady(true)
    }
    boot()
    return () => { cancelled = true }
  }, [])

  // Login Google: kirim credential JWT GSI ke backend untuk diverifikasi.
  const loginWithGoogle = useCallback(async (credential) => {
    const deviceFingerprint = await createDeviceFingerprint()
    const { user: u } = await api.googleLogin(credential, deviceFingerprint)
    setToken(null)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(withInitials(u))
    return u
  }, [])

  const loginWithPassword = useCallback(async (identifier, password) => {
    const deviceFingerprint = await createDeviceFingerprint()
    const { user: u } = await api.passwordLogin(identifier, password, deviceFingerprint)
    setToken(null)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(withInitials(u))
    return u
  }, [])

  const registerWithPassword = useCallback(async (payload) => {
    const deviceFingerprint = await createDeviceFingerprint()
    const { user: u } = await api.passwordRegister(payload, deviceFingerprint)
    setToken(null)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(withInitials(u))
    return u
  }, [])

  const logout = useCallback(() => {
    api.logout().catch(() => {})
    setToken(null)
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, isAdmin: user?.role === 'ADMIN', loginWithGoogle, loginWithPassword, registerWithPassword, logout }),
    [user, ready, loginWithGoogle, loginWithPassword, registerWithPassword, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
