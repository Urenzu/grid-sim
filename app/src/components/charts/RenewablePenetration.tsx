import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DuckPoint } from '../../types'
import { parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis } from './chartUtils'

const W = 520, H = 220, M = { top: 12, right: 16, bottom: 36, left: 46 }

interface Props { data: DuckPoint[] }

export function RenewablePenetration({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (data.length < 2) return
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top - M.bottom
    const periods = data.map(d => d.period)

    const x   = makeTimeScale(periods, iw)
    const cfg = axisConfig(periods)
    const y   = d3.scaleLinear().domain([0, 100]).range([ih, 0])

    // Compute per-point penetration
    const varPct  = data.map(d => d.totalMw > 0 ? ((d.solarMw + d.windMw) / d.totalMw) * 100 : 0)
    const cleanPct = data.map(d => d.totalMw > 0
      ? ((d.solarMw + d.windMw + d.hydroMw + d.nuclearMw) / d.totalMw) * 100
      : 0)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    // Y gridlines + labels
    g.call(
      d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat(d => `${d}%`)
    )
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.07)'))
      .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
        .attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.35)'))

    const xG = g.append('g').attr('transform', `translate(0,${ih})`)
    drawTimeAxis(xG, x, cfg, -ih, iw)

    // Reference lines at 25 / 50 / 75 / 100%
    ;[25, 50, 75, 100].forEach(pct => {
      g.append('line')
        .attr('x1', 0).attr('x2', iw)
        .attr('y1', y(pct)).attr('y2', y(pct))
        .attr('stroke', pct === 100 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)')
        .attr('stroke-width', 1)
    })

    const xVal = (d: DuckPoint) => x(parseEiaPeriod(d.period))

    // All-clean area (solar + wind + hydro + nuclear)
    const cleanArea = d3.area<number>()
      .x((_, i) => xVal(data[i]))
      .y0(ih).y1(v => y(v))
      .curve(d3.curveMonotoneX)
    g.append('path').datum(cleanPct)
      .attr('fill', 'rgba(34,197,94,0.1)').attr('d', cleanArea)

    // Variable renewables area (solar + wind only)
    const varArea = d3.area<number>()
      .x((_, i) => xVal(data[i]))
      .y0(ih).y1(v => y(v))
      .curve(d3.curveMonotoneX)
    g.append('path').datum(varPct)
      .attr('fill', 'rgba(217,119,6,0.12)').attr('d', varArea)

    const varLine = d3.line<number>()
      .x((_, i) => xVal(data[i])).y(v => y(v)).curve(d3.curveMonotoneX)
    const cleanLine = d3.line<number>()
      .x((_, i) => xVal(data[i])).y(v => y(v)).curve(d3.curveMonotoneX)

    // All-clean line — green dashed
    g.append('path').datum(cleanPct)
      .attr('fill', 'none').attr('stroke', '#16a34a')
      .attr('stroke-width', 1.5).attr('stroke-dasharray', '5 3')
      .attr('d', cleanLine)

    // Variable renewables line — amber solid
    g.append('path').datum(varPct)
      .attr('fill', 'none').attr('stroke', '#d97706')
      .attr('stroke-width', 2).attr('d', varLine)

    // Legend
    const lg = g.append('g').attr('transform', `translate(0,${ih + 22})`)
    const entries = [
      { label: 'Solar + Wind', color: '#d97706', dash: '' },
      { label: 'All Clean (incl. Hydro + Nuclear)', color: '#16a34a', dash: '5 3' },
    ]
    entries.forEach(({ label, color, dash }, i) => {
      const gx = i * 230
      lg.append('line').attr('x1', gx).attr('x2', gx + 16).attr('y1', 0).attr('y2', 0)
        .attr('stroke', color).attr('stroke-width', 1.8)
        .attr('stroke-dasharray', dash || null)
      lg.append('text').attr('x', gx + 20).attr('y', 0).attr('dominant-baseline', 'middle')
        .attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.4)').text(label)
    })
  }, [data])

  return <svg ref={svgRef} style={{ width: '100%', height: H, overflow: 'visible' }} viewBox={`0 0 ${W} ${H}`} />
}
