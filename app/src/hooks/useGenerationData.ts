import { useQuery } from '@tanstack/react-query'
import type { BaGenData } from '../types'

export function useGenerationData() {
  const { data, isLoading } = useQuery<BaGenData[]>({
    queryKey: ['generation'],
    queryFn: () => fetch('/api/generation').then(r => r.json()),
  })
  return { genData: data ?? null, loading: isLoading }
}
