import { useQuery } from '@tanstack/react-query'
import type { BaCarbonData } from '../types'

export function useCarbonData() {
  const { data, isLoading } = useQuery<BaCarbonData[]>({
    queryKey: ['carbon'],
    queryFn: () => fetch('/api/carbon').then(r => r.json()),
  })
  return { carbonData: data ?? null, loading: isLoading }
}
