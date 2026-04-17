import { useCallback } from 'react'
import { supabase } from '@/services/supabase'

interface ProxyOptions {
  endpoint: string
  params?: Record<string, string | number>
  token?: string
}

export function usePiperunProxy() {
  const call = useCallback(async <T = unknown>({ endpoint, params, token }: ProxyOptions): Promise<{ data: T | null; error: string | null }> => {
    try {
      const body: Record<string, unknown> = { endpoint, params: params || {} }
      if (token) body.token = token

      const { data, error } = await supabase.functions.invoke('proxy-piperun', { body })

      if (error) {
        return { data: null, error: error.message }
      }

      return { data: data as T, error: null }
    } catch (err) {
      return { data: null, error: (err as Error).message }
    }
  }, [])

  return { call }
}
