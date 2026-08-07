import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, ShoppingCart, LogOut, ChevronRight, BadgeCheck, ShieldCheck } from 'lucide-react'
import Asterisk from '../components/Asterisk.jsx'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'

export default function Account() {
  const { user, logout, isAdmin } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [orderCount, setOrderCount] = useState(null)

  useEffect(() => {
    if (!user) return
    let on = true
    api.myOrders().then((d) => on && setOrderCount(d.orders.length)).catch(() => on && setOrderCount(0))
    return () => { on = false }
  }, [user])

  if (!user) {
    return (
      <div className="container section" style={{ textAlign: 'center', maxWidth: 520 }}>
        <h1 className="display h-md">{t('account.signInFirst')}</h1>
        <p className="text-muted" style={{ marginTop: 12 }}>{t('account.signInToManage')}</p>
        <Link to="/login" className="pill pill-indigo" style={{ marginTop: 24 }}>{t('nav.login')}</Link>
      </div>
    )
  }

  const menu = [
    { to: '/orders', icon: Package, label: t('nav.orderHistory'), meta: orderCount === null ? t('common.loading') : `${orderCount} ${t('account.ordersCount')}` },
    { to: '/cart', icon: ShoppingCart, label: t('nav.cart'), meta: t('account.viewCart') },
    ...(isAdmin ? [{ to: '/admin', icon: ShieldCheck, label: t('nav.adminPanel'), meta: t('account.manageOrders') }] : []),
  ]

  return (
    <div className="container section" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Asterisk size={28} />
        <h1 className="display h-lg">{t('account.title')}</h1>
      </div>

      {/* Profil */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}
      >
        <span className="avatar" style={{ width: 60, height: 60, fontSize: 22, flexShrink: 0 }}>
          {user.picture
            ? <img src={user.picture} alt="" width={60} height={60} style={{ objectFit: 'cover' }} />
            : user.initials}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="display" style={{ fontSize: 20 }}>{user.name}</h2>
            <BadgeCheck size={18} color="var(--indigo)" />
          </div>
          <div className="text-muted" style={{ fontSize: 13.5, wordBreak: 'break-all' }}>{user.email}</div>
          <span className="chip" style={{ marginTop: 8, fontSize: 10.5, padding: '3px 8px' }}>{t('account.googleAccount')}</span>
        </div>
      </motion.div>

      {/* Menu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {menu.map((m) => (
          <Link key={m.to} to={m.to} className="card account-link">
            <span className="account-link-ic"><m.icon size={20} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{m.label}</div>
              <div className="text-muted" style={{ fontSize: 12.5 }}>{m.meta}</div>
            </div>
            <ChevronRight size={19} style={{ color: 'var(--muted)' }} />
          </Link>
        ))}

        <button
          onClick={() => { logout(); navigate('/') }}
          className="card account-link"
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          <span className="account-link-ic" style={{ background: 'var(--surface-2)' }}><LogOut size={20} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{t('nav.logout')}</div>
            <div className="text-muted" style={{ fontSize: 12.5 }}>{t('account.endSession')}</div>
          </div>
        </button>
      </div>
    </div>
  )
}
