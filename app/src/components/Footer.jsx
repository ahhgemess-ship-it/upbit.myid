import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useLang } from '../context/LanguageContext.jsx'

export default function Footer() {
  const { t } = useLang()
  return (
    <footer style={{ background: 'var(--ink)', color: 'var(--bg)', marginTop: 40 }}>
      <div className="container" style={{ padding: '64px 24px 32px' }}>
        <div
          className="split-2"
          style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 40 }}
        >
          <div>
            <div style={{ marginBottom: 16 }}>
              <img src="/logo.png" alt="EvolusiAI" className="brand-logo brand-logo-invert" style={{ height: 34 }} />
            </div>
            <p style={{ color: '#bdbbb1', fontSize: 15, maxWidth: 360, lineHeight: 1.6 }}>
              {t('footer.tagline')}
            </p>
            <Link to="/store" className="pill" style={{ marginTop: 22, color: 'var(--bg)', borderColor: 'var(--bg)' }}>
              {t('footer.startShopping')}
              <span className="pill-ic"><ArrowUpRight size={16} strokeWidth={2.6} /></span>
            </Link>
          </div>

          <FootCol
            title={t('footer.navigation')}
            links={[[t('nav.home'), '/'], [t('nav.store'), '/store'], [t('nav.cart'), '/cart'], [t('nav.about'), '/about']]}
          />
          <FootCol
            title={t('footer.help')}
            links={[[t('hero.howToOrder'), '/about'], [t('footer.warranty'), '/about'], [t('footer.contact'), '/about'], [t('footer.faq'), '/about']]}
          />
        </div>

        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between',
            marginTop: 48, paddingTop: 22, borderTop: '1px solid #43423c',
            color: '#9d9b92', fontSize: 13.5,
          }}
        >
          <span>{t('footer.rights')}</span>
          <span>{t('footer.madeFor')}</span>
        </div>
      </div>
    </footer>
  )
}

function FootCol({ title, links }) {
  return (
    <div>
      <h4 className="display" style={{ fontSize: 14, color: 'var(--lime)', marginBottom: 16, letterSpacing: '.08em' }}>
        {title}
      </h4>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {links.map(([label, to]) => (
          <li key={label}>
            <Link to={to} style={{ color: '#cfcdc4', fontSize: 14.5 }}>{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
