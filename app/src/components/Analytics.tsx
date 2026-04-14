import { useState } from 'react'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import { useHeatmapData }   from '../hooks/useHeatmapData'
import { useTrendData }     from '../hooks/useTrendData'
import { FUEL_COLORS, BA_DEFS } from '../data/ba'
import { BaScatter }     from './charts/BaScatter'
import { BaHourHeatmap } from './charts/BaHourHeatmap'
import { GridTrend }     from './charts/GridTrend'
import { ChartTitle, ChartModal } from './ChartTitle'
import type { BaRanking } from '../types'

type SortKey    = 'capacity' | 'carbon' | 'renewables' | 'clean'
type ViewKey    = 'list' | 'scatter' | 'heatmap' | 'trends'
type Granularity = 'day' | 'week' | 'month'

const BA_OPTIONS = BA_DEFS.map(([id, name]) => ({ id, name: name as string }))

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'capacity',   label: 'capacity'   },
  { id: 'carbon',     label: 'carbon'     },
  { id: 'renewables', label: 'renewables' },
  { id: 'clean',      label: 'clean'      },
]

const VIEWS: { id: ViewKey; label: string }[] = [
  { id: 'list',    label: 'list'    },
  { id: 'scatter', label: 'scatter' },
  { id: 'heatmap', label: 'heatmap' },
  { id: 'trends',  label: 'trends'  },
]

const HEATMAP_DAYS = [
  { days: 14,  label: '14d' },
  { days: 30,  label: '30d' },
  { days: 90,  label: '90d' },
  { days: 180, label: '6mo' },
]

const GRANULARITIES: { id: Granularity; label: string }[] = [
  { id: 'day',   label: 'daily'   },
  { id: 'week',  label: 'weekly'  },
  { id: 'month', label: 'monthly' },
]

// ── formatting ────────────────────────────────────────────────────────────

function fmtMw(mw: number): string {
  return mw >= 1000 ? `${(mw / 1000).toFixed(1)} GW` : `${Math.round(mw)} MW`
}
function fmtPct(v: number): string { return `${v.toFixed(1)}%` }
function fmtCi(v: number): string  { return `${Math.round(v)} g/kWh` }

function ciColor(intensity: number): string {
  const t = Math.min(intensity / 900, 1)
  const r = Math.round(34  + t * (220 - 34))
  const g = Math.round(197 - t * (197 - 38))
  const b = Math.round(94  - t * (94  - 38))
  return `rgb(${r},${g},${b})`
}

// ── sort helpers ──────────────────────────────────────────────────────────

function sortedRankings(rankings: BaRanking[], key: SortKey): BaRanking[] {
  return [...rankings].sort((a, b) => {
    switch (key) {
      case 'capacity':   return b.totalMw        - a.totalMw
      case 'carbon':     return b.carbonIntensity - a.carbonIntensity
      case 'renewables': return b.renewablePct    - a.renewablePct
      case 'clean':      return b.cleanPct        - a.cleanPct
    }
  })
}

function metricOf(r: BaRanking, key: SortKey): { raw: number; label: string } {
  switch (key) {
    case 'capacity':   return { raw: r.totalMw,        label: fmtMw(r.totalMw)         }
    case 'carbon':     return { raw: r.carbonIntensity, label: fmtCi(r.carbonIntensity) }
    case 'renewables': return { raw: r.renewablePct,    label: fmtPct(r.renewablePct)   }
    case 'clean':      return { raw: r.cleanPct,        label: fmtPct(r.cleanPct)       }
  }
}

function maxMetric(rankings: BaRanking[], key: SortKey): number {
  switch (key) {
    case 'capacity':   return Math.max(...rankings.map(r => r.totalMw))
    case 'carbon':     return Math.max(...rankings.map(r => r.carbonIntensity))
    case 'renewables': return 100
    case 'clean':      return 100
  }
}

function barColor(r: BaRanking, key: SortKey): string {
  switch (key) {
    case 'capacity':   return FUEL_COLORS[r.dominantFuel] ?? '#6b7280'
    case 'carbon':     return ciColor(r.carbonIntensity)
    case 'renewables': return '#0891b2'
    case 'clean':      return '#059669'
  }
}

