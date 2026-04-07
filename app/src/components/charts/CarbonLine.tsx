import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DuckPoint } from '../../types'

const W = 520, H = 220, M = { top: 12, right: 12, bottom: 36, left: 52 }

interface Props { data: DuckPoint[] }

export function CarbonLine({ data }: Props) {
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

    const yMax = Math.max(d3.max(data, d => d.intensity) ?? 0, 100)
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([ih, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    g.append('g').call(
      d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat(d => `${d}`)
    )
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.07)'))
      .call(g => g.selectAll('.tick text').attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'rgba(0,0,0,0.35)'))

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

    // Reference line at 400 g/kWh (US grid average)
    if (y(400) >= 0 && y(400) <= ih) {
      g.append('line')
        .attr('x1', 0).attr('x2', iw)
        .attr('y1', y(400)).attr('y2', y(400))
        .attr('stroke', 'rgba(0,0,0,0.15)').attr('stroke-width', 1).attr('stroke-dasharray', '4 3')
      g.append('text').attr('x', iw - 2).attr('y', y(400) - 4)
        .attr('text-anchor', 'end').attr('font-size', 7)
        .attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'rgba(0,0,0,0.25)')
        .text('US avg ~400')
    }

    // Color the line by intensity using a gradient
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([800, 0])

    // Area fill
    const area = d3.area<DuckPoint>()
      .x(d => x(d.period)!)
      .y0(ih)
      .y1(d => y(d.intensity))
      .curve(d3.curveMonotoneX)

    g.append('path').datum(data)
      .attr('fill', 'rgba(0,0,0,0.05)')
      .attr('d', area)

    // Colored line segments
    for (let i = 1; i < data.length; i++) {
      const a = data[i - 1], b = data[i]
      const mid = (a.intensity + b.intensity) / 2
      g.append('line')
        .attr('x1', x(a.period)!).attr('y1', y(a.intensity))
        .attr('x2', x(b.period)!).attr('y2', y(b.intensity))
        .attr('stroke', colorScale(mid))
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
    }
  }, [data])

  return <svg ref={svgRef} style={{ width: '100%', height: H, overflow: 'visible' }} viewBox={`0 0 ${W} ${H}`} />
}
