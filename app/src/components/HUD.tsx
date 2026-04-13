import type { GridData } from '../types'

interface Props {
  data:    GridData | null
  error:   string | null
  loading: boolean
}

export function HUD({ data, error, loading }: Props) {
  const links  = data?.links ?? []
  const status = loading ? 'connecting' : error ? 'error' : data?.period ? data.period + ' UTC' : '\u2014'
  const hasError    = !!error

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
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10, letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(0,0,0,0.4)',
        }}>
          US Power Grid
        </span>
      </div>

      {/* ── Status badge (top-right) ── */}
      <div style={{ position: 'fixed', top: 16, right: 24, zIndex: 20, pointerEvents: 'none' }}>
        <Badge accent={hasError ? 'rgba(220,38,38,0.7)' : undefined}>
          {status}
        </Badge>
      </div>

      {/* ── Stats (bottom-left) ── */}
      <div style={{
        position: 'fixed', bottom: 20, left: 24,
        zIndex: 20, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <StatBadge label="Links" value={links.length || '\u2014'} />
      </div>

      {/* ── Zoom (bottom-right) ── */}
      <div style={{
        position: 'fixed', bottom: 20, right: 24,
        zIndex: 20, pointerEvents: 'none',
      }}>
        <StatBadge label="Zoom" value="\u2014" id="stat-zoom" />
      </div>
    </>
  )
}

function Badge({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="glass-sm" style={{
      padding: '4px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: accent ?? 'rgba(0,0,0,0.4)',
    }}>
      {children}
    </div>
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
      padding: '5px 11px',
      display: 'flex', alignItems: 'baseline', gap: 7,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9, letterSpacing: '0.12em',
        textTransform: 'uppercase' as const,
        color: 'rgba(0,0,0,0.32)',
      }}>
        {label}
      </span>
      <span id={id} style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: accent ?? 'rgba(0,0,0,0.55)',
      }}>
        {value}
      </span>
    </div>
  )
}