// ── shared button styles (matches Dispatch preset buttons) ────────────────

const btnBase: React.CSSProperties = {
  background:     'rgba(255,255,255,0.88)',
  border:         '1px solid rgba(0,0,0,0.1)',
  borderRadius:   8,
  padding:        '7px 14px',
  fontFamily:     'var(--font-mono)',
  fontSize:       11,
  color:          'rgba(0,0,0,0.65)',
  cursor:         'pointer',
  outline:        'none',
  transition:     'all 0.14s ease',
}

const btnActive: React.CSSProperties = {
  ...btnBase,
  background:  'rgba(0,102,204,0.1)',
  border:      '1px solid rgba(0,102,204,0.25)',
  color:       '#0066cc',
}

// ── sub-components ────────────────────────────────────────────────────────

function PillToggle<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{
      display: 'flex', gap: 4,
      background: 'rgba(0,0,0,0.04)',
      borderRadius: 999, padding: 4,
      width: 'fit-content',
    }}>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          background:    value === o.id ? 'white' : 'transparent',
          border:        value === o.id ? '1px solid rgba(0,0,0,0.09)' : '1px solid transparent',
          borderRadius:  999,
          color:         value === o.id ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.35)',
          fontFamily:    'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', padding: '7px 18px',
          cursor: 'pointer',
          boxShadow: value === o.id ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
          transition: 'all 0.14s ease',
        }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Preset-style buttons matching Dispatch (rectangular, not pill) */
function PresetButtons<T extends string | number>({
  options, value, onChange,
}: {
  options: { id: T; label: string }[]
  value:   T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          style={value === o.id ? btnActive : btnBase}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function BaSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={btnBase}>
      {BA_OPTIONS.map(o => (
        <option key={o.id} value={o.id}>{o.id} — {o.name}</option>
      ))}
    </select>
  )
}


function FuelMiniBar({ fuels, totalMw }: { fuels: BaRanking['fuels']; totalMw: number }) {
  const sorted = [...fuels].sort((a, b) => b.mw - a.mw)
  return (
    <div style={{
      display: 'flex', width: 60, height: 6,
      borderRadius: 999, overflow: 'hidden', flexShrink: 0,
    }}>
      {sorted.map(({ fuel, mw }) => (
        <div key={fuel} style={{
          width: `${(mw / totalMw) * 100}%`,
          background: FUEL_COLORS[fuel] ?? '#6b7280',
        }} />
      ))}
    </div>
  )
}

function FuelDetail({ fuels, totalMw }: { fuels: BaRanking['fuels']; totalMw: number }) {
  const sorted = [...fuels].sort((a, b) => b.mw - a.mw)
  return (
    <div style={{ padding: '12px 20px 16px 120px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      {sorted.map(({ fuel, mw }) => {
        const pct = totalMw > 0 ? (mw / totalMw) * 100 : 0
        const fc  = FUEL_COLORS[fuel] ?? '#6b7280'
        return (
          <div key={fuel} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: fc, flexShrink: 0 }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.45)', width: 52 }}>{fuel}</div>
            <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: fc, borderRadius: 999 }} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.55)', width: 56, textAlign: 'right' }}>
              {fmtMw(mw)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.3)', width: 34, textAlign: 'right' }}>
              {pct.toFixed(0)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── shared expand button ──────────────────────────────────────────────────

function ExpandBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Expand chart"
      style={{
        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
        border: '1px solid rgba(0,0,0,0.1)',
        background: 'rgba(0,0,0,0.03)',
        color: 'rgba(0,0,0,0.35)',
        cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s ease',
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
      <svg width={12} height={12} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
        <path d="M8 1.5h3.5V5M5 11.5H1.5V8M11.5 1.5l-4 4M1.5 11.5l4-4" />
      </svg>
    </button>
  )
}

// ── heatmap panel ─────────────────────────────────────────────────────────

const HEATMAP_TITLE = "Carbon Intensity by Hour & Day"
const HEATMAP_EXPL  = "Average carbon intensity (g CO₂/kWh) for each hour and day of week. Green = cleaner electricity, red = more carbon-heavy. Use it to find the best times to shift heavy loads."

function HeatmapPanel() {
  const [ba,       setBa]       = useState('CISO')
  const [days,     setDays]     = useState(30)
  const [expanded, setExpanded] = useState(false)
  const { cells, loading, fetching } = useHeatmapData(ba, days)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <ChartTitle title={HEATMAP_TITLE} explanation={HEATMAP_EXPL} />
        {cells.length > 0 && <ExpandBtn onClick={() => setExpanded(true)} />}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <BaSelect value={ba} onChange={setBa} />
        <PresetButtons
          options={HEATMAP_DAYS.map(d => ({ id: d.days, label: d.label }))}
          value={days}
          onChange={v => setDays(Number(v))}
        />
        {fetching && !loading && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>loading…</span>
        )}
      </div>
      {loading ? (
        <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>loading…</span>
        </div>
      ) : cells.length === 0 ? (
        <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>no parquet data yet — accumulating…</span>
        </div>
      ) : (
        <BaHourHeatmap cells={cells} />
      )}

      {expanded && (
        <ChartModal title={HEATMAP_TITLE} explanation={HEATMAP_EXPL} onClose={() => setExpanded(false)}>
          <BaHourHeatmap cells={cells} />
        </ChartModal>
      )}
    </>
  )
}

