import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import Store from './pages/Store.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Cart from './pages/Cart.jsx'
import About from './pages/About.jsx'
import Auth from './pages/Auth.jsx'
import FlashSale from './pages/FlashSale.jsx'
import Checkout from './pages/Checkout.jsx'
import Orders from './pages/Orders.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import Account from './pages/Account.jsx'
import Balance from './pages/Balance.jsx'
import AdminOrders from './pages/AdminOrders.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminOrderDetail from './pages/AdminOrderDetail.jsx'
import AdminProducts from './pages/AdminProducts.jsx'
import AdminCoupons from './pages/AdminCoupons.jsx'
import NotFound from './pages/NotFound.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
  }, [pathname])
  return null
}

function Page({ children }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.main>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ScrollToTop />
      <Navbar />
      <div style={{ flex: 1 }}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Page><Home /></Page>} />
            <Route path="/store" element={<Page><Store /></Page>} />
            <Route path="/flash-sale" element={<Page><FlashSale /></Page>} />
            <Route path="/product/:id" element={<Page><ProductDetail /></Page>} />
            <Route path="/cart" element={<Page><Cart /></Page>} />
            <Route path="/checkout" element={<Page><Checkout /></Page>} />
            <Route path="/orders" element={<Page><Orders /></Page>} />
            <Route path="/orders/:id" element={<Page><OrderDetail /></Page>} />
            <Route path="/account" element={<Page><Account /></Page>} />
            <Route path="/balance" element={<Page><Balance /></Page>} />
            <Route path="/admin" element={<Page><AdminOrders /></Page>} />
            <Route path="/admin/users" element={<Page><AdminUsers /></Page>} />
            <Route path="/admin/products" element={<Page><AdminProducts /></Page>} />
            <Route path="/admin/coupons" element={<Page><AdminCoupons /></Page>} />
            <Route path="/admin/:id" element={<Page><AdminOrderDetail /></Page>} />
            <Route path="/about" element={<Page><About /></Page>} />
            <Route path="/login" element={<Page><Auth /></Page>} />
            <Route path="*" element={<Page><NotFound /></Page>} />
          </Routes>
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  )
}
