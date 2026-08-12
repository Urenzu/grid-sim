import { useQuery } from '@tanstack/react-query'
import type { BaDemandData } from '../types'

export function useDemandData() {
  const { data, isLoading } = useQuery<BaDemandData[]>({
    queryKey: ['demand'],
    queryFn: () => fetch('/api/demand').then(r => r.json()),
  })
  return { demandData: data ?? null, loading: isLoading }
}
