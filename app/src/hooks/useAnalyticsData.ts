import { useQuery } from '@tanstack/react-query'
import type { AnalyticsData } from '../types'

export function useAnalyticsData() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: () => fetch('/api/analytics').then(r => r.json()),
    staleTime: 4 * 60 * 1000,
  })
  return { analytics: data ?? null, loading: isLoading }
}
