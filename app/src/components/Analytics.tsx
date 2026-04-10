import { useState } from 'react'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import { FUEL_COLORS } from '../data/ba'
import type { BaRanking } from '../types'

type SortKey = 'capacity' | 'carbon' | 'renewables' | 'clean'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'capacity',   label: 'capacity'   },
  { id: 'carbon',     label: 'carbon'     },
  { id: 'renewables', label: 'renewables' },
  { id: 'clean',      label: 'clean'      },
]

function fmtMw(mw: number): string {
  if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`
  return `${Math.round(mw)} MW`
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function fmtCi(v: number): string {
  return `${Math.round(v)} g/kWh`
}

// Carbon intensity color: green (clean) → red (dirty), max ~900 g/kWh
function ciColor(intensity: number): string {
  const t = Math.min(intensity / 900, 1)
  const r = Math.round(34 + t * (220 - 34))
  const g = Math.round(197 - t * (197 - 38))
  const b = Math.round(94  - t * (94  - 38))
  return `rgb(${r},${g},${b})`
}

function sortedRankings(rankings: BaRanking[], key: SortKey): BaRanking[] {
  return [...rankings].sort((a, b) => {
    switch (key) {
      case 'capacity':   return b.totalMw         - a.totalMw
      case 'carbon':     return b.carbonIntensity  - a.carbonIntensity
      case 'renewables': return b.renewablePct     - a.renewablePct
      case 'clean':      return b.cleanPct         - a.cleanPct
    }
  })
}

function metricValue(r: BaRanking, key: SortKey): { raw: number; label: string } {
  switch (key) {
    case 'capacity':   return { raw: r.totalMw,        label: fmtMw(r.totalMw)         }
    case 'carbon':     return { raw: r.carbonIntensity, label: fmtCi(r.carbonIntensity) }
    case 'renewables': return { raw: r.renewablePct,    label: fmtPct(r.renewablePct)   }
    case 'clean':      return { raw: r.cleanPct,        label: fmtPct(r.cleanPct)       }
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

function maxMetric(rankings: BaRanking[], key: SortKey): number {
  switch (key) {
    case 'capacity':   return Math.max(...rankings.map(r => r.totalMw))
    case 'carbon':     return Math.max(...rankings.map(r => r.carbonIntensity))
    case 'renewables': return 100
    case 'clean':      return 100
  }
}

interface SummaryTileProps {
  label: string
  value: string
  sub?:  string
  color?: string
}

function SummaryTile({ label, value, sub, color }: SummaryTileProps) {
  return (
    <div style={{
      flex: 1, minWidth: 120,
      padding: '14px 18px',
      background: 'rgba(255,255,255,0.7)',
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 10,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 8,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(0,0,0,0.3)', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 20,
        fontWeight: 600, color: color ?? 'rgba(0,0,0,0.82)',
        lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'rgba(0,0,0,0.28)', marginTop: 4,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

export function Analytics() {
  const { analytics, loading } = useAnalyticsData()
  const [sort, setSort] = useState<SortKey>('capacity')

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

  const { grid, rankings } = analytics
  const ranked  = sortedRankings(rankings, sort)
  const maxVal  = maxMetric(rankings, sort)

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#f7f7f7',
      overflowY: 'auto',
    }}>
      <div style={{
        maxWidth: 860, margin: '0 auto',
        padding: '40px 24px 80px',
      }}>

        {/* Header */}
        <div style={{
          ...mono, fontSize: 10, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)',
          marginBottom: 24,
        }}>
          grid analytics · {grid.baCount} balancing authorities
        </div>

        {/* Summary tiles */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
          <SummaryTile
            label="total generation"
            value={fmtMw(grid.totalMw)}
            sub="live snapshot"
          />
          <SummaryTile
            label="carbon intensity"
            value={fmtCi(grid.carbonIntensity)}
            sub="weighted avg"
            color={ciColor(grid.carbonIntensity)}
          />
          <SummaryTile
            label="renewables"
            value={fmtPct(grid.renewablePct)}
            sub="wind + solar"
            color="#0891b2"
          />
          <SummaryTile
            label="clean energy"
            value={fmtPct(grid.cleanPct)}
            sub="incl. nuclear + hydro"
            color="#059669"
          />
        </div>

        {/* Sort selector */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 18,
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 999, padding: 4,
          width: 'fit-content',
        }}>
          {SORTS.map(s => (
            <button key={s.id} onClick={() => setSort(s.id)} style={{
              background: sort === s.id ? 'white' : 'transparent',
              border: sort === s.id ? '1px solid rgba(0,0,0,0.1)' : '1px solid transparent',
              borderRadius: 999,
              color: sort === s.id ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.35)',
              ...mono, fontSize: 9, letterSpacing: '0.16em',
              textTransform: 'uppercase', padding: '6px 16px',
              cursor: 'pointer',
              boxShadow: sort === s.id ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
              transition: 'all 0.14s ease',
            }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Rankings list */}
        <div style={{
          background: 'rgba(255,255,255,0.75)',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {ranked.map((r, i) => {
            const { raw, label } = metricValue(r, sort)
            const barW = maxVal > 0 ? (raw / maxVal) * 100 : 0
            const fuelColor = FUEL_COLORS[r.dominantFuel] ?? '#6b7280'

            return (
              <div key={r.ba} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '11px 18px',
                borderBottom: i < ranked.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
              }}>

                {/* Rank */}
                <div style={{
                  ...mono, fontSize: 9, color: 'rgba(0,0,0,0.2)',
                  width: 22, textAlign: 'right', flexShrink: 0,
                }}>
                  {i + 1}
                </div>

                {/* Fuel dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: fuelColor, flexShrink: 0,
                }} />

                {/* BA name */}
                <div style={{ flex: '0 0 52px' }}>
                  <div style={{ ...mono, fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.78)' }}>
                    {r.ba}
                  </div>
                </div>

                {/* Label */}
                <div style={{
                  ...mono, fontSize: 9, color: 'rgba(0,0,0,0.35)',
                  flex: '1 1 160px', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.label}
                </div>

                {/* Bar + value */}
                <div style={{ flex: '2 1 200px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    flex: 1, height: 5, background: 'rgba(0,0,0,0.06)', borderRadius: 999,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      width: `${barW}%`,
                      background: barColor(r, sort),
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{
                    ...mono, fontSize: 10, color: 'rgba(0,0,0,0.55)',
                    width: 72, textAlign: 'right', flexShrink: 0,
                  }}>
                    {label}
                  </div>
                </div>

              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
