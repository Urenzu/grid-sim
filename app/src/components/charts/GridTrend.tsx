import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GridTrendPoint } from '../../types'

const W = 660, H = 300
const M = { top: 20, right: 54, bottom: 36, left: 44 }

interface Props { points: GridTrendPoint[] }

export function GridTrend({ points }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!points.length) return

    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top  - M.bottom

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    // ── scales ────────────────────────────────────────────────────────────
    const xScale = d3.scalePoint<string>()
      .domain(points.map(p => p.period))
      .range([0, iw])
      .padding(0.3)

    const pctScale = d3.scaleLinear()
      .domain([0, 100])
      .range([ih, 0])
      .nice()

    const ciMax  = d3.max(points, p => p.carbonIntensity) ?? 800
    const ciScale = d3.scaleLinear()
      .domain([0, Math.max(ciMax * 1.1, 200)])
      .range([ih, 0])
      .nice()

    // ── x axis ────────────────────────────────────────────────────────────
    const ticks = points.length <= 24
      ? points.map(p => p.period)
      : points.filter((_, i) => i % Math.ceil(points.length / 12) === 0).map(p => p.period)

    g.append('g')
      .attr('transform', `translate(0,${ih})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(ticks)
          .tickSize(0)
      )
      .call(ax => ax.select('.domain').attr('stroke', 'rgba(0,0,0,0.1)'))
      .selectAll('text')
      .attr('font-size', 9)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.35)')
      .attr('dy', '1.2em')

    // ── left axis (%) ─────────────────────────────────────────────────────
    g.append('g')
      .call(
        d3.axisLeft(pctScale)
          .ticks(5)
          .tickFormat(d => `${d}%`)
          .tickSize(-iw)
      )
      .call(ax => {
        ax.select('.domain').remove()
        ax.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.06)')
        ax.selectAll('.tick text')
          .attr('font-size', 9)
          .attr('font-family', 'IBM Plex Mono, monospace')
          .attr('fill', 'rgba(0,0,0,0.3)')
      })

    // ── right axis (g/kWh) ────────────────────────────────────────────────
    g.append('g')
      .attr('transform', `translate(${iw},0)`)
      .call(
        d3.axisRight(ciScale)
          .ticks(5)
          .tickSize(0)
      )
      .call(ax => {
        ax.select('.domain').attr('stroke', 'rgba(0,0,0,0.1)')
        ax.selectAll('.tick text')
          .attr('font-size', 9)
          .attr('font-family', 'IBM Plex Mono, monospace')
          .attr('fill', 'rgba(0,0,0,0.3)')
          .attr('dx', 4)
      })

    g.append('text')
      .attr('x', iw + 48).attr('y', ih / 2)
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(90, ${iw + 48}, ${ih / 2})`)
      .attr('font-size', 8)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.28)')
      .text('g CO₂/kWh')

    // ── line helpers ──────────────────────────────────────────────────────
    function lineOf<T>(
      data: T[],
      x: (d: T) => string | undefined,
      y: (d: T) => number,
      yScale: d3.ScaleLinear<number, number>,
    ): string | null {
      const line = d3.line<T>()
        .x(d => xScale(x(d) ?? '') ?? 0)
        .y(d => yScale(y(d)))
        .curve(d3.curveMonotoneX)
      return line(data)
    }

    // ── area fill for clean% ──────────────────────────────────────────────
    const areaClean = d3.area<GridTrendPoint>()
      .x(d => xScale(d.period) ?? 0)
      .y0(ih)
      .y1(d => pctScale(d.cleanPct))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(points)
      .attr('d', areaClean)
      .attr('fill', '#05966922')
      .attr('stroke', 'none')

    // ── clean% line ───────────────────────────────────────────────────────
    g.append('path')
      .attr('d', lineOf(points, p => p.period, p => p.cleanPct, pctScale))
      .attr('fill', 'none')
      .attr('stroke', '#059669')
      .attr('stroke-width', 1.8)
      .attr('opacity', 0.85)

    // ── renewable% line ───────────────────────────────────────────────────
    g.append('path')
      .attr('d', lineOf(points, p => p.period, p => p.renewablePct, pctScale))
      .attr('fill', 'none')
      .attr('stroke', '#0891b2')
      .attr('stroke-width', 1.8)
      .attr('stroke-dasharray', '4 2')
      .attr('opacity', 0.8)

    // ── carbon intensity line (right axis) ────────────────────────────────
    g.append('path')
      .attr('d', lineOf(points, p => p.period, p => p.carbonIntensity, ciScale))
      .attr('fill', 'none')
      .attr('stroke', '#dc2626')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.65)

    // ── legend ────────────────────────────────────────────────────────────
    const legend = [
      { color: '#059669', label: 'clean %',     dash: '' },
      { color: '#0891b2', label: 'renewable %',  dash: '4 2' },
      { color: '#dc2626', label: 'carbon g/kWh', dash: '' },
    ]
    const lg = svg.append('g').attr('transform', `translate(${M.left + 8}, ${M.top})`)
    legend.forEach(({ color, label, dash }, i) => {
      const lx = i * 130
      lg.append('line')
        .attr('x1', lx).attr('x2', lx + 18).attr('y1', 6).attr('y2', 6)
        .attr('stroke', color).attr('stroke-width', 2)
        .attr('stroke-dasharray', dash)
      lg.append('text')
        .attr('x', lx + 22).attr('y', 10)
        .attr('font-size', 9).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.4)')
        .text(label)
    })

  }, [points])

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      viewBox={`0 0 ${W} ${H}`}
    />
  )
}
