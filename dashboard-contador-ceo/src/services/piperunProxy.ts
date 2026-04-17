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

  // Edge Function wraps in { success, data: <piperun_response>, status }
  // PipeRun response itself has { data: [...], meta: {...} }
  const piperunResponse = data?.data || data
  return piperunResponse as PiperunAPIResponse<T>
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

  // Edge Function wraps: { success, data: <piperun /me response>, status }
  const meData = data?.data?.data || data?.data
  if (!meData) {
    return { success: false, error: 'Resposta vazia da API PipeRun' }
  }

  return {
    success: true,
    data: {
      account_name: meData.account_name || meData.company?.name || 'N/A',
      user_email: meData.email || meData.user_email || 'N/A',
      user_acl: meData.acl || meData.user_acl || 'N/A',
    },
  }
}
