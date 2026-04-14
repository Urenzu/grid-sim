import { useState } from 'react'

import type { BaGenData, GenHistoryPoint, DuckPoint } from '../types'
import { useHistoryData } from '../hooks/useHistoryData'
import { useRangeData }   from '../hooks/useRangeData'
import { BA_DEFS, BA_COLORS } from '../data/ba'
import { DuckCurve }            from './charts/DuckCurve'
import { FuelMixArea }          from './charts/FuelMixArea'
import { CarbonLine }           from './charts/CarbonLine'
import { RenewablePenetration } from './charts/RenewablePenetration'
import { ChartTitle, ChartModal } from './ChartTitle'

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
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
      gap: 20,
      opacity: fetching && !loading ? 0.55 : 1,
      transition: 'opacity 0.15s ease',
    }}>
      <ChartCard
        title="Duck Curve"
        explanation="Net load after subtracting solar and wind. The midday dip is solar doing work; the sharp evening rise is when solar drops and demand peaks."
      >
        {duck ? <DuckCurve data={duck} /> : <ChartBlank />}
      </ChartCard>

      <ChartCard
        title="Fuel Mix"
        explanation="Generation by source over time, stacked. Shows how fuels compete and hand off across the day."
      >
        {history ? <FuelMixArea data={history} /> : <ChartBlank />}
      </ChartCard>

      <ChartCard
        title="Carbon Intensity"
        explanation="Grams of CO₂ per kWh generated. Dips when renewables are high, spikes when fossil fuels carry more load. Dashed line is the US average (~386 g/kWh)."
      >
        {duck ? <CarbonLine data={duck} /> : <ChartBlank />}
      </ChartCard>

      <ChartCard
        title="Clean Energy Share"
        explanation="Fraction of generation from zero-carbon sources: nuclear + hydro + wind + solar. Above 50% means most power on the grid is emissions-free."
      >
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
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: '7px 14px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'rgba(0,0,0,0.65)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.14s ease',
  }

  const activeBtnStyle: React.CSSProperties = {
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
    }}>
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '72px 32px 80px' }}>
      {/* BA identity header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
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
    </div>
  )
}

function ExpandIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <path d="M8 1.5h3.5V5M5 11.5H1.5V8M11.5 1.5l-4 4M1.5 11.5l4-4" />
    </svg>
  )
}

function ChartCard({ title, explanation, children }: {
  title:       string
  explanation: string
  children:    React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div style={{
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        padding: '20px 24px 24px',
        boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
      }}>
        {/* Header row: title on left, expand button on right */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <ChartTitle title={title} explanation={explanation} />
          <button
            onClick={() => setExpanded(true)}
            title="Expand chart"
            style={{
              width: 26, height: 26, borderRadius: 6,
              border: '1px solid rgba(0,0,0,0.1)',
              background: 'rgba(0,0,0,0.03)',
              color: 'rgba(0,0,0,0.35)',
              cursor: 'pointer', padding: 0, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s ease',
              marginLeft: 8,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,102,204,0.08)'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#0066cc'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,102,204,0.2)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.03)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0.35)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.1)'
            }}
          >
            <ExpandIcon />
          </button>
        </div>
        {children}
      </div>

      {expanded && (
        <ChartModal title={title} explanation={explanation} onClose={() => setExpanded(false)}>
          {children}
        </ChartModal>
      )}
    </>
  )
}

function ChartBlank() {
  return <div style={{ height: 220 }} />
}
