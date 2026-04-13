import { useState } from 'react'
import type { BaGenData, GenHistoryPoint, DuckPoint } from '../types'
import { useHistoryData } from '../hooks/useHistoryData'
import { useRangeData }   from '../hooks/useRangeData'
import { BA_DEFS, BA_COLORS } from '../data/ba'
import { DuckCurve }            from './charts/DuckCurve'
import { FuelMixArea }          from './charts/FuelMixArea'
import { CarbonLine }           from './charts/CarbonLine'
import { RenewablePenetration } from './charts/RenewablePenetration'

const BA_OPTIONS  = BA_DEFS.map(([id, name]) => ({ id, name: name as string }))
const BA_NAME_MAP = Object.fromEntries(BA_DEFS.map(([id, name]) => [id, name]))

type PresetMode = 'live' | 'range'
interface Preset {
  label: string
  mode:  PresetMode
  hours?: number
  days?:  number
}

const PRESETS: Preset[] = [
  { label: '24h',  mode: 'live',  hours: 24  },
  { label: '48h',  mode: 'live',  hours: 48  },
  { label: '72h',  mode: 'live',  hours: 72  },
  { label: '7d',   mode: 'live',  hours: 168 },
  { label: '30d',  mode: 'range', days: 30   },
  { label: '90d',  mode: 'range', days: 90   },
  { label: '1y',   mode: 'range', days: 365  },
]

const DEFAULT_PRESET = PRESETS[1]  // 48h

interface Props {
  genData:    BaGenData[] | null
  carbonData: unknown
  ba:         string
  onBaChange: (id: string) => void
}

// Inner component so hooks are always called unconditionally
function LiveCharts({ ba, hours }: { ba: string; hours: number }) {
  const { history, duck, loading, fetching } = useHistoryData(ba, hours)
  return <ChartGrid history={history} duck={duck} loading={loading} fetching={fetching} />
}

function RangeCharts({ ba, days }: { ba: string; days: number }) {
  const { history, duck, loading, fetching } = useRangeData(ba, days)
  return <ChartGrid history={history} duck={duck} loading={loading} fetching={fetching} />
}

function ChartGrid({
  history, duck, loading, fetching,
}: {
  history:  GenHistoryPoint[] | null
  duck:     DuckPoint[]       | null
  loading:  boolean
  fetching: boolean
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
      opacity: fetching && !loading ? 0.55 : 1,
      transition: 'opacity 0.15s ease',
    }}>
      <ChartCard title="Duck Curve — Net Load vs Renewable Output">
        {duck ? <DuckCurve data={duck} /> : <ChartBlank />}
      </ChartCard>

      <ChartCard title="Fuel Mix — Generation by Source">
        {history ? <FuelMixArea data={history} /> : <ChartBlank />}
      </ChartCard>

      <ChartCard title="Carbon Intensity — g CO₂/kWh">
        {duck ? <CarbonLine data={duck} /> : <ChartBlank />}
      </ChartCard>

      <ChartCard title="Renewable Penetration — % of Generation">
        {duck ? <RenewablePenetration data={duck} /> : <ChartBlank />}
      </ChartCard>
    </div>
  )
}

export function Dispatch({ genData: _genData, carbonData: _carbonData, ba, onBaChange }: Props) {
  const [preset, setPreset] = useState<Preset>(DEFAULT_PRESET)

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

  // Divider between live and range presets
  const livePresets  = PRESETS.filter(p => p.mode === 'live')
  const rangePresets = PRESETS.filter(p => p.mode === 'range')

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

        {/* Live presets */}
        <div style={{ display: 'flex', gap: 4 }}>
          {livePresets.map(p => (
            <button key={p.label} onClick={() => setPreset(p)} style={
              preset.label === p.label ? activeBtnStyle : ctrlStyle
            }>
              {p.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.12)' }} />

        {/* Range presets */}
        <div style={{ display: 'flex', gap: 4 }}>
          {rangePresets.map(p => (
            <button key={p.label} onClick={() => setPreset(p)} style={
              preset.label === p.label ? activeBtnStyle : ctrlStyle
            }>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts — rendered by mode so hooks are stable */}
      {preset.mode === 'live'
        ? <LiveCharts  ba={ba} hours={preset.hours!} />
        : <RangeCharts ba={ba} days={preset.days!}  />
      }
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

function ChartBlank() {
  return <div style={{ height: 220 }} />
}
