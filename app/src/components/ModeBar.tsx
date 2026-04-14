import { motion } from 'motion/react'
import type { Mode, LayerKey } from '../types'

const MODES: { id: Mode; label: string }[] = [
  { id: 'flow',       label: 'Flow'       },
  { id: 'generation', label: 'Generation' },
  { id: 'carbon',     label: 'Carbon'     },
]

const FLOW_LAYERS: { id: LayerKey; label: string }[] = [
  { id: 'arcs',      label: 'Arcs'      },
  { id: 'particles', label: 'Particles' },
]

export const DEFAULT_LAYERS: LayerKey[] = ['arcs', 'particles', 'nuclear', 'hydro', 'wind', 'solar', 'gas', 'coal']

const GLOBAL_LAYERS: { id: LayerKey; label: string; on: string; border: string; text: string }[] = [
  { id: 'nuclear', label: 'Nuclear', on: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)',  text: '#7c3aed' },
  { id: 'hydro',   label: 'Hydro',   on: 'rgba(37,99,235,0.1)',   border: 'rgba(37,99,235,0.3)',   text: '#1d4ed8' },
  { id: 'wind',    label: 'Wind',    on: 'rgba(8,145,178,0.1)',   border: 'rgba(8,145,178,0.3)',   text: '#0e7490' },
  { id: 'solar',   label: 'Solar',   on: 'rgba(217,119,6,0.1)',   border: 'rgba(217,119,6,0.3)',   text: '#b45309' },
  { id: 'gas',     label: 'Gas',     on: 'rgba(234,88,12,0.1)',   border: 'rgba(234,88,12,0.3)',   text: '#c2410c' },
  { id: 'coal',    label: 'Coal',    on: 'rgba(220,38,38,0.1)',   border: 'rgba(220,38,38,0.3)',   text: '#b91c1c' },
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
      gap: 9,
      pointerEvents: 'none',
    }}>

      {/* Generation facility toggles — always visible */}
      <div style={{ display: 'flex', gap: 6, pointerEvents: 'all' }}>
        {GLOBAL_LAYERS.map(({ id, label, on: onBg, border: onBorder, text: onText }) => {
          const active = layers.has(id)
          return (
            <button key={id} onClick={() => onLayerToggle(id)} style={{
              background:           active ? onBg : 'rgba(255,255,255,0.82)',
              backdropFilter:       'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border:               `1px solid ${active ? onBorder : 'rgba(0,0,0,0.09)'}`,
              borderRadius:         999,
              color:                active ? onText : 'rgba(0,0,0,0.45)',
              fontFamily:           'var(--font-mono)',
              fontSize:             11,
              letterSpacing:        '0.1em',
              textTransform:        'uppercase' as const,
              padding:              '7px 16px',
              cursor:               'pointer',
              transition:           'all 0.18s ease',
            }}>
              {label}
            </button>
          )
        })}
      </div>

      {/* Flow layer toggles */}
      {mode === 'flow' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          style={{ display: 'flex', gap: 6, pointerEvents: 'all' }}
        >
          {FLOW_LAYERS.map(({ id, label }) => {
            const on = layers.has(id)
            return (
              <button key={id} onClick={() => onLayerToggle(id)} style={{
                background:           on ? 'rgba(0,102,204,0.08)' : 'rgba(255,255,255,0.82)',
                backdropFilter:       'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border:               `1px solid ${on ? 'rgba(0,102,204,0.25)' : 'rgba(0,0,0,0.09)'}`,
                borderRadius:         999,
                color:                on ? '#0066cc' : 'rgba(0,0,0,0.45)',
                fontFamily:           'var(--font-mono)',
                fontSize:             11,
                letterSpacing:        '0.12em',
                textTransform:        'uppercase' as const,
                padding:              '7px 16px',
                cursor:               'pointer',
                transition:           'all 0.18s ease',
              }}>
                {label}
              </button>
            )
          })}
        </motion.div>
      )}

      {/* Mode pill */}
      <div style={{
        background:           'rgba(255,255,255,0.88)',
        backdropFilter:       'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border:               '1px solid rgba(0,0,0,0.08)',
        borderRadius:         999,
        padding:              5,
        display:              'flex',
        gap:                  2,
        pointerEvents:        'all',
        boxShadow:            '0 2px 12px rgba(0,0,0,0.07)',
      }}>
        {MODES.map(({ id, label }) => (
          <button key={id} onClick={() => onMode(id)} style={{
            position:      'relative',
            background:    'transparent',
            border:        'none',
            borderRadius:  999,
            color:         mode === id ? '#1a1a1a' : 'rgba(0,0,0,0.38)',
            fontFamily:    'var(--font-mono)',
            fontSize:      12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            padding:       '10px 26px',
            cursor:        'pointer',
            transition:    'color 0.18s ease',
            minWidth:      120,
          }}>
            {mode === id && (
              <motion.div
                layoutId="mode-indicator"
                style={{
                  position:   'absolute',
                  inset:      0,
                  borderRadius: 999,
                  background: 'rgba(0,102,204,0.08)',
                  border:     '1px solid rgba(0,102,204,0.2)',
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
