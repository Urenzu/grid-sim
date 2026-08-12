// EIA periods are UTC hour stamps: "2026-08-10T07".
//
// The three feeds behind this app lag by very different amounts — demand is
// current, generation runs ~19h behind, interchange ~42h — so the UI reports
// each one's age rather than printing one timestamp and implying the whole
// view is from that moment.

export function parsePeriodUtc(period: string): Date | null {
  const d = new Date(period + ':00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

export function ageHours(period: string | null | undefined, now = new Date()): number | null {
  if (!period) return null
  const d = parsePeriodUtc(period)
  if (!d) return null
  return (now.getTime() - d.getTime()) / 3_600_000
}

/** "3h ago", "2d ago" — coarse on purpose, the data is hourly. */
export function relativeAge(period: string | null | undefined, now = new Date()): string {
  const h = ageHours(period, now)
  if (h === null) return '—'
  if (h < 0)   return 'forecast'   // day-ahead demand runs into the future
  if (h < 1)   return 'just now'
  if (h < 48)  return `${Math.floor(h)}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export type Freshness = 'live' | 'aging' | 'stale' | 'unknown'

/** EIA revises for hours, so a few hours behind is normal, not a problem. */
export function freshness(period: string | null | undefined, now = new Date()): Freshness {
  const h = ageHours(period, now)
  if (h === null) return 'unknown'
  if (h <= 6)  return 'live'
  if (h <= 24) return 'aging'
  return 'stale'
}

export const FRESHNESS_COLOR: Record<Freshness, string> = {
  live:    'rgba(5,150,105,0.85)',
  aging:   'rgba(180,131,7,0.9)',
  stale:   'rgba(190,70,40,0.85)',
  unknown: 'rgba(0,0,0,0.3)',
}

/** Absolute UTC rendering, kept for tooltips so precision isn't lost. */
export function absoluteUtc(period: string | null | undefined): string {
  if (!period) return 'no data'
  const [date, hour] = period.split('T')
  if (!date || hour === undefined) return period
  return `${date} ${hour.padStart(2, '0')}:00 UTC`
}