// ── trends panel ──────────────────────────────────────────────────────────

const TRENDS_TITLE = "Clean Energy & Carbon Trend"
const TRENDS_EXPL  = "Clean % (green), renewable % (blue dashed), and carbon intensity (red, right axis) over time. A rising green line or falling red line means the grid is getting cleaner."

function TrendsPanel() {
  const [gran,     setGran]     = useState<Granularity>('month')
  const [ba,       setBa]       = useState('')
  const [expanded, setExpanded] = useState(false)
  const { points, loading, fetching } = useTrendData(gran, ba || undefined)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <ChartTitle title={TRENDS_TITLE} explanation={TRENDS_EXPL} />
        {points.length > 0 && <ExpandBtn onClick={() => setExpanded(true)} />}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <PillToggle options={GRANULARITIES} value={gran} onChange={setGran} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>BA</span>
          <select value={ba} onChange={e => setBa(e.target.value)} style={btnBase}>
            <option value=''>all BAs (grid-wide)</option>
            {BA_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.id} — {o.name}</option>
            ))}
          </select>
        </div>
        {fetching && !loading && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>loading…</span>
        )}
      </div>
      {loading ? (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>loading…</span>
        </div>
      ) : points.length === 0 ? (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,0,0,0.25)' }}>no parquet data yet — accumulating…</span>
        </div>
      ) : (
        <GridTrend points={points} granularity={gran} />
      )}

      {expanded && (
        <ChartModal title={TRENDS_TITLE} explanation={TRENDS_EXPL} onClose={() => setExpanded(false)}>
          <GridTrend points={points} granularity={gran} />
        </ChartModal>
      )}
    </>
  )
}

// ── scatter card ─────────────────────────────────────────────────────────

const SCATTER_TITLE = "Carbon vs Clean Energy"
const SCATTER_EXPL  = "Each circle is a balancing authority, sized by output. Top-left = cleanest (low carbon, high clean %). Bottom-right = dirtiest. Green and red shading mark the quadrant boundaries."

