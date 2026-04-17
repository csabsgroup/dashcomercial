import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import type { Goal, GoalType } from '@/types/database'
import { MOCK_ENABLED, MOCK_GOALS } from '@/mocks/mockData'

export function useGoals(year: number) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (MOCK_ENABLED) {
      setGoals(MOCK_GOALS.filter(g => g.year === year))
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase.from('goals').select('*').eq('year', year)
    if (data) setGoals(data as Goal[])
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  /**
   * Get monthly target.
   * productId: undefined = sum all products (global), null = only goals without product, string = specific product
   */
  const getMonthlyTarget = useCallback((month: number, type: GoalType = 'revenue', userId?: string, productId?: string | null) => {
    const filtered = goals.filter(g =>
      g.period_type === 'monthly' &&
      g.period_value === month &&
      g.goal_type === type &&
      (userId ? g.user_id === userId : !g.user_id)
    )

    // If productId is undefined, sum all (global behavior)
    if (productId === undefined) {
      return filtered.reduce((sum, g) => sum + g.target_value, 0)
    }

    // If productId is null, filter for goals without product
    if (productId === null) {
      return filtered.find(g => !g.product_id)?.target_value || 0
    }

    // Specific product
    return filtered.find(g => g.product_id === productId)?.target_value || 0
  }, [goals])

  /**
   * Get annual target.
   * productId: undefined = sum all products (global), null = only goals without product, string = specific product
   */
  const getAnnualTarget = useCallback((type: GoalType = 'revenue', productId?: string | null) => {
    const filtered = goals.filter(g => g.period_type === 'annual' && g.goal_type === type && !g.user_id)

    if (productId === undefined) {
      return filtered.reduce((sum, g) => sum + g.target_value, 0)
    }

    if (productId === null) {
      return filtered.find(g => !g.product_id)?.target_value || 0
    }

    return filtered.find(g => g.product_id === productId)?.target_value || 0
  }, [goals])

  return { goals, loading, reload: load, getMonthlyTarget, getAnnualTarget }
}
