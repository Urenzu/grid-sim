import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { BaCarbonData } from '../../types'

const W = 660, H = 340, M = { top: 8, right: 16, bottom: 32, left: 70 }

// Show top N BAs by total MW to keep it readable
const MAX_BAS = 16

interface Props { carbonData: BaCarbonData[] }

export function BaHourHeatmap({ carbonData }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!carbonData.length) return

    // Sort by totalMw descending, pick top N
    const sorted = [...carbonData]
      .sort((a, b) => b.totalMw - a.totalMw)
      .slice(0, MAX_BAS)

    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top - M.bottom

    const baIds = sorted.map(d => d.ba)
    // Single column (current snapshot) — treat each BA as one cell
    const cellH = ih / baIds.length
    const cellW = iw

    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([800, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    // BA labels on y
    g.selectAll('text.ba-label')
      .data(sorted)
      .join('text')
      .attr('class', 'ba-label')
      .attr('x', -8)
      .attr('y', (_, i) => i * cellH + cellH / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 11)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.5)')
      .text(d => d.ba)

    // Cells
    g.selectAll('rect.cell')
      .data(sorted)
      .join('rect')
      .attr('class', 'cell')
      .attr('x', 0)
      .attr('y', (_, i) => i * cellH + 1)
      .attr('width', d => Math.max(4, cellW * Math.sqrt(d.totalMw / (sorted[0]?.totalMw ?? 1))))
      .attr('height', cellH - 2)
      .attr('rx', 3)
      .attr('fill', d => colorScale(d.intensity))
      .attr('opacity', 0.85)

    // Intensity text inside cell
    g.selectAll('text.val')
      .data(sorted)
      .join('text')
      .attr('class', 'val')
      .attr('x', 10)
      .attr('y', (_, i) => i * cellH + cellH / 2)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 10)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.68)')
      .text(d => `${Math.round(d.intensity)} g/kWh`)

    // MW label
    g.selectAll('text.mw')
      .data(sorted)
      .join('text')
      .attr('class', 'mw')
      .attr('x', d => Math.max(4, cellW * Math.sqrt(d.totalMw / (sorted[0]?.totalMw ?? 1))) + 8)
      .attr('y', (_, i) => i * cellH + cellH / 2)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 10)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.3)')
      .text(d => `${(d.totalMw / 1000).toFixed(1)} GW`)

    // X axis label
    g.append('text')
      .attr('x', iw / 2).attr('y', ih + 24)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10).attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.28)')
      .text('bar width ∝ √(generation output)  ·  color = carbon intensity')
  }, [carbonData])

  return <svg ref={svgRef} style={{ width: '100%', height: 'auto', overflow: 'visible' }} viewBox={`0 0 ${W} ${H}`} />
}
