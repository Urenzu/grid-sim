import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { BaRanking } from '../../types'
import { FUEL_COLORS } from '../../data/ba'
import { TOOLTIP_STYLE, positionTooltip } from './chartUtils'

const W = 740, H = 480
const M = { top: 28, right: 32, bottom: 68, left: 72 }

interface Props { rankings: BaRanking[] }

export function BaScatter({ rankings }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rankings.length) return

    const iw = W - M.left - M.right
    const ih = H - M.top  - M.bottom
    const maxCi = d3.max(rankings, r => r.carbonIntensity) ?? 900
    const maxMw = d3.max(rankings, r => r.totalMw) ?? 1

    const x = d3.scaleLinear().domain([0, maxCi * 1.08]).range([0, iw])
    const y = d3.scaleLinear().domain([0, 100]).range([ih, 0])
    const r = d3.scaleSqrt().domain([0, maxMw]).range([5, 26])

    const svg = d3.select(svgRef.current!).attr('viewBox', `0 0 ${W} ${H}`)
    svg.selectAll('*').remove()

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    // Quadrant shading — top-left = clean, bottom-right = dirty
    const qx = x(400), qy = y(50)
    g.append('rect').attr('x', 0).attr('y', 0)
      .attr('width', qx).attr('height', qy)
      .attr('fill', 'rgba(5,150,105,0.06)')
    g.append('rect').attr('x', qx).attr('y', qy)
      .attr('width', iw - qx).attr('height', ih - qy)
      .attr('fill', 'rgba(220,38,38,0.05)')

    // Quadrant guide lines
    g.append('line')
      .attr('x1', qx).attr('x2', qx).attr('y1', 0).attr('y2', ih)
      .attr('stroke', 'rgba(0,0,0,0.1)').attr('stroke-dasharray', '5 3')
    g.append('line')
      .attr('x1', 0).attr('x2', iw).attr('y1', qy).attr('y2', qy)
      .attr('stroke', 'rgba(0,0,0,0.1)').attr('stroke-dasharray', '5 3')

    // Quadrant labels
    const ql = (tx: number, ty: number, text: string, anchor = 'start') =>
      g.append('text')
        .attr('x', tx).attr('y', ty).attr('text-anchor', anchor)
        .attr('font-size', 12).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.35)')
        .text(text)
    ql(10, 18, 'clean & renewable')
    ql(iw - 10, ih - 12, 'carbon heavy', 'end')

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('.tick line')
        .attr('x2', iw).attr('stroke', 'rgba(0,0,0,0.07)'))
      .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
        .attr('font-size', 12).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.6)'))

    // X axis
    g.append('g').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(6))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('.tick line').remove())
      .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
        .attr('font-size', 12).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.6)'))

    // Axis labels
    g.append('text')
      .attr('x', iw / 2).attr('y', ih + 52)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.6)')
      .text('Carbon Intensity (g CO₂ per kWh generated)')
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(ih / 2)).attr('y', -56)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.6)')
      .text('Clean Energy % (nuclear + hydro + wind + solar)')

    // Label top-N BAs by capacity
    const labeled = new Set(
      [...rankings].sort((a, b) => b.totalMw - a.totalMw).slice(0, 14).map(d => d.ba)
    )

    // Dots
    const dots = g.selectAll<SVGGElement, BaRanking>('g.dot')
      .data(rankings, d => d.ba)
      .join('g').attr('class', 'dot')
      .attr('transform', d => `translate(${x(d.carbonIntensity)},${y(d.cleanPct)})`)
      .style('cursor', 'default')

    dots.append('circle')
      .attr('r', d => r(d.totalMw))
      .attr('fill', d => FUEL_COLORS[d.dominantFuel] ?? '#6b7280')
      .attr('opacity', 0.72)
      .attr('stroke', 'white')
      .attr('stroke-width', 1.5)

    dots.filter(d => labeled.has(d.ba))
      .append('text')
      .attr('y', d => -(r(d.totalMw) + 5))
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.65)')
      .attr('font-weight', '500')
      .text(d => d.ba)

    // Tooltip
    const tip = d3.select(tipRef.current!)
    dots
      .on('mouseenter', (event: MouseEvent, d) => {
        const pct = (v: number) => `${v.toFixed(1)}%`
        tip.style('opacity', 1).html(`
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${d.ba}</div>
          <div style="color:rgba(0,0,0,0.5);margin-bottom:8px;font-size:10px">${d.label}</div>
          <div style="margin-bottom:3px"><strong>${Math.round(d.carbonIntensity)}</strong> g CO₂/kWh</div>
          <div style="margin-bottom:3px">Clean <strong>${pct(d.cleanPct)}</strong> · Renewable <strong>${pct(d.renewablePct)}</strong></div>
          <div><strong>${(d.totalMw / 1000).toFixed(1)} GW</strong> total output</div>
        `)
        positionTooltip(tipRef.current!, wrapRef.current!, event.clientX, event.clientY)
      })
      .on('mousemove', (event: MouseEvent) => {
        positionTooltip(tipRef.current!, wrapRef.current!, event.clientX, event.clientY)
      })
      .on('mouseleave', () => tip.style('opacity', 0))

  }, [rankings])

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} style={{ width: '100%', height: H, overflow: 'visible' }} />
      <div ref={tipRef} style={TOOLTIP_STYLE} />
    </div>
  )
}
