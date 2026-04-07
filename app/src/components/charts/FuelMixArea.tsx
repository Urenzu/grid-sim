import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GenHistoryPoint } from '../../types'
import { FUEL_COLORS } from '../../data/ba'

const W = 520, H = 220, M = { top: 12, right: 12, bottom: 36, left: 52 }
const FUELS = ['coal', 'gas', 'other', 'hydro', 'nuclear', 'wind', 'solar']

interface Props { data: GenHistoryPoint[] }

export function FuelMixArea({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length) return
    const svg = d3.select(svgRef.current!).attr('width', W).attr('height', H)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top - M.bottom

    // Build row objects: period → fuel → mw
    type FuelRow = { period: string } & { [k: string]: string | number }
    const rows: FuelRow[] = data.map(d => {
      const row: FuelRow = { period: d.period }
      for (const fuel of FUELS) row[fuel] = 0
      for (const { fuel, mw } of d.fuels) {
        const norm = FUELS.includes(fuel) ? fuel : 'other'
        row[norm] = ((row[norm] as number) ?? 0) + mw
      }
      return row
    })

    const x = d3.scalePoint<string>()
      .domain(rows.map(d => d.period))
      .range([0, iw])

    const stack = d3.stack<FuelRow>().keys(FUELS).order(d3.stackOrderNone).offset(d3.stackOffsetNone)
    const series = stack(rows)

    const yMax = d3.max(series[series.length - 1], d => d[1]) ?? 0
    const y = d3.scaleLinear().domain([0, yMax * 1.05]).range([ih, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    g.append('g').call(
      d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat(d => `${(+d / 1000).toFixed(0)}GW`)
    )
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.07)'))
      .call(g => g.selectAll('.tick text').attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'rgba(0,0,0,0.35)'))

    const step = Math.max(1, Math.floor(rows.length / 6))
    g.append('g')
      .attr('transform', `translate(0,${ih})`)
      .call(
        d3.axisBottom(x)
          .tickValues(rows.filter((_, i) => i % step === 0).map(d => d.period))
          .tickFormat(d => {
            const hour = parseInt((d as string).slice(11, 13), 10)
            return `${hour}:00`
          })
      )
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').remove())
      .call(g => g.selectAll('.tick text').attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'rgba(0,0,0,0.3)'))

    const area = d3.area<[number, number]>()
      .x((_, i) => x(rows[i].period)!)
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveMonotoneX)

    for (const s of series) {
      const col = FUEL_COLORS[s.key] ?? '#6b7280'
      g.append('path')
        .datum(s as any)
        .attr('fill', col)
        .attr('opacity', 0.8)
        .attr('d', area as any)
    }

    // Legend
    const lg = g.append('g').attr('transform', `translate(0,${ih + 20})`)
    FUELS.forEach((fuel, i) => {
      const gx = i * 66
      lg.append('rect').attr('x', gx).attr('y', -4).attr('width', 10).attr('height', 8)
        .attr('rx', 2).attr('fill', FUEL_COLORS[fuel] ?? '#6b7280').attr('opacity', 0.8)
      lg.append('text').attr('x', gx + 13).attr('y', 0).attr('dominant-baseline', 'middle')
        .attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.4)').text(fuel)
    })
  }, [data])

  return <svg ref={svgRef} style={{ width: '100%', height: H, overflow: 'visible' }} viewBox={`0 0 ${W} ${H}`} />
}
