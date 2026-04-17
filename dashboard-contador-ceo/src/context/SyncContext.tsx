import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/services/supabase'
import type { SyncLogEntry, SyncStatus } from '@/types/database'
import { MOCK_ENABLED, MOCK_SYNC_LOG } from '@/mocks/mockData'

interface SyncContextType {
  status: SyncStatus | 'never'
  lastSyncAt: string | null
  lastEntry: SyncLogEntry | null
}

const SyncContext = createContext<SyncContextType>({
  status: 'never',
  lastSyncAt: null,
  lastEntry: null,
})

export function SyncProvider({ children }: { children: ReactNode }) {
  const [lastEntry, setLastEntry] = useState<SyncLogEntry | null>(null)

  useEffect(() => {
    if (MOCK_ENABLED) {
      setLastEntry(MOCK_SYNC_LOG)
      return
    }

    // Fetch last sync entry
    supabase
      .from('sync_log')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setLastEntry(data as SyncLogEntry)
      })

    // Subscribe to realtime changes
    const channel = supabase
      .channel('sync_log_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sync_log' },
        (payload) => {
          setLastEntry(payload.new as SyncLogEntry)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <SyncContext.Provider
      value={{
        status: lastEntry?.status ?? 'never',
        lastSyncAt: lastEntry?.synced_at ?? null,
        lastEntry,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSyncStatus() {
  return useContext(SyncContext)
}
