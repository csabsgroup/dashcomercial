import { useState, useMemo, useEffect } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { KPICardSkeleton } from '@/components/ui/Skeleton'
import { useRealtimeDeals } from '@/hooks/useRealtimeDeals'
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities'
import { useDateRange } from '@/context/DateRangeContext'
import { useGoals } from '@/hooks/useGoals'
import { useDashboardConfig } from '@/hooks/useDashboardConfig'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/services/supabase'
import {
  calcTotalRevenue,
  calcTotalEntry,
  calcMRR,
  calcPipelineTotal,
  calcPipelineCoverage,
  calcConversionRate,
  calcWinRate,
  calcContactRate,
  calcLeadsWorked,
  calcAverageTicket,
  calcSalesCycle,
  calcAvgActivitiesPerDeal,
  calcForecastGap,
  calcQualificationRate,
  calcShowRate,
  calcFirstContactSLA,
  calcRevenuePerMeeting,
  calcWinRateByOrigin,
  calcSdrToCloserRate,
  filterDealsByDateRange,
} from '@/utils/metrics'
import { formatCurrencyCompact, formatPercent, formatCurrency } from '@/utils/formatters'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { FunnelChart } from '@/components/charts/FunnelChart'
import { LineChart } from '@/components/charts/LineChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { DiagnosticAlert, generateDiagnostics } from '@/components/dashboard/DiagnosticAlert'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  TrendingUp, TrendingDown, DollarSign, PiggyBank, BarChart3,
  Target, Users, Phone, Clock, Repeat, CalendarCheck, AlertTriangle
} from 'lucide-react'
import { format, eachDayOfInterval, differenceInMilliseconds, subMilliseconds } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { UserProfile, StageMappings } from '@/types/database'
import { useProductFilter, NO_PRODUCT_ID } from '@/context/ProductContext'
import type { CachedDeal } from '@/types/database'
import { MOCK_ENABLED, MOCK_USERS, MOCK_FIELD_MAPPINGS, MOCK_STAGE_MAPPINGS, MOCK_ORIGINS, MOCK_PIPERUN_CONFIG } from '@/mocks/mockData'

interface KPICardProps {
  label: string
  value: string
  target?: string
  percent?: number
  icon: React.ReactNode
  trend?: { value: number; label: string }
}

