import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DuckPoint } from '../../types'
import {
  parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis, drawYAxis,
  fmtTooltipTime, fmtMW, TOOLTIP_STYLE, positionTooltip,
} from './chartUtils'
import { ChartLegend } from './ChartLegend'

const W = 560, H = 280, M = { top: 16, right: 20, bottom: 40, left: 64 }

const SERIES = [
  { key: 'netLoadMw'  as const, label: 'Net Load (demand minus solar/wind)',  color: '#1d4ed8' },
  { key: 'solarMw'    as const, label: 'Solar',                               color: '#d97706' },
  { key: 'windMw'     as const, label: 'Wind',                                color: '#0891b2' },
  { key: 'totalMw'    as const, label: 'Total Generation',                    color: 'rgba(0,0,0,0.4)' },
]

interface Props { data: DuckPoint[] }

export function DuckCurve({ data }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (data.length < 2) return
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top  - M.bottom
    const periods = data.map(d => d.period)
    const x    = makeTimeScale(periods, iw)
    const cfg  = axisConfig(periods)
    const yMax = d3.max(data, d => d.totalMw) ?? 0
    const y    = d3.scaleLinear().domain([0, yMax * 1.05]).range([ih, 0])

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

    const line = (key: keyof DuckPoint) =>
      d3.line<DuckPoint>()
        .x(d => x(parseEiaPeriod(d.period))).y(d => y(d[key] as number))
        .curve(d3.curveMonotoneX)

    // Solar fill
    g.append('path').datum(data)
      .attr('fill', 'rgba(217,119,6,0.1)')
      .attr('d', d3.area<DuckPoint>()
        .x(d => x(parseEiaPeriod(d.period))).y0(ih).y1(d => y(d.solarMw))
        .curve(d3.curveMonotoneX))

    // Lines — total first (behind)
    g.append('path').datum(data).attr('fill', 'none')
      .attr('stroke', 'rgba(0,0,0,0.25)').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5 3').attr('d', line('totalMw'))
    g.append('path').datum(data).attr('fill', 'none')
      .attr('stroke', '#1d4ed8').attr('stroke-width', 2.5).attr('d', line('netLoadMw'))
    g.append('path').datum(data).attr('fill', 'none')
      .attr('stroke', '#d97706').attr('stroke-width', 2).attr('d', line('solarMw'))
    g.append('path').datum(data).attr('fill', 'none')
      .attr('stroke', '#0891b2').attr('stroke-width', 2).attr('d', line('windMw'))

    // ── Hover ─────────────────────────────────────────────────────────────
    const crosshair = g.append('line')
      .attr('y1', 0).attr('y2', ih)
      .attr('stroke', 'rgba(0,0,0,0.18)').attr('stroke-width', 1)
      .style('opacity', 0).attr('pointer-events', 'none')

    const dots = SERIES.map(s =>
      g.append('circle').attr('r', 4)
        .attr('fill', s.color).attr('stroke', '#fff').attr('stroke-width', 2)
        .style('opacity', 0).attr('pointer-events', 'none')
    )

    const bisect = d3.bisector<DuckPoint, Date>(d => parseEiaPeriod(d.period)).left

    g.append('rect').attr('width', iw).attr('height', ih)
      .attr('fill', 'none').attr('pointer-events', 'all')
      .on('mousemove', function (event: MouseEvent) {
        const [mx] = d3.pointer(event)
        const date = x.invert(mx)
        let i = bisect(data, date, 1)
        if (i >= data.length) i = data.length - 1
        if (i > 0) {
          const d0 = parseEiaPeriod(data[i - 1].period)
          const d1 = parseEiaPeriod(data[i].period)
          if (date.getTime() - d0.getTime() < d1.getTime() - date.getTime()) i -= 1
        }
        const pt  = data[i]
        const px  = x(parseEiaPeriod(pt.period))

        crosshair.attr('x1', px).attr('x2', px).style('opacity', 1)
        SERIES.forEach((s, si) => {
          dots[si].attr('cx', px).attr('cy', y(pt[s.key] as number)).style('opacity', 1)
        })

        const tip = tipRef.current!
        tip.innerHTML = `
          <div style="font-size:11px;color:rgba(0,0,0,0.5);margin-bottom:8px">
            ${fmtTooltipTime(parseEiaPeriod(pt.period))}
          </div>
          ${SERIES.map(s => `
            <div style="display:flex;justify-content:space-between;gap:20px;margin-bottom:4px">
              <span style="color:${s.color === 'rgba(0,0,0,0.4)' ? 'rgba(0,0,0,0.65)' : s.color}">${s.label.split(' (')[0]}</span>
              <span style="font-weight:600">${fmtMW(pt[s.key] as number)}</span>
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
  }, [data])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 'auto' }} viewBox={`0 0 ${W} ${H}`} />
      <div ref={tipRef} style={TOOLTIP_STYLE} />
      <ChartLegend entries={[
        { label: 'Total Generation',        color: 'rgba(0,0,0,0.4)', dash: '5 3' },
        { label: 'Net Load',                color: '#1d4ed8' },
        { label: 'Solar',                   color: '#d97706' },
        { label: 'Wind',                    color: '#0891b2' },
      ]} />
    </div>
  )
}
