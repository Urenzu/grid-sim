import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DuckPoint } from '../../types'
import {
  parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis,
  fmtTooltipTime, TOOLTIP_STYLE, positionTooltip,
} from './chartUtils'
import { ChartLegend } from './ChartLegend'

const W = 520, H = 210, M = { top: 12, right: 16, bottom: 26, left: 46 }

interface Props { data: DuckPoint[] }

export function RenewablePenetration({ data }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)

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

    const varPct   = data.map(d => d.totalMw > 0 ? ((d.solarMw + d.windMw) / d.totalMw) * 100 : 0)
    const cleanPct = data.map(d => d.totalMw > 0
      ? ((d.solarMw + d.windMw + d.hydroMw + d.nuclearMw) / d.totalMw) * 100 : 0)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    g.call(d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat(d => `${d}%`))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.07)'))
      .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
        .attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.35)'))

    drawTimeAxis(g.append('g').attr('transform', `translate(0,${ih})`), x, cfg, -ih, iw)

    g.append('line')
      .attr('x1', 0).attr('x2', iw).attr('y1', y(50)).attr('y2', y(50))
      .attr('stroke', 'rgba(0,0,0,0.06)').attr('stroke-width', 1)

    const xVal    = (_: unknown, i: number) => x(parseEiaPeriod(data[i].period))
    const lineGen = d3.line<number>().x(xVal).y(v => y(v)).curve(d3.curveMonotoneX)
    const areaGen = (vals: number[]) => d3.area<number>().x(xVal).y0(ih).y1(v => y(v)).curve(d3.curveMonotoneX)(vals)

    g.append('path').datum(cleanPct).attr('fill', 'rgba(34,197,94,0.08)').attr('d', areaGen(cleanPct)!)
    g.append('path').datum(varPct).attr('fill', 'rgba(217,119,6,0.08)').attr('d', areaGen(varPct)!)
    g.append('path').datum(cleanPct).attr('fill', 'none')
      .attr('stroke', '#16a34a').attr('stroke-width', 1.5).attr('stroke-dasharray', '5 3').attr('d', lineGen)
    g.append('path').datum(varPct).attr('fill', 'none')
      .attr('stroke', '#d97706').attr('stroke-width', 2).attr('d', lineGen)

    // ── Hover ─────────────────────────────────────────────────────────────
    const crosshair = g.append('line')
      .attr('y1', 0).attr('y2', ih)
      .attr('stroke', 'rgba(0,0,0,0.15)').attr('stroke-width', 1)
      .style('opacity', 0).attr('pointer-events', 'none')

    const dotVar   = g.append('circle').attr('r', 3.5).attr('fill', '#d97706')
      .attr('stroke', '#fff').attr('stroke-width', 1.5).style('opacity', 0).attr('pointer-events', 'none')
    const dotClean = g.append('circle').attr('r', 3.5).attr('fill', '#16a34a')
      .attr('stroke', '#fff').attr('stroke-width', 1.5).style('opacity', 0).attr('pointer-events', 'none')

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
        const vp  = varPct[i]
        const cp  = cleanPct[i]

        crosshair.attr('x1', px).attr('x2', px).style('opacity', 1)
        dotVar.attr('cx', px).attr('cy', y(vp)).style('opacity', 1)
        dotClean.attr('cx', px).attr('cy', y(cp)).style('opacity', 1)

        const tip = tipRef.current!
        tip.innerHTML = `
          <div style="font-size:10px;color:rgba(0,0,0,0.38);letter-spacing:0.04em;margin-bottom:7px">
            ${fmtTooltipTime(parseEiaPeriod(pt.period))}
          </div>
          <div style="display:flex;justify-content:space-between;gap:18px;margin-bottom:3px">
            <span style="color:#d97706">Solar + Wind</span>
            <span style="color:rgba(0,0,0,0.65);font-weight:500">${vp.toFixed(1)}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:18px">
            <span style="color:#16a34a">All Clean</span>
            <span style="color:rgba(0,0,0,0.65);font-weight:500">${cp.toFixed(1)}%</span>
          </div>
        `
        tip.style.opacity = '1'
        positionTooltip(tip, wrapRef.current!, event.clientX, event.clientY)
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0)
        dotVar.style('opacity', 0)
        dotClean.style('opacity', 0)
        if (tipRef.current) tipRef.current.style.opacity = '0'
      })
  }, [data])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: H }} viewBox={`0 0 ${W} ${H}`} />
      <div ref={tipRef} style={TOOLTIP_STYLE} />
      <ChartLegend entries={[
        { label: 'Solar + Wind',  color: '#d97706' },
        { label: 'All Clean (incl. Hydro + Nuclear)', color: '#16a34a', dash: '5 3' },
      ]} />
    </div>
  )
}
