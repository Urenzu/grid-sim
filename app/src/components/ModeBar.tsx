import { motion } from 'motion/react'
import type { Mode, LayerKey } from '../types'

const MODES: { id: Mode; label: string }[] = [
  { id: 'flow',       label: 'Flow'       },
  { id: 'generation', label: 'Generation' },
]

const LAYERS: { id: LayerKey; label: string }[] = [
  { id: 'arcs',      label: 'Arcs'      },
  { id: 'particles', label: 'Particles' },
]

interface Props {
  mode:          Mode
  layers:        Set<LayerKey>
  onMode:        (m: Mode) => void
  onLayerToggle: (l: LayerKey) => void
}

export function ModeBar({ mode, layers, onMode, onLayerToggle }: Props) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 52,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      pointerEvents: 'none',
    }}>

      {/* Layer toggles — flow mode only */}
      {mode === 'flow' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          style={{ display: 'flex', gap: 5, pointerEvents: 'all' }}
        >
          {LAYERS.map(({ id, label }) => {
            const on = layers.has(id)
            return (
              <button key={id} onClick={() => onLayerToggle(id)} style={{
                background: on ? 'rgba(0,229,255,0.1)' : 'rgba(10,10,10,0.75)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: `1px solid ${on ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 999,
                color: on ? 'rgba(0,229,255,0.8)' : 'rgba(255,255,255,0.28)',
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.16em',
                textTransform: 'uppercase' as const,
                padding: '5px 14px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}>
                {label}
              </button>
            )
          })}
        </motion.div>
      )}

      {/* Mode pill */}
      <div style={{
        background: 'rgba(10,10,10,0.82)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 999,
        padding: 4,
        display: 'flex',
        gap: 2,
        pointerEvents: 'all',
      }}>
        {MODES.map(({ id, label }) => (
          <button key={id} onClick={() => onMode(id)} style={{
            position: 'relative',
            background: 'transparent',
            border: 'none',
            borderRadius: 999,
            color: mode === id ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase' as const,
            padding: '8px 22px',
            cursor: 'pointer',
            transition: 'color 0.18s ease',
            minWidth: 108,
          }}>
            {mode === id && (
              <motion.div
                layoutId="mode-indicator"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: 'rgba(0,229,255,0.08)',
                  border: '1px solid rgba(0,229,255,0.22)',
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span style={{ position: 'relative' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
