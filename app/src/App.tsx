import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { GridMap }           from './components/GridMap'
import { HUD }               from './components/HUD'
import { BAInfoPanel }       from './components/BAInfoPanel'
import { ModeBar, DEFAULT_LAYERS } from './components/ModeBar'
import { Dispatch }          from './components/Dispatch'
import { Analytics }         from './components/Analytics'
import { useGridData }       from './hooks/useGridData'
import { useGenerationData } from './hooks/useGenerationData'
import { useCarbonData }     from './hooks/useCarbonData'
import type { Mode, LayerKey } from './types'

type View = 'grid' | 'dispatch' | 'analytics'
const VIEWS: { id: View; label: string }[] = [
  { id: 'grid',      label: 'grid'      },
  { id: 'dispatch',  label: 'dispatch'  },
  { id: 'analytics', label: 'analytics' },
]

export default function App() {
  const { data, error, loading } = useGridData()
  const [hoveredBA,  setHoveredBA]  = useState<string | null>(null)
  const [selectedBA, setSelectedBA] = useState<string | null>(null)
  const [mode,   setMode]   = useState<Mode>('flow')
  const [layers, setLayers] = useState<Set<LayerKey>>(new Set(DEFAULT_LAYERS))
  const [view,   setView]   = useState<View>('grid')
  const [dispatchBA, setDispatchBA] = useState('CISO')

  const { genData }    = useGenerationData()
  const { carbonData } = useCarbonData()
  const queryClient    = useQueryClient()

  const displayedBA = hoveredBA ?? selectedBA
  const hoverTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Prefetch dispatch data for a BA — fires silently, no-ops if already cached
  function prefetchDispatch(baId: string, hours = 48) {
    const params = `ba=${encodeURIComponent(baId)}&hours=${hours}`
    queryClient.prefetchQuery({ queryKey: ['history', baId, hours], queryFn: () => fetch(`/api/history?${params}`).then(r => r.json()) })
    queryClient.prefetchQuery({ queryKey: ['duck',    baId, hours], queryFn: () => fetch(`/api/duck-curve?${params}`).then(r => r.json()) })
  }

  // Warm the default BA on startup so first dispatch visit is instant
  useEffect(() => { prefetchDispatch('CISO') }, []) // eslint-disable-line

  // Debounce hover: 60ms enter, 80ms leave — prevents jitter when cursor
  // moves quickly between BAs or briefly grazes the hit area
  function handleBAHover(id: string | null) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHoveredBA(id), id ? 60 : 80)
  }

  function handleBASelect(id: string | null) {
    setSelectedBA(prev => prev === id ? null : id)
    if (id) prefetchDispatch(id) // start fetching immediately on click
  }

  function navigateToDispatch(baId: string) {
    setDispatchBA(baId)
    setView('dispatch')
  }

  function handleViewToggle(v: View) {
    if (v === 'dispatch' && selectedBA) setDispatchBA(selectedBA)
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
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => handleViewToggle(v.id)} style={{
            background: view === v.id ? 'rgba(0,102,204,0.08)' : 'transparent',
            border: view === v.id ? '1px solid rgba(0,102,204,0.2)' : '1px solid transparent',
            borderRadius: 999,
            color: view === v.id ? '#0066cc' : 'rgba(0,0,0,0.45)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            padding: '8px 22px',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}>
            {v.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {view === 'grid' ? (
          <motion.div key="grid"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', inset: 0 }}
          >
            <GridMap
              data={data} onBAHover={handleBAHover}
              selectedBA={selectedBA} onBASelect={handleBASelect}
              mode={mode} layers={layers} genData={genData} carbonData={carbonData}
            />
            <HUD data={data} error={error} loading={loading} />
            <BAInfoPanel
              baId={displayedBA} selectedBA={selectedBA} data={data} genData={genData}
              onViewAnalytics={navigateToDispatch}
            />
            <ModeBar mode={mode} layers={layers} onMode={setMode} onLayerToggle={toggleLayer} />
          </motion.div>
        ) : view === 'dispatch' ? (
          <motion.div key="dispatch"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', inset: 0 }}
          >
            <Dispatch
              genData={genData} carbonData={carbonData}
              ba={dispatchBA} onBaChange={setDispatchBA}
            />
          </motion.div>
        ) : (
          <motion.div key="analytics"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'fixed', inset: 0 }}
          >
            <Analytics />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
