import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const { endpoint, method = 'GET', params = {}, token: overrideToken } = await req.json()

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing endpoint' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Allowlist of safe endpoints
    const allowedPrefixes = [
      '/deals', '/activities', '/pipelines', '/stages', '/users',
      '/origins', '/lostReasons', '/activityTypes', '/customFields', '/me', '/items',
    ]

    const isAllowed = endpoint === '/' || allowedPrefixes.some((prefix) => endpoint.startsWith(prefix))
    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: 'Endpoint not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get API token
    let apiToken = overrideToken
    if (!apiToken) {
      const { data: config } = await supabase
        .from('piperun_config')
        .select('api_token_encrypted')
        .eq('is_configured', true)
        .single()

      apiToken = config?.api_token_encrypted
    }

    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: 'PipeRun não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build URL
    const baseUrl = 'https://api.pipe.run/v1'
    const queryString = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString()
    const url = `${baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`

    // Call PipeRun
    const piperunRes = await fetch(url, {
      method,
      headers: {
        Token: apiToken,
        'Content-Type': 'application/json',
      },
    })

    const data = await piperunRes.json()

    return new Response(
      JSON.stringify({ success: piperunRes.ok, data, status: piperunRes.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Proxy failed', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
