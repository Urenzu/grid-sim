import * as d3 from 'd3'

// EIA periods arrive as "2026-04-07T14" — parse as local time
export function parseEiaPeriod(p: string): Date {
  return new Date(p + ':00')
}

export function makeTimeScale(periods: string[], width: number) {
  const dates = periods.map(parseEiaPeriod)
  return d3.scaleTime()
    .domain([dates[0], dates[dates.length - 1]])
    .range([0, width])
}

function fmt12(d: Date): string {
  const h = d.getHours()
  if (h === 0)  return 'midnight'
  if (h === 12) return 'noon'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function axisConfig(periods: string[]): {
  tickInterval: d3.TimeInterval
  format: (d: Date) => string
  dayLines: boolean
} {
  const dates = periods.map(parseEiaPeriod)
  const spanH = (dates[dates.length - 1].getTime() - dates[0].getTime()) / 3_600_000

  if (spanH <= 26) {
    return {
      tickInterval: d3.timeHour.every(4)!,
      format: d => fmt12(d),
      dayLines: false,
    }
  }
  if (spanH <= 74) {
    return {
      tickInterval: d3.timeHour.every(12)!,
      format: d => {
        const h = d.getHours()
        // At midnight show day name, otherwise just time
        return h === 0 ? DAY[d.getDay()] : fmt12(d)
      },
      dayLines: true,
    }
  }
  return {
    tickInterval: d3.timeDay.every(1)!,
    format: d => `${DAY[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`,
    dayLines: true,
  }
}

export function drawTimeAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleTime<number, number>,
  config: ReturnType<typeof axisConfig>,
  innerHeight: number,
  _innerWidth: number,
) {
  if (config.dayLines) {
    const midnights = scale.ticks(d3.timeDay.every(1)!)
    g.selectAll<SVGLineElement, Date>('line.midnight')
      .data(midnights).join('line').attr('class', 'midnight')
      .attr('x1', d => scale(d)).attr('x2', d => scale(d))
      .attr('y1', 0).attr('y2', innerHeight)
      .attr('stroke', 'rgba(0,0,0,0.1)').attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3')
  }

  g.call(
    d3.axisBottom(scale)
      .ticks(config.tickInterval)
      .tickFormat(d => config.format(d as Date))
  )
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('.tick line').remove())
    .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
      .attr('font-size', 8)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', d => {
        // Bold the day-name ticks on the 48-72h range
        const date = d as Date
        return date.getHours?.() === 0 ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)'
      })
      .attr('font-weight', d => {
        const date = d as Date
        return date.getHours?.() === 0 ? '600' : '400'
      })
    )
}

export function drawYAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleLinear<number, number>,
  innerWidth: number,
  format: (d: d3.NumberValue) => string,
  ticks = 4,
) {
  g.call(
    d3.axisLeft(scale).ticks(ticks).tickSize(-innerWidth).tickFormat(format)
  )
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('.tick line').attr('stroke', 'rgba(0,0,0,0.07)'))
    .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
      .attr('font-size', 8)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.35)')
    )
}

