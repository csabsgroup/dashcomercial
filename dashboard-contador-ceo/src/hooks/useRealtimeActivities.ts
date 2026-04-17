import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { toast } from 'sonner'
import type { CachedActivity } from '@/types/database'
import { MOCK_ENABLED, MOCK_ACTIVITIES } from '@/mocks/mockData'

export function useRealtimeActivities() {
  const [activities, setActivities] = useState<CachedActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (MOCK_ENABLED) {
      setActivities(MOCK_ACTIVITIES)
      setLoading(false)
      return
    }

    const fetchActivities = async () => {
      const { data, error } = await supabase.from('piperun_activities_cache').select('*')
      if (error) {
        toast.error('Erro ao carregar atividades', { description: error.message })
      }
      if (data) setActivities(data as CachedActivity[])
      setLoading(false)
    }

    fetchActivities()

    const channel = supabase
      .channel('activities_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'piperun_activities_cache' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setActivities((prev) => [...prev, payload.new as CachedActivity])
          } else if (payload.eventType === 'UPDATE') {
            setActivities((prev) =>
              prev.map((a) =>
                a.piperun_activity_id === (payload.new as CachedActivity).piperun_activity_id
                  ? (payload.new as CachedActivity)
                  : a
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setActivities((prev) =>
              prev.filter(
                (a) =>
                  a.piperun_activity_id !==
                  (payload.old as CachedActivity).piperun_activity_id
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { activities, loading }
}
