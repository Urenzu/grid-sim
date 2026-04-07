import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DuckPoint } from '../../types'
import { parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis, drawYAxis } from './chartUtils'

const W = 520, H = 220, M = { top: 12, right: 16, bottom: 36, left: 54 }

interface Props { data: DuckPoint[] }

export function DuckCurve({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (data.length < 2) return
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top - M.bottom
    const periods = data.map(d => d.period)

    const x    = makeTimeScale(periods, iw)
    const cfg  = axisConfig(periods)
    const yMax = d3.max(data, d => d.totalMw) ?? 0
    const y    = d3.scaleLinear().domain([0, yMax * 1.05]).range([ih, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    drawYAxis(g, y, iw, d => `${(+d / 1000).toFixed(0)}GW`)

    const xG = g.append('g').attr('transform', `translate(0,${ih})`)
    drawTimeAxis(xG, x, cfg, -ih, iw)

    const line = (key: keyof DuckPoint) =>
      d3.line<DuckPoint>()
        .x(d => x(parseEiaPeriod(d.period)))
        .y(d => y(d[key] as number))
        .curve(d3.curveMonotoneX)

    // Total load — dashed grey
    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', 'rgba(0,0,0,0.18)')
      .attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3')
      .attr('d', line('totalMw'))

    // Net load — dark blue (the duck shape)
    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#1d4ed8')
      .attr('stroke-width', 2).attr('d', line('netLoadMw'))

    // Solar fill area
    const solarArea = d3.area<DuckPoint>()
      .x(d => x(parseEiaPeriod(d.period)))
      .y0(ih).y1(d => y(d.solarMw))
      .curve(d3.curveMonotoneX)
    g.append('path').datum(data)
      .attr('fill', 'rgba(217,119,6,0.12)').attr('d', solarArea)

    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#d97706')
      .attr('stroke-width', 1.5).attr('d', line('solarMw'))

    // Wind
    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#0891b2')
      .attr('stroke-width', 1.5).attr('d', line('windMw'))

    // Legend
    const entries = [
      { label: 'Total Load', color: 'rgba(0,0,0,0.4)', dash: '4 3' },
      { label: 'Net Load',   color: '#1d4ed8',         dash: '' },
      { label: 'Solar',      color: '#d97706',         dash: '' },
      { label: 'Wind',       color: '#0891b2',         dash: '' },
    ]
    const lg = g.append('g').attr('transform', `translate(0,${ih + 22})`)
    entries.forEach(({ label, color, dash }, i) => {
      const gx = i * 118
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