function KPICard({ label, value, target, percent, icon, trend }: KPICardProps) {
  return (
    <div className="group">
      {/* Label + Icon — outside the card */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/15 transition-colors">
          {icon}
        </div>
        <span className="text-sm font-medium text-text-muted">{label}</span>
      </div>
      {/* Card body — only value + metrics */}
      <div className="bg-surface rounded-2xl border border-border p-4 hover:border-primary/20 transition-all duration-200">
        <p className="text-2xl font-bold font-display text-text-primary mb-1">{value}</p>
        {target && (
          <p className="text-xs text-text-muted mb-2">Meta: {target}</p>
        )}
        {percent !== undefined && (
          <ProgressBar value={percent} max={100} size="sm" />
        )}
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${trend.value >= 0 ? 'text-success' : 'text-danger'}`}>
            {trend.value >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{trend.value >= 0 ? '+' : ''}{formatPercent(trend.value)}</span>
            <span className="text-text-faint">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sdr' | 'closer'>('overview')
  const { deals, loading: dealsLoading } = useRealtimeDeals()
  const { activities, loading: activitiesLoading } = useRealtimeActivities()
  const { dateRange } = useDateRange()
  const { isKpiVisible, isSdrBlockVisible, isCloserBlockVisible } = useDashboardConfig()
  const { profile, role } = useAuth()
  const isAdmin = role === 'master' || role === 'admin'

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const { getMonthlyTarget } = useGoals(currentYear)
  const { selectedProductId, activeProducts } = useProductFilter()

  const [fieldMappings, setFieldMappings] = useState<{ revenue_field_id?: string; entry_field_id?: string }>({})
  const [closerPipelineId, setCloserPipelineId] = useState<number | null>(null)
  const [sdrPipelineId, setSdrPipelineId] = useState<number | null>(null)
  const [stageMappings, setStageMappings] = useState<StageMappings>({})
  const [users, setUsers] = useState<UserProfile[]>([])
  const [originNames, setOriginNames] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    if (MOCK_ENABLED) {
      setFieldMappings(MOCK_FIELD_MAPPINGS)
      setCloserPipelineId(MOCK_PIPERUN_CONFIG.closer_pipeline_id!)
      setSdrPipelineId(MOCK_PIPERUN_CONFIG.sdr_pipeline_id!)
      setStageMappings(MOCK_STAGE_MAPPINGS)
      setUsers(MOCK_USERS)
      setOriginNames(MOCK_ORIGINS)
      return
    }
    supabase.from('piperun_config').select('field_mappings, closer_pipeline_id, sdr_pipeline_id, stage_mappings').limit(1).single().then(({ data }) => {
      if (data?.field_mappings) setFieldMappings(data.field_mappings)
      if (data?.closer_pipeline_id) setCloserPipelineId(data.closer_pipeline_id)
      if (data?.sdr_pipeline_id) setSdrPipelineId(data.sdr_pipeline_id)
      if (data?.stage_mappings) setStageMappings(data.stage_mappings)
    })
    supabase.from('user_profiles').select('*').eq('active', true).then(({ data }) => {
      if (data) setUsers(data as UserProfile[])
    })
    supabase.from('piperun_origins_cache').select('piperun_origin_id, name').then(({ data }) => {
      if (data) {
        const map = new Map<number, string>()
        data.forEach((o: { piperun_origin_id: number; name: string }) => map.set(o.piperun_origin_id, o.name))
        setOriginNames(map)
      }
    })
  }, [])

  // Helper: resolve selectedProductId to a product_id for goals
  const goalProductId = selectedProductId === NO_PRODUCT_ID ? null
    : selectedProductId ? selectedProductId
    : undefined // undefined = sum all

  // Filter deals by selected product
  const filterByProduct = (d: CachedDeal[]) => {
    if (!selectedProductId) return d // "Todos"
    if (selectedProductId === NO_PRODUCT_ID) return d.filter(deal => !deal.item_id)
    const product = activeProducts.find(p => p.id === selectedProductId)
    if (!product) return d
    return d.filter(deal => deal.item_id === product.piperun_item_id)
  }

  const monthlyGoal = getMonthlyTarget(currentMonth, 'revenue', undefined, goalProductId)
  const entryGoal = getMonthlyTarget(currentMonth, 'entry', undefined, goalProductId)

  // Filter deals by pipeline for each tab
  const closerDeals = useMemo(
    () => closerPipelineId ? filterByProduct(deals.filter(d => d.pipeline_id === closerPipelineId)) : filterByProduct(deals),
    [deals, closerPipelineId, selectedProductId, activeProducts]
  )
  const sdrDeals = useMemo(
    () => sdrPipelineId ? filterByProduct(deals.filter(d => d.pipeline_id === sdrPipelineId)) : [],
    [deals, sdrPipelineId, selectedProductId, activeProducts]
  )

  // Non-admin users see only their own deals
  const myPiperunUserId = profile?.piperun_user_id ?? null
  const scopedCloserDeals = useMemo(
    () => !isAdmin && myPiperunUserId
      ? closerDeals.filter(d => d.user_id === myPiperunUserId)
      : closerDeals,
    [closerDeals, isAdmin, myPiperunUserId]
  )
  const scopedSdrDeals = useMemo(
    () => !isAdmin && myPiperunUserId
      ? sdrDeals.filter(d => d.user_id === myPiperunUserId)
      : sdrDeals,
    [sdrDeals, isAdmin, myPiperunUserId]
  )
  const scopedDeals = useMemo(
    () => !isAdmin && myPiperunUserId
      ? filterByProduct(deals).filter(d => d.user_id === myPiperunUserId)
      : filterByProduct(deals),
    [deals, isAdmin, myPiperunUserId, selectedProductId, activeProducts]
  )

  const filteredDeals = useMemo(
    () => filterDealsByDateRange(scopedDeals, dateRange.start, dateRange.end),
    [scopedDeals, dateRange]
  )
  const filteredCloserDeals = useMemo(
    () => filterDealsByDateRange(scopedCloserDeals, dateRange.start, dateRange.end),
    [scopedCloserDeals, dateRange]
  )
  const filteredSdrDeals = useMemo(
    () => filterDealsByDateRange(scopedSdrDeals, dateRange.start, dateRange.end),
    [scopedSdrDeals, dateRange]
  )

  const loading = dealsLoading || activitiesLoading

  const stats = useMemo(() => ({
    totalRevenue: calcTotalRevenue(filteredDeals, fieldMappings),
    totalEntry: calcTotalEntry(filteredDeals, fieldMappings),
    mrr: calcMRR(filteredDeals, fieldMappings),
    pipelineTotal: calcPipelineTotal(scopedDeals),
    pipelineCoverage: calcPipelineCoverage(scopedDeals, 0),
    conversionRate: calcConversionRate(filteredDeals),
    winRate: calcWinRate(filteredDeals),
    contactRate: calcContactRate(filteredDeals, activities),
    leadsWorked: calcLeadsWorked(filteredDeals, activities),
    avgTicket: calcAverageTicket(filteredDeals, fieldMappings),
    salesCycle: calcSalesCycle(filteredDeals),
    avgActivities: calcAvgActivitiesPerDeal(filteredDeals, activities),
    totalDeals: filteredDeals.length,
    wonDeals: filteredDeals.filter(d => d.status === 'won').length,
    lostDeals: filteredDeals.filter(d => d.status === 'lost').length,
    openDeals: filteredDeals.filter(d => d.status === 'open').length,
    forecast: calcForecastGap(monthlyGoal || 0, calcTotalRevenue(filteredDeals, fieldMappings)),
  }), [filteredDeals, scopedDeals, activities, fieldMappings, monthlyGoal])

  // Closer-specific stats
  const closerStats = useMemo(() => ({
    totalRevenue: calcTotalRevenue(filteredCloserDeals, fieldMappings),
    totalEntry: calcTotalEntry(filteredCloserDeals, fieldMappings),
    avgTicket: calcAverageTicket(filteredCloserDeals, fieldMappings),
    winRate: calcWinRate(filteredCloserDeals),
    conversionRate: calcConversionRate(filteredCloserDeals),
    salesCycle: calcSalesCycle(filteredCloserDeals),
    pipelineTotal: calcPipelineTotal(scopedCloserDeals),
    pipelineCoverage: calcPipelineCoverage(scopedCloserDeals, 0),
    wonDeals: filteredCloserDeals.filter(d => d.status === 'won').length,
    lostDeals: filteredCloserDeals.filter(d => d.status === 'lost').length,
    openDeals: filteredCloserDeals.filter(d => d.status === 'open').length,
    totalDeals: filteredCloserDeals.length,
    revenuePerMeeting: calcRevenuePerMeeting(filteredCloserDeals, activities, stageMappings.meeting_done_stage_id || 0, fieldMappings),
    sdrToCloserRate: calcSdrToCloserRate(filteredSdrDeals, filteredCloserDeals),
  }), [filteredCloserDeals, scopedCloserDeals, fieldMappings, activities, stageMappings, filteredSdrDeals])

  // SDR-specific stats
  const sdrStats = useMemo(() => ({
    totalDeals: filteredSdrDeals.length,
    leadsWorked: calcLeadsWorked(filteredSdrDeals, activities),
    contactRate: calcContactRate(filteredSdrDeals, activities),
    avgActivities: calcAvgActivitiesPerDeal(filteredSdrDeals, activities),
    wonDeals: filteredSdrDeals.filter(d => d.status === 'won').length,
    qualificationRate: calcQualificationRate(filteredSdrDeals, stageMappings.qualification_stage_id || 0),
    showRate: calcShowRate(activities, stageMappings.meeting_scheduled_stage_id || 0),
    sla: calcFirstContactSLA(filteredSdrDeals, activities),
  }), [filteredSdrDeals, activities, stageMappings])

  // Chart data: daily evolution
  const dailyChartData = useMemo(() => {
    try {
      const days = eachDayOfInterval({ start: dateRange.start, end: new Date() > dateRange.end ? dateRange.end : new Date() })
      return days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const dayDeals = filteredDeals.filter(d => {
          const created = d.piperun_created_at ? format(new Date(d.piperun_created_at), 'yyyy-MM-dd') : null
          return created === dayStr
        })
        const dayWon = dayDeals.filter(d => d.status === 'won')
        return {
          date: format(day, 'dd/MM', { locale: ptBR }),
          leads: dayDeals.length,
          won: dayWon.length,
          revenue: dayWon.reduce((sum, d) => sum + (d.value || 0), 0),
        }
      })
    } catch {
      return []
    }
  }, [filteredDeals, dateRange])

  // SDR funnel data
  const sdrFunnelData = useMemo(() => [
    { name: 'Leads Recebidos', value: sdrStats.totalDeals },
    { name: 'Trabalhados', value: sdrStats.leadsWorked },
    { name: 'Qualificados', value: Math.round(sdrStats.totalDeals * (sdrStats.contactRate / 100) * 0.6) },
    { name: 'Agendados', value: Math.round(sdrStats.totalDeals * 0.2) },
    { name: 'Realizados', value: sdrStats.wonDeals },
  ], [sdrStats])

  // Closer funnel data
  const closerFunnelData = useMemo(() => [
    { name: 'Oportunidades', value: closerStats.totalDeals },
    { name: 'Em negociação', value: closerStats.openDeals },
    { name: 'Ganhos', value: closerStats.wonDeals, fill: '#00c853' },
    { name: 'Perdidos', value: closerStats.lostDeals, fill: '#f44336' },
  ], [closerStats])

  // Lost reasons (from closer deals data)
  const lostReasonsData = useMemo(() => {
    const reasons = new Map<string, number>()
    filteredCloserDeals
      .filter(d => d.status === 'lost')
      .forEach(d => {
        const reason = d.lost_reason_id ? `Motivo #${d.lost_reason_id}` : 'Não informado'
        reasons.set(reason, (reasons.get(reason) || 0) + 1)
      })
    return Array.from(reasons.entries()).map(([name, value]) => ({ name, value }))
  }, [filteredCloserDeals])

  // User-level data for bar charts (closer)
  const userDealsMap = useMemo(() => {
    const byUser = new Map<number, typeof filteredCloserDeals>()
    filteredCloserDeals.forEach(d => {
      if (!d.user_id) return
      const existing = byUser.get(d.user_id) || []
      existing.push(d)
      byUser.set(d.user_id, existing)
    })
    return byUser
  }, [filteredCloserDeals])

  const userBarData = useMemo(() => {
    return Array.from(userDealsMap.entries()).map(([userId, userDeals]) => {
      const wonDeals = userDeals.filter(d => d.status === 'won')
      const revenue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0)
      const userName = users.find(u => u.piperun_user_id === userId)?.name || `Usuário ${userId}`
      return { name: userName, value: revenue, deals: wonDeals.length }
    }).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [userDealsMap, users])

  // Meta vs Realizado per closer (grouped bar chart)
  const metaVsRealizadoData = useMemo(() => {
    return Array.from(userDealsMap.entries()).map(([userId, userDeals]) => {
      const wonDeals = userDeals.filter(d => d.status === 'won')
      const revenue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0)
      const userProfile = users.find(u => u.piperun_user_id === userId)
      const userName = userProfile?.name || `Usuário ${userId}`
      const userGoal = userProfile ? getMonthlyTarget(currentMonth, 'revenue', userProfile.id, goalProductId) : 0
      return { name: userName, realizado: revenue, meta: userGoal || 0 }
    }).sort((a, b) => b.realizado - a.realizado).slice(0, 10)
  }, [userDealsMap, users, currentMonth, getMonthlyTarget, goalProductId])

  // Win rate by origin chart data
  const winRateByOriginData = useMemo(() => {
    const raw = calcWinRateByOrigin(filteredCloserDeals)
    return raw.map(r => ({
      name: originNames.get(r.originId) || `Origem #${r.originId}`,
      value: Math.round(r.winRate * 10) / 10,
      total: r.total,
    })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [filteredCloserDeals, originNames])

  // Diagnostics
  const sdrDiagnostics = useMemo(() => generateDiagnostics({
    qualificationRate: sdrStats.contactRate * 0.6,
    showRate: sdrStats.wonDeals > 0 ? (sdrStats.wonDeals / Math.max(1, sdrStats.leadsWorked)) * 100 : undefined,
  }), [sdrStats])

  const closerDiagnostics = useMemo(() => generateDiagnostics({
    pipelineCoverage: closerStats.pipelineCoverage,
  }), [closerStats])

  // Previous period for trend comparison
  const periodLengthMs = differenceInMilliseconds(dateRange.end, dateRange.start)
  const prevDateRange = useMemo(() => ({
    start: subMilliseconds(dateRange.start, periodLengthMs),
    end: subMilliseconds(dateRange.end, periodLengthMs),
  }), [dateRange, periodLengthMs])

  const prevFilteredDeals = useMemo(
    () => filterDealsByDateRange(scopedDeals, prevDateRange.start, prevDateRange.end),
    [scopedDeals, prevDateRange]
  )

  const prevStats = useMemo(() => ({
    totalRevenue: calcTotalRevenue(prevFilteredDeals, fieldMappings),
    totalEntry: calcTotalEntry(prevFilteredDeals, fieldMappings),
    conversionRate: calcConversionRate(prevFilteredDeals),
    winRate: calcWinRate(prevFilteredDeals),
  }), [prevFilteredDeals, fieldMappings])

  const calcTrend = (current: number, prev: number) => prev > 0 ? ((current - prev) / prev) * 100 : 0

  const tabs = [
    { key: 'overview' as const, label: 'Visão Geral' },
    { key: 'sdr' as const, label: 'SDR' },
    { key: 'closer' as const, label: 'Closer' },
  ]

  return (
    <PageLayout title="Dashboard">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1 mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            aria-label={`Aba ${tab.label}`}
            aria-selected={activeTab === tab.key}
            role="tab"
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
              ${activeTab === tab.key
                ? 'bg-surface text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          title="Nenhum deal encontrado"
          description="Nenhum deal foi sincronizado ainda. Verifique a integração PipeRun em Configurações."
          icon={<BarChart3 size={48} />}
        />
      ) : (
        <>
          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {isKpiVisible('revenue') && (
                  <KPICard
                    label="Faturamento"
                    value={formatCurrencyCompact(stats.totalRevenue)}
                    target={monthlyGoal ? formatCurrencyCompact(monthlyGoal) : undefined}
                    percent={monthlyGoal ? (stats.totalRevenue / monthlyGoal) * 100 : undefined}
                    icon={<DollarSign size={20} />}
                    trend={prevStats.totalRevenue > 0 ? { value: calcTrend(stats.totalRevenue, prevStats.totalRevenue), label: 'vs anterior' } : undefined}
                  />
                )}
                {isKpiVisible('entry') && (
                  <KPICard
                    label="Entrada"
                    value={formatCurrencyCompact(stats.totalEntry)}
                    target={entryGoal ? formatCurrencyCompact(entryGoal) : undefined}
                    percent={entryGoal ? (stats.totalEntry / entryGoal) * 100 : undefined}
                    icon={<PiggyBank size={20} />}
                    trend={prevStats.totalEntry > 0 ? { value: calcTrend(stats.totalEntry, prevStats.totalEntry), label: 'vs anterior' } : undefined}
                  />
                )}
                {isKpiVisible('mrr') && (
                  <KPICard
                    label="MRR Gerado"
                    value={formatCurrencyCompact(stats.mrr)}
                    icon={<BarChart3 size={20} />}
                  />
                )}
                {isKpiVisible('pipeline') && (
                  <KPICard
                    label="Pipeline Total"
                    value={formatCurrencyCompact(stats.pipelineTotal)}
                    percent={Math.min((stats.pipelineCoverage / 3) * 100, 100)}
                    icon={<Target size={20} />}
                  />
                )}
                {isKpiVisible('conversion') && (
                  <KPICard
                    label="Taxa de Conversão"
                    value={formatPercent(stats.conversionRate)}
                    icon={<TrendingUp size={20} />}
                    trend={prevStats.conversionRate > 0 ? { value: calcTrend(stats.conversionRate, prevStats.conversionRate), label: 'vs anterior' } : undefined}
                  />
                )}
                {isKpiVisible('winrate') && (
                  <KPICard
                    label="Win Rate"
                    value={formatPercent(stats.winRate)}
                    icon={<TrendingUp size={20} />}
                    trend={prevStats.winRate > 0 ? { value: calcTrend(stats.winRate, prevStats.winRate), label: 'vs anterior' } : undefined}
                  />
                )}
              </div>

              {/* Forecast Card */}
              <div className="bg-surface rounded-2xl border border-border p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                    <Target size={16} className="text-gold" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">Forecast do Mês</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-text-muted text-xs">Previsto até hoje</p>
                    <p className="font-bold font-display text-text-primary">{formatCurrency(stats.forecast.expectedByNow)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Realizado</p>
                    <p className="font-bold font-display text-text-primary">{formatCurrency(stats.forecast.realized)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Gap</p>
                    <p className={`font-bold font-display flex items-center gap-1 ${stats.forecast.gap >= 0 ? 'text-success' : 'text-danger'}`}>
                      {stats.forecast.gap >= 0 ? <TrendingUp size={14} /> : <AlertTriangle size={14} />}
                      {formatCurrency(Math.abs(stats.forecast.gap))}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Restante</p>
                    <p className="font-bold font-display text-text-primary">{formatCurrency(stats.forecast.remaining)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Dias úteis restantes</p>
                    <p className="font-bold font-display text-text-primary">{stats.forecast.remainingDays}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SDR */}
          {activeTab === 'sdr' && (
            <div className="space-y-6">
              <DiagnosticAlert alerts={sdrDiagnostics} />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {isSdrBlockVisible('leads_received') && (
                  <KPICard
                    label="Leads Recebidos"
                    value={String(sdrStats.totalDeals)}
                    icon={<Users size={20} />}
                  />
                )}
                {isSdrBlockVisible('leads_worked') && (
                  <KPICard
                    label="Leads Trabalhados"
                    value={String(sdrStats.leadsWorked)}
                    icon={<Phone size={20} />}
                  />
                )}
                {isSdrBlockVisible('contact_rate') && (
                  <KPICard
                    label="Taxa de Contato"
                    value={formatPercent(sdrStats.contactRate)}
                    icon={<TrendingUp size={20} />}
                  />
                )}
                {isSdrBlockVisible('cadence') && (
                  <KPICard
                    label="Cadência Média"
                    value={sdrStats.avgActivities.toFixed(1)}
                    icon={<Repeat size={20} />}
                  />
                )}
                {isSdrBlockVisible('qualification_rate') && (
                  <KPICard
                    label="Taxa de Qualificação"
                    value={formatPercent(sdrStats.qualificationRate)}
                    icon={<Target size={20} />}
                  />
                )}
                {isSdrBlockVisible('show_rate') && (
                  <KPICard
                    label="Show Rate"
                    value={formatPercent(sdrStats.showRate)}
                    icon={<CalendarCheck size={20} />}
                  />
                )}
                {isSdrBlockVisible('sla') && (
                  <KPICard
                    label="SLA 1º Contato"
                    value={`${sdrStats.sla.toFixed(1)}h`}
                    icon={<Clock size={20} />}
                  />
                )}
              </div>

              {/* SDR Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isSdrBlockVisible('funnel_chart') && <FunnelChart data={sdrFunnelData} />}
                {isSdrBlockVisible('daily_chart') && (
                  <LineChart
                    data={dailyChartData}
                    series={[
                      { dataKey: 'leads', name: 'Leads', color: '#DF2531' },
                      { dataKey: 'won', name: 'Convertidos', color: '#00c853' },
                    ]}
                    title="Evolução diária"
                  />
                )}
              </div>

              {isSdrBlockVisible('sdr_comparison') && (
                <BarChart
                  data={userBarData.map(u => ({ ...u, name: u.name }))}
                  series={[{ dataKey: 'deals', name: 'Deals', color: '#DF2531' }]}
                  title="Comparativo por SDR"
                  layout="vertical"
                />
              )}
            </div>
          )}

          {/* Closer */}
          {activeTab === 'closer' && (
            <div className="space-y-6">
              <DiagnosticAlert alerts={closerDiagnostics} />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {isCloserBlockVisible('revenue') && (
                  <KPICard
                    label="Receita Gerada"
                    value={formatCurrencyCompact(closerStats.totalRevenue)}
                    icon={<DollarSign size={20} />}
                  />
                )}
                {isCloserBlockVisible('ticket') && (
                  <KPICard
                    label="Ticket Médio"
                    value={formatCurrencyCompact(closerStats.avgTicket)}
                    icon={<PiggyBank size={20} />}
                  />
                )}
                {isCloserBlockVisible('winrate') && (
                  <KPICard
                    label="Win Rate"
                    value={formatPercent(closerStats.winRate)}
                    icon={<TrendingUp size={20} />}
                  />
                )}
                {isCloserBlockVisible('cycle') && (
                  <KPICard
                    label="Ciclo de Vendas"
                    value={`${closerStats.salesCycle.toFixed(0)} dias`}
                    icon={<Clock size={20} />}
                  />
                )}
                {isCloserBlockVisible('conversion') && (
                  <KPICard
                    label="Taxa de Conversão"
                    value={formatPercent(closerStats.conversionRate)}
                    icon={<CalendarCheck size={20} />}
                  />
                )}
                {isCloserBlockVisible('pipeline') && (
                  <KPICard
                    label="Pipeline"
                    value={formatCurrencyCompact(closerStats.pipelineTotal)}
                    icon={<BarChart3 size={20} />}
                  />
                )}
                {isCloserBlockVisible('coverage') && (
                  <KPICard
                    label="Cobertura Pipeline"
                    value={`${closerStats.pipelineCoverage.toFixed(1)}x`}
                    icon={<Target size={20} />}
                  />
                )}
                <KPICard
                  label="Deals Fechados"
                  value={String(closerStats.wonDeals)}
                  icon={<Target size={20} />}
                />
                {isCloserBlockVisible('revenue_per_meeting') && (
                  <KPICard
                    label="Receita por Reunião"
                    value={formatCurrencyCompact(closerStats.revenuePerMeeting)}
                    icon={<CalendarCheck size={20} />}
                  />
                )}
              </div>

              {/* Closer Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isCloserBlockVisible('funnel_chart') && <FunnelChart data={closerFunnelData} />}
                {isCloserBlockVisible('revenue_chart') && (
                  <LineChart
                    data={dailyChartData}
                    series={[
                      { dataKey: 'revenue', name: 'Receita', color: '#00c853' },
                    ]}
                    title="Evolução de receita diária"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isCloserBlockVisible('closer_comparison') && (
                  <BarChart
                    data={metaVsRealizadoData}
                    series={[
                      { dataKey: 'realizado', name: 'Realizado', color: '#00c853' },
                      { dataKey: 'meta', name: 'Meta', color: '#f5c518' },
                    ]}
                    title="Meta vs Realizado por Closer"
                  />
                )}
                {isCloserBlockVisible('lost_reasons') && (
                  <DonutChart
                    data={lostReasonsData}
                    title="Motivos de Perda"
                  />
                )}
              </div>

              {isCloserBlockVisible('winrate_by_origin') && winRateByOriginData.length > 0 && (
                <BarChart
                  data={winRateByOriginData}
                  series={[{ dataKey: 'value', name: 'Win Rate %', color: '#DF2531' }]}
                  title="Win Rate por Origem"
                  layout="vertical"
                />
              )}
            </div>
          )}
        </>
      )}
    </PageLayout>
  )
}
