import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { api } from '../api.js'
import { useAuth } from './AuthContext.jsx'

const BalanceContext = createContext(null)

export function BalanceProvider({ children }) {
  const { user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [withdrawEligible, setWithdrawEligible] = useState(false)
  const [minWithdraw, setMinWithdraw] = useState(250000)
  const [history, setHistory] = useState([])
  const [loaded, setLoaded] = useState(false)

  // ──────────── Check‑in state ────────────
  const [checkInStreak, setCheckInStreak] = useState(0)
  const [canCheckIn, setCanCheckIn] = useState(false)
  const [checkInReward, setCheckInReward] = useState(300)
  const [checkInBonus, setCheckInBonus] = useState(2000)
  const [checkInCycle, setCheckInCycle] = useState(7)
  const checkInLoadingRef = useRef(false)

  const fetchBalance = useCallback(async () => {
    if (!user) return
    try {
      const data = await api.getBalance()
      setBalance(data.balance || 0)
      setTotalSpent(data.totalSpent || 0)
      setWithdrawEligible(data.withdrawEligible || false)
      setMinWithdraw(data.minWithdraw || 250000)
      setLoaded(true)
    } catch {
      // Backend tidak terjangkau — tampilkan 0 (jangan saldo palsu, abaikan demo_balance lama).
      setBalance(0)
      setTotalSpent(0)
      setWithdrawEligible(false)
      setLoaded(true)
    }
  }, [user])

  const fetchHistory = useCallback(async () => {
    if (!user) return
    try {
      const txns = await api.getBalanceHistory()
      setHistory(txns)
    } catch {
      setHistory([])
    }
  }, [user])

  // ──────────── Check‑in API ────────────
  const fetchCheckInStatus = useCallback(async () => {
    if (!user) return
    try {
      const data = await api.checkInStatus()
      setCheckInStreak(data.streak)
      setCanCheckIn(data.canCheckIn)
      setCheckInReward(data.reward)
      setCheckInBonus(data.bonus)
      setCheckInCycle(data.cycle)
    } catch {
      // Fallback lokal
      const lastCheckIn = localStorage.getItem('demo_last_checkin')
      const streak = parseInt(localStorage.getItem('demo_checkin_streak') || '0', 10)
      const now = new Date()
      const last = lastCheckIn ? new Date(lastCheckIn) : null
      const alreadyToday = last && last.toDateString() === now.toDateString()
      setCheckInStreak(streak)
      setCanCheckIn(!alreadyToday)
      setCheckInReward(300)
      setCheckInBonus(2000)
      setCheckInCycle(7)
    }
  }, [user])

  const doCheckIn = useCallback(async () => {
    if (!canCheckIn || checkInLoadingRef.current) return null
    checkInLoadingRef.current = true
    try {
      const res = await api.checkIn()
      setBalance(res.balance)
      setCanCheckIn(false)
      setCheckInStreak(res.newCycle ? 0 : res.streak)
      fetchHistory()
      return res
    } catch (e) {
      throw e
    } finally {
      checkInLoadingRef.current = false
    }
  }, [canCheckIn, fetchHistory])

  // Auto-fetch check-in status saat user login
  useEffect(() => { fetchCheckInStatus() }, [fetchCheckInStatus])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Withdraw
  const withdraw = useCallback(async (amount, method) => {
    const res = await api.withdrawBalance(amount, method)
    setBalance(res.balance)
    fetchHistory()
    return res
  }, [fetchHistory])

  const value = useMemo(() => ({
    balance, totalSpent, withdrawEligible, minWithdraw,
    history, loaded,
    fetchBalance, fetchHistory, withdraw,
    // Check-in
    checkInStreak, canCheckIn, checkInReward, checkInBonus, checkInCycle,
    fetchCheckInStatus, doCheckIn,
  }), [
    balance, totalSpent, withdrawEligible, minWithdraw,
    history, loaded,
    fetchBalance, fetchHistory, withdraw,
    checkInStreak, canCheckIn, checkInReward, checkInBonus, checkInCycle,
    fetchCheckInStatus, doCheckIn,
  ])

  return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>
}

export function useBalance() {
  const ctx = useContext(BalanceContext)
  if (!ctx) throw new Error('useBalance must be used within BalanceProvider')
  return ctx
}
