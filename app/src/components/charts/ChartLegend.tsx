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
      gap:        '6px 20px',
      marginTop:  10,
      paddingLeft: 4,
    }}>
      {entries.map(({ label, color, dash, swatch = 'line' }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {swatch === 'rect' ? (
            <div style={{
              width: 12, height: 12, borderRadius: 3,
              background: color, opacity: 0.9, flexShrink: 0,
            }} />
          ) : (
            <svg width={22} height={12} style={{ flexShrink: 0, overflow: 'visible' }}>
              <line
                x1={0} x2={22} y1={6} y2={6}
                stroke={color}
                strokeWidth={2.5}
                strokeDasharray={dash ?? undefined}
              />
            </svg>
          )}
          <span style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize:   11,
            color:      'rgba(0,0,0,0.65)',
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
