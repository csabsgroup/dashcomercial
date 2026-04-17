import { PageLayout } from '@/components/layout/PageLayout'
import { useMemo, useEffect, useState } from 'react'
import { calcForecastGap, calcTotalRevenue, filterDealsByDateRange } from '@/utils/metrics'
import { formatCurrency, formatCurrencyCompact, formatPercent } from '@/utils/formatters'
import { Target, TrendingUp, TrendingDown, Calendar, AlertTriangle } from 'lucide-react'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { GoalProgressChart } from '@/components/charts/GoalProgressChart'
import { LineChart } from '@/components/charts/LineChart'
import { KPICardSkeleton } from '@/components/ui/Skeleton'
import { useRealtimeDeals } from '@/hooks/useRealtimeDeals'
import { useDateRange } from '@/context/DateRangeContext'
import { useProductFilter, NO_PRODUCT_ID } from '@/context/ProductContext'
import { supabase } from '@/services/supabase'
import type { Goal, UserProfile, CachedDeal } from '@/types/database'
import { startOfMonth, endOfMonth } from 'date-fns'
import { MOCK_ENABLED, MOCK_GOALS, MOCK_USERS, MOCK_FIELD_MAPPINGS } from '@/mocks/mockData'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function Goals() {
  const { deals, loading: dealsLoading } = useRealtimeDeals()
  const { dateRange } = useDateRange()
  const { selectedProductId, activeProducts } = useProductFilter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [goalsLoading, setGoalsLoading] = useState(true)

  useEffect(() => {
    if (MOCK_ENABLED) {
      setGoals(MOCK_GOALS)
      setUsers(MOCK_USERS)
      setGoalsLoading(false)
      return
    }
    Promise.all([
      supabase.from('goals').select('*'),
      supabase.from('user_profiles').select('*').eq('active', true),
    ]).then(([goalsRes, usersRes]) => {
      if (goalsRes.data) setGoals(goalsRes.data as Goal[])
      if (usersRes.data) setUsers(usersRes.data as UserProfile[])
      setGoalsLoading(false)
    })
  }, [])

  const [fieldMappings, setFieldMappings] = useState<{ revenue_field_id?: string; entry_field_id?: string }>({})

  useEffect(() => {
    if (MOCK_ENABLED) {
      setFieldMappings(MOCK_FIELD_MAPPINGS)
      return
    }
    supabase.from('piperun_config').select('field_mappings').limit(1).single().then(({ data }) => {
      if (data?.field_mappings) setFieldMappings(data.field_mappings)
    })
  }, [])

  // Filter deals by selected product
  const filterByProduct = (d: CachedDeal[]) => {
    if (!selectedProductId) return d
    if (selectedProductId === NO_PRODUCT_ID) return d.filter(deal => !deal.item_id)
    const product = activeProducts.find(p => p.id === selectedProductId)
    if (!product) return d
    return d.filter(deal => deal.item_id === product.piperun_item_id)
  }

  // Resolve product_id for goal queries
  const goalProductId = selectedProductId === NO_PRODUCT_ID ? null
    : selectedProductId ? selectedProductId
    : undefined

  const productDeals = useMemo(() => filterByProduct(deals), [deals, selectedProductId, activeProducts])

  const filteredDeals = useMemo(
    () => filterDealsByDateRange(productDeals, dateRange.start, dateRange.end),
    [productDeals, dateRange]
  )
  const realized = useMemo(() => calcTotalRevenue(filteredDeals, fieldMappings), [filteredDeals, fieldMappings])

  // Get current month goal
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const monthlyGoal = useMemo(() => {
    const matchingGoals = goals.filter(
      g => g.period_type === 'monthly' && g.period_value === currentMonth && g.year === currentYear && g.goal_type === 'revenue' && !g.user_id
    )
    if (goalProductId === undefined) {
      // Sum all products
      const sum = matchingGoals.reduce((s, g) => s + g.target_value, 0)
      return sum || 175_000
    }
    if (goalProductId === null) {
      return matchingGoals.find(g => !g.product_id)?.target_value || 175_000
    }
    return matchingGoals.find(g => g.product_id === goalProductId)?.target_value || 175_000
  }, [goals, currentMonth, currentYear, goalProductId])

  const annualGoal = useMemo(() => {
    const matchingGoals = goals.filter(
      g => g.period_type === 'annual' && g.year === currentYear && g.goal_type === 'revenue' && !g.user_id
    )
    if (goalProductId === undefined) {
      const sum = matchingGoals.reduce((s, g) => s + g.target_value, 0)
      return sum || monthlyGoal * 12
    }
    if (goalProductId === null) {
      return matchingGoals.find(g => !g.product_id)?.target_value || monthlyGoal * 12
    }
    return matchingGoals.find(g => g.product_id === goalProductId)?.target_value || monthlyGoal * 12
  }, [goals, currentYear, monthlyGoal, goalProductId])

  const forecast = useMemo(() => calcForecastGap(monthlyGoal, realized), [monthlyGoal, realized])
  const percent = monthlyGoal > 0 ? (realized / monthlyGoal) * 100 : 0

  // Monthly chart data: realized vs target for each month this year
  const monthlyChartData = useMemo(() => {
    return MONTHS.map((name, i) => {
      const month = i + 1
      const monthGoals = goals.filter(
        g => g.period_type === 'monthly' && g.period_value === month && g.year === currentYear && g.goal_type === 'revenue' && !g.user_id
      )
      let target: number
      if (goalProductId === undefined) {
        target = monthGoals.reduce((s, g) => s + g.target_value, 0) || annualGoal / 12
      } else if (goalProductId === null) {
        target = monthGoals.find(g => !g.product_id)?.target_value || annualGoal / 12
      } else {
        target = monthGoals.find(g => g.product_id === goalProductId)?.target_value || annualGoal / 12
      }

      const start = startOfMonth(new Date(currentYear, i))
      const end = endOfMonth(new Date(currentYear, i))
      const monthDeals = filterDealsByDateRange(productDeals, start, end)
      const monthRealized = calcTotalRevenue(monthDeals, fieldMappings)

      return { name, realized: month <= currentMonth ? monthRealized : 0, target }
    })
  }, [goals, productDeals, annualGoal, currentYear, currentMonth, fieldMappings, goalProductId])

  // Cumulative line chart data
  const cumulativeData = useMemo(() => {
    let cumRealized = 0
    let cumTarget = 0
    return monthlyChartData.map(m => {
      cumRealized += m.realized
      cumTarget += m.target
      return { date: m.name, realized: cumRealized, target: cumTarget }
    })
  }, [monthlyChartData])

  // Per-closer breakdown
  const closerBreakdown = useMemo(() => {
    const closers = users.filter(u => u.role === 'closer')
    const fallbackTarget = closers.length > 0 ? monthlyGoal / closers.length : 0
    return closers.map(user => {
      const userGoal = goals.find(
        g => g.period_type === 'monthly' && g.period_value === currentMonth && g.year === currentYear && g.goal_type === 'revenue' && g.user_id === user.id
        && (goalProductId === undefined || (goalProductId === null ? !g.product_id : g.product_id === goalProductId))
      )
      const target = userGoal?.target_value || fallbackTarget
      const isEstimated = !userGoal?.target_value
      const userDeals = filteredDeals.filter(d => d.user_id === user.piperun_user_id)
      const userRealized = calcTotalRevenue(userDeals, fieldMappings)
      const pct = target > 0 ? (userRealized / target) * 100 : 0
      return { name: user.name, realized: userRealized, target, percent: pct, isEstimated }
    })
  }, [users, goals, filteredDeals, fieldMappings, currentMonth, currentYear, monthlyGoal])

  const loading = dealsLoading || goalsLoading

  return (
    <PageLayout title="Metas">
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      ) : (
      <div className="space-y-6">
        {/* Forecast Card */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
              <Target size={18} className="text-gold" />
            </div>
            <h2 className="text-lg font-semibold font-display text-text-primary">
              Forecast do Mês
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-text-muted mb-1">Previsto até hoje</p>
              <p className="text-lg font-bold font-display text-text-primary">
                {formatCurrency(forecast.expectedByNow)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Realizado até hoje</p>
              <p className="text-lg font-bold font-display text-text-primary">
                {formatCurrency(forecast.realized)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Gap</p>
              <p className={`text-lg font-bold font-display flex items-center gap-1
                ${forecast.gap >= 0 ? 'text-success' : 'text-danger'}`}>
                {forecast.gap >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {formatCurrency(Math.abs(forecast.gap))}
                {forecast.gap < 0 && (
                  <AlertTriangle size={14} className="text-warning ml-1" />
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Necessário restante</p>
              <p className="text-lg font-bold font-display text-text-primary">
                {formatCurrency(forecast.remaining)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
            <Calendar size={14} />
            <span>{forecast.remainingDays} dias úteis restantes</span>
            <span className="text-text-faint">|</span>
            <span>Necessário: {formatCurrencyCompact(forecast.dailyNeeded)}/dia</span>
          </div>
        </div>

        {/* Monthly Goal Progress */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="text-lg font-semibold font-display text-text-primary mb-4">
            Meta Mensal — Faturamento
          </h2>
          <div className="flex items-end gap-4 mb-3">
            <p className="text-3xl font-bold font-display text-text-primary">
              {formatCurrencyCompact(realized)}
            </p>
            <p className="text-sm text-text-muted mb-1">
              de {formatCurrencyCompact(monthlyGoal)}
            </p>
            <p className={`text-sm font-medium mb-1 ${percent >= 90 ? 'text-success' : percent >= 60 ? 'text-warning' : 'text-danger'}`}>
              {formatPercent(percent)}
            </p>
          </div>
          <ProgressBar value={percent} max={100} size="lg" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GoalProgressChart
            data={monthlyChartData}
            title="Meta vs Realizado — Mensal"
          />
          <LineChart
            data={cumulativeData}
            series={[
              { dataKey: 'realized', name: 'Realizado Acumulado', color: '#00c853' },
              { dataKey: 'target', name: 'Meta Acumulada', color: '#f5c518', dashed: true },
            ]}
            title="Evolução Acumulada no Ano"
          />
        </div>

        {/* Per-closer breakdown */}
        {closerBreakdown.length > 0 && (
          <div className="bg-surface rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold font-display text-text-primary mb-4">
              Breakdown por Closer
            </h2>
            <div className="space-y-4">
              {closerBreakdown.map((closer) => (
                <div key={closer.name} className="flex items-center gap-4">
                  <span className="text-sm text-text-primary w-32 truncate">{closer.name}</span>
                  <div className="flex-1">
                    <ProgressBar value={closer.percent} max={100} size="sm" />
                  </div>
                  <span className="text-sm font-medium text-text-primary w-24 text-right">
                    {formatCurrencyCompact(closer.realized)}
                  </span>
                  <span className="text-xs text-text-muted w-20 text-right">
                    / {formatCurrencyCompact(closer.target)}
                    {closer.isEstimated && <span className="text-text-faint ml-0.5" title="Meta distribu\u00edda automaticamente">(est.)</span>}
                  </span>
                  <span className={`text-xs font-medium w-12 text-right ${closer.percent >= 90 ? 'text-success' : closer.percent >= 60 ? 'text-warning' : 'text-danger'}`}>
                    {formatPercent(closer.percent)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {goals.length === 0 && (
          <div className="text-center text-sm text-text-muted py-8">
            Configure as metas em Configurações → Metas para ver dados completos
          </div>
        )}
      </div>
      )}
    </PageLayout>
  )
}
