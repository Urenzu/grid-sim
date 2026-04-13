import { useState } from 'react'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import { useHeatmapData }   from '../hooks/useHeatmapData'
import { useTrendData }     from '../hooks/useTrendData'
import { FUEL_COLORS, BA_DEFS } from '../data/ba'
import { BaScatter }     from './charts/BaScatter'
import { BaHourHeatmap } from './charts/BaHourHeatmap'
import { GridTrend }     from './charts/GridTrend'
import type { BaRanking } from '../types'

type SortKey  = 'capacity' | 'carbon' | 'renewables' | 'clean'
type ViewKey  = 'list' | 'scatter' | 'heatmap' | 'trends'
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

// ── sub-components ────────────────────────────────────────────────────────

function PillToggle<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' }
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
          color:         value === o.id ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.32)',
          ...mono, fontSize: 9, letterSpacing: '0.16em',
          textTransform: 'uppercase', padding: '6px 16px',
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

function BaSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 8,
        padding: '6px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: '#1a1a1a',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
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
      display: 'flex', width: 52, height: 5,
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
  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' }
  return (
    <div style={{
      padding: '10px 18px 14px 108px',
      borderTop: '1px solid rgba(0,0,0,0.04)',
    }}>
      {sorted.map(({ fuel, mw }) => {
        const pct = totalMw > 0 ? (mw / totalMw) * 100 : 0
        const fc  = FUEL_COLORS[fuel] ?? '#6b7280'
        return (
          <div key={fuel} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: fc, flexShrink: 0 }} />
            <div style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.4)', width: 48 }}>{fuel}</div>
            <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: fc, borderRadius: 999 }} />
            </div>
            <div style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.38)', width: 48, textAlign: 'right' }}>
              {fmtMw(mw)}
            </div>
            <div style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.22)', width: 30, textAlign: 'right' }}>
              {pct.toFixed(0)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── heatmap panel ─────────────────────────────────────────────────────────

function HeatmapPanel() {
  const [ba,   setBa]   = useState('CISO')
  const [days, setDays] = useState(30)
  const { cells, loading, fetching } = useHeatmapData(ba, days)
  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <BaSelect value={ba} onChange={setBa} />
        <PillToggle
          options={HEATMAP_DAYS.map(d => ({ id: String(d.days) as string, label: d.label }))}
          value={String(days)}
          onChange={v => setDays(Number(v))}
        />
        {fetching && !loading && (
          <span style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.25)' }}>loading…</span>
        )}
      </div>
      <div style={{ ...mono, fontSize: 10, color: 'rgba(0,0,0,0.3)', marginBottom: 12 }}>
        carbon intensity by hour-of-day × day-of-week &nbsp;·&nbsp; color = avg g CO₂/kWh
      </div>
      {loading ? (
        <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.2)' }}>loading…</span>
        </div>
      ) : cells.length === 0 ? (
        <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.2)' }}>no parquet data yet — accumulating…</span>
        </div>
      ) : (
        <BaHourHeatmap cells={cells} />
      )}
    </>
  )
}

// ── trends panel ──────────────────────────────────────────────────────────

function TrendsPanel() {
  const [gran, setGran] = useState<Granularity>('month')
  const [ba,   setBa]   = useState('')   // empty = all BAs
  const { points, loading, fetching } = useTrendData(gran, ba || undefined)
  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <PillToggle options={GRANULARITIES} value={gran} onChange={setGran} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.3)' }}>BA</span>
          <select
            value={ba}
            onChange={e => setBa(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.88)',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 8,
              padding: '6px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#1a1a1a',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value=''>all BAs</option>
            {BA_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.id} — {o.name}</option>
            ))}
          </select>
        </div>
        {fetching && !loading && (
          <span style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.25)' }}>loading…</span>
        )}
      </div>
      <div style={{ ...mono, fontSize: 10, color: 'rgba(0,0,0,0.3)', marginBottom: 12 }}>
        {ba ? `${ba} trend` : 'grid-wide trend'} &nbsp;·&nbsp; clean% / renewable% / carbon intensity over time
      </div>
      {loading ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.2)' }}>loading…</span>
        </div>
      ) : points.length === 0 ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.2)' }}>no parquet data yet — accumulating…</span>
        </div>
      ) : (
        <GridTrend points={points} />
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
        position: 'fixed', inset: 0,
        background: 'rgba(248,248,248,0.97)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,0,0,0.2)' }}>
          loading analytics…
        </div>
      </div>
    )
  }

  const { rankings } = analytics
  const ranked = sortedRankings(rankings, sort)
  const maxVal = maxMetric(rankings, sort)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f7f7f7', overflowY: 'auto' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Header */}
        <div style={{
          ...mono, fontSize: 10, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: 'rgba(0,0,0,0.3)',
          marginBottom: 22,
        }}>
          {rankings.length} balancing authorities
        </div>

        {/* View + sort toggles */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
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
              const barW    = maxVal > 0 ? (raw / maxVal) * 100 : 0
              const isOpen  = expandedBa === r.ba
              const isLast  = i === ranked.length - 1

              return (
                <div key={r.ba} style={{
                  borderBottom: !isLast || isOpen ? '1px solid rgba(0,0,0,0.05)' : 'none',
                }}>
                  <div
                    onClick={() => setExpandedBa(isOpen ? null : r.ba)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '10px 18px',
                      cursor: 'pointer',
                      background: isOpen ? 'rgba(0,0,0,0.015)' : 'transparent',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <div style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.18)', width: 22, textAlign: 'right', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <FuelMiniBar fuels={r.fuels} totalMw={r.totalMw} />
                    <div style={{ flex: '0 0 50px' }}>
                      <div style={{ ...mono, fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.76)' }}>
                        {r.ba}
                      </div>
                    </div>
                    <div style={{
                      ...mono, fontSize: 9, color: 'rgba(0,0,0,0.32)',
                      flex: '1 1 150px', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.label}
                    </div>
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
                        ...mono, fontSize: 10, color: 'rgba(0,0,0,0.5)',
                        width: 72, textAlign: 'right', flexShrink: 0,
                      }}>
                        {label}
                      </div>
                    </div>
                    <div style={{
                      ...mono, fontSize: 9, color: 'rgba(0,0,0,0.18)',
                      width: 10, flexShrink: 0,
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
          <div style={{
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 12, padding: '20px 16px 12px',
          }}>
            <div style={{ ...mono, fontSize: 11, color: 'rgba(0,0,0,0.3)', marginBottom: 16 }}>
              carbon intensity vs clean energy &nbsp;·&nbsp; circle size ∝ √(generation)
            </div>
            <BaScatter rankings={rankings} />
          </div>
        )}

        {/* ── Heatmap view ───────────────────────────────────────────── */}
        {view === 'heatmap' && (
          <div style={{
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 12, padding: '20px 16px 12px',
          }}>
            <HeatmapPanel />
          </div>
        )}

        {/* ── Trends view ────────────────────────────────────────────── */}
        {view === 'trends' && (
          <div style={{
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 12, padding: '20px 16px 12px',
          }}>
            <TrendsPanel />
          </div>
        )}

      </div>
    </div>
  )
}
