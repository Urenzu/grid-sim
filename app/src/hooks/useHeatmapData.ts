import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { HeatmapCell } from '../types'

export function useHeatmapData(ba: string, days = 30) {
  const params = `ba=${encodeURIComponent(ba)}&days=${days}`

  const { data, isLoading, isFetching } = useQuery<HeatmapCell[]>({
    queryKey: ['heatmap', ba, days],
    queryFn:  () => fetch(`/api/heatmap?${params}`).then(r => r.json()),
    enabled:  !!ba,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })

  return {
    cells:    data ?? [],
    loading:  isLoading,
    fetching: isFetching,
  }
}
