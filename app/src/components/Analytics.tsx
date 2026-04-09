export function Analytics() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(248,248,248,0.97)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 12,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: 'rgba(0,0,0,0.3)',
      }}>
        global analytics
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'rgba(0,0,0,0.18)',
      }}>
        coming soon — cross-BA rankings, Polars-powered historical analysis
      </div>
    </div>
  )
}
