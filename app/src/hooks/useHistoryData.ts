import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { GenHistoryPoint, DuckPoint } from '../types'

export function useHistoryData(ba: string, hours = 48) {
  const params = `ba=${encodeURIComponent(ba)}&hours=${hours}`

  const { data: history, isLoading: hLoading, isFetching: hFetching } = useQuery<GenHistoryPoint[]>({
    queryKey: ['history', ba, hours],
    queryFn: () => fetch(`/api/history?${params}`).then(r => r.json()),
    enabled: !!ba,
    placeholderData: keepPreviousData,
  })

  const { data: duck, isLoading: dLoading, isFetching: dFetching } = useQuery<DuckPoint[]>({
    queryKey: ['duck', ba, hours],
    queryFn: () => fetch(`/api/duck-curve?${params}`).then(r => r.json()),
    enabled: !!ba,
    placeholderData: keepPreviousData,
  })

  return {
    history:  history ?? null,
    duck:     duck ?? null,
    loading:  hLoading || dLoading,    // true only on first load (no prior data)
    fetching: hFetching || dFetching,  // true on any background refresh
  }
}
