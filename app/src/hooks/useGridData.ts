import { useQuery } from '@tanstack/react-query'
import type { GridData } from '../types'

export function useGridData() {
  const { data, error, isLoading } = useQuery<GridData>({
    queryKey: ['interchange'],
    queryFn: () => fetch('/api/interchange').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }),
  })
  return {
    data:    data ?? null,
    error:   error ? 'server offline' : null,
    loading: isLoading,
  }
}
