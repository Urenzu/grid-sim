import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GenHistoryPoint } from '../../types'
import { FUEL_COLORS } from '../../data/ba'
import {
  parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis, drawYAxis,
  fmtTooltipTime, fmtMW, TOOLTIP_STYLE, positionTooltip,
} from './chartUtils'
import { ChartLegend } from './ChartLegend'

const W = 560, H = 280, M = { top: 16, right: 20, bottom: 40, left: 64 }
const FUELS = ['coal', 'gas', 'other', 'hydro', 'nuclear', 'wind', 'solar']

type FuelRow = { period: string } & { [fuel: string]: number | string }

interface Props { data: GenHistoryPoint[] }

export function FuelMixArea({ data }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (data.length < 2) return
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top  - M.bottom

    const rows: FuelRow[] = data.map(d => {
      const row: FuelRow = { period: d.period }
      for (const fuel of FUELS) row[fuel] = 0
      for (const { fuel, mw } of d.fuels) {
        const key = FUELS.includes(fuel) ? fuel : 'other'
        row[key] = ((row[key] as number) ?? 0) + mw
      }
      return row
    })

    const periods = rows.map(r => r.period as string)
    const x   = makeTimeScale(periods, iw)
    const cfg = axisConfig(periods)

    const stack  = d3.stack<FuelRow>().keys(FUELS)
    const series = stack(rows)
    const yMax   = d3.max(series[series.length - 1], d => d[1]) ?? 0
    const y      = d3.scaleLinear().domain([0, yMax * 1.05]).range([ih, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    drawYAxis(g, y, iw, d => `${(+d / 1000).toFixed(0)} GW`)
    drawTimeAxis(g.append('g').attr('transform', `translate(0,${ih})`), x, cfg, -ih, iw)

    // Y-axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(ih / 2)).attr('y', -50)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.5)')
      .text('gigawatts (GW)')

    const area = d3.area<d3.SeriesPoint<FuelRow>>()
      .x(d => x(parseEiaPeriod((d.data as FuelRow).period as string)))
      .y0(d => y(d[0])).y1(d => y(d[1]))
      .curve(d3.curveMonotoneX)

    for (const s of series) {
      g.append('path').datum(s)
        .attr('fill', FUEL_COLORS[s.key] ?? '#6b7280')
        .attr('opacity', 0.85).attr('d', area)
    }

    // ── Hover ─────────────────────────────────────────────────────────────
    const crosshair = g.append('line')
      .attr('y1', 0).attr('y2', ih)
      .attr('stroke', 'rgba(0,0,0,0.18)').attr('stroke-width', 1)
      .style('opacity', 0).attr('pointer-events', 'none')

    const bisect = d3.bisector<FuelRow, Date>(d => parseEiaPeriod(d.period as string)).left

    g.append('rect').attr('width', iw).attr('height', ih)
      .attr('fill', 'none').attr('pointer-events', 'all')
      .on('mousemove', function (event: MouseEvent) {
        const [mx] = d3.pointer(event)
        const date = x.invert(mx)
        let i = bisect(rows, date, 1)
        if (i >= rows.length) i = rows.length - 1
        if (i > 0) {
          const d0 = parseEiaPeriod(rows[i - 1].period as string)
          const d1 = parseEiaPeriod(rows[i].period as string)
          if (date.getTime() - d0.getTime() < d1.getTime() - date.getTime()) i -= 1
        }
        const row = rows[i]
        const px  = x(parseEiaPeriod(row.period as string))

        crosshair.attr('x1', px).attr('x2', px).style('opacity', 1)

        const fuelsWithMw = FUELS
          .map(f => ({ fuel: f, mw: row[f] as number }))
          .filter(f => f.mw > 0)
          .sort((a, b) => b.mw - a.mw)

        const totalMw = fuelsWithMw.reduce((s, f) => s + f.mw, 0)

        const tip = tipRef.current!
        tip.innerHTML = `
          <div style="font-size:11px;color:rgba(0,0,0,0.5);margin-bottom:8px">
            ${fmtTooltipTime(parseEiaPeriod(row.period as string))}
          </div>
          ${fuelsWithMw.map(({ fuel, mw }) => `
            <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:4px">
              <span style="color:${FUEL_COLORS[fuel] ?? '#6b7280'}">${fuel}</span>
              <span style="font-weight:600">${fmtMW(mw)}</span>
            </div>`).join('')}
          <div style="border-top:1px solid rgba(0,0,0,0.1);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;gap:20px">
            <span style="color:rgba(0,0,0,0.55)">total</span>
            <span style="font-weight:600">${fmtMW(totalMw)}</span>
          </div>
        `
        tip.style.opacity = '1'
        positionTooltip(tip, wrapRef.current!, event.clientX, event.clientY)
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0)
        if (tipRef.current) tipRef.current.style.opacity = '0'
      })
  }, [data])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 'auto' }} viewBox={`0 0 ${W} ${H}`} />
      <div ref={tipRef} style={TOOLTIP_STYLE} />
      <ChartLegend entries={FUELS.map(f => ({
        label:  f,
        color:  FUEL_COLORS[f] ?? '#6b7280',
        swatch: 'rect' as const,
      }))} />
    </div>
  )
}
