import { useState, useEffect } from 'react'
import type { BaCarbonData } from '../types'

export function useCarbonData() {
  const [carbonData, setCarbonData] = useState<BaCarbonData[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/carbon')
      .then(r => r.json())
      .then((d: BaCarbonData[]) => { if (!cancelled) setCarbonData(d) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/carbon')
        .then(r => r.json())
        .then(setCarbonData)
        .catch(console.error)
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  return { carbonData, loading }
}
