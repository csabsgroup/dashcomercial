import { useState, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import type { DashboardConfig } from '@/types/database'
import { MOCK_ENABLED, MOCK_DASHBOARD_CONFIG } from '@/mocks/mockData'

export function useDashboardConfig() {
  const [config, setConfig] = useState<DashboardConfig>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (MOCK_ENABLED) {
      setConfig(MOCK_DASHBOARD_CONFIG)
      setLoading(false)
      return
    }
    supabase.from('piperun_config').select('dashboard_config').limit(1).single().then(({ data }) => {
      if (data) setConfig((data as { dashboard_config: DashboardConfig }).dashboard_config || {})
      setLoading(false)
    })
  }, [])

  const isKpiVisible = (kpiId: string): boolean => {
    if (!config.overview_kpis) return true
    return config.overview_kpis.includes(kpiId)
  }

  const isSdrBlockVisible = (blockId: string): boolean => {
    if (!config.sdr_blocks) return true
    return config.sdr_blocks.includes(blockId)
  }

  const isCloserBlockVisible = (blockId: string): boolean => {
    if (!config.closer_blocks) return true
    return config.closer_blocks.includes(blockId)
  }

  return { config, loading, isKpiVisible, isSdrBlockVisible, isCloserBlockVisible }
}
