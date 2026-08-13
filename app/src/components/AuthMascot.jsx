import { motion } from 'framer-motion'

// Maskot robot EvolusiAI (flat, warna brand, tanpa gradient). Bergerak: mengambang,
// berkedip, melambai, antena berdenyut.
// PENTING: elemen ber-posisi (.auth-mascot) harus div biasa — framer-motion
// menulis `transform` inline yang akan menimpa translate centering CSS bila
// dipasang di elemen yang sama. Jadi animasi masuk dipasang di anak.
export default function AuthMascot() {
  return (
    <div className="auth-mascot" aria-hidden="true">
      <motion.div
        initial={{ opacity: 0, y: -22, scale: 0.7 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 13, delay: 0.15 }}
      >
        <div className="mascot-float">
          <svg viewBox="0 0 140 150" width="100%" height="100%" role="img">
            {/* bayangan */}
            <ellipse className="mascot-shadow" cx="70" cy="141" rx="30" ry="5.5" fill="#2b2b28" />

            <g className="mascot-body">
              {/* antena */}
              <line x1="70" y1="40" x2="70" y2="27" stroke="#2b2b28" strokeWidth="3" strokeLinecap="round" />
              <circle className="mascot-antenna" cx="70" cy="21" r="6" fill="#c5f82a" stroke="#2b2b28" strokeWidth="3" />

              {/* telinga / panel samping */}
              <rect x="19" y="63" width="9" height="24" rx="4.5" fill="#2b2b28" />
              <rect x="112" y="63" width="9" height="24" rx="4.5" fill="#2b2b28" />

              {/* kepala */}
              <rect x="26" y="40" width="88" height="72" rx="26" fill="#4f46e5" stroke="#2b2b28" strokeWidth="3" />

              {/* visor */}
              <rect x="36" y="53" width="68" height="36" rx="18" fill="#211c52" stroke="#2b2b28" strokeWidth="2.5" />

              {/* mata (berkedip) */}
              <g className="mascot-eyes">
                <circle cx="58" cy="71" r="6.5" fill="#c5f82a" />
                <circle cx="82" cy="71" r="6.5" fill="#c5f82a" />
                <circle cx="60" cy="69" r="2" fill="#eafbb8" />
                <circle cx="84" cy="69" r="2" fill="#eafbb8" />
              </g>

              {/* pipi + senyum */}
              <circle cx="45" cy="99" r="3.4" fill="#c5f82a" opacity="0.85" />
              <circle cx="95" cy="99" r="3.4" fill="#c5f82a" opacity="0.85" />
              <path d="M61 99 Q70 105 79 99" stroke="#c5f82a" strokeWidth="3" fill="none" strokeLinecap="round" />

              {/* lengan kiri */}
              <rect x="17" y="92" width="12" height="25" rx="6" fill="#4f46e5" stroke="#2b2b28" strokeWidth="3" />

              {/* lengan kanan melambai */}
              <g className="mascot-wave">
                <rect x="111" y="92" width="12" height="25" rx="6" fill="#4f46e5" stroke="#2b2b28" strokeWidth="3" />
                <circle cx="117" cy="92" r="7" fill="#c5f82a" stroke="#2b2b28" strokeWidth="3" />
              </g>
            </g>
          </svg>
        </div>
      </motion.div>
    </div>
  )
}
