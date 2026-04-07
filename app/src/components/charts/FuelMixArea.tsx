import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GenHistoryPoint } from '../../types'
import { FUEL_COLORS } from '../../data/ba'
import { parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis, drawYAxis } from './chartUtils'

const W = 520, H = 220, M = { top: 12, right: 16, bottom: 36, left: 54 }
const FUELS = ['coal', 'gas', 'other', 'hydro', 'nuclear', 'wind', 'solar']

type FuelRow = { period: string; date: Date } & { [fuel: string]: number | string | Date }

interface Props { data: GenHistoryPoint[] }

export function FuelMixArea({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (data.length < 2) return
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const iw = W - M.left - M.right
    const ih = H - M.top - M.bottom

    const rows: FuelRow[] = data.map(d => {
      const row: FuelRow = { period: d.period, date: parseEiaPeriod(d.period) }
      for (const fuel of FUELS) row[fuel] = 0
      for (const { fuel, mw } of d.fuels) {
        const key = FUELS.includes(fuel) ? fuel : 'other'
        row[key] = ((row[key] as number) ?? 0) + mw
      }
      return row
    })

    const periods = rows.map(r => r.period)
    const x   = makeTimeScale(periods, iw)
    const cfg = axisConfig(periods)

    const stack   = d3.stack<FuelRow>().keys(FUELS)
    const series  = stack(rows)
    const yMax    = d3.max(series[series.length - 1], d => d[1]) ?? 0
    const y       = d3.scaleLinear().domain([0, yMax * 1.05]).range([ih, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    drawYAxis(g, y, iw, d => `${(+d / 1000).toFixed(0)}GW`)

    const xG = g.append('g').attr('transform', `translate(0,${ih})`)
    drawTimeAxis(xG, x, cfg, -ih, iw)

    const area = d3.area<d3.SeriesPoint<FuelRow>>()
      .x(d => x(parseEiaPeriod((d.data as FuelRow).period)))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveMonotoneX)

    for (const s of series) {
      g.append('path')
        .datum(s)
        .attr('fill', FUEL_COLORS[s.key] ?? '#6b7280')
        .attr('opacity', 0.82)
        .attr('d', area)
    }

    // Legend — two rows of 4 and 3
    const lg = g.append('g').attr('transform', `translate(0,${ih + 22})`)
    FUELS.forEach((fuel, i) => {
      const row = Math.floor(i / 4)
      const col = i % 4
      const gx = col * 118, gy = row * 14
      lg.append('rect').attr('x', gx).attr('y', gy - 4).attr('width', 10).attr('height', 8)
        .attr('rx', 2).attr('fill', FUEL_COLORS[fuel] ?? '#6b7280').attr('opacity', 0.85)
      lg.append('text').attr('x', gx + 13).attr('y', gy).attr('dominant-baseline', 'middle')
        .attr('font-size', 8).attr('font-family', 'IBM Plex Mono, monospace')
        .attr('fill', 'rgba(0,0,0,0.4)').text(fuel)
    })
  }, [data])

  return <svg ref={svgRef} style={{ width: '100%', height: H, overflow: 'visible' }} viewBox={`0 0 ${W} ${H}`} />
}
