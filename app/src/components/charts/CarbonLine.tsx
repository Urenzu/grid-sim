import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DuckPoint } from '../../types'
import {
  parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis, drawYAxis,
  fmtTooltipTime, TOOLTIP_STYLE, positionTooltip,
} from './chartUtils'

const W = 560, H = 280, M = { top: 16, right: 20, bottom: 40, left: 64 }
const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([800, 0])

interface Props { data: DuckPoint[] }

export function CarbonLine({ data }: Props) {
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
    const yMax = Math.max(d3.max(data, d => d.intensity) ?? 0, 150)
    const y    = d3.scaleLinear().domain([0, yMax * 1.1]).range([ih, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    drawYAxis(g, y, iw, d => `${d}`)
    drawTimeAxis(g.append('g').attr('transform', `translate(0,${ih})`), x, cfg, -ih, iw)

    // Y-axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(ih / 2)).attr('y', -50)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.5)')
      .text('g CO₂ / kWh')

    // US avg reference line
    const refY = y(386)
    if (refY >= 0 && refY <= ih) {
      g.append('line')
        .attr('x1', 0).attr('x2', iw).attr('y1', refY).attr('y2', refY)
        .attr('stroke', 'rgba(0,0,0,0.2)').attr('stroke-width', 1)
        .attr('stroke-dasharray', '5 3')
      g.append('text').attr('x', iw - 4).attr('y', refY - 5)
        .attr('text-anchor', 'end').attr('font-size', 10)
        .attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.45)').text('US avg 386 g/kWh')
    }

    // Soft area fill
    g.append('path').datum(data).attr('fill', 'rgba(0,0,0,0.04)')
      .attr('d', d3.area<DuckPoint>()
        .x(d => x(parseEiaPeriod(d.period))).y0(ih).y1(d => y(d.intensity))
        .curve(d3.curveMonotoneX))

    // Colored line segments (green=clean, red=dirty)
    for (let i = 1; i < data.length; i++) {
      const a = data[i - 1], b = data[i]
      g.append('line')
        .attr('x1', x(parseEiaPeriod(a.period))).attr('y1', y(a.intensity))
        .attr('x2', x(parseEiaPeriod(b.period))).attr('y2', y(b.intensity))
        .attr('stroke', colorScale((a.intensity + b.intensity) / 2))
        .attr('stroke-width', 3).attr('stroke-linecap', 'round')
    }

    // ── Hover ─────────────────────────────────────────────────────────────
    const crosshair = g.append('line')
      .attr('y1', 0).attr('y2', ih)
      .attr('stroke', 'rgba(0,0,0,0.18)').attr('stroke-width', 1)
      .style('opacity', 0).attr('pointer-events', 'none')

    const dot = g.append('circle').attr('r', 5)
      .attr('stroke', '#fff').attr('stroke-width', 2)
      .style('opacity', 0).attr('pointer-events', 'none')

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
        const pt = data[i]
        const px = x(parseEiaPeriod(pt.period))
        const py = y(pt.intensity)
        const c  = colorScale(pt.intensity)

        crosshair.attr('x1', px).attr('x2', px).style('opacity', 1)
        dot.attr('cx', px).attr('cy', py).attr('fill', c).style('opacity', 1)

        const label = pt.intensity < 200 ? 'Very clean (mostly nuclear/renewables)'
                    : pt.intensity < 400 ? 'Relatively clean'
                    : pt.intensity < 600 ? 'Moderate — mix of gas and clean'
                    : 'Carbon intensive — heavy fossil use'

        const tip = tipRef.current!
        tip.innerHTML = `
          <div style="font-size:11px;color:rgba(0,0,0,0.5);margin-bottom:8px">
            ${fmtTooltipTime(parseEiaPeriod(pt.period))}
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">
            <div style="width:12px;height:12px;border-radius:50%;background:${c};flex-shrink:0"></div>
            <span style="font-size:13px;font-weight:700">${Math.round(pt.intensity)} g CO₂/kWh</span>
          </div>
          <div style="font-size:10px;color:rgba(0,0,0,0.5);max-width:180px;white-space:normal">${label}</div>
        `
        tip.style.opacity = '1'
        positionTooltip(tip, wrapRef.current!, event.clientX, event.clientY)
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0)
        dot.style('opacity', 0)
        if (tipRef.current) tipRef.current.style.opacity = '0'
      })
  }, [data])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 'auto' }} viewBox={`0 0 ${W} ${H}`} />
      <div ref={tipRef} style={TOOLTIP_STYLE} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingLeft: 4 }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(0,0,0,0.55)', whiteSpace: 'nowrap' }}>
          clean (0)
        </span>
        <div style={{
          flex: '0 0 140px', height: 10, borderRadius: 5,
          background: 'linear-gradient(to right, #1a9641, #ffffbf, #d7191c)',
        }} />
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'rgba(0,0,0,0.55)', whiteSpace: 'nowrap' }}>
          dirty (800 g/kWh)
        </span>
      </div>
    </div>
  )
}
