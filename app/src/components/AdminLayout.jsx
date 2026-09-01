import { useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ShoppingBag, Users, Package, Tag, Zap,
  Menu, X, ExternalLink, LogOut, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Pesanan', icon: ShoppingBag },
  { to: '/admin/users', label: 'Pengguna', icon: Users },
  { to: '/admin/products', label: 'Produk', icon: Package },
  { to: '/admin/flash-sale', label: 'Flash Sale', icon: Zap },
  { to: '/admin/coupons', label: 'Kupon', icon: Tag },
]

const TITLES = {
  '/admin': 'Dashboard',
  '/admin/orders': 'Kelola Pesanan',
  '/admin/users': 'Kelola Pengguna',
  '/admin/products': 'Kelola Produk',
  '/admin/flash-sale': 'Kelola Flash Sale',
  '/admin/coupons': 'Kelola Kupon',
}

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  let title = TITLES[location.pathname]
  if (!title && location.pathname.startsWith('/admin/')) title = 'Detail Pesanan'

  const doLogout = () => { setOpen(false); logout(); navigate('/') }

  return (
    <div className="admin-shell">
      {/* ===== Sidebar ===== */}
      <aside className={`admin-sidebar ${open ? 'is-open' : ''}`}>
        <div className="admin-brand">
          <span className="admin-brand-mark"><ShieldCheck size={20} /></span>
          <div>
            <div className="admin-brand-name">EvolusiAI</div>
            <div className="admin-brand-sub">Admin Panel</div>
          </div>
          <button className="admin-sidebar-close" onClick={() => setOpen(false)} aria-label="Tutup menu">
            <X size={20} />
          </button>
        </div>

        <nav className="admin-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'is-active' : ''}`}
            >
              <n.icon size={18} strokeWidth={2.2} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <Link to="/" className="admin-nav-item" onClick={() => setOpen(false)}>
            <ExternalLink size={18} strokeWidth={2.2} />
            <span>Lihat Toko</span>
          </Link>
          <button onClick={doLogout} className="admin-nav-item">
            <LogOut size={18} strokeWidth={2.2} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ===== Overlay (mobile) ===== */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="admin-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ===== Main ===== */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-burger" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="admin-title">{title}</h1>
          </div>
          <div className="admin-topbar-right">
            <Link to="/" className="admin-view-store">
              <ExternalLink size={15} /> <span>Lihat Toko</span>
            </Link>
            <div className="admin-user">
              <span className="admin-user-avatar">{user?.name?.[0]?.toUpperCase() || 'A'}</span>
              <div className="admin-user-meta">
                <div className="admin-user-name">{user?.name || 'Administrator'}</div>
                <div className="admin-user-role">Administrator</div>
              </div>
            </div>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
