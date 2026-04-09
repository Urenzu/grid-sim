import { useQuery } from '@tanstack/react-query'
import type { GenHistoryPoint, DuckPoint } from '../types'

export function useHistoryData(ba: string, hours = 48) {
  const params = `ba=${encodeURIComponent(ba)}&hours=${hours}`

  const { data: history, isLoading: hLoading } = useQuery<GenHistoryPoint[]>({
    queryKey: ['history', ba, hours],
    queryFn: () => fetch(`/api/history?${params}`).then(r => r.json()),
    enabled: !!ba,
  })

  const { data: duck, isLoading: dLoading } = useQuery<DuckPoint[]>({
    queryKey: ['duck', ba, hours],
    queryFn: () => fetch(`/api/duck-curve?${params}`).then(r => r.json()),
    enabled: !!ba,
  })

  return { history: history ?? null, duck: duck ?? null, loading: hLoading || dLoading }
}
