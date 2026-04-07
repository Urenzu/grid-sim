import { useState, useEffect } from 'react'
import type { GenHistoryPoint, DuckPoint } from '../types'

export function useHistoryData(ba: string, hours = 48) {
  const [history, setHistory] = useState<GenHistoryPoint[] | null>(null)
  const [duck, setDuck]       = useState<DuckPoint[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ba) return
    let cancelled = false
    setLoading(true)

    const params = `ba=${encodeURIComponent(ba)}&hours=${hours}`

    Promise.all([
      fetch(`/api/history?${params}`).then(r => r.json()),
      fetch(`/api/duck-curve?${params}`).then(r => r.json()),
    ])
      .then(([h, d]: [GenHistoryPoint[], DuckPoint[]]) => {
        if (!cancelled) { setHistory(h); setDuck(d) }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [ba, hours])

  // Poll every 5 minutes
  useEffect(() => {
    if (!ba) return
    const params = `ba=${encodeURIComponent(ba)}&hours=${hours}`
    const id = setInterval(() => {
      Promise.all([
        fetch(`/api/history?${params}`).then(r => r.json()),
        fetch(`/api/duck-curve?${params}`).then(r => r.json()),
      ])
        .then(([h, d]: [GenHistoryPoint[], DuckPoint[]]) => { setHistory(h); setDuck(d) })
        .catch(console.error)
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [ba, hours])

  return { history, duck, loading }
}
