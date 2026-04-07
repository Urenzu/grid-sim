import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GenHistoryPoint } from '../../types'
import { FUEL_COLORS } from '../../data/ba'
import { parseEiaPeriod, makeTimeScale, axisConfig, drawTimeAxis, drawYAxis } from './chartUtils'
import { ChartLegend } from './ChartLegend'

const W = 520, H = 210, M = { top: 12, right: 16, bottom: 26, left: 54 }
const FUELS = ['coal', 'gas', 'other', 'hydro', 'nuclear', 'wind', 'solar']

type FuelRow = { period: string } & { [fuel: string]: number | string }

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
      const row: FuelRow = { period: d.period }
      for (const fuel of FUELS) row[fuel] = 0
      for (const { fuel, mw } of d.fuels) {
        const key = FUELS.includes(fuel) ? fuel : 'other'
        row[key] = ((row[key] as number) ?? 0) + mw
      }
      return row
    })

    const periods = rows.map(r => r.period as string)
    const x   = makeTimeScale(periods, iw)
    const cfg = axisConfig(periods)

    const stack  = d3.stack<FuelRow>().keys(FUELS)
    const series = stack(rows)
    const yMax   = d3.max(series[series.length - 1], d => d[1]) ?? 0
    const y      = d3.scaleLinear().domain([0, yMax * 1.05]).range([ih, 0])

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    drawYAxis(g, y, iw, d => `${(+d / 1000).toFixed(0)} GW`)
    drawTimeAxis(g.append('g').attr('transform', `translate(0,${ih})`), x, cfg, -ih, iw)

    const area = d3.area<d3.SeriesPoint<FuelRow>>()
      .x(d => x(parseEiaPeriod((d.data as FuelRow).period as string)))
      .y0(d => y(d[0])).y1(d => y(d[1]))
      .curve(d3.curveMonotoneX)

    for (const s of series) {
      g.append('path').datum(s)
        .attr('fill', FUEL_COLORS[s.key] ?? '#6b7280')
        .attr('opacity', 0.82).attr('d', area)
    }
  }, [data])

  return (
    <div>
      <svg ref={svgRef} style={{ width: '100%', height: H }} viewBox={`0 0 ${W} ${H}`} />
      <ChartLegend entries={FUELS.map(f => ({
        label:  f,
        color:  FUEL_COLORS[f] ?? '#6b7280',
        swatch: 'rect' as const,
      }))} />
    </div>
  )
}
