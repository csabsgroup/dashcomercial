import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageLayout } from '@/components/layout/PageLayout'
import { Avatar } from '@/components/ui/Avatar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { RankingCardSkeleton } from '@/components/ui/Skeleton'
import { useRealtimeDeals } from '@/hooks/useRealtimeDeals'
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities'
import { useAuth } from '@/context/AuthContext'
import { useDateRange } from '@/context/DateRangeContext'
import { supabase } from '@/services/supabase'
import { calcTotalRevenue, calcTotalEntry, calcConversionRate, filterDealsByDateRange } from '@/utils/metrics'
import { formatCurrencyCompact } from '@/utils/formatters'
import { Crown, ChevronUp, ChevronDown, Volume2, VolumeX, Medal, Flame, DollarSign, ArrowDownToLine, BarChart3, Target, CalendarCheck, CheckCircle } from 'lucide-react'
import { RankingParticles } from '@/components/ranking/RankingParticles'
import { ConfettiCanvas } from '@/components/ranking/ConfettiCanvas'
import { useGoals } from '@/hooks/useGoals'
import type { UserProfile, FieldMappings, CachedActivity } from '@/types/database'
import type { RankingDisplayEntry, RankingSortMetric } from '@/types/dashboard'
import { MOCK_ENABLED, MOCK_USERS, MOCK_FIELD_MAPPINGS, MOCK_PIPERUN_CONFIG } from '@/mocks/mockData'

const podiumColors = ['text-rank-1', 'text-rank-2', 'text-rank-3']
const podiumBorders = ['border-rank-1', 'border-rank-2', 'border-rank-3']

const SORT_ICONS: Record<RankingSortMetric, React.ReactNode> = {
  revenue: <DollarSign size={14} />,
  entry: <ArrowDownToLine size={14} />,
  deals_closed: <BarChart3 size={14} />,
  conversion_rate: <Target size={14} />,
  meetings_scheduled: <CalendarCheck size={14} />,
  leads_qualified: <CheckCircle size={14} />,
  scheduling_rate: <CalendarCheck size={14} />,
}

const sortOptions: { key: RankingSortMetric; label: string; tab: 'closer' | 'sdr' | 'both' }[] = [
  { key: 'revenue', label: 'Receita', tab: 'both' },
  { key: 'entry', label: 'Entrada', tab: 'closer' },
  { key: 'deals_closed', label: 'Deals Fechados', tab: 'closer' },
  { key: 'conversion_rate', label: 'Taxa de Conversão', tab: 'closer' },
  { key: 'meetings_scheduled', label: 'Reuniões Agendadas', tab: 'sdr' },
  { key: 'leads_qualified', label: 'Leads Qualificados', tab: 'sdr' },
]

function calcValueByMetric(
  metric: RankingSortMetric,
  deals: import('@/types/database').CachedDeal[],
  fieldMappings: FieldMappings,
  activities: CachedActivity[]
): number {
  switch (metric) {
    case 'revenue':
      return calcTotalRevenue(deals, fieldMappings)
    case 'entry':
      return calcTotalEntry(deals, fieldMappings)
    case 'deals_closed':
      return deals.filter(d => d.status === 'won').length
    case 'conversion_rate':
      return calcConversionRate(deals)
    case 'meetings_scheduled': {
      const dealIds = new Set(deals.map(d => d.piperun_deal_id))
      return activities.filter(a => a.deal_id && dealIds.has(a.deal_id)).length
    }
    case 'leads_qualified':
      return deals.filter(d => d.status === 'won' || d.status === 'open').length
    default:
      return calcTotalRevenue(deals, fieldMappings)
  }
}

function formatMetricValue(value: number, metric: RankingSortMetric): string {
  switch (metric) {
    case 'revenue':
    case 'entry':
      return formatCurrencyCompact(value)
    case 'conversion_rate':
      return `${value.toFixed(1)}%`
    case 'deals_closed':
    case 'meetings_scheduled':
    case 'leads_qualified':
      return String(Math.round(value))
    default:
      return formatCurrencyCompact(value)
  }
}

