import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, CheckCheck, Package, RotateCcw, XCircle, CheckCircle2 } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'

const ICON = {
  order_created: Package,
  order_completed: CheckCircle2,
  order_cancelled: XCircle,
  refund_requested: RotateCcw,
  refund_done: RotateCcw,
  admin_new_order: Package,
  admin_refund: RotateCcw,
}

const timeAgo = (d, t) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60) return t('notif.justNow')
  if (s < 3600) return `${Math.floor(s / 60)} ${t('notif.minAgo')}`
  if (s < 86400) return `${Math.floor(s / 3600)} ${t('notif.hourAgo')}`
  return `${Math.floor(s / 86400)} ${t('notif.dayAgo')}`
}

export default function NotificationBell({ variant = 'desktop' }) {
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  const load = useCallback(async () => {
    try {
      const d = await api.notifications()
      setItems(d.items || [])
      setUnread(d.unread || 0)
    } catch { /* abaikan */ }
  }, [])

  // Poll unread tiap 25 dtk + saat mount
  useEffect(() => {
    if (!user) return
    let on = true
    const tick = async () => {
      try { const d = await api.notifUnread(); if (on) setUnread(d.unread || 0) } catch { /* */ }
    }
    tick()
    const t = setInterval(tick, 25000)
    return () => { on = false; clearInterval(t) }
  }, [user])

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!user) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  const markAll = async () => {
    setUnread(0)
    setItems((xs) => xs.map((x) => ({ ...x, read: true })))
    try { await api.notifReadAll() } catch { /* */ }
  }

  const openItem = async (n) => {
    setOpen(false)
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1))
      try { await api.notifRead(n.id) } catch { /* */ }
    }
    if (n.orderId) navigate(`/orders/${n.orderId}`)
  }

  const isMobile = variant === 'mobile'

  return (
    <div ref={ref} style={{ position: 'relative' }} className={`notif-wrap ${isMobile ? 'is-mobile' : ''}`}>
      {isMobile ? (
        <button onClick={toggle} className="notif-btn-mobile" aria-label={t('notif.title')}>
          <Bell size={18} strokeWidth={2.2} />
          <span style={{ flex: 1, textAlign: 'left' }}>{t('notif.title')}</span>
          {unread > 0 && <span className="notif-dot-inline">{unread > 9 ? '9+' : unread}</span>}
        </button>
      ) : (
        <button onClick={toggle} className="notif-btn" aria-label={t('notif.title')}>
          <Bell size={18} strokeWidth={2.2} />
          {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="notif-menu"
          >
            <div className="notif-head">
              <span className="display" style={{ fontSize: 14 }}>{t('notif.title')}</span>
              {unread > 0 && (
                <button onClick={markAll} className="notif-readall">
                  <CheckCheck size={14} /> {t('notif.markRead')}
                </button>
              )}
            </div>
            <div className="notif-list">
              {items.length === 0 ? (
                <div className="notif-empty">{t('notif.empty')}</div>
              ) : (
                items.map((n) => {
                  const Ic = ICON[n.type] || Bell
                  return (
                    <button key={n.id} onClick={() => openItem(n)} className={`notif-item ${n.read ? '' : 'is-unread'}`}>
                      <span className="notif-ic"><Ic size={16} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="notif-title">{n.title}</span>
                        {n.body && <span className="notif-body">{n.body}</span>}
                        <span className="notif-time">{timeAgo(n.createdAt, t)}</span>
                      </span>
                      {!n.read && <span className="notif-unread-dot" />}
                    </button>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
