import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DuckPoint } from '../../types'
import { parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis, drawYAxis } from './chartUtils'
import { ChartLegend } from './ChartLegend'

const W = 520, H = 210, M = { top: 12, right: 16, bottom: 26, left: 54 }

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

    drawYAxis(g, y, iw, d => `${(+d / 1000).toFixed(0)} GW`)
    drawTimeAxis(g.append('g').attr('transform', `translate(0,${ih})`), x, cfg, -ih, iw)

    const line = (key: keyof DuckPoint) =>
      d3.line<DuckPoint>()
        .x(d => x(parseEiaPeriod(d.period)))
        .y(d => y(d[key] as number))
        .curve(d3.curveMonotoneX)

    // Solar fill area
    g.append('path').datum(data)
      .attr('fill', 'rgba(217,119,6,0.1)')
      .attr('d', d3.area<DuckPoint>()
        .x(d => x(parseEiaPeriod(d.period))).y0(ih).y1(d => y(d.solarMw))
        .curve(d3.curveMonotoneX))

    // Lines
    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', 'rgba(0,0,0,0.18)')
      .attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3')
      .attr('d', line('totalMw'))

    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#1d4ed8')
      .attr('stroke-width', 2).attr('d', line('netLoadMw'))

    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#d97706')
      .attr('stroke-width', 1.5).attr('d', line('solarMw'))

    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#0891b2')
      .attr('stroke-width', 1.5).attr('d', line('windMw'))
  }, [data])

  return (
    <div>
      <svg ref={svgRef} style={{ width: '100%', height: H }} viewBox={`0 0 ${W} ${H}`} />
      <ChartLegend entries={[
        { label: 'Total Load', color: 'rgba(0,0,0,0.35)', dash: '4 3' },
        { label: 'Net Load',   color: '#1d4ed8' },
        { label: 'Solar',      color: '#d97706' },
        { label: 'Wind',       color: '#0891b2' },
      ]} />
    </div>
  )
}
