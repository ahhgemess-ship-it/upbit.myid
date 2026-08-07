import Asterisk from './Asterisk.jsx'
import { useLang } from '../context/LanguageContext.jsx'

const defaultKeys = ['mq.warranty', 'mq.instant', 'mq.legal', 'mq.support', 'mq.bestPrice', 'mq.securePay']

export default function Marquee({ items }) {
  const { t } = useLang()
  const base = items || defaultKeys.map((k) => t(k))
  const loop = [...base, ...base]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {loop.map((t, i) => (
          <span className="marquee-item" key={i}>
            <Asterisk size={16} color="var(--lime)" />
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}
