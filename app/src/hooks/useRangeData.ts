import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { RangeResponse } from '../types'

function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useRangeData(ba: string, days: number) {
  const start = useMemo(() => daysAgoISO(days), [days])
  const end   = useMemo(() => todayISO(),        [])

  const params = `ba=${encodeURIComponent(ba)}&start=${start}&end=${end}`

  const { data, isLoading, isFetching } = useQuery<RangeResponse>({
    queryKey: ['range', ba, days],
    queryFn:  () => fetch(`/api/range?${params}`).then(r => r.json()),
    enabled:  !!ba,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })

  return {
    history:  data?.history ?? null,
    duck:     data?.duck    ?? null,
    loading:  isLoading,
    fetching: isFetching,
  }
}