function ScatterCard({ rankings }: { rankings: BaRanking[] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <div style={{
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: 12, padding: '24px 20px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <ChartTitle title={SCATTER_TITLE} explanation={SCATTER_EXPL} />
          <ExpandBtn onClick={() => setExpanded(true)} />
        </div>
        <BaScatter rankings={rankings} />
      </div>
      {expanded && (
        <ChartModal title={SCATTER_TITLE} explanation={SCATTER_EXPL} onClose={() => setExpanded(false)}>
          <BaScatter rankings={rankings} />
        </ChartModal>
      )}
    </>
  )
}

// ── main component ────────────────────────────────────────────────────────

export function Analytics() {
  const { analytics, loading } = useAnalyticsData()
  const [sort,       setSort]       = useState<SortKey>('capacity')
  const [view,       setView]       = useState<ViewKey>('list')
  const [expandedBa, setExpandedBa] = useState<string | null>(null)

  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' }

  if (loading || !analytics) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(248,248,248,0.97)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: '0.2em', color: 'rgba(0,0,0,0.3)' }}>
          loading analytics…
        </div>
      </div>
    )
  }

  const { rankings } = analytics
  const ranked = sortedRankings(rankings, sort)
  const maxVal = maxMetric(rankings, sort)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(248,248,248,0.97)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '72px 32px 80px' }}>

        {/* Header */}
        <div style={{
          ...mono, fontSize: 13, fontWeight: 600,
          color: 'rgba(0,0,0,0.65)',
          marginBottom: 24,
        }}>
          {rankings.length} balancing authorities
        </div>

        {/* View + sort toggles */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          <PillToggle options={VIEWS} value={view} onChange={v => { setView(v); setExpandedBa(null) }} />
          {view === 'list' && (
            <PillToggle options={SORTS} value={sort} onChange={setSort} />
          )}
        </div>

        {/* ── List view ──────────────────────────────────────────────── */}
        {view === 'list' && (
          <div style={{
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {ranked.map((r, i) => {
              const { raw, label } = metricOf(r, sort)
              const barW   = maxVal > 0 ? (raw / maxVal) * 100 : 0
              const isOpen = expandedBa === r.ba
              const isLast = i === ranked.length - 1

              return (
                <div key={r.ba} style={{
                  borderBottom: !isLast || isOpen ? '1px solid rgba(0,0,0,0.05)' : 'none',
                }}>
                  <div
                    onClick={() => setExpandedBa(isOpen ? null : r.ba)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 20px',
                      cursor: 'pointer',
                      background: isOpen ? 'rgba(0,0,0,0.015)' : 'transparent',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {/* Rank */}
                    <div style={{ ...mono, fontSize: 11, color: 'rgba(0,0,0,0.25)', width: 24, textAlign: 'right', flexShrink: 0 }}>
                      {i + 1}
                    </div>

                    {/* Mini fuel bar */}
                    <FuelMiniBar fuels={r.fuels} totalMw={r.totalMw} />

                    {/* BA ticker */}
                    <div style={{ flex: '0 0 56px' }}>
                      <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: 'rgba(0,0,0,0.8)' }}>
                        {r.ba}
                      </div>
                    </div>

                    {/* Full label */}
                    <div style={{
                      ...mono, fontSize: 11, color: 'rgba(0,0,0,0.45)',
                      flex: '1 1 160px', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.label}
                    </div>

                    {/* Metric bar + value */}
                    <div style={{ flex: '2 1 200px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        flex: 1, height: 5, background: 'rgba(0,0,0,0.06)',
                        borderRadius: 999, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 999,
                          width: `${barW}%`,
                          background: barColor(r, sort),
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <div style={{
                        ...mono, fontSize: 12, fontWeight: 500,
                        color: 'rgba(0,0,0,0.65)',
                        width: 80, textAlign: 'right', flexShrink: 0,
                      }}>
                        {label}
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <div style={{
                      ...mono, fontSize: 12, color: 'rgba(0,0,0,0.22)',
                      width: 12, flexShrink: 0,
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}>
                      ›
                    </div>
                  </div>

                  {isOpen && <FuelDetail fuels={r.fuels} totalMw={r.totalMw} />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Scatter view ───────────────────────────────────────────── */}
        {view === 'scatter' && (
          <ScatterCard rankings={rankings} />
        )}

        {/* ── Heatmap view ───────────────────────────────────────────── */}
        {view === 'heatmap' && (
          <div style={{
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 12, padding: '24px 20px 16px',
          }}>
            <HeatmapPanel />
          </div>
        )}

        {/* ── Trends view ────────────────────────────────────────────── */}
        {view === 'trends' && (
          <div style={{
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 12, padding: '24px 20px 16px',
          }}>
            <TrendsPanel />
          </div>
        )}

      </div>
    </div>
  )
}
