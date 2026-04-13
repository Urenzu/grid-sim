import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { HeatmapCell } from '../../types'

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const W  = 600, H = 460
const ML = 44, MR = 64, MT = 28, MB = 12

interface Props { cells: HeatmapCell[] }

export function BaHourHeatmap({ cells }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const iw = W - ML - MR
    const ih = H - MT - MB
    const cw = iw / 7       // cell width  (7 days)
    const ch = ih / 24      // cell height (24 hours)

    // Index cells by (dow, hour)
    const idx = new Map<string, HeatmapCell>()
    for (const c of cells) idx.set(`${c.dow}:${c.hour}`, c)

    const intensities = cells.map(c => c.intensity).filter(v => v > 0)
    const [lo, hi]    = intensities.length
      ? [d3.min(intensities)!, d3.max(intensities)!]
      : [0, 800]

    const color = d3.scaleSequential(d3.interpolateRdYlGn).domain([hi, lo])

    const g = svg.append('g').attr('transform', `translate(${ML},${MT})`)

    // ── cells ──────────────────────────────────────────────────────────────
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        const cell = idx.get(`${dow}:${hour}`)
        const x = dow  * cw
        const y = hour * ch

        g.append('rect')
          .attr('x', x + 1).attr('y', y + 1)
          .attr('width', cw - 2).attr('height', ch - 2)
          .attr('rx', 2)
          .attr('fill', cell ? color(cell.intensity) : 'rgba(0,0,0,0.04)')
          .attr('opacity', 0.88)

        if (cell) {
          g.append('title').text(
            `${DAYS[dow]} ${String(hour).padStart(2, '0')}:00\n${Math.round(cell.intensity)} g/kWh (n=${cell.sampleCount})`
          )
        }
      }
    }

    // ── day-of-week labels (top) ───────────────────────────────────────────
    g.selectAll('text.dow')
      .data(DAYS)
      .join('text')
      .attr('class', 'dow')
      .attr('x', (_, i) => i * cw + cw / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.38)')
      .text(d => d)

    // ── hour labels (left) ────────────────────────────────────────────────
    g.selectAll('text.hour')
      .data(HOURS.filter(h => h % 3 === 0))
      .join('text')
      .attr('class', 'hour')
      .attr('x', -6)
      .attr('y', h => h * ch + ch / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 9)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.3)')
      .text(h => `${String(h).padStart(2, '0')}:00`)

    // ── color scale legend (right) ────────────────────────────────────────
    const legendH = ih * 0.6
    const legendY = (ih - legendH) / 2
    const legendX = iw + 14

    const gradId = 'heatmap-grad'
    const defs   = svg.append('defs')
    const grad   = defs.append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%').attr('y1', '100%')
      .attr('x2', '0%').attr('y2', '0%')

    grad.selectAll('stop')
      .data(d3.range(0, 1.01, 0.1))
      .join('stop')
      .attr('offset', d => `${d * 100}%`)
      .attr('stop-color', d => color(lo + d * (hi - lo)))

    g.append('rect')
      .attr('x', legendX).attr('y', legendY)
      .attr('width', 10).attr('height', legendH)
      .attr('fill', `url(#${gradId})`)
      .attr('rx', 3)

    const legScale = d3.scaleLinear().domain([lo, hi]).range([legendY + legendH, legendY])
    const legAxis  = d3.axisRight(legScale)
      .ticks(4)
      .tickFormat(d => `${d}`)
      .tickSize(0)

    g.append('g')
      .attr('transform', `translate(${legendX + 10},0)`)
      .call(legAxis)
      .select('.domain').remove()

    g.selectAll('.tick text')
      .attr('font-size', 9)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.35)')
      .attr('dx', 4)

  }, [cells])

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      viewBox={`0 0 ${W} ${H}`}
    />
  )
}
