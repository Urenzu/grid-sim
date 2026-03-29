import * as d3 from 'd3'
import type { GridData } from '../types'

function fmt(mw: number) {
  return mw >= 1000 ? (mw / 1000).toFixed(1) + ' GW' : Math.round(mw) + ' MW'
}

interface Props {
  data:    GridData | null
  error:   string | null
  loading: boolean
}

export function HUD({ data, error, loading }: Props) {
  const links       = data?.links ?? []
  const totalExport = d3.sum(links.filter(l => l.value > 0), l => l.value)
  const totalImport = d3.sum(links.filter(l => l.value < 0), l => Math.abs(l.value))
  const status      = loading ? 'connecting' : error ? 'error' : data?.period ? data.period + ' UTC' : '—'
  const hasError    = !!error

  return (
    <>
      {/* ── Top vignette ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 80,
        background: 'linear-gradient(to bottom, rgba(5,5,5,0.85) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 19,
      }} />

      {/* ── Bottom vignette ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 100,
        background: 'linear-gradient(to top, rgba(5,5,5,0.85) 0%, transparent 100%)',
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
          fontSize: 9, letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.45)',
        }}>
          US Power Grid
        </span>
      </div>

      {/* ── Status badge (top-right) ── */}
      <div style={{ position: 'fixed', top: 16, right: 24, zIndex: 20, pointerEvents: 'none' }}>
        <Badge accent={hasError ? 'rgba(255,80,50,0.5)' : undefined}>
          {status}
        </Badge>
      </div>

      {/* ── Stats (bottom-left) ── */}
      <div style={{
        position: 'fixed', bottom: 20, left: 24,
        zIndex: 20, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <StatBadge label="Links"   value={links.length || '—'} />
        <StatBadge label="Export"  value={data ? fmt(totalExport) : '—'} accent="rgba(74,158,255,0.9)" />
        <StatBadge label="Import"  value={data ? fmt(totalImport) : '—'} accent="rgba(255,128,64,0.9)" />
      </div>

      {/* ── Legend + zoom (bottom-right) ── */}
      <div style={{
        position: 'fixed', bottom: 20, right: 24,
        zIndex: 20, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <LegendBadge />
        <StatBadge label="Zoom" value="—" id="stat-zoom" />
      </div>
    </>
  )
}

function Badge({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="glass-sm" style={{
      padding: '4px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 8,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      color: accent ?? 'rgba(255,255,255,0.3)',
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
        fontSize: 7, letterSpacing: '0.16em',
        textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.22)',
      }}>
        {label}
      </span>
      <span id={id} style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: accent ?? 'rgba(255,255,255,0.5)',
      }}>
        {value}
      </span>
    </div>
  )
}

function LegendBadge() {
  return (
    <div className="glass-sm" style={{
      padding: '5px 11px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <LegendItem color="#4a9eff" label="Export" />
      <LegendItem color="#ff8040" label="Import" />
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 16, height: 1.5, borderRadius: 1,
        background: `linear-gradient(to right, transparent, ${color})`,
      }} />
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 7, letterSpacing: '0.14em',
        textTransform: 'uppercase' as const,
        color: 'rgba(255,255,255,0.22)',
      }}>
        {label}
      </span>
    </div>
  )
}
