import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { GridTrendPoint } from '../types'

export function useTrendData(granularity: 'day' | 'week' | 'month' = 'month', ba?: string) {
  const params = new URLSearchParams({ granularity })
  if (ba) params.set('ba', ba)

  const { data, isLoading, isFetching } = useQuery<GridTrendPoint[]>({
    queryKey: ['trends', granularity, ba ?? 'all'],
    queryFn:  () => fetch(`/api/trends?${params}`).then(r => r.json()),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  })

  return {
    points:   data ?? [],
    loading:  isLoading,
    fetching: isFetching,
  }
}
