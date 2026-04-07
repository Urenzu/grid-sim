export interface LegendEntry {
  label:   string
  color:   string
  dash?:   string
  swatch?: 'line' | 'rect'
}

interface Props {
  entries: LegendEntry[]
}

export function ChartLegend({ entries }: Props) {
  return (
    <div style={{
      display:    'flex',
      flexWrap:   'wrap',
      gap:        '4px 18px',
      marginTop:  8,
      paddingLeft: 4,
    }}>
      {entries.map(({ label, color, dash, swatch = 'line' }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {swatch === 'rect' ? (
            <div style={{
              width: 10, height: 10, borderRadius: 2,
              background: color, opacity: 0.85, flexShrink: 0,
            }} />
          ) : (
            <svg width={20} height={10} style={{ flexShrink: 0, overflow: 'visible' }}>
              <line
                x1={0} x2={20} y1={5} y2={5}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={dash ?? undefined}
              />
            </svg>
          )}
          <span style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize:   9,
            color:      'rgba(0,0,0,0.45)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
