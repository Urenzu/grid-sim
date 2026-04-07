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
const HOUR_OPTIONS = [
  { value: 24,  label: '24h' },
  { value: 48,  label: '48h' },
  { value: 72,  label: '72h' },
  { value: 168, label: '7d' },
]

interface Props {
  genData:    BaGenData[] | null
  carbonData: unknown
  ba:         string
  onBaChange: (id: string) => void
}

export function Analytics({ genData: _genData, carbonData: _carbonData, ba, onBaChange }: Props) {
  const [hours, setHours] = useState(48)

  const { history, duck, loading } = useHistoryData(ba, hours)

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
          background: baColor,
          boxShadow: `0 0 8px ${baColor}55`,
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, alignItems: 'center' }}>
        <select value={ba} onChange={e => onBaChange(e.target.value)} style={ctrlStyle}>
          {BA_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{o.id} — {o.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {HOUR_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setHours(o.value)} style={{
              ...ctrlStyle,
              background: hours === o.value ? 'rgba(0,102,204,0.1)' : 'rgba(255,255,255,0.88)',
              border: hours === o.value ? '1px solid rgba(0,102,204,0.25)' : '1px solid rgba(0,0,0,0.08)',
              color: hours === o.value ? '#0066cc' : '#1a1a1a',
            }}>
              {o.label}
            </button>
          ))}
        </div>
        {loading && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(0,0,0,0.3)' }}>
            loading…
          </span>
        )}
      </div>

      {/* Chart grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ChartCard title="Duck Curve — Net Load vs Renewable Output">
          {duck ? <DuckCurve data={duck} /> : <Placeholder />}
        </ChartCard>

        <ChartCard title="Fuel Mix — Generation by Source">
          {history ? <FuelMixArea data={history} /> : <Placeholder />}
        </ChartCard>

        <ChartCard title="Carbon Intensity — g CO₂/kWh">
          {duck ? <CarbonLine data={duck} /> : <Placeholder />}
        </ChartCard>

        <ChartCard title="Renewable Penetration — % of Generation">
          {duck ? <RenewablePenetration data={duck} /> : <Placeholder />}
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
        fontSize: 9,
        letterSpacing: '0.16em',
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