export default function Ranking() {
  const [activeTab, setActiveTab] = useState<'closer' | 'sdr'>('closer')
  const [sortMetric, setSortMetric] = useState<RankingSortMetric>('revenue')
  const { deals, loading: dealsLoading } = useRealtimeDeals()
  const { activities } = useRealtimeActivities()
  const { profile: _profile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMappings>({})
  const [closerPipelineId, setCloserPipelineId] = useState<number | null>(null)
  const [sdrPipelineId, setSdrPipelineId] = useState<number | null>(null)

  const { dateRange } = useDateRange()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const { getMonthlyTarget } = useGoals(currentYear)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [overtakeMap, setOvertakeMap] = useState<Record<number, boolean>>({})
  const [showConfetti, setShowConfetti] = useState(false)
  const prevRankingRef = useRef<RankingDisplayEntry[]>([])

  useEffect(() => {
    if (MOCK_ENABLED) {
      setUsers(MOCK_USERS)
      setFieldMappings(MOCK_FIELD_MAPPINGS)
      setCloserPipelineId(MOCK_PIPERUN_CONFIG.closer_pipeline_id!)
      setSdrPipelineId(MOCK_PIPERUN_CONFIG.sdr_pipeline_id!)
      return
    }
    supabase
      .from('user_profiles')
      .select('*')
      .eq('active', true)
      .then(({ data }) => {
        if (data) setUsers(data as UserProfile[])
      })
    supabase
      .from('piperun_config')
      .select('field_mappings, closer_pipeline_id, sdr_pipeline_id')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.field_mappings) setFieldMappings(data.field_mappings)
        if (data?.closer_pipeline_id) setCloserPipelineId(data.closer_pipeline_id)
        if (data?.sdr_pipeline_id) setSdrPipelineId(data.sdr_pipeline_id)
      })
  }, [])

  // Reset sort metric when switching tabs
  useEffect(() => {
    setSortMetric(activeTab === 'sdr' ? 'meetings_scheduled' : 'revenue')
  }, [activeTab])

  // Available sort options for current tab
  const availableSortOptions = useMemo(
    () => sortOptions.filter(o => o.tab === 'both' || o.tab === activeTab),
    [activeTab]
  )

  const ranking: RankingDisplayEntry[] = useMemo(() => {
    // Filter by pipeline
    const pipelineId = activeTab === 'closer' ? closerPipelineId : sdrPipelineId
    const pipelineDeals = pipelineId ? deals.filter(d => d.pipeline_id === pipelineId) : deals
    const filteredDeals = filterDealsByDateRange(pipelineDeals, dateRange.start, dateRange.end)

    // Group by user
    const byUser = new Map<number, typeof filteredDeals>()
    for (const deal of filteredDeals) {
      if (!deal.user_id) continue
      const existing = byUser.get(deal.user_id) || []
      existing.push(deal)
      byUser.set(deal.user_id, existing)
    }

    const entries: RankingDisplayEntry[] = []
    byUser.forEach((userDeals, piperunUserId) => {
      const userProfile = users.find((u) => u.piperun_user_id === piperunUserId)
      const value = calcValueByMetric(sortMetric, userDeals, fieldMappings, activities)
      const goalType = sortMetric === 'entry' ? 'entry' as const : 'revenue' as const
      const userTarget = getMonthlyTarget(currentMonth, goalType, userProfile?.id)

      entries.push({
        position: 0,
        previousPosition: null,
        userId: userProfile?.id || '',
        piperunUserId,
        name: userProfile?.name || `Usuário ${piperunUserId}`,
        avatarUrl: userProfile?.avatar_url || null,
        value,
        target: userTarget,
        percentAchieved: userTarget > 0 ? (value / userTarget) * 100 : 0,
        positionChange: 'same',
      })
    })

    entries.sort((a, b) => b.value - a.value)
    entries.forEach((e, i) => {
      e.position = i + 1
    })

    return entries
  }, [deals, dateRange, users, activeTab, closerPipelineId, sdrPipelineId, sortMetric, fieldMappings, activities, getMonthlyTarget, currentMonth])

  // Detect position changes and overtakes
  useEffect(() => {
    const prev = prevRankingRef.current
    if (prev.length > 0 && ranking.length > 0) {
      const newOvertakes: Record<number, boolean> = {}
      for (const entry of ranking) {
        const prevEntry = prev.find(p => p.piperunUserId === entry.piperunUserId)
        if (prevEntry && prevEntry.position > entry.position) {
          entry.positionChange = 'up'
          newOvertakes[entry.piperunUserId] = true
        } else if (prevEntry && prevEntry.position < entry.position) {
          entry.positionChange = 'down'
        }
      }
      if (Object.keys(newOvertakes).length > 0) {
        setOvertakeMap(newOvertakes)
        setShowConfetti(true)
        // Play sound if enabled
        if (soundEnabled) {
          try {
            const audioCtx = new AudioContext()
            const osc = audioCtx.createOscillator()
            const gain = audioCtx.createGain()
            osc.connect(gain)
            gain.connect(audioCtx.destination)
            osc.frequency.value = 880
            osc.type = 'sine'
            gain.gain.value = 0.1
            osc.start()
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
            osc.stop(audioCtx.currentTime + 0.3)
          } catch { /* audio not supported */ }
        }
        // Clear overtake badges after 3s
        setTimeout(() => setOvertakeMap({}), 3000)
      }
    }
    prevRankingRef.current = ranking.map(r => ({ ...r }))
  }, [ranking, soundEnabled])

  const loading = dealsLoading
  const top3 = ranking.slice(0, 3)

  return (
    <PageLayout title="Ranking">
      <ConfettiCanvas active={showConfetti} onComplete={() => setShowConfetti(false)} />
      {/* Live Indicator + Sound Toggle */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
        </span>
        <span className="text-xs text-text-muted">Atualização em tempo real</span>
        <div className="flex-1" />
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-1.5 rounded-xl hover:bg-surface-3 transition-all duration-200 text-text-muted cursor-pointer"
          title={soundEnabled ? 'Desativar som' : 'Ativar som'}
          aria-label={soundEnabled ? 'Desativar som de celebração' : 'Ativar som de celebração'}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-primary">{SORT_ICONS[sortMetric]}</span>
          <select
            value={sortMetric}
            onChange={(e) => setSortMetric(e.target.value as RankingSortMetric)}
            aria-label="Ordenar ranking por"
            className="bg-surface-2 border border-border rounded-xl px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          >
            {availableSortOptions.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>

        <span className="flex items-center gap-1.5 text-xs text-primary font-semibold">
          <Flame size={14} className="animate-live-pulse" />
          AO VIVO
        </span>

        <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
          {(['closer', 'sdr'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-label={`Aba ${tab === 'closer' ? 'Closers' : 'SDRs'}`}
              aria-selected={activeTab === tab}
              role="tab"
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                ${activeTab === tab
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
                }`}
            >
              {tab === 'closer' ? 'Closers' : 'SDRs'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <RankingCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Podium - Left 60% */}
          <div className="lg:col-span-3">
            <div className="flex items-end justify-center gap-4 sm:gap-8 py-8 relative">
              {/* 2nd Place */}
              {top3[1] && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 60 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
                  className="flex flex-col items-center relative"
                >
                  <RankingParticles active={!loading && !!top3[1]} color="var(--color-rank-2)" />
                  <div className="relative">
                    <Avatar name={top3[1].name} src={top3[1].avatarUrl} size="xl" className={`border-2 ${podiumBorders[1]} mb-2`} />
                    <span className="absolute -top-1 -right-1"><Medal size={22} className="text-rank-2" /></span>
                  </div>
                  <p className="text-base font-bold text-text-primary text-center mt-1">{top3[1].name}</p>
                  <p className={`text-xl font-bold font-display ${podiumColors[1]}`}>
                    {formatMetricValue(top3[1].value, sortMetric)}
                  </p>
                  {top3[1].target > 0 && (
                    <span className="text-[10px] text-text-muted mt-0.5">
                      {Math.round(top3[1].percentAchieved)}% da meta
                    </span>
                  )}
                  <div className={`w-24 sm:w-28 h-36 bg-surface-2 border-2 ${podiumBorders[1]} border-opacity-30 rounded-t-xl mt-3 flex items-center justify-center text-3xl font-bold text-rank-2 font-display`}>
                    2
                  </div>
                </motion.div>
              )}

              {/* 1st Place */}
              {top3[0] && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.3, y: 80 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 18 }}
                  className="flex flex-col items-center relative"
                >
                  <RankingParticles active={!loading && !!top3[0]} />
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Crown size={40} className="text-gold mb-1" />
                  </motion.div>
                  <div className="relative">
                    <motion.div
                      animate={{ boxShadow: ['0 0 20px var(--color-gold-glow)', '0 0 40px var(--color-gold-glow)', '0 0 20px var(--color-gold-glow)'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="rounded-full"
                    >
                      <Avatar name={top3[0].name} src={top3[0].avatarUrl} size="2xl" className={`border-3 ${podiumBorders[0]} glow-gold-pulse mb-2`} />
                    </motion.div>
                    <span className="absolute -top-1 -right-1"><Medal size={28} className="text-rank-1" /></span>
                  </div>
                  <p className="text-lg font-bold text-text-primary text-center mt-1">{top3[0].name}</p>
                  <p className={`text-2xl font-bold font-display ${podiumColors[0]}`}>
                    {formatMetricValue(top3[0].value, sortMetric)}
                  </p>
                  {top3[0].target > 0 && (
                    <span className="text-xs text-text-muted mt-0.5">
                      {Math.round(top3[0].percentAchieved)}% da meta
                    </span>
                  )}
                  <div className="w-28 sm:w-32 h-48 bg-brand-gradient-subtle border-2 border-gold/30 rounded-t-xl mt-3 flex items-center justify-center text-4xl font-bold text-gold font-display glow-gold">
                    1
                  </div>
                </motion.div>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 60 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
                  className="flex flex-col items-center relative"
                >
                  <RankingParticles active={!loading && !!top3[2]} color="var(--color-rank-3)" />
                  <div className="relative">
                    <Avatar name={top3[2].name} src={top3[2].avatarUrl} size="xl" className={`border-2 ${podiumBorders[2]} mb-2`} />
                    <span className="absolute -top-1 -right-1"><Medal size={22} className="text-rank-3" /></span>
                  </div>
                  <p className="text-base font-bold text-text-primary text-center mt-1">{top3[2].name}</p>
                  <p className={`text-xl font-bold font-display ${podiumColors[2]}`}>
                    {formatMetricValue(top3[2].value, sortMetric)}
                  </p>
                  {top3[2].target > 0 && (
                    <span className="text-[10px] text-text-muted mt-0.5">
                      {Math.round(top3[2].percentAchieved)}% da meta
                    </span>
                  )}
                  <div className={`w-24 sm:w-28 h-24 bg-surface-2 border-2 ${podiumBorders[2]} border-opacity-30 rounded-t-xl mt-3 flex items-center justify-center text-3xl font-bold text-rank-3 font-display`}>
                    3
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Full List - Right 40% */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex justify-between text-xs text-text-muted px-2 mb-2">
              <span>Total do time: {formatMetricValue(ranking.reduce((s, r) => s + r.value, 0), sortMetric)}</span>
              <span>Top 3: {formatMetricValue(top3.reduce((s, r) => s + r.value, 0), sortMetric)}</span>
            </div>

            <AnimatePresence>
              {ranking.map((entry, i) => (
                <motion.div
                  key={entry.piperunUserId}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 30 }}
                  className={`flex items-center gap-3 bg-surface rounded-2xl border border-border p-3.5 hover:border-primary/20 transition-all duration-200 relative overflow-hidden group
                    ${entry.position === 1 ? 'glow-gold' : ''}
                    ${overtakeMap[entry.piperunUserId] ? 'ring-2 ring-success/50' : ''}`}
                >
                  {/* Position */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold font-display shrink-0
                    ${entry.position <= 3
                      ? `bg-rank-${entry.position}/20 text-rank-${entry.position}`
                      : 'bg-surface-3 text-text-muted'
                    }`}
                  >
                    {entry.position <= 3 ? (
                      <Medal size={16} />
                    ) : (
                      entry.position
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar name={entry.name} src={entry.avatarUrl} size="sm" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{entry.name}</p>
                    <ProgressBar
                      value={entry.value}
                      max={Math.max(ranking[0]?.value || 1, 1)}
                      color={entry.position <= 3 ? 'gold' : 'primary'}
                      size="sm"
                      className="mt-1"
                    />
                  </div>

                  {/* Value */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-display text-text-primary">
                      {formatMetricValue(entry.value, sortMetric)}
                    </p>
                    {overtakeMap[entry.piperunUserId] ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.3, 1] }}
                        transition={{ duration: 0.4 }}
                        className="text-xs text-success flex items-center gap-0.5 font-semibold"
                      >
                        <ChevronUp size={12} /> <Flame size={12} /> Subiu!
                      </motion.span>
                    ) : entry.positionChange === 'up' ? (
                      <span className="text-xs text-success flex items-center gap-0.5">
                        <ChevronUp size={12} /> Subiu
                      </span>
                    ) : entry.positionChange === 'down' ? (
                      <span className="text-xs text-danger flex items-center gap-0.5">
                        <ChevronDown size={12} /> Caiu
                      </span>
                    ) : null}
                  </div>
                  {overtakeMap[entry.piperunUserId] && (
                    <RankingParticles active burst />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {ranking.length === 0 && (
              <div className="text-center py-12 text-text-muted text-sm">
                Nenhum dado disponível para este período
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
