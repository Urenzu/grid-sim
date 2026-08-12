import { useEffect, useState } from 'react'
import type { GridData, BaGenData } from '../types'
import { relativeAge, freshness, absoluteUtc, FRESHNESS_COLOR } from '../utils/time'

interface Props {
  data:    GridData | null
  genData: BaGenData[] | null
  error:   string | null
  loading: boolean
}

export function HUD({ data, genData, loading }: Props) {
  const links = data?.links ?? []

  // Re-render on a timer so "3h ago" doesn't freeze at whatever it said when
  // the data landed.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // The arcs come from interchange, EIA's laggiest series; the fuel-mix
  // colours come from generation, which runs hours ahead of it. One badge
  // each, because a single "updated" time would misrepresent both.
  const flowPeriod = data?.period ?? null
  const genPeriod  = genData?.length
    ? genData.reduce<string | null>((max, g) => (!max || g.period > max ? g.period : max), null)
    : null

  const flowLabel = flowPeriod ? relativeAge(flowPeriod, now) : loading ? 'connecting…' : '—'

  return (
    <>
      {/* ── Top vignette ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 80,
        background: 'linear-gradient(to bottom, rgba(245,245,247,0.9) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 19,
      }} />

      {/* ── Bottom vignette ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 100,
        background: 'linear-gradient(to top, rgba(245,245,247,0.9) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 19,
      }} />

      {/* ── Title (top-left) ── */}
      <div style={{
        position: 'fixed', top: 20, left: 24,
        zIndex: 20, pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12, letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'rgba(0,0,0,0.5)',
        }}>
          US Power Grid
        </span>
      </div>

      {/* ── Bottom-left: last updated + link count ── */}
      <div style={{
        position: 'fixed', bottom: 20, left: 24,
        zIndex: 20, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <StatBadge
          label="Flows"
          value={flowLabel}
          accent={FRESHNESS_COLOR[freshness(flowPeriod, now)]}
          title={`Interchange data · ${absoluteUtc(flowPeriod)}`}
        />
        <StatBadge
          label="Fuel mix"
          value={relativeAge(genPeriod, now)}
          accent={FRESHNESS_COLOR[freshness(genPeriod, now)]}
          title={`Generation data · ${absoluteUtc(genPeriod)}`}
        />
        <StatBadge label="Links" value={links.length || '—'} />
      </div>

      {/* ── Zoom (bottom-right) ── */}
      <div style={{
        position: 'fixed', bottom: 20, right: 24,
        zIndex: 20, pointerEvents: 'none',
      }}>
        <StatBadge label="Zoom" value="1.0×" id="stat-zoom" />
      </div>
    </>
  )
}

function StatBadge({ label, value, accent, id, title }: {
  label:   string
  value:   string | number
  accent?: string
  id?:     string
  title?:  string
}) {
  return (
    <div className="glass-sm" title={title} style={{
      padding: '6px 14px',
      display: 'flex', alignItems: 'baseline', gap: 8,
      pointerEvents: title ? 'all' : undefined,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11, letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color: 'rgba(0,0,0,0.4)',
      }}>
        {label}
      </span>
      <span id={id} style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: accent ?? 'rgba(0,0,0,0.65)',
      }}>
        {value}
      </span>
    </div>
  )
}
