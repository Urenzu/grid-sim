import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { BaRanking } from '../../types'
import { FUEL_COLORS } from '../../data/ba'
import { TOOLTIP_STYLE, positionTooltip } from './chartUtils'

const W = 740, H = 460
const M = { top: 24, right: 30, bottom: 64, left: 68 }

interface Props { rankings: BaRanking[] }

export function BaScatter({ rankings }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rankings.length) return

    const iw = W - M.left - M.right
    const ih = H - M.top - M.bottom
    const maxCi = d3.max(rankings, r => r.carbonIntensity) ?? 900
    const maxMw = d3.max(rankings, r => r.totalMw) ?? 1

    const x = d3.scaleLinear().domain([0, maxCi * 1.08]).range([0, iw])
    const y = d3.scaleLinear().domain([0, 100]).range([ih, 0])
    const r = d3.scaleSqrt().domain([0, maxMw]).range([4, 24])

    const svg = d3.select(svgRef.current!).attr('viewBox', `0 0 ${W} ${H}`)
    svg.selectAll('*').remove()

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    // Quadrant shading — top-left = clean, bottom-right = dirty
    const qx = x(400), qy = y(50)
    g.append('rect').attr('x', 0).attr('y', 0)
      .attr('width', qx).attr('height', qy)
      .attr('fill', 'rgba(5,150,105,0.05)')
    g.append('rect').attr('x', qx).attr('y', qy)
      .attr('width', iw - qx).attr('height', ih - qy)
      .attr('fill', 'rgba(220,38,38,0.04)')

    // Quadrant guide lines
    g.append('line')
      .attr('x1', qx).attr('x2', qx).attr('y1', 0).attr('y2', ih)
      .attr('stroke', 'rgba(0,0,0,0.07)').attr('stroke-dasharray', '4 3')
    g.append('line')
      .attr('x1', 0).attr('x2', iw).attr('y1', qy).attr('y2', qy)
      .attr('stroke', 'rgba(0,0,0,0.07)').attr('stroke-dasharray', '4 3')

    // Quadrant labels
    const ql = (tx: number, ty: number, text: string) =>
      g.append('text')
        .attr('x', tx).attr('y', ty)
        .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.15)')
        .text(text)
    ql(8, 16, 'clean')
    ql(qx + 8, ih - 10, 'carbon-heavy')

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('.tick line')
        .attr('x2', iw).attr('stroke', 'rgba(0,0,0,0.06)'))
      .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
        .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.38)'))

    // X axis
    g.append('g').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(6))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('.tick line').remove())
      .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
        .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.38)'))

    // Axis labels
    g.append('text')
      .attr('x', iw / 2).attr('y', ih + 50)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.3)')
      .text('carbon intensity (g CO₂/kWh)')
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(ih / 2)).attr('y', -50)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.3)')
      .text('clean energy %')

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
      .attr('opacity', 0.68)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)

    dots.filter(d => labeled.has(d.ba))
      .append('text')
      .attr('y', d => -(r(d.totalMw) + 4))
      .attr('text-anchor', 'middle')
      .attr('font-size', 10).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.52)')
      .text(d => d.ba)

    // Tooltip
    const tip = d3.select(tipRef.current!)
    dots
      .on('mouseenter', (event: MouseEvent, d) => {
        const pct = (v: number) => `${v.toFixed(1)}%`
        tip.style('opacity', 1).html(`
          <div style="font-weight:600;margin-bottom:4px">${d.ba}</div>
          <div style="color:rgba(0,0,0,0.45);margin-bottom:6px;font-size:9px">${d.label}</div>
          <div>${Math.round(d.carbonIntensity)} g CO₂/kWh</div>
          <div>clean ${pct(d.cleanPct)} · renewable ${pct(d.renewablePct)}</div>
          <div>${(d.totalMw / 1000).toFixed(1)} GW total</div>
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
