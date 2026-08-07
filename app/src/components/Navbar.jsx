import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, Menu, X, LogIn, LogOut, ChevronDown, ChevronRight, Package, User as UserIcon, ShieldCheck, Wallet } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useBalance } from '../context/BalanceContext.jsx'
import { useLang } from '../context/LanguageContext.jsx'
import NotificationBell from './NotificationBell.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'

const links = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/store', key: 'nav.store' },
  { to: '/flash-sale', key: 'nav.flashSale', hot: true },
  { to: '/about', key: 'nav.about' },
]

export default function Navbar() {
  const { count } = useCart()
  const { user, logout, isAdmin } = useAuth()
  const { balance } = useBalance()
  const { t } = useLang()
  const fmtBal = (n) => n >= 1000 ? 'Rp ' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'rb' : 'Rp ' + n
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [acctOpen, setAcctOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const acctRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (acctRef.current && !acctRef.current.contains(e.target)) setAcctOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`site-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div
        className="container site-nav-inner"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Link to="/" className="brand-link" onClick={() => setOpen(false)} aria-label="Upbit Store">
          <img src="/logo.png" alt="Upbit Store" className="brand-logo" />
        </Link>

        {/* desktop nav */}
        <nav className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              style={({ isActive }) => ({
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontWeight: 600,
                fontSize: 15,
                color: isActive ? 'var(--indigo)' : 'var(--ink)',
                paddingBottom: 3,
                borderBottom: isActive ? '2px solid var(--indigo)' : '2px solid transparent',
              })}
            >
              {t(l.key)}
              {l.hot && <span className="nav-hot">HOT</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LanguageSwitcher />
          <NotificationBell />
          <Link to="/cart" className="pill" style={{ padding: '9px 15px' }}>
            <ShoppingCart size={18} strokeWidth={2.2} />
            <span className="cart-label">{t('nav.cart')}</span>
            <motion.span
              key={count}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              style={{
                display: 'grid', placeItems: 'center', minWidth: 22, height: 22, padding: '0 6px',
                borderRadius: 999, background: 'var(--lime)', color: 'var(--ink)',
                fontSize: 12, fontWeight: 700,
              }}
            >
              {count}
            </motion.span>
          </Link>

          {/* Account */}
          {user ? (
            <div ref={acctRef} style={{ position: 'relative' }} className="acct-wrap">
              <button
                onClick={() => setAcctOpen((o) => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', border: '1.5px solid var(--line)', borderRadius: 999, background: 'var(--surface)' }}
                aria-label="Menu akun"
              >
                <span className="avatar">
                  {user.picture ? <img src={user.picture} alt="" width={34} height={34} style={{ objectFit: 'cover' }} /> : user.initials}
                </span>
                <ChevronDown size={15} style={{ color: 'var(--muted)' }} />
              </button>

              {acctOpen && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="acct-menu">
                  <div style={{ padding: '8px 12px 12px', borderBottom: '1.5px solid var(--line-soft)', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{user.name}</div>
                    <div className="text-muted" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{user.email}</div>
                    <span className="chip" style={{ marginTop: 8, fontSize: 10.5, padding: '3px 8px' }}>
                      Google
                    </span>
                  </div>
                  <Link to="/balance" className="acct-balance-card" onClick={() => setAcctOpen(false)}>
                    <span className="acct-balance-icon"><Wallet size={18} strokeWidth={2.4} /></span>
                    <span className="acct-balance-info">
                      <span className="acct-balance-label">Saldo</span>
                      <span className="acct-balance-value">{fmtBal(balance)}</span>
                    </span>
                    <ChevronRight size={17} className="acct-balance-arrow" />
                  </Link>
                  <Link to="/account" className="acct-item" onClick={() => setAcctOpen(false)}>
                    <UserIcon size={17} /> {t('nav.myAccount')}
                  </Link>
                  <Link to="/orders" className="acct-item" onClick={() => setAcctOpen(false)}>
                    <Package size={17} /> {t('nav.orderHistory')}
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="acct-item" onClick={() => setAcctOpen(false)} style={{ color: 'var(--indigo)' }}>
                      <ShieldCheck size={17} /> {t('nav.adminPanel')}
                    </Link>
                  )}
                  <Link to="/cart" className="acct-item" onClick={() => setAcctOpen(false)}>
                    <ShoppingCart size={17} /> {t('nav.cart')}
                  </Link>
                  <button className="acct-item" onClick={() => { logout(); setAcctOpen(false); navigate('/') }}>
                    <LogOut size={17} /> {t('nav.logout')}
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <Link to="/login" className="pill pill-solid acct-login" style={{ padding: '9px 16px' }}>
              <LogIn size={17} strokeWidth={2.2} />
              <span className="cart-label">{t('nav.login')}</span>
            </Link>
          )}

          <button
            className="nav-toggle"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            style={{ display: 'none', width: 40, height: 40, placeItems: 'center', border: '1.5px solid var(--ink)', borderRadius: 10 }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* mobile menu — card dropdown di pojok kanan */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="nav-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              className="nav-mobile-card"
              initial={{ opacity: 0, scale: 0.92, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  onClick={() => setOpen(false)}
                  className="nav-mobile-item"
                  style={({ isActive }) => ({ color: isActive ? 'var(--indigo)' : 'var(--ink)' })}
                >
                  {t(l.key)}
                  {l.hot && <span className="nav-hot">HOT</span>}
                </NavLink>
              ))}
              <div className="nav-mobile-sep" />
              <div className="nav-mobile-lang"><LanguageSwitcher variant="mobile" /></div>
              <div className="nav-mobile-sep" />
              {user ? (
                <>
              <div className="nav-mobile-notif"><NotificationBell variant="mobile" /></div>
              <Link to="/balance" onClick={() => setOpen(false)} className="nav-balance-card">
                <span className="nav-balance-icon"><Wallet size={20} strokeWidth={2.3} /></span>
                <span className="nav-balance-info">
                  <span className="nav-balance-label">Saldo</span>
                  <span className="nav-balance-value">{fmtBal(balance)}</span>
                  <span className="nav-balance-hint">Bisa dipakai untuk checkout</span>
                </span>
                <ChevronRight size={19} className="nav-balance-arrow" />
              </Link>
              <Link to="/account" onClick={() => setOpen(false)} className="nav-mobile-item">
                    <UserIcon size={18} /> {t('nav.myAccount')}
                  </Link>
                  <Link to="/orders" onClick={() => setOpen(false)} className="nav-mobile-item">
                    <Package size={18} /> {t('nav.orderHistory')}
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setOpen(false)} className="nav-mobile-item" style={{ color: 'var(--indigo)' }}>
                      <ShieldCheck size={18} /> {t('nav.adminPanel')}
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setOpen(false); navigate('/') }}
                    className="nav-mobile-item"
                  >
                    <LogOut size={18} /> {t('nav.logout')} ({user.name.split(' ')[0]})
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="nav-mobile-item"
                  style={{ color: 'var(--indigo)' }}
                >
                  <LogIn size={18} /> {t('nav.login')}
                </Link>
              )}
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
