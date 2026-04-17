import { supabase } from '@/services/supabase'
import type { PiperunAPIResponse } from '@/types/piperun'

interface ProxyRequest {
  endpoint: string
  params?: Record<string, string>
  token?: string
}

export async function callPiperunProxy<T>(request: ProxyRequest): Promise<PiperunAPIResponse<T>> {
  const { data, error } = await supabase.functions.invoke('proxy-piperun', {
    body: request,
  })

  if (error) {
    throw new Error(`Erro ao chamar proxy PipeRun: ${error.message}`)
  }

  return data as PiperunAPIResponse<T>
}

export async function triggerSync(): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('sync-piperun')

  if (error) {
    return { success: false, error: error.message }
  }

  return data as { success: boolean; error?: string }
}

export async function testPiperunConnection(token: string): Promise<{
  success: boolean
  data?: { account_name: string; user_email: string; user_acl: string }
  error?: string
}> {
  const { data, error } = await supabase.functions.invoke('proxy-piperun', {
    body: { endpoint: '/me', params: {}, token },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}
