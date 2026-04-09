import { useState } from 'react'
import type { BaGenData } from '../types'
import { useHistoryData } from '../hooks/useHistoryData'
import { BA_DEFS, BA_COLORS } from '../data/ba'
import { DuckCurve }            from './charts/DuckCurve'
import { FuelMixArea }          from './charts/FuelMixArea'
import { CarbonLine }           from './charts/CarbonLine'
import { RenewablePenetration } from './charts/RenewablePenetration'

const BA_OPTIONS  = BA_DEFS.map(([id, name]) => ({ id, name }))
const BA_NAME_MAP = Object.fromEntries(BA_DEFS.map(([id, name]) => [id, name]))

const PRESETS = [
  { hours: 24,  label: '24h' },
  { hours: 48,  label: '48h' },
  { hours: 72,  label: '72h' },
  { hours: 168, label: '7d'  },
]

interface Props {
  genData:    BaGenData[] | null
  carbonData: unknown
  ba:         string
  onBaChange: (id: string) => void
}

export function Dispatch({ genData: _genData, carbonData: _carbonData, ba, onBaChange }: Props) {
  const [hours, setHours] = useState(48)

  const { history, duck, loading, fetching } = useHistoryData(ba, hours)

  const baColor = BA_COLORS[ba] ?? '#333'
  const baName  = BA_NAME_MAP[ba] ?? ba

  const ctrlStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 8,
    padding: '6px 12px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: '#1a1a1a',
    cursor: 'pointer',
    outline: 'none',
  }

  const activeBtnStyle = {
    ...ctrlStyle,
    background: 'rgba(0,102,204,0.1)',
    border: '1px solid rgba(0,102,204,0.25)',
    color: '#0066cc',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(248,248,248,0.97)',
      overflowY: 'auto',
      padding: '72px 32px 40px',
    }}>
      {/* BA identity header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: baColor, boxShadow: `0 0 8px ${baColor}55`,
          flexShrink: 0, alignSelf: 'center',
        }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 18,
          fontWeight: 600, color: 'rgba(0,0,0,0.8)', letterSpacing: '-0.01em',
        }}>
          {baName}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '0.18em', color: 'rgba(0,0,0,0.25)',
        }}>
          {ba}
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* BA selector */}
        <select value={ba} onChange={e => onBaChange(e.target.value)} style={ctrlStyle}>
          {BA_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{o.id} — {o.name}</option>
          ))}
        </select>

        {/* Time range buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {PRESETS.map(o => (
            <button key={o.hours} onClick={() => setHours(o.hours)} style={
              hours === o.hours ? activeBtnStyle : ctrlStyle
            }>
              {o.label}
            </button>
          ))}
        </div>

        {fetching && !loading && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(0,0,0,0.25)' }}>
            updating…
          </span>
        )}
      </div>

      {/* Chart grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
        opacity: fetching && !loading ? 0.55 : 1,
        transition: 'opacity 0.15s ease',
      }}>
        <ChartCard title="Duck Curve — Net Load vs Renewable Output">
          {duck ? <DuckCurve data={duck} /> : loading ? <ChartSkeleton /> : <Placeholder />}
        </ChartCard>

        <ChartCard title="Fuel Mix — Generation by Source">
          {history ? <FuelMixArea data={history} /> : loading ? <ChartSkeleton /> : <Placeholder />}
        </ChartCard>

        <ChartCard title="Carbon Intensity — g CO₂/kWh">
          {duck ? <CarbonLine data={duck} /> : loading ? <ChartSkeleton /> : <Placeholder />}
        </ChartCard>

        <ChartCard title="Renewable Penetration — % of Generation">
          {duck ? <RenewablePenetration data={duck} /> : loading ? <ChartSkeleton /> : <Placeholder />}
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.9)',
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 12,
      padding: '20px 24px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9, letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'rgba(0,0,0,0.35)',
        marginBottom: 16,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div style={{ height: 220, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end', paddingBottom: 4 }}>
      {/* Simulated bars that pulse — gives chart-like spatial context */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, padding: '0 2px' }}>
        {[0.45, 0.7, 0.55, 0.85, 0.6, 0.9, 0.5, 0.75, 0.65, 0.8, 0.55, 0.7].map((h, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${h * 100}%`,
            background: 'rgba(0,0,0,0.055)',
            borderRadius: 3,
            backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: `shimmer 1.6s ease-in-out ${i * 0.06}s infinite`,
          }} />
        ))}
      </div>
      {/* Baseline */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '0 2px' }} />
    </div>
  )
}

function Placeholder() {
  return (
    <div style={{
      height: 220,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(0,0,0,0.2)',
      fontFamily: 'var(--font-mono)', fontSize: 10,
    }}>
      no data
    </div>
  )
}
