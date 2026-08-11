import type React from 'react'
import * as d3 from 'd3'

// EIA periods arrive as "2026-04-07T14" and are always UTC.
//
// Charts need them on the *balancing authority's* clock: a duck curve plotted
// against UTC puts CISO's solar peak near midnight, and rendering in the
// viewer's own zone makes the same chart differ by continent. So each period
// is re-expressed as a Date whose local getters read the BA's wall clock —
// d3's time scales, tick intervals and every getHours() below then work
// unchanged, in the right zone.
//
// Caveat: the two hours a year the *viewer's* zone changes offset are not
// representable this way and shift by an hour.

const zoneFormatters = new Map<string, Intl.DateTimeFormat>()

function zoneFormatter(tz: string): Intl.DateTimeFormat {
  let f = zoneFormatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    })
    zoneFormatters.set(tz, f)
  }
  return f
}

// Parsing is hot — bisectors re-derive dates on every mousemove.
const periodCache = new Map<string, Date>()

export function parseEiaPeriod(period: string, tz = 'UTC'): Date {
  const key = tz + period
  const hit = periodCache.get(key)
  if (hit) return hit

  const utc   = new Date(period + ':00:00Z')
  const parts = zoneFormatter(tz).formatToParts(utc)
  const num   = (type: string) => Number(parts.find(p => p.type === type)?.value)
  const local = new Date(num('year'), num('month') - 1, num('day'), num('hour'))

  if (periodCache.size > 20_000) periodCache.clear()
  periodCache.set(key, local)
  return local
}

export function makeTimeScale(periods: string[], width: number, tz = 'UTC') {
  const dates = periods.map(p => parseEiaPeriod(p, tz))
  return d3.scaleTime()
    .domain([dates[0], dates[dates.length - 1]])
    .range([0, width])
}

function fmt12(d: Date): string {
  const h = d.getHours()
  if (h === 0)  return 'midnight'
  if (h === 12) return 'noon'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function axisConfig(periods: string[], tz = 'UTC'): {
  tickInterval: d3.TimeInterval
  format: (d: Date) => string
  dayLines: boolean
} {
  const dates = periods.map(p => parseEiaPeriod(p, tz))
  const spanH = (dates[dates.length - 1].getTime() - dates[0].getTime()) / 3_600_000

  if (spanH <= 26) {
    return {
      tickInterval: d3.timeHour.every(4)!,
      format: d => fmt12(d),
      dayLines: false,
    }
  }
  if (spanH <= 74) {
    return {
      tickInterval: d3.timeHour.every(12)!,
      format: d => {
        const h = d.getHours()
        return h === 0 ? DAY[d.getDay()] : fmt12(d)
      },
      dayLines: true,
    }
  }
  if (spanH <= 240) {
    // ~7–10 days: one tick per day
    return {
      tickInterval: d3.timeDay.every(1)!,
      format: d => `${DAY[d.getDay()]} ${d.getDate()}`,
      dayLines: true,
    }
  }
  if (spanH <= 800) {
    // ~11–33 days: one tick per week
    return {
      tickInterval: d3.timeWeek.every(1)!,
      format: d => `${MON[d.getMonth()]} ${d.getDate()}`,
      dayLines: false,
    }
  }
  if (spanH <= 2500) {
    // ~34–104 days: one tick per 2 weeks
    return {
      tickInterval: d3.timeWeek.every(2)!,
      format: d => `${MON[d.getMonth()]} ${d.getDate()}`,
      dayLines: false,
    }
  }
  // 105+ days (quarterly, yearly): monthly ticks
  const everyN = spanH > 5000 ? 3 : 1
  return {
    tickInterval: d3.timeMonth.every(everyN)!,
    format: d => {
      const m = MON[d.getMonth()]
      // Show year label on January
      return d.getMonth() === 0
        ? `${m} '${String(d.getFullYear()).slice(2)}`
        : m
    },
    dayLines: false,
  }
}

export function drawTimeAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleTime<number, number>,
  config: ReturnType<typeof axisConfig>,
  innerHeight: number,
  _innerWidth: number,
) {
  if (config.dayLines) {
    const midnights = scale.ticks(d3.timeDay.every(1)!)
    g.selectAll<SVGLineElement, Date>('line.midnight')
      .data(midnights).join('line').attr('class', 'midnight')
      .attr('x1', d => scale(d)).attr('x2', d => scale(d))
      .attr('y1', 0).attr('y2', innerHeight)
      .attr('stroke', 'rgba(0,0,0,0.12)').attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3')
  }

  g.call(
    d3.axisBottom(scale)
      .ticks(config.tickInterval)
      .tickFormat(d => config.format(d as Date))
  )
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('.tick line').remove())
    .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
      .attr('font-size', 11)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', d => {
        const date = d as Date
        return date.getHours?.() === 0 ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)'
      })
      .attr('font-weight', d => {
        const date = d as Date
        return date.getHours?.() === 0 ? '600' : '400'
      })
    )
}

// ── Tooltip helpers ───────────────────────────────────────────────────────

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function fmtTooltipTime(d: Date): string {
  const day  = DAY[d.getDay()]
  const mon  = MONTH[d.getMonth()]
  const date = d.getDate()
  const h    = d.getHours()
  const time = h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? `${h} AM` : `${h - 12} PM`
  return `${day} ${mon} ${date} · ${time}`
}

export function fmtMW(mw: number): string {
  if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`
  return `${Math.round(mw)} MW`
}

export const TOOLTIP_STYLE: React.CSSProperties = {
  position:       'absolute',
  pointerEvents:  'none',
  background:     'rgba(255,255,255,0.98)',
  border:         '1px solid rgba(0,0,0,0.1)',
  borderRadius:   8,
  padding:        '10px 14px',
  fontFamily:     'IBM Plex Mono, monospace',
  fontSize:       11,
  opacity:        0,
  transition:     'opacity 0.08s ease',
  zIndex:         10,
  whiteSpace:     'nowrap',
  boxShadow:      '0 4px 20px rgba(0,0,0,0.1)',
  minWidth:       150,
  color:          'rgba(0,0,0,0.75)',
}

// Position tooltip relative to wrapper, flipping if near right edge
export function positionTooltip(
  tooltip:   HTMLDivElement,
  wrapper:   HTMLDivElement,
  clientX:   number,
  clientY:   number,
) {
  const wr  = wrapper.getBoundingClientRect()
  const tw  = tooltip.offsetWidth || 160
  let   tx  = clientX - wr.left + 14
  const ty  = clientY - wr.top  - 10
  if (tx + tw > wr.width - 8) tx = clientX - wr.left - tw - 14
  tooltip.style.left = `${tx}px`
  tooltip.style.top  = `${ty}px`
}

// ── Axes ──────────────────────────────────────────────────────────────────

export function drawYAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleLinear<number, number>,
  innerWidth: number,
  format: (d: d3.NumberValue) => string,
  ticks = 4,
) {
  g.call(
    d3.axisLeft(scale).ticks(ticks).tickSize(-innerWidth).tickFormat(format)
  )
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.08)'))
    .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
      .attr('font-size', 11)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.6)')
    )
}
