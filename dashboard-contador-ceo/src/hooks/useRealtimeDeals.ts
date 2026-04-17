import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { toast } from 'sonner'
import type { CachedDeal } from '@/types/database'
import { MOCK_ENABLED, MOCK_ALL_DEALS } from '@/mocks/mockData'

export function useRealtimeDeals(pipelineId?: number | null) {
  const [deals, setDeals] = useState<CachedDeal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (MOCK_ENABLED) {
      const filtered = pipelineId
        ? MOCK_ALL_DEALS.filter(d => d.pipeline_id === pipelineId)
        : MOCK_ALL_DEALS
      setDeals(filtered)
      setLoading(false)
      return
    }

    const fetchDeals = async () => {
      let query = supabase.from('piperun_deals_cache').select('*')
      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId)
      }
      const { data, error } = await query
      if (error) {
        toast.error('Erro ao carregar deals', { description: error.message })
      }
      if (data) setDeals(data as CachedDeal[])
      setLoading(false)
    }

    fetchDeals()

    const channel = supabase
      .channel('deals_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'piperun_deals_cache',
          ...(pipelineId ? { filter: `pipeline_id=eq.${pipelineId}` } : {}),
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setDeals((prev) => [...prev, payload.new as CachedDeal])
          } else if (payload.eventType === 'UPDATE') {
            setDeals((prev) =>
              prev.map((d) =>
                d.piperun_deal_id === (payload.new as CachedDeal).piperun_deal_id
                  ? (payload.new as CachedDeal)
                  : d
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setDeals((prev) =>
              prev.filter(
                (d) => d.piperun_deal_id !== (payload.old as CachedDeal).piperun_deal_id
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pipelineId])

  return { deals, loading }
}
