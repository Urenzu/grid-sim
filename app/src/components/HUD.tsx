import type { GridData } from '../types'

interface Props {
  data:    GridData | null
  error:   string | null
  loading: boolean
}

// "2026-04-12T07" → "Apr 12 · 7 AM UTC"
function fmtPeriod(period: string): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  // period format: "YYYY-MM-DDTHH"
  const [datePart, hourPart] = period.split('T')
  if (!datePart || hourPart === undefined) return period
  const [, mm, dd] = datePart.split('-')
  const hour = parseInt(hourPart, 10)
  const mon  = MONTHS[parseInt(mm, 10) - 1] ?? mm
  const day  = parseInt(dd, 10)
  const ampm = hour === 0 ? 'midnight' : hour === 12 ? 'noon'
              : hour < 12 ? `${hour} AM` : `${hour - 12} PM`
  return `${mon} ${day} · ${ampm} UTC`
}

export function HUD({ data, loading }: Props) {
  const links  = data?.links ?? []
  const period = data?.period ? fmtPeriod(data.period) : loading ? 'connecting…' : '—'

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
        <StatBadge label="Updated" value={period} />
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

function StatBadge({ label, value, accent, id }: {
  label:   string
  value:   string | number
  accent?: string
  id?:     string
}) {
  return (
    <div className="glass-sm" style={{
      padding: '6px 14px',
      display: 'flex', alignItems: 'baseline', gap: 8,
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
