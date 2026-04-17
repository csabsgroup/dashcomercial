import { useState, useCallback } from 'react'
import { callPiperunProxy } from '@/services/piperunProxy'
import type { PiperunPipeline } from '@/types/piperun'

export function usePiperunPipelines() {
  const [pipelines, setPipelines] = useState<PiperunPipeline[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (token?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await callPiperunProxy<PiperunPipeline>({
        endpoint: '/pipelines',
        params: { show: '200' },
        ...(token ? { token } : {}),
      })
      setPipelines(res.data || [])
    } catch (err) {
      setError((err as Error).message)
      setPipelines([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { pipelines, loading, error, fetch }
}
