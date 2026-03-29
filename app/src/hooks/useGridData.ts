import { useState, useEffect, useCallback } from 'react'
import type { GridData } from '../types'

const API = 'http://localhost:3000/api/interchange'
const POLL_MS = 5 * 60 * 1000

export function useGridData() {
  const [data, setData]       = useState<GridData | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: GridData = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError('server offline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, POLL_MS)
    return () => clearInterval(id)
  }, [fetch_])

  return { data, error, loading }
}
