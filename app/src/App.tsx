import { useState } from 'react'
import { GridMap }           from './components/GridMap'
import { HUD }               from './components/HUD'
import { BAInfoPanel }       from './components/BAInfoPanel'
import { ModeBar, DEFAULT_LAYERS } from './components/ModeBar'
import { useGridData }       from './hooks/useGridData'
import { useGenerationData } from './hooks/useGenerationData'
import type { Mode, LayerKey } from './types'

export default function App() {
  const { data, error, loading } = useGridData()
  const [hoveredBA, setHoveredBA] = useState<string | null>(null)
  const [mode,   setMode]   = useState<Mode>('flow')
  const [layers, setLayers] = useState<Set<LayerKey>>(new Set(DEFAULT_LAYERS))

  const { genData } = useGenerationData()

  function toggleLayer(l: LayerKey) {
    setLayers(prev => {
      const next = new Set(prev)
      next.has(l) ? next.delete(l) : next.add(l)
      return next
    })
  }

  return (
    <>
      <GridMap
        data={data} hoveredBA={hoveredBA} onBAHover={setHoveredBA}
        mode={mode} layers={layers} genData={genData}
      />
      <HUD data={data} error={error} loading={loading} />
      <BAInfoPanel baId={hoveredBA} data={data} genData={genData} />
      <ModeBar mode={mode} layers={layers} onMode={setMode} onLayerToggle={toggleLayer} />
    </>
  )
}
