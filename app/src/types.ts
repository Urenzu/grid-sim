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

export type Mode     = 'flow' | 'generation'
export type LayerKey = 'arcs' | 'particles'
