export interface GridNode {
  id: string
  label: string
}

export interface GridLink {
  source: string
  target: string
  value: number
}

export interface GridData {
  nodes: GridNode[]
  links: GridLink[]
  period: string
}

export interface BaGenData {
  ba:           string
  totalMw:      number
  dominantFuel: string
  fuels:        Array<{ fuel: string; mw: number }>
}

export interface BaCarbonData {
  ba:        string
  intensity: number
  totalMw:   number
}

export interface GenHistoryPoint {
  period:  string
  fuels:   Array<{ fuel: string; mw: number }>
  totalMw: number
}

export interface DuckPoint {
  period:     string
  totalMw:    number
  solarMw:    number
  windMw:     number
  netLoadMw:  number
  nuclearMw:  number
  gasMw:      number
  coalMw:     number
  hydroMw:    number
  intensity:  number
}

export type Mode     = 'flow' | 'generation' | 'carbon'
export type LayerKey = 'arcs' | 'particles' | 'nuclear' | 'hydro' | 'wind' | 'solar' | 'gas' | 'coal'
