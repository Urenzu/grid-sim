import { AnimatePresence, motion } from 'motion/react'
import type { GridData, BaGenData } from '../types'
import { FUEL_COLORS } from './GridMap'

const BA_LABELS: Record<string, string> = {
  BPAT: 'Bonneville Power Admin',
  PACW: 'PacifiCorp West',
  CISO: 'California ISO',
  IPCO: 'Idaho Power',
  NEVP: 'NV Energy',
  PACE: 'PacifiCorp East',
  AZPS: 'Arizona Public Service',
  SRP:  'Salt River Project',
  WACM: 'WAPA Colorado',
  PSCO: 'Xcel Energy Colorado',
  SWPP: 'Southwest Power Pool',
  ERCO: 'ERCOT',
  MISO: 'Midcontinent ISO',
  TVA:  'Tennessee Valley Authority',
  PJM:  'PJM Interconnection',
  DUK:  'Duke Energy',
  SC:   'South Carolina E&G',
  FPL:  'Florida Power & Light',
  NYIS: 'New York ISO',
  ISNE: 'ISO New England',
}

const BA_COLORS: Record<string, string> = {
  BPAT: '#4a9eff', PACW: '#38c4f0', CISO: '#f0c93a', IPCO: '#5bcce0',
  NEVP: '#f0a83a', PACE: '#8870e0', AZPS: '#f07840', SRP:  '#e86030',
  WACM: '#7090d8', PSCO: '#5878c8', SWPP: '#40c878', ERCO: '#e84848',
  MISO: '#50b870', TVA:  '#38c0a8', PJM:  '#7878f0', DUK:  '#90c840',
  SC:   '#b0d840', FPL:  '#f09040', NYIS: '#9090f8', ISNE: '#c0c0ff',
}

function fmtMW(mw: number) {
  const abs = Math.abs(mw)
  return abs >= 1000 ? (abs / 1000).toFixed(1) + ' GW' : Math.round(abs) + ' MW'
}

interface Props {
  baId:    string | null
  data:    GridData | null
  genData: BaGenData[] | null
}

export function BAInfoPanel({ baId, data, genData }: Props) {
  const color  = baId ? (BA_COLORS[baId] ?? '#ffffff') : '#ffffff'
  const label  = baId ? (BA_LABELS[baId] ?? baId) : null
  const baGen  = baId ? (genData?.find(d => d.ba === baId) ?? null) : null

  const links  = data?.links ?? []
  const net    = baId
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
          const flow = l.source === baId ? l.value : -l.value
          return { id: partnerId, flow }
        })
        .sort((a, b) => Math.abs(b.flow) - Math.abs(a.flow))
        .slice(0, 4)
    : []

  const isExport  = net >= 0
  const flowColor = isExport ? '#4a9eff' : '#ff8040'

  return (
    <div style={{
      position: 'fixed',
      top: 56,
      right: 24,
      zIndex: 20,
      width: 260,
      pointerEvents: 'none',
    }}>
      <AnimatePresence mode="wait">
        {baId && (
          <motion.div
            key={baId}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="glass"
            style={{ padding: '16px 18px', overflow: 'hidden' }}
          >
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 8px ${color}88`,
                flexShrink: 0,
              }} />
              <div>
                <div style={{
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                  color: 'rgba(255,255,255,0.82)', lineHeight: 1.3,
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 8, fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.18em',
                  color: 'rgba(255,255,255,0.2)', marginTop: 2,
                }}>
                  {baId}
                </div>
              </div>
            </div>

            <Divider />

            {/* ── Interchange stats ── */}
            <Row label={isExport ? 'net export' : 'net import'} value={fmtMW(net)} valueColor={flowColor} />
            <Row label="active links" value={String(partners.length)} />

            {/* ── Fuel mix (generation mode data) ── */}
            {baGen && (
              <>
                <Divider top={12} bottom={10} />
                <SectionLabel>Generation</SectionLabel>
                <Row label="total output" value={fmtMW(baGen.totalMw)} />
                <div style={{ marginTop: 10 }}>
                  <FuelDonut fuels={baGen.fuels} total={baGen.totalMw} />
                </div>
                <div style={{ marginTop: 10 }}>
                  {baGen.fuels.map(f => (
                    <FuelRow key={f.fuel} fuel={f.fuel} mw={f.mw} total={baGen.totalMw} />
                  ))}
                </div>
              </>
            )}

            {/* ── Top exchanges ── */}
            {partners.length > 0 && (
              <>
                <Divider top={12} bottom={10} />
                <SectionLabel>Exchanges</SectionLabel>
                {partners.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: 5, alignItems: 'center',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: 'rgba(255,255,255,0.32)',
                    }}>
                      {p.id}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: p.flow >= 0 ? '#4a9eff' : '#ff8040',
                    }}>
                      {p.flow >= 0 ? '↑' : '↓'} {fmtMW(p.flow)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function Divider({ top = 10, bottom = 10 }: { top?: number; bottom?: number }) {
  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      marginTop: top, marginBottom: bottom,
    }} />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 7, letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.16)',
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      marginBottom: 5, alignItems: 'baseline',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'rgba(255,255,255,0.25)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: valueColor ?? 'rgba(255,255,255,0.55)',
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
    <div style={{ marginBottom: 6 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 3,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: fc, flexShrink: 0,
            boxShadow: `0 0 4px ${fc}66`,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'rgba(255,255,255,0.32)',
            textTransform: 'capitalize',
          }}>
            {fuel}
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'rgba(255,255,255,0.48)',
        }}>
          {fmtMW(mw)}{' '}
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8 }}>{pct}%</span>
        </span>
      </div>
      {/* Progress bar */}
      <div style={{
        height: 2, borderRadius: 1,
        background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.05 }}
          style={{ height: '100%', borderRadius: 1, background: fc, opacity: 0.7 }}
        />
      </div>
    </div>
  )
}

function FuelDonut({ fuels, total }: { fuels: Array<{fuel: string; mw: number}>; total: number }) {
  const R = 30, r = 19, cx = 35, cy = 35
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
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={70} height={70}>
        {slices.map(({ fuel, start, end, sweep }) => {
          const large = sweep > Math.PI ? 1 : 0
          const color = FUEL_COLORS[fuel] ?? '#6b7280'
          return (
            <path
              key={fuel}
              d={arc(start, end, R, r, large)}
              fill={color}
              opacity={0.85}
              stroke="rgba(10,10,10,0.5)"
              strokeWidth={0.5}
            />
          )
        })}
        <circle cx={cx} cy={cy} r={r - 1} fill="rgba(10,10,10,0.95)" />
      </svg>
    </div>
  )
}
