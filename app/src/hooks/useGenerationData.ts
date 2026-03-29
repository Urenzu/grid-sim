import { useState, useEffect } from 'react'
import type { BaGenData } from '../types'

export function useGenerationData(active: boolean) {
  const [genData, setGenData] = useState<BaGenData[] | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch once when activated
  useEffect(() => {
    if (!active) return
    let cancelled = false
    setLoading(true)
    fetch('/api/generation')
      .then(r => r.json())
      .then((d: BaGenData[]) => { if (!cancelled) setGenData(d) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [active])

  // Poll every 5 minutes while active
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      fetch('/api/generation')
        .then(r => r.json())
        .then(setGenData)
        .catch(console.error)
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [active])

  return { genData, loading }
}
