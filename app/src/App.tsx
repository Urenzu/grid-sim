import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { GridMap }           from './components/GridMap'
import { HUD }               from './components/HUD'
import { BAInfoPanel }       from './components/BAInfoPanel'
import { ModeBar, DEFAULT_LAYERS } from './components/ModeBar'
import { Analytics }         from './components/Analytics'
import { useGridData }       from './hooks/useGridData'
import { useGenerationData } from './hooks/useGenerationData'
import { useCarbonData }     from './hooks/useCarbonData'
import type { Mode, LayerKey } from './types'

export default function App() {
  const { data, error, loading } = useGridData()
  const [hoveredBA,  setHoveredBA]  = useState<string | null>(null)
  const [selectedBA, setSelectedBA] = useState<string | null>(null)
  const [mode,   setMode]   = useState<Mode>('flow')
  const [layers, setLayers] = useState<Set<LayerKey>>(new Set(DEFAULT_LAYERS))
  const [view,   setView]   = useState<'map' | 'analytics'>('map')
  const [analyticsBA, setAnalyticsBA] = useState('CISO')

  const { genData }    = useGenerationData()
  const { carbonData } = useCarbonData()

  const displayedBA = hoveredBA ?? selectedBA

  function handleBASelect(id: string | null) {
    setSelectedBA(prev => prev === id ? null : id)
  }

  function navigateToAnalytics(baId: string) {
    setAnalyticsBA(baId)
    setView('analytics')
  }

  function handleViewToggle(v: 'map' | 'analytics') {
    if (v === 'analytics' && selectedBA) setAnalyticsBA(selectedBA)
    setView(v)
  }

  function toggleLayer(l: LayerKey) {
    setLayers(prev => {
      const next = new Set(prev)
      next.has(l) ? next.delete(l) : next.add(l)
      return next
    })
  }

  return (
    <>
      {/* View toggle */}
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 30,
        display: 'flex', gap: 4,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 999, padding: 4,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        {(['map', 'analytics'] as const).map(v => (
          <button key={v} onClick={() => handleViewToggle(v)} style={{
            background: view === v ? 'rgba(0,102,204,0.08)' : 'transparent',
            border: view === v ? '1px solid rgba(0,102,204,0.2)' : '1px solid transparent',
            borderRadius: 999,
            color: view === v ? '#0066cc' : 'rgba(0,0,0,0.35)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding: '7px 18px',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}>
            {v}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {view === 'map' ? (
          <motion.div key="map"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', inset: 0 }}
          >
            <GridMap
              data={data} hoveredBA={hoveredBA} onBAHover={setHoveredBA}
              selectedBA={selectedBA} onBASelect={handleBASelect}
              mode={mode} layers={layers} genData={genData} carbonData={carbonData}
            />
            <HUD data={data} error={error} loading={loading} />
            <BAInfoPanel
              baId={displayedBA} selectedBA={selectedBA} data={data} genData={genData}
              onViewAnalytics={navigateToAnalytics}
            />
            <ModeBar mode={mode} layers={layers} onMode={setMode} onLayerToggle={toggleLayer} />
          </motion.div>
        ) : (
          <motion.div key="analytics"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', inset: 0 }}
          >
            <Analytics
              genData={genData} carbonData={carbonData}
              ba={analyticsBA} onBaChange={setAnalyticsBA}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
