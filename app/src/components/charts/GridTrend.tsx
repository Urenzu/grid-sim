import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GridTrendPoint } from '../../types'
import { TOOLTIP_STYLE, positionTooltip } from './chartUtils'

const W = 700, H = 340
const M = { top: 24, right: 70, bottom: 48, left: 58 }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function parseTrendPeriod(p: string): Date {
  if (p.length === 7) {
    const [y, m] = p.split('-').map(Number)
    return new Date(y, m - 1, 1)
  }
  const [y, m, d] = p.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtPeriodLabel(p: string): string {
  const d = parseTrendPeriod(p)
  const m = MONTHS[d.getMonth()]
  if (p.length === 7) return `${m} ${d.getFullYear()}`           // monthly → "Apr 2026"
  return `${m} ${d.getDate()}, ${d.getFullYear()}`               // daily/weekly → "Apr 7, 2026"
}

interface Props {
  points:       GridTrendPoint[]
  granularity?: 'day' | 'week' | 'month'
}

const SERIES = [
  { key: 'cleanPct'       as const, label: 'Clean',    color: '#059669', scale: 'pct', fmt: (v: number) => `${v.toFixed(1)}%`          },
  { key: 'renewablePct'   as const, label: 'Renewable', color: '#0891b2', scale: 'pct', fmt: (v: number) => `${v.toFixed(1)}%`          },
  { key: 'carbonIntensity'as const, label: 'Carbon',   color: '#dc2626', scale: 'ci',  fmt: (v: number) => `${Math.round(v)} g/kWh`    },
]

export function GridTrend({ points, granularity = 'month' }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!points.length) return

    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top  - M.bottom

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    // ── scales ────────────────────────────────────────────────────────────
    const dates  = points.map(p => parseTrendPeriod(p.period))
    const xScale = d3.scaleTime().domain([dates[0], dates[dates.length - 1]]).range([0, iw])

    const pctScale = d3.scaleLinear().domain([0, 100]).range([ih, 0])

    const ciMax   = d3.max(points, p => p.carbonIntensity) ?? 800
    const ciScale = d3.scaleLinear()
      .domain([0, Math.max(ciMax * 1.1, 200)])
      .range([ih, 0])
      .nice()

    const scaleOf = (s: typeof SERIES[number]) => s.scale === 'pct' ? pctScale : ciScale

    // ── x axis tick config ────────────────────────────────────────────────
    const spanDays = (dates[dates.length - 1].getTime() - dates[0].getTime()) / 86_400_000

    let tickInterval: d3.TimeInterval
    let tickFmt: (d: Date) => string

    if (spanDays > 365) {
      tickInterval = d3.timeYear.every(1)!
      tickFmt = d => String(d.getFullYear())
    } else if (spanDays > 60) {
      tickInterval = d3.timeMonth.every(1)!
      tickFmt = d => MONTHS[d.getMonth()]
    } else {
      tickInterval = d3.timeWeek.every(1)!
      tickFmt = d => `${MONTHS[d.getMonth()]} ${d.getDate()}`
    }

    // ── vertical year gridlines ───────────────────────────────────────────
    if (spanDays > 365) {
      g.selectAll<SVGLineElement, Date>('line.year')
        .data(xScale.ticks(d3.timeYear.every(1)!))
        .join('line').attr('class', 'year')
        .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
        .attr('y1', 0).attr('y2', ih)
        .attr('stroke', 'rgba(0,0,0,0.07)').attr('stroke-width', 1)
    }

    // ── x axis ────────────────────────────────────────────────────────────
    g.append('g')
      .attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).ticks(tickInterval).tickFormat(d => tickFmt(d as Date)).tickSize(0))
      .call(ax => ax.select('.domain').attr('stroke', 'rgba(0,0,0,0.15)'))
      .selectAll('text')
      .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.6)').attr('dy', '1.4em')

    // ── left axis (%) ─────────────────────────────────────────────────────
    g.append('g')
      .call(d3.axisLeft(pctScale).ticks(5).tickFormat(d => `${d}%`).tickSize(-iw))
      .call(ax => {
        ax.select('.domain').remove()
        ax.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.08)')
        ax.selectAll('.tick text')
          .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
          .attr('fill', 'rgba(0,0,0,0.6)')
      })

    g.append('text')
      .attr('transform', 'rotate(-90)').attr('x', -(ih / 2)).attr('y', -44)
      .attr('text-anchor', 'middle').attr('font-size', 11)
      .attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'rgba(0,0,0,0.55)')
      .text('% of generation')

    // ── right axis (g/kWh) ────────────────────────────────────────────────
    g.append('g')
      .attr('transform', `translate(${iw},0)`)
      .call(d3.axisRight(ciScale).ticks(5).tickSize(0))
      .call(ax => {
        ax.select('.domain').attr('stroke', 'rgba(0,0,0,0.15)')
        ax.selectAll('.tick text')
          .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
          .attr('fill', 'rgba(0,0,0,0.6)').attr('dx', 5)
      })

    g.append('text')
      .attr('transform', 'rotate(90)').attr('x', ih / 2).attr('y', -(iw + 58))
      .attr('text-anchor', 'middle').attr('font-size', 11)
      .attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'rgba(0,0,0,0.55)')
      .text('g CO₂ / kWh (right)')

    // ── area + lines ──────────────────────────────────────────────────────
    const px = (d: GridTrendPoint) => xScale(parseTrendPeriod(d.period))

    g.append('path').datum(points)
      .attr('d', d3.area<GridTrendPoint>()
        .x(px).y0(ih).y1(d => pctScale(d.cleanPct)).curve(d3.curveMonotoneX))
      .attr('fill', '#05966918').attr('stroke', 'none')

    const line = (key: keyof GridTrendPoint, ys: d3.ScaleLinear<number,number>) =>
      d3.line<GridTrendPoint>().x(px).y(d => ys(d[key] as number)).curve(d3.curveMonotoneX)(points)

    g.append('path').attr('d', line('cleanPct', pctScale))
      .attr('fill', 'none').attr('stroke', '#059669').attr('stroke-width', 2.5).attr('opacity', 0.9)

    g.append('path').attr('d', line('renewablePct', pctScale))
      .attr('fill', 'none').attr('stroke', '#0891b2')
      .attr('stroke-width', 2.5).attr('stroke-dasharray', '6 3').attr('opacity', 0.85)

    g.append('path').attr('d', line('carbonIntensity', ciScale))
      .attr('fill', 'none').attr('stroke', '#dc2626').attr('stroke-width', 2).attr('opacity', 0.75)

    // ── hover ─────────────────────────────────────────────────────────────
    const crosshair = g.append('line')
      .attr('y1', 0).attr('y2', ih)
      .attr('stroke', 'rgba(0,0,0,0.18)').attr('stroke-width', 1)
      .style('opacity', 0).attr('pointer-events', 'none')

    const dots = SERIES.map(s =>
      g.append('circle').attr('r', 4)
        .attr('fill', s.color).attr('stroke', '#fff').attr('stroke-width', 2)
        .style('opacity', 0).attr('pointer-events', 'none')
    )

    const bisect = d3.bisector<GridTrendPoint, Date>(d => parseTrendPeriod(d.period)).left

    g.append('rect').attr('width', iw).attr('height', ih)
      .attr('fill', 'none').attr('pointer-events', 'all')
      .on('mousemove', function (event: MouseEvent) {
        const [mx] = d3.pointer(event)
        const date = xScale.invert(mx)

        let i = bisect(points, date, 1)
        if (i >= points.length) i = points.length - 1
        if (i > 0) {
          const t0 = parseTrendPeriod(points[i - 1].period).getTime()
          const t1 = parseTrendPeriod(points[i].period).getTime()
          if (date.getTime() - t0 < t1 - date.getTime()) i -= 1
        }
        const pt = points[i]
        const cx = xScale(parseTrendPeriod(pt.period))

        crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 1)
        SERIES.forEach((s, si) => {
          dots[si]
            .attr('cx', cx)
            .attr('cy', scaleOf(s)(pt[s.key] as number))
            .style('opacity', 1)
        })

        const tip = tipRef.current!
        tip.innerHTML = `
          <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:8px;font-weight:500">
            ${fmtPeriodLabel(pt.period)}
          </div>
          ${SERIES.map(s => `
            <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:5px;align-items:center">
              <span style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:10px;height:2.5px;background:${s.color};border-radius:2px;flex-shrink:0"></span>
                <span style="color:rgba(0,0,0,0.55)">${s.label}</span>
              </span>
              <span style="font-weight:600;color:${s.color}">${s.fmt(pt[s.key] as number)}</span>
            </div>`).join('')}
        `
        tip.style.opacity = '1'
        positionTooltip(tip, wrapRef.current!, event.clientX, event.clientY)
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0)
        dots.forEach(d => d.style('opacity', 0))
        if (tipRef.current) tipRef.current.style.opacity = '0'
      })

  }, [points, granularity])

  const LEGEND = [
    { color: '#059669', label: 'Clean %',                        dash: '' },
    { color: '#0891b2', label: 'Renewable %',                    dash: '6 3' },
    { color: '#dc2626', label: 'Carbon g CO₂/kWh (right axis)', dash: '' },
  ]

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        viewBox={`0 0 ${W} ${H}`}
      />
      <div ref={tipRef} style={TOOLTIP_STYLE} />
      <div style={{
        display: 'flex', gap: 24, justifyContent: 'center',
        marginTop: 10, flexWrap: 'wrap',
      }}>
        {LEGEND.map(({ color, label, dash }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={28} height={12} style={{ flexShrink: 0 }}>
              <line x1={0} y1={6} x2={28} y2={6} stroke={color} strokeWidth={2.5} strokeDasharray={dash || undefined} />
            </svg>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(0,0,0,0.65)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
