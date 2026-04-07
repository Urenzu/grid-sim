import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DuckPoint } from '../../types'

const W = 520, H = 220, M = { top: 12, right: 12, bottom: 36, left: 52 }

interface Props { data: DuckPoint[] }

export function DuckCurve({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length) return
    const svg = d3.select(svgRef.current!).attr('width', W).attr('height', H)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top - M.bottom

    const x = d3.scalePoint<string>()
      .domain(data.map(d => d.period))
      .range([0, iw])

    const yMax = d3.max(data, d => d.totalMw) ?? 0
    const y = d3.scaleLinear().domain([0, yMax * 1.05]).range([ih, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    // Grid
    g.append('g').call(
      d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat(d => `${(+d / 1000).toFixed(0)}GW`)
    )
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.07)'))
      .call(g => g.selectAll('.tick text').attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'rgba(0,0,0,0.35)'))

    // X axis — show only a few labels
    const step = Math.max(1, Math.floor(data.length / 6))
    g.append('g')
      .attr('transform', `translate(0,${ih})`)
      .call(
        d3.axisBottom(x)
          .tickValues(data.filter((_, i) => i % step === 0).map(d => d.period))
          .tickFormat(d => {
            const hour = parseInt((d as string).slice(11, 13), 10)
            return `${hour}:00`
          })
      )
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').remove())
      .call(g => g.selectAll('.tick text').attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'rgba(0,0,0,0.3)'))

    const line = (key: keyof DuckPoint) =>
      d3.line<DuckPoint>()
        .x(d => x(d.period)!)
        .y(d => y(d[key] as number))
        .curve(d3.curveMonotoneX)

    // Total load — grey
    g.append('path').datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(0,0,0,0.18)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3')
      .attr('d', line('totalMw'))

    // Net load — dark blue (the "duck" curve)
    g.append('path').datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#1d4ed8')
      .attr('stroke-width', 2)
      .attr('d', line('netLoadMw'))

    // Solar — amber
    g.append('path').datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#d97706')
      .attr('stroke-width', 1.5)
      .attr('d', line('solarMw'))

    // Wind — teal
    g.append('path').datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#0891b2')
      .attr('stroke-width', 1.5)
      .attr('d', line('windMw'))

    // Legend
    const legend = [
      { label: 'Total Load', color: 'rgba(0,0,0,0.4)', dash: '4 3' },
      { label: 'Net Load',   color: '#1d4ed8', dash: '' },
      { label: 'Solar',      color: '#d97706', dash: '' },
      { label: 'Wind',       color: '#0891b2', dash: '' },
    ]
    const lg = g.append('g').attr('transform', `translate(0,${ih + 20})`)
    legend.forEach(({ label, color, dash }, i) => {
      const gx = i * 115
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
