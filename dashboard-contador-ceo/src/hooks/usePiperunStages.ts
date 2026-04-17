import { useState, useCallback } from 'react'
import { callPiperunProxy } from '@/services/piperunProxy'
import type { PiperunStageAPI } from '@/types/piperun'

export function usePiperunStages() {
  const [stages, setStages] = useState<PiperunStageAPI[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (pipelineId: number, token?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await callPiperunProxy<PiperunStageAPI>({
        endpoint: '/stages',
        params: { pipeline_id: String(pipelineId) },
        ...(token ? { token } : {}),
      })
      const sorted = (res.data || []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      setStages(sorted)
    } catch (err) {
      setError((err as Error).message)
      setStages([])
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setStages([])
    setError(null)
  }, [])

  return { stages, loading, error, fetch, reset }
}
