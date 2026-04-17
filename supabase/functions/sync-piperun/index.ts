import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---------- PipeRun Client with rate-limit + cursor pagination ----------
class PiperunClient {
  private baseUrl: string
  private token: string
  private remainingRequests = 120

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl
    this.token = token
  }

  async get(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

    const response = await fetch(url.toString(), {
      headers: { Token: this.token, Accept: 'application/json' },
    })

    // Track rate limit
    const remaining = response.headers.get('X-RateLimit-Remaining')
    if (remaining) this.remainingRequests = parseInt(remaining, 10)

    // Handle 429
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10)
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      return this.get(endpoint, params)
    }

    if (!response.ok) {
      throw new Error(`PipeRun API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getAll(endpoint: string, params: Record<string, string> = {}): Promise<any[]> {
    let allData: any[] = []
    let cursor: string | null = ''

    while (cursor !== null) {
      // Throttle when few requests remain
      if (this.remainingRequests < 10) {
        await new Promise((r) => setTimeout(r, 5000))
      }

      const response = await this.get(endpoint, {
        ...params,
        show: '200',
        cursor: cursor || '',
      })

      if (response.data) {
        allData = allData.concat(response.data)
      }

      cursor = response.meta?.cursor?.next ?? null
    }

    return allData
  }
}

// ---------- Notification helpers ----------
async function createNotification(
  supabase: any,
  userId: string | null,
  type: string,
  title: string,
  message: string,
  data: Record<string, unknown> = {}
) {
  if (userId) {
    await supabase.from('notifications').insert({ user_id: userId, type, title, message, data })
  } else {
    // Broadcast to all admins/masters
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('id')
      .in('role', ['master', 'admin'])
      .eq('active', true)
    for (const admin of admins || []) {
      await supabase.from('notifications').insert({ user_id: admin.id, type, title, message, data })
    }
  }
}

async function checkAndNotifyGoals(supabase: any, config: any, totalDeals: number) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  // Get monthly revenue goal
  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .eq('year', year)
    .eq('period_type', 'monthly')
    .eq('period_value', month)
    .eq('goal_type', 'revenue')
    .is('user_id', null)

  if (!goals || goals.length === 0) return

  const target = goals[0].target_value

  // Calculate current revenue from won deals this month
  const startOfMonth = new Date(year, month - 1, 1).toISOString()
  const endOfMonth = new Date(year, month, 1).toISOString()

  const { data: wonDeals } = await supabase
    .from('piperun_deals_cache')
    .select('value')
    .eq('status', 'won')
    .eq('pipeline_id', config.closer_pipeline_id)
    .gte('piperun_created_at', startOfMonth)
    .lt('piperun_created_at', endOfMonth)

  const totalRevenue = (wonDeals || []).reduce((s: number, d: any) => s + (d.value || 0), 0)

  // Goal reached
  if (target > 0 && totalRevenue >= target) {
    await createNotification(supabase, null, 'goal_reached', 'Meta atingida! 🎯', `Faturamento de R$ ${totalRevenue.toLocaleString('pt-BR')} atingiu a meta de R$ ${target.toLocaleString('pt-BR')}`)
  }

  // Gap alert (> 30% behind with < 40% of month remaining)
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(year, month, 0).getDate()
  const pctMonthElapsed = dayOfMonth / daysInMonth
  if (pctMonthElapsed > 0.6 && totalRevenue < target * 0.7) {
    await createNotification(supabase, null, 'gap_alert', 'Alerta de Gap ⚠️', `Faturamento está ${Math.round((1 - totalRevenue / target) * 100)}% abaixo da meta com ${Math.round((1 - pctMonthElapsed) * 100)}% do mês restante`)
  }
}

async function checkHighValueDeals(supabase: any, config: any) {
  // Find deals won in the last 10 minutes (recent sync window)
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { data: recentWins } = await supabase
    .from('piperun_deals_cache')
    .select('title, value, user_id')
    .eq('status', 'won')
    .eq('pipeline_id', config.closer_pipeline_id)
    .gte('synced_at', tenMinAgo)
    .gt('value', 10000)

  for (const deal of recentWins || []) {
    // Find the user profile for this piperun user
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, name')
      .eq('piperun_user_id', deal.user_id)
      .single()

    await createNotification(
      supabase,
      null,
      'high_value_deal',
      'Deal de alto valor! 💰',
      `${profile?.name || 'Vendedor'} fechou "${deal.title}" por R$ ${(deal.value || 0).toLocaleString('pt-BR')}`,
      { deal_value: deal.value, user_name: profile?.name }
    )
  }
}

async function detectRankingChanges(supabase: any) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  // Get previous snapshot
  const { data: prevSnapshots } = await supabase
    .from('ranking_snapshots')
    .select('ranking_data, role_type')
    .eq('period_month', month)
    .eq('period_year', year)
    .eq('role_type', 'closer')
    .order('snapshot_at', { ascending: false })
    .limit(2)

  if (!prevSnapshots || prevSnapshots.length < 2) return

  const current = prevSnapshots[0].ranking_data as any[]
  const previous = prevSnapshots[1].ranking_data as any[]

  for (let i = 0; i < current.length; i++) {
    const entry = current[i]
    const prevIdx = previous.findIndex((p: any) => p.piperun_user_id === entry.piperun_user_id)
    if (prevIdx > i && prevIdx !== -1) {
      // This user moved up — find their profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, name')
        .eq('piperun_user_id', entry.piperun_user_id)
        .single()

      if (profile) {
        await createNotification(
          supabase,
          null,
          'ranking_change',
          'Mudança no ranking! 📈',
          `${profile.name} subiu da posição ${prevIdx + 1} para ${i + 1}`,
          { user_id: profile.id, from: prevIdx + 1, to: i + 1 }
        )
      }
    }
  }
}

// ---------- Main handler ----------
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // 1. Get config
    const { data: config, error: configError } = await supabase
      .from('piperun_config')
      .select('*')
      .single()

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'PipeRun não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const piperun = new PiperunClient(
      config.base_url || 'https://api.pipe.run/v1',
      config.api_token_encrypted
    )

    // 2. Determine if incremental
    const { data: lastSync } = await supabase
      .from('sync_log')
      .select('synced_at')
      .eq('status', 'success')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    const isIncremental = !!lastSync
    const syncParams: Record<string, string> = {}
    if (isIncremental && lastSync) {
      syncParams.updated_at_start = lastSync.synced_at
    }

    let totalDeals = 0
    let totalActivities = 0

    // 2.5. Sync items catalog from PipeRun
    try {
      const items = await piperun.getAll('/items')
      const itemRows = items.map((item: any) => ({
        piperun_item_id: item.id,
        name: item.name || `Produto #${item.id}`,
        price: item.price || item.unit_price || 0,
        data: item,
        synced_at: new Date().toISOString(),
      }))
      if (itemRows.length > 0) {
        for (let i = 0; i < itemRows.length; i += 500) {
          const chunk = itemRows.slice(i, i + 500)
          await supabase.from('piperun_items_cache').upsert(chunk, { onConflict: 'piperun_item_id' })
        }
      }
    } catch (itemErr) {
      console.error('Items sync error (non-fatal):', itemErr)
    }

    // 3. Sync deals for each pipeline (with customForms)
    const pipelines = [config.closer_pipeline_id, config.sdr_pipeline_id].filter(Boolean)

    for (const pipelineId of pipelines) {
      const deals = await piperun.getAll('/deals', {
        pipeline_id: String(pipelineId),
        with: 'customForms,items',
        ...syncParams,
      })

      const cacheRows = deals.map((deal: any) => {
        // Extract first item_id from deal items (if available)
        const dealItems = deal.items || deal.products || []
        const firstItemId = Array.isArray(dealItems) && dealItems.length > 0
          ? (dealItems[0].item_id || dealItems[0].product_id || dealItems[0].id || null)
          : null

        return {
          piperun_deal_id: deal.id,
          pipeline_id: deal.pipeline_id,
          stage_id: deal.stage_id,
          user_id: deal.user_id,
          status: deal.status === 1 ? 'open' : deal.status === 2 ? 'won' : deal.status === 3 ? 'lost' : typeof deal.status === 'string' ? deal.status : 'open',
          value: deal.value || 0,
          title: deal.title,
          origin_id: deal.origin_id,
          lost_reason_id: deal.lost_reason_id,
          person_id: deal.person_id,
          company_id: deal.company_id,
          custom_fields: deal.customForms || deal.custom_fields || {},
          item_id: firstItemId,
          piperun_created_at: deal.created_at,
          piperun_updated_at: deal.updated_at,
          raw_data: deal,
          synced_at: new Date().toISOString(),
        }
      })

      if (cacheRows.length > 0) {
        // Batch upsert in chunks of 500
        for (let i = 0; i < cacheRows.length; i += 500) {
          const chunk = cacheRows.slice(i, i + 500)
          await supabase.from('piperun_deals_cache').upsert(chunk, { onConflict: 'piperun_deal_id' })
        }
        totalDeals += cacheRows.length
      }

      // 4. Sync activities for updated deals
      const dealIds = deals.map((d: any) => d.id)
      for (const dealId of dealIds) {
        const activities = await piperun.getAll('/activities', { deal_id: String(dealId) })

        const actRows = activities.map((act: any) => ({
          piperun_activity_id: act.id,
          deal_id: act.deal_id,
          user_id: act.user_id,
          activity_type_id: act.activity_type_id || act.type_id,
          status: act.status || (act.done ? 'done' : 'pending'),
          title: act.title || act.notes || null,
          piperun_created_at: act.created_at,
          piperun_updated_at: act.updated_at,
          synced_at: new Date().toISOString(),
        }))

        if (actRows.length > 0) {
          await supabase.from('piperun_activities_cache').upsert(actRows, { onConflict: 'piperun_activity_id' })
          totalActivities += actRows.length
        }
      }
    }

    // 5. Sync reference data (stages, origins, lost reasons)
    for (const pipelineId of pipelines) {
      const stagesRes = await piperun.get('/stages', { pipeline_id: String(pipelineId) })
      for (const stage of stagesRes.data || []) {
        await supabase.from('piperun_stages_cache').upsert(
          {
            piperun_stage_id: stage.id,
            pipeline_id: stage.pipeline_id,
            name: stage.name,
            position: stage.sort || 0,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'piperun_stage_id' }
        )
      }
    }

    // Sync origins
    try {
      const originsRes = await piperun.get('/origins')
      for (const origin of originsRes.data || []) {
        await supabase.from('piperun_origins_cache').upsert(
          { piperun_origin_id: origin.id, name: origin.name, synced_at: new Date().toISOString() },
          { onConflict: 'piperun_origin_id' }
        )
      }
    } catch { /* origins endpoint may not exist */ }

    // Sync lost reasons
    try {
      const reasonsRes = await piperun.get('/lostReasons')
      for (const reason of reasonsRes.data || []) {
        await supabase.from('piperun_lost_reasons_cache').upsert(
          { piperun_reason_id: reason.id, name: reason.name, synced_at: new Date().toISOString() },
          { onConflict: 'piperun_reason_id' }
        )
      }
    } catch { /* lost reasons endpoint may not exist */ }

    // Sync activity types
    try {
      const actTypesRes = await piperun.get('/activityTypes')
      for (const actType of actTypesRes.data || []) {
        await supabase.from('piperun_activity_types_cache').upsert(
          { piperun_type_id: actType.id, name: actType.name, synced_at: new Date().toISOString() },
          { onConflict: 'piperun_type_id' }
        )
      }
    } catch { /* activity types endpoint may not exist */ }

    // 6. Register in sync_log (matching actual table schema)
    const durationMs = Date.now() - startTime
    await supabase.from('sync_log').insert({
      synced_at: new Date().toISOString(),
      sync_type: isIncremental ? 'incremental' : 'full',
      deals_synced: totalDeals,
      activities_synced: totalActivities,
      status: 'success',
      duration_ms: durationMs,
    })

    // 6.5. Update piperun_config with last sync info
    await supabase.from('piperun_config').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
    }).eq('id', config.id)

    // 7. Generate ranking snapshot
    await supabase.rpc('generate_ranking_snapshot')

    // 8. Generate notifications
    try {
      await checkAndNotifyGoals(supabase, config, totalDeals)
      await checkHighValueDeals(supabase, config)
      await detectRankingChanges(supabase)
    } catch (notifErr) {
      console.error('Notification generation error (non-fatal):', notifErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        sync_type: isIncremental ? 'incremental' : 'full',
        deals_synced: totalDeals,
        activities_synced: totalActivities,
        duration_ms: durationMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Sync error:', error)

    // Log error in sync_log
    const durationMs = Date.now() - startTime
    await supabase.from('sync_log').insert({
      synced_at: new Date().toISOString(),
      sync_type: 'error',
      status: 'error',
      error_message: String(error),
      duration_ms: durationMs,
    })

    // Update piperun_config with error status
    await supabase.from('piperun_config').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
    }).neq('id', '')

    // Notify admins of sync error
    try {
      await createNotification(supabase, null, 'sync_error', 'Erro na sincronização ❌', String(error))
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({ error: 'Sync failed', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
