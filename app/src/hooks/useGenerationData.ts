import { useState, useEffect } from 'react'
import type { BaGenData } from '../types'

export function useGenerationData() {
  const [genData, setGenData] = useState<BaGenData[] | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch once on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/generation')
      .then(r => r.json())
      .then((d: BaGenData[]) => { if (!cancelled) setGenData(d) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Poll every 5 minutes
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/generation')
        .then(r => r.json())
        .then(setGenData)
        .catch(console.error)
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  return { genData, loading }
}
