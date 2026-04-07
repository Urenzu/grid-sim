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

// Derive span from data, pick appropriate tick interval + format
export function axisConfig(periods: string[]): {
  tickInterval: d3.TimeInterval
  format: (d: Date) => string
  dayLines: boolean
} {
  const dates   = periods.map(parseEiaPeriod)
  const spanH   = (dates[dates.length - 1].getTime() - dates[0].getTime()) / 3_600_000

  if (spanH <= 26) {
    return {
      tickInterval: d3.timeHour.every(4)!,
      format: d => {
        const h = d.getHours()
        return `${h.toString().padStart(2, '0')}:00`
      },
      dayLines: false,
    }
  }
  if (spanH <= 74) {
    return {
      tickInterval: d3.timeHour.every(12)!,
      format: d => {
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
        return `${days[d.getDay()]} ${d.getHours().toString().padStart(2,'0')}h`
      },
      dayLines: true,
    }
  }
  return {
    tickInterval: d3.timeDay.every(1)!,
    format: d => {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      return days[d.getDay()]
    },
    dayLines: true,
  }
}

// Draw a standard time x-axis + optional midnight gridlines onto a <g> selection
export function drawTimeAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleTime<number, number>,
  config: ReturnType<typeof axisConfig>,
  innerHeight: number,
  _innerWidth: number,
) {
  // Midnight gridlines
  if (config.dayLines) {
    const midnights = scale.ticks(d3.timeDay.every(1)!)
    g.selectAll<SVGLineElement, Date>('line.midnight')
      .data(midnights)
      .join('line')
      .attr('class', 'midnight')
      .attr('x1', d => scale(d)).attr('x2', d => scale(d))
      .attr('y1', 0).attr('y2', innerHeight)
      .attr('stroke', 'rgba(0,0,0,0.08)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3')
  }

  // Axis
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
      .attr('fill', 'rgba(0,0,0,0.3)')
    )
}

// Draw a standard left y-axis with horizontal gridlines
export function drawYAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleLinear<number, number>,
  innerWidth: number,
  format: (d: d3.NumberValue) => string,
  ticks = 4,
) {
  g.call(
    d3.axisLeft(scale)
      .ticks(ticks)
      .tickSize(-innerWidth)
      .tickFormat(format)
  )
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('.tick line')
      .attr('stroke', 'rgba(0,0,0,0.07)')
      .attr('stroke-dasharray', null)
    )
    .call(ax => ax.selectAll<SVGTextElement, unknown>('.tick text')
      .attr('font-size', 8)
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('fill', 'rgba(0,0,0,0.35)')
    )
}
