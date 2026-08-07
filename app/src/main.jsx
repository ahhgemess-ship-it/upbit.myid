import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { BalanceProvider } from './context/BalanceContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { CatalogProvider } from './context/CatalogContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <BalanceProvider>
            <CatalogProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </CatalogProvider>
            </BalanceProvider>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
