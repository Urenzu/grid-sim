import { AnimatePresence, motion } from 'motion/react'
import type { GridData, BaGenData } from '../types'
import { FUEL_COLORS, BA_COLORS, BA_DEFS } from '../data/ba'

const BA_LABEL_MAP: Record<string, string> = Object.fromEntries(
  BA_DEFS.map(([id, label]) => [id, label])
)

function fmtMW(mw: number) {
  const abs = Math.abs(mw)
  return abs >= 1000 ? (abs / 1000).toFixed(1) + ' GW' : Math.round(abs) + ' MW'
}

interface Props {
  baId:            string | null
  selectedBA:      string | null
  data:            GridData | null
  genData:         BaGenData[] | null
  onViewAnalytics: (id: string) => void
}

export function BAInfoPanel({ baId, selectedBA, data, genData, onViewAnalytics }: Props) {
  const color  = baId ? (BA_COLORS[baId] ?? '#333333') : '#333333'
  const label  = baId ? (BA_LABEL_MAP[baId] ?? baId) : null
  const baGen  = baId ? (genData?.find(d => d.ba === baId) ?? null) : null

  const links   = data?.links ?? []
  const net     = baId
    ? links.reduce((acc, l) => {
        if (l.source === baId) return acc + l.value
        if (l.target === baId) return acc - l.value
        return acc
      }, 0)
    : 0

  const partners = baId
    ? links
        .filter(l => l.source === baId || l.target === baId)
        .map(l => {
          const partnerId = l.source === baId ? l.target : l.source
          const flow      = l.source === baId ? l.value : -l.value
          return { id: partnerId, flow }
        })
        .sort((a, b) => Math.abs(b.flow) - Math.abs(a.flow))
    : []

  const isExport  = net >= 0
  const flowColor = isExport ? '#2563eb' : '#ea580c'

  return (
    <div style={{
      position: 'fixed',
      top: 72,
      right: 24,
      zIndex: 20,
      width: 300,
      pointerEvents: 'none',
    }}>
      <AnimatePresence mode="wait">
        {baId && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="glass"
            style={{ padding: '20px 22px', pointerEvents: 'all' }}
          >
            <AnimatePresence mode="wait">
            <motion.div key={baId}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.08 }}
            >

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 8px ${color}55`,
                flexShrink: 0,
              }} />
              <div>
                <div style={{
                  fontSize: 14, fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: 'rgba(0,0,0,0.82)', lineHeight: 1.3,
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.14em',
                  color: 'rgba(0,0,0,0.35)', marginTop: 2,
                }}>
                  {baId}
                </div>
              </div>
            </div>

            <Divider />

            {/* ── Interchange stats ── */}
            <Row label={isExport ? 'net export' : 'net import'} value={fmtMW(net)} valueColor={flowColor} />
            <Row label="active links" value={String(partners.length)} />

            {/* ── Fuel mix ── */}
            {baGen && (
              <>
                <Divider top={14} bottom={12} />
                <SectionLabel>Generation</SectionLabel>
                <Row label="total output" value={fmtMW(baGen.totalMw)} />
                <div style={{ marginTop: 14, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
                  <FuelDonut fuels={baGen.fuels} total={baGen.totalMw} />
                </div>
                <div style={{ marginTop: 12 }}>
                  {baGen.fuels.map(f => (
                    <FuelRow key={f.fuel} fuel={f.fuel} mw={f.mw} total={baGen.totalMw} />
                  ))}
                </div>
              </>
            )}

            {/* ── Exchanges ── */}
            {partners.length > 0 && (
              <>
                <Divider top={14} bottom={12} />
                <SectionLabel>Exchanges ({partners.length})</SectionLabel>
                <div style={{ maxHeight: 200, overflowY: 'auto', overflowX: 'hidden' }}>
                  {partners.map(p => {
                    const partnerColor = BA_COLORS[p.id] ?? '#6b7280'
                    const partnerLabel = BA_LABEL_MAP[p.id] ?? p.id
                    return (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between',
                        marginBottom: 8, alignItems: 'center', gap: 8,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: partnerColor, flexShrink: 0,
                          }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontFamily: 'var(--font-mono)', fontSize: 11,
                              color: 'rgba(0,0,0,0.65)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {partnerLabel}
                            </div>
                            <div style={{
                              fontFamily: 'var(--font-mono)', fontSize: 10,
                              color: 'rgba(0,0,0,0.35)',
                            }}>
                              {p.id}
                            </div>
                          </div>
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11,
                          fontWeight: 500,
                          color: p.flow >= 0 ? '#2563eb' : '#ea580c',
                          flexShrink: 0,
                        }}>
                          {p.flow >= 0 ? '↑' : '↓'} {fmtMW(p.flow)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* ── Dispatch CTA — only when locked (selected) ── */}
            {selectedBA === baId && (
              <>
                <Divider top={16} bottom={14} />
                <button
                  onClick={() => onViewAnalytics(baId!)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,102,204,0.06)',
                    border: '1px solid rgba(0,102,204,0.18)',
                    borderRadius: 8,
                    padding: '10px 0',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#0066cc',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,102,204,0.11)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,102,204,0.3)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,102,204,0.06)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,102,204,0.18)'
                  }}
                >
                  view in dispatch →
                </button>
              </>
            )}

            </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function Divider({ top = 12, bottom = 12 }: { top?: number; bottom?: number }) {
  return (
    <div style={{
      borderTop: '1px solid rgba(0,0,0,0.07)',
      marginTop: top, marginBottom: bottom,
    }} />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10, letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'rgba(0,0,0,0.38)',
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      marginBottom: 6, alignItems: 'baseline',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'rgba(0,0,0,0.45)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        fontWeight: 500,
        color: valueColor ?? 'rgba(0,0,0,0.72)',
      }}>
        {value}
      </span>
    </div>
  )
}

function FuelRow({ fuel, mw, total }: { fuel: string; mw: number; total: number }) {
  const pct = Math.round((mw / total) * 100)
  const fc  = FUEL_COLORS[fuel] ?? '#6b7280'
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: fc, flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'rgba(0,0,0,0.55)',
            textTransform: 'capitalize',
          }}>
            {fuel}
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'rgba(0,0,0,0.65)',
        }}>
          {fmtMW(mw)}{' '}
          <span style={{ color: 'rgba(0,0,0,0.35)' }}>{pct}%</span>
        </span>
      </div>
      <div style={{
        height: 3, borderRadius: 2,
        background: 'rgba(0,0,0,0.07)',
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.05 }}
          style={{ height: '100%', borderRadius: 2, background: fc, opacity: 0.85 }}
        />
      </div>
    </div>
  )
}

function FuelDonut({ fuels, total }: { fuels: Array<{ fuel: string; mw: number }>; total: number }) {
  const R = 40, r = 26, cx = 46, cy = 46
  let angle = -Math.PI / 2

  const slices = fuels.slice(0, 7).map(f => {
    const sweep = (f.mw / total) * 2 * Math.PI
    const start = angle
    const end   = angle + sweep
    angle = end
    return { fuel: f.fuel, start, end, sweep }
  })

  const arc = (s: number, e: number, outer: number, inner: number, large: number) => {
    const ox1 = cx + outer * Math.cos(s), oy1 = cy + outer * Math.sin(s)
    const ox2 = cx + outer * Math.cos(e), oy2 = cy + outer * Math.sin(e)
    const ix1 = cx + inner * Math.cos(e), iy1 = cy + inner * Math.sin(e)
    const ix2 = cx + inner * Math.cos(s), iy2 = cy + inner * Math.sin(s)
    return `M ${ox1} ${oy1} A ${outer} ${outer} 0 ${large} 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${inner} ${inner} 0 ${large} 0 ${ix2} ${iy2} Z`
  }

  return (
    <svg width={92} height={92}>
      {slices.map(({ fuel, start, end, sweep }) => {
        const large = sweep > Math.PI ? 1 : 0
        const color = FUEL_COLORS[fuel] ?? '#6b7280'
        return (
          <path
            key={fuel}
            d={arc(start, end, R, r, large)}
            fill={color}
            opacity={0.88}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={0.8}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r - 1} fill="rgba(255,255,255,0.95)" />
    </svg>
  )
}
