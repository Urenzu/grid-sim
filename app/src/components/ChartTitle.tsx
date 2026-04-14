import { useState, useEffect } from 'react'

interface Props {
  title:       string
  explanation: string
}

export function ChartTitle({ title, explanation }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
        color: 'rgba(0,0,0,0.75)',
      }}>
        {title}
      </span>

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '1px solid rgba(0,0,0,0.15)',
            background: open ? 'rgba(0,102,204,0.08)' : 'rgba(0,0,0,0.04)',
            color: open ? '#0066cc' : 'rgba(0,0,0,0.38)',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, lineHeight: 1,
            transition: 'all 0.12s ease',
          }}
        >
          ?
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 24, left: 0, zIndex: 50,
            background: 'rgba(255,255,255,0.98)',
            border: '1px solid rgba(0,0,0,0.09)',
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.1)',
            width: 270,
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'rgba(0,0,0,0.6)',
            lineHeight: 1.65,
          }}>
            {explanation}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Expand modal ──────────────────────────────────────────────────────────────

interface ModalProps {
  title:       string
  explanation: string
  onClose:     () => void
  children:    React.ReactNode
}

export function ChartModal({ title, explanation, onClose, children }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '24px 28px 28px',
          boxShadow: '0 32px 100px rgba(0,0,0,0.25)',
          width: '90vw', maxWidth: 1240,
          maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <ChartTitle title={title} explanation={explanation} />
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid rgba(0,0,0,0.1)',
              background: 'rgba(0,0,0,0.04)',
              color: 'rgba(0,0,0,0.45)',
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, lineHeight: 1,
              flexShrink: 0,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.08)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0.7)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0.45)'
            }}
          >
            ×
          </button>
        </div>

        {/* Chart content at full size */}
        <div>{children}</div>
      </div>
    </div>
  )
}
