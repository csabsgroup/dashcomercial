import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import type { RankingSnapshot } from '@/types/database'
import { MOCK_ENABLED } from '@/mocks/mockData'

export function useRealtimeRanking(roleType: 'closer' | 'sdr', metric: string) {
  const [current, setCurrent] = useState<RankingSnapshot | null>(null)
  const [previous, setPrevious] = useState<RankingSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (MOCK_ENABLED) {
      setLoading(false)
      return
    }

    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    const fetchSnapshots = async () => {
      const { data } = await supabase
        .from('ranking_snapshots')
        .select('*')
        .eq('role_type', roleType)
        .eq('metric', metric)
        .eq('period_month', month)
        .eq('period_year', year)
        .order('snapshot_at', { ascending: false })
        .limit(2)

      if (data && data.length > 0) {
        setCurrent(data[0] as RankingSnapshot)
        if (data.length > 1) {
          setPrevious(data[1] as RankingSnapshot)
        }
      }
      setLoading(false)
    }

    fetchSnapshots()

    const channel = supabase
      .channel(`ranking_${roleType}_${metric}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ranking_snapshots' },
        (payload) => {
          const snap = payload.new as RankingSnapshot
          if (snap.role_type === roleType && snap.metric === metric) {
            setPrevious(current)
            setCurrent(snap)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roleType, metric, current])

  return { current, previous, loading }
}
