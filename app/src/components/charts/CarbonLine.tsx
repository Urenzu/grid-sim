import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { DuckPoint } from '../../types'
import { parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis, drawYAxis } from './chartUtils'

const W = 520, H = 210, M = { top: 12, right: 16, bottom: 26, left: 54 }

interface Props { data: DuckPoint[] }

export function CarbonLine({ data }: Props) {
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
    const yMax = Math.max(d3.max(data, d => d.intensity) ?? 0, 150)
    const y    = d3.scaleLinear().domain([0, yMax * 1.1]).range([ih, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    drawYAxis(g, y, iw, d => `${d}`)
    drawTimeAxis(g.append('g').attr('transform', `translate(0,${ih})`), x, cfg, -ih, iw)

    // US avg reference line
    const refY = y(386)
    if (refY >= 0 && refY <= ih) {
      g.append('line')
        .attr('x1', 0).attr('x2', iw).attr('y1', refY).attr('y2', refY)
        .attr('stroke', 'rgba(0,0,0,0.12)').attr('stroke-width', 1)
        .attr('stroke-dasharray', '4 3')
      g.append('text')
        .attr('x', iw - 2).attr('y', refY - 4)
        .attr('text-anchor', 'end')
        .attr('font-size', 7).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.25)').text('US avg 386')
    }

    // Soft area
    g.append('path').datum(data)
      .attr('fill', 'rgba(0,0,0,0.04)')
      .attr('d', d3.area<DuckPoint>()
        .x(d => x(parseEiaPeriod(d.period))).y0(ih).y1(d => y(d.intensity))
        .curve(d3.curveMonotoneX))

    // Line colored by intensity
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([800, 0])
    for (let i = 1; i < data.length; i++) {
      const a = data[i - 1], b = data[i]
      g.append('line')
        .attr('x1', x(parseEiaPeriod(a.period))).attr('y1', y(a.intensity))
        .attr('x2', x(parseEiaPeriod(b.period))).attr('y2', y(b.intensity))
        .attr('stroke', colorScale((a.intensity + b.intensity) / 2))
        .attr('stroke-width', 2.5).attr('stroke-linecap', 'round')
    }
  }, [data])

  return (
    <div>
      <svg ref={svgRef} style={{ width: '100%', height: H }} viewBox={`0 0 ${W} ${H}`} />
      {/* HTML gradient legend — clean/dirty scale */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 8, paddingLeft: 4,
      }}>
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 9,
          color: 'rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
        }}>
          clean
        </span>
        <div style={{
          flex: '0 0 120px', height: 8, borderRadius: 4,
          background: 'linear-gradient(to right, #1a9641, #ffffbf, #d7191c)',
        }} />
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 9,
          color: 'rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
        }}>
          dirty (800 g CO₂/kWh)
        </span>
      </div>
    </div>
  )
}
