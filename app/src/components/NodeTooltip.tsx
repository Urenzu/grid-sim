import { AnimatePresence, motion } from 'motion/react'
import type { GridData } from '../types'

const BA_LABELS = new Map([
  ['BPAT', 'Bonneville Power Admin'],
  ['PACW', 'PacifiCorp West'],
  ['CISO', 'California ISO'],
  ['IPCO', 'Idaho Power'],
  ['NEVP', 'NV Energy'],
  ['PACE', 'PacifiCorp East'],
  ['AZPS', 'Arizona Public Service'],
  ['SRP',  'Salt River Project'],
  ['WACM', 'WAPA Colorado'],
  ['PSCO', 'Xcel Energy Colorado'],
  ['SWPP', 'Southwest Power Pool'],
  ['ERCO', 'ERCOT'],
  ['MISO', 'Midcontinent ISO'],
  ['TVA',  'Tennessee Valley Authority'],
  ['PJM',  'PJM Interconnection'],
  ['DUK',  'Duke Energy'],
  ['SC',   'South Carolina E&G'],
  ['FPL',  'Florida Power & Light'],
  ['NYIS', 'New York ISO'],
  ['ISNE', 'ISO New England'],
])

interface Props {
  nodeId: string | null
  x: number
  y: number
  data: GridData | null
}

export function NodeTooltip({ nodeId, x, y, data }: Props) {
  const net = nodeId && data
    ? data.links.reduce((acc, l) => {
        if (l.source === nodeId) return acc + l.value
        if (l.target === nodeId) return acc - l.value
        return acc
      }, 0)
    : 0

  const label = nodeId ? BA_LABELS.get(nodeId) ?? nodeId : ''
  const isExport = net >= 0
  const absMW = Math.abs(net).toLocaleString()

  return (
    <AnimatePresence>
      {nodeId && (
        <motion.div
          key={nodeId}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'fixed',
            left: x + 18,
            top: y - 14,
            zIndex: 50,
            pointerEvents: 'none',
            background: 'rgba(8,8,8,0.97)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            lineHeight: 1.9,
            letterSpacing: '0.04em',
          }}
        >
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, marginBottom: 6 }}>
            {nodeId}
          </div>
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 6,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 20,
            color: 'rgba(255,255,255,0.3)',
          }}>
            <span>{isExport ? 'net export' : 'net import'}</span>
            <span style={{ color: isExport ? '#4a9eff' : '#ff8040' }}>
              {absMW} MW
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
