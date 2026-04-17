import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { RankingParticles } from '@/components/ranking/RankingParticles'
import { AnimatedNumber } from '@/components/ranking/AnimatedNumber'
import { ConfettiCanvas } from '@/components/ranking/ConfettiCanvas'
import { supabase } from '@/services/supabase'
import { calcTotalRevenue, calcTotalEntry, countDealsWon, filterDealsByDateRange } from '@/utils/metrics'
import { getWorkingDaysInMonth, getWorkingDaysElapsed } from '@/utils/dateUtils'
import { formatCurrencyCompact } from '@/utils/formatters'
import { useGoals } from '@/hooks/useGoals'
import { Crown, Medal, Flame, Volume2, VolumeX, TrendingUp, Target, Users, CalendarCheck, UserCheck } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { startOfMonth, endOfMonth } from 'date-fns'
import type { UserProfile, FieldMappings, CachedDeal, CachedActivity, GoalType } from '@/types/database'
import type { RankingDisplayEntry, RankingSortMetric } from '@/types/dashboard'
import { MOCK_ENABLED, MOCK_USERS, MOCK_FIELD_MAPPINGS, MOCK_PIPERUN_CONFIG, MOCK_ALL_DEALS, MOCK_ACTIVITIES } from '@/mocks/mockData'

// ─── Constants ──────────────────────────────────────────
const ROTATION_INTERVAL = 30_000 // 30 seconds
const podiumColors = ['text-rank-1', 'text-rank-2', 'text-rank-3']
const podiumBorders = ['border-rank-1', 'border-rank-2', 'border-rank-3']

type ActiveView = 'closer' | 'sdr'

const MOTIVATIONAL_QUOTES = [
  'Sucesso é a soma de pequenos esforços repetidos dia após dia.',
  'Não pare até ter orgulho de si mesmo.',
  'Resultados extraordinários vêm de pessoas que se recusam a ser comuns.',
  'O ranking é temporário. A disciplina é permanente.',
  'Cada ligação é uma oportunidade. Cada deal é uma vitória.',
  'Campeões treinam, perdedores reclamam.',
  'Hoje é o dia de virar o jogo.',
  'Você não precisa ser o melhor. Precisa ser melhor que ontem.',
  'A meta não é o limite. É apenas o começo.',
  'Consistência vence talento quando talento não é consistente.',
  'Vendas é sobre resolver problemas. Resolva mais, ganhe mais.',
  'O topo do ranking espera por quem não desiste.',
]

// ─── Team banner metric definitions ─────────────────────
interface TeamMetricDef {
  key: string
  label: string
  goalType: GoalType
  icon: React.ReactNode
  format: (v: number) => string
  calcRealized: (deals: CachedDeal[], fieldMappings: FieldMappings, activities: CachedActivity[]) => number
}

const CLOSER_TEAM_METRICS: TeamMetricDef[] = [
  {
    key: 'deals_won',
    label: 'Contratos',
    goalType: 'deals_won',
    icon: <UserCheck size={16} />,
    format: (v) => String(Math.round(v)),
    calcRealized: (deals) => countDealsWon(deals),
  },
  {
    key: 'entry',
    label: 'Entrada',
    goalType: 'entry',
    icon: <TrendingUp size={16} />,
    format: (v) => formatCurrencyCompact(v),
    calcRealized: (deals, fm) => calcTotalEntry(deals, fm),
  },
  {
    key: 'revenue',
    label: 'Faturamento',
    goalType: 'revenue',
    icon: <Target size={16} />,
    format: (v) => formatCurrencyCompact(v),
    calcRealized: (deals, fm) => calcTotalRevenue(deals, fm),
  },
]

const SDR_TEAM_METRICS: TeamMetricDef[] = [
  {
    key: 'meetings',
    label: 'Reuniões',
    goalType: 'meetings',
    icon: <CalendarCheck size={16} />,
    format: (v) => String(Math.round(v)),
    calcRealized: (deals, _fm, activities) => {
      const dealIds = new Set(deals.map(d => d.piperun_deal_id))
      return activities.filter(a => a.deal_id && dealIds.has(a.deal_id)).length
    },
  },
  {
    key: 'leads',
    label: 'Leads Qualificados',
    goalType: 'leads',
    icon: <Users size={16} />,
    format: (v) => String(Math.round(v)),
    calcRealized: (deals) => deals.filter(d => d.status === 'won' || d.status === 'open').length,
  },
]

// ─── Helpers ────────────────────────────────────────────
function calcValueByMetric(
  metric: RankingSortMetric,
  deals: CachedDeal[],
  fieldMappings: FieldMappings,
  activities: CachedActivity[]
): number {
  switch (metric) {
    case 'revenue':
      return calcTotalRevenue(deals, fieldMappings)
    case 'entry':
      return calcTotalEntry(deals, fieldMappings)
    case 'deals_closed':
      return countDealsWon(deals)
    case 'conversion_rate': {
      const total = deals.length
      const won = countDealsWon(deals)
      return total > 0 ? (won / total) * 100 : 0
    }
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

function useRealTimeClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  return time
}

// ─── Main Component ─────────────────────────────────────
export default function RankingTV() {
  const { theme } = useTheme()
  const clock = useRealTimeClock()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const { getMonthlyTarget } = useGoals(currentYear)

  // View rotation state
  const [activeView, setActiveView] = useState<ActiveView>('closer')
  const [rotationProgress, setRotationProgress] = useState(0)

  // Data state
  const [deals, setDeals] = useState<CachedDeal[]>([])
  const [activities, setActivities] = useState<CachedActivity[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMappings>({})
  const [closerPipelineId, setCloserPipelineId] = useState<number | null>(null)
  const [sdrPipelineId, setSdrPipelineId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Effects state
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [overtakeMap, setOvertakeMap] = useState<Record<number, boolean>>({})
  const [showConfetti, setShowConfetti] = useState(false)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const prevRankingRef = useRef<RankingDisplayEntry[]>([])

  // ─── View rotation ────────────────────────────────────
  useEffect(() => {
    const startTime = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) % ROTATION_INTERVAL
      setRotationProgress((elapsed / ROTATION_INTERVAL) * 100)
    }, 100)

    const rotateInterval = setInterval(() => {
      setActiveView(prev => prev === 'closer' ? 'sdr' : 'closer')
    }, ROTATION_INTERVAL)

    return () => {
      clearInterval(progressInterval)
      clearInterval(rotateInterval)
    }
  }, [])

  // ─── Quote rotation ───────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % MOTIVATIONAL_QUOTES.length)
    }, 18000)
    return () => clearInterval(interval)
  }, [])

  // ─── Fetch data ───────────────────────────────────────
  useEffect(() => {
    if (MOCK_ENABLED) {
      setDeals(MOCK_ALL_DEALS)
      setActivities(MOCK_ACTIVITIES)
      setUsers(MOCK_USERS)
      setFieldMappings(MOCK_FIELD_MAPPINGS)
      setCloserPipelineId(MOCK_PIPERUN_CONFIG.closer_pipeline_id!)
      setSdrPipelineId(MOCK_PIPERUN_CONFIG.sdr_pipeline_id!)
      setLoading(false)
      return
    }

    async function fetchAll() {
      const [dealsRes, activitiesRes, usersRes, configRes] = await Promise.all([
        supabase.from('piperun_deals_cache').select('*'),
        supabase.from('piperun_activities_cache').select('*'),
        supabase.from('user_profiles').select('*').eq('active', true),
        supabase.from('piperun_config').select('field_mappings, closer_pipeline_id, sdr_pipeline_id').limit(1).single(),
      ])

      if (dealsRes.data) setDeals(dealsRes.data as CachedDeal[])
      if (activitiesRes.data) setActivities(activitiesRes.data as CachedActivity[])
      if (usersRes.data) setUsers(usersRes.data as UserProfile[])
      if (configRes.data?.field_mappings) setFieldMappings(configRes.data.field_mappings)
      if (configRes.data?.closer_pipeline_id) setCloserPipelineId(configRes.data.closer_pipeline_id)
      if (configRes.data?.sdr_pipeline_id) setSdrPipelineId(configRes.data.sdr_pipeline_id)
      setLoading(false)
    }

    fetchAll()

    const channel = supabase
      .channel('tv_deals_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'piperun_deals_cache' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDeals(prev => [...prev, payload.new as CachedDeal])
        } else if (payload.eventType === 'UPDATE') {
          setDeals(prev => prev.map(d => d.piperun_deal_id === (payload.new as CachedDeal).piperun_deal_id ? payload.new as CachedDeal : d))
        } else if (payload.eventType === 'DELETE') {
          setDeals(prev => prev.filter(d => d.piperun_deal_id !== (payload.old as CachedDeal).piperun_deal_id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ─── Date range ───────────────────────────────────────
  const dateRange = useMemo(() => ({
    start: startOfMonth(now),
    end: endOfMonth(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentMonth, currentYear])

  // ─── Working days calculations ────────────────────────
  const workingDays = useMemo(() => {
    const total = getWorkingDaysInMonth(now)
    const elapsed = getWorkingDaysElapsed(now)
    const remaining = total - elapsed
    return { total, elapsed, remaining }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth])

  // ─── Pipeline-filtered deals ──────────────────────────
  const pipelineId = activeView === 'closer' ? closerPipelineId : sdrPipelineId
  const sortMetric: RankingSortMetric = activeView === 'closer' ? 'revenue' : 'meetings_scheduled'

  const filteredDeals = useMemo(() => {
    const pipeDeals = pipelineId ? deals.filter(d => d.pipeline_id === pipelineId) : deals
    return filterDealsByDateRange(pipeDeals, dateRange.start, dateRange.end)
  }, [deals, pipelineId, dateRange])

  // ─── Ranking ──────────────────────────────────────────
  const ranking: RankingDisplayEntry[] = useMemo(() => {
    const byUser = new Map<number, CachedDeal[]>()
    for (const deal of filteredDeals) {
      if (!deal.user_id) continue
      const existing = byUser.get(deal.user_id) || []
      existing.push(deal)
      byUser.set(deal.user_id, existing)
    }

    const entries: RankingDisplayEntry[] = []
    byUser.forEach((userDeals, piperunUserId) => {
      const userProfile = users.find(u => u.piperun_user_id === piperunUserId)
      const value = calcValueByMetric(sortMetric, userDeals, fieldMappings, activities)

      // Individual goal target
      const goalType: GoalType = activeView === 'closer' ? 'revenue' : 'meetings'
      const target = userProfile
        ? getMonthlyTarget(currentMonth, goalType, userProfile.id)
        : 0
      const percentAchieved = target > 0 ? (value / target) * 100 : 0

      entries.push({
        position: 0,
        previousPosition: null,
        userId: userProfile?.id || '',
        piperunUserId,
        name: userProfile?.name || `Usuário ${piperunUserId}`,
        avatarUrl: userProfile?.avatar_url || null,
        value,
        target,
        percentAchieved,
        positionChange: 'same',
      })
    })

    entries.sort((a, b) => b.value - a.value)
    entries.forEach((e, i) => { e.position = i + 1 })
    return entries
  }, [filteredDeals, users, sortMetric, fieldMappings, activities, activeView, getMonthlyTarget, currentMonth])

  // ─── Extra per-user data for enriched rows ────────────
  const userExtras = useMemo(() => {
    const extras: Record<number, { dealsWon: number; meetings: number; leads: number }> = {}
    const byUser = new Map<number, CachedDeal[]>()
    for (const deal of filteredDeals) {
      if (!deal.user_id) continue
      const existing = byUser.get(deal.user_id) || []
      existing.push(deal)
      byUser.set(deal.user_id, existing)
    }

    byUser.forEach((userDeals, piperunUserId) => {
      const dealIds = new Set(userDeals.map(d => d.piperun_deal_id))
      extras[piperunUserId] = {
        dealsWon: countDealsWon(userDeals),
        meetings: activities.filter(a => a.deal_id && dealIds.has(a.deal_id)).length,
        leads: userDeals.filter(d => d.status === 'won' || d.status === 'open').length,
      }
    })
    return extras
  }, [filteredDeals, activities])

  // ─── Team banner metrics ──────────────────────────────
  const teamMetrics = useMemo(() => {
    const defs = activeView === 'closer' ? CLOSER_TEAM_METRICS : SDR_TEAM_METRICS
    return defs.map(def => {
      const realized = def.calcRealized(filteredDeals, fieldMappings, activities)
      const target = getMonthlyTarget(currentMonth, def.goalType)
      const forecast = workingDays.elapsed > 0
        ? (realized / workingDays.elapsed) * workingDays.total
        : 0
      const remaining = Math.max(0, target - realized)
      const perDay = workingDays.remaining > 0
        ? remaining / workingDays.remaining
        : 0
      return { ...def, realized, target, forecast, remaining, perDay }
    })
  }, [activeView, filteredDeals, fieldMappings, activities, getMonthlyTarget, currentMonth, workingDays])

  // ─── Overtake detection ───────────────────────────────
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
        if (soundEnabled) {
          try {
            const audioCtx = new AudioContext()
            const osc = audioCtx.createOscillator()
            const gain = audioCtx.createGain()
            osc.connect(gain)
            gain.connect(audioCtx.destination)
            osc.frequency.value = 880
            osc.type = 'sine'
            gain.gain.value = 0.15
            osc.start()
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5)
            osc.stop(audioCtx.currentTime + 0.5)
          } catch { /* audio not supported */ }
        }
        setTimeout(() => setOvertakeMap({}), 4000)
      }
    }
    prevRankingRef.current = ranking.map(r => ({ ...r }))
  }, [ranking, soundEnabled])

  // ─── Derived values ───────────────────────────────────
  const top3 = ranking.slice(0, 3)
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' })
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)
  const logoSrc = theme === 'dark' ? '/LOGO CEO BRANCO.png' : '/LOGO CEO PRETO.png'
  const viewLabel = activeView === 'closer' ? 'Closers' : 'SDRs'

  // ─── Loading state ────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <img src="/LOGO CEO PRETO.png" alt="Contador CEO" className="h-16 mx-auto mb-4" />
          <p className="text-text-muted text-lg">Carregando ranking...</p>
        </motion.div>
      </div>
    )
  }

  // ─── Slide transition variants ────────────────────────
  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0 }),
  }
  const slideDirection = activeView === 'closer' ? 1 : -1

  return (
    <div className="fixed inset-0 bg-bg overflow-hidden flex flex-col">
      <ConfettiCanvas active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Geometric grid background */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none" />

      {/* Rotation progress bar */}
      <div className="absolute top-0 left-0 right-0 z-50 h-1 bg-border/30">
        <div
          className="h-full bg-primary transition-[width] duration-100 ease-linear"
          style={{ width: `${rotationProgress}%` }}
        />
      </div>

      {/* Ambient Background Particles */}
      <div className="absolute inset-0 pointer-events-none">
        <RankingParticles active />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between px-8 py-3 bg-surface/60 backdrop-blur-xl border-b border-border mt-1">
        <div className="flex items-center gap-4">
          <img src={logoSrc} alt="Contador CEO" className="h-10" />
          <div className="h-6 w-px bg-border" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-display text-text-primary tracking-tight">
                Ranking de Vendas
              </h1>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wide ${
                activeView === 'closer'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-accent/15 text-accent'
              }`}>
                {viewLabel}
              </span>
            </div>
            <p className="text-sm text-text-muted">
              {capitalizedMonth} {now.getFullYear()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-sm text-primary font-semibold">
            <Flame size={16} className="animate-live-pulse" />
            AO VIVO
          </span>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl hover:bg-surface-3 transition-all duration-200 text-text-muted cursor-pointer"
            aria-label={soundEnabled ? 'Desativar som' : 'Ativar som'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <time className="text-2xl font-bold font-display text-text-primary tabular-nums tracking-tight">
            {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </time>
        </div>
      </header>

      {/* Team Goals Banner */}
      <div className="relative z-10 px-8 py-3 bg-surface/40 backdrop-blur-sm border-b border-border">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView + '-banner'}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className={`grid gap-4 ${teamMetrics.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            {teamMetrics.map(m => {
              const pct = m.target > 0 ? (m.realized / m.target) * 100 : 0
              return (
                <div key={m.key} className="bg-surface rounded-xl border border-border p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-primary">{m.icon}</span>
                      <span className="text-sm font-semibold text-text-primary">{m.label}</span>
                    </div>
                    <span className="text-xs text-text-muted">
                      Meta: <span className="font-semibold text-text-primary">{m.format(m.target)}</span>
                    </span>
                  </div>
                  <ProgressBar value={m.realized} max={m.target || 1} color="auto" size="sm" />
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Realizado</p>
                      <p className="text-sm font-bold text-text-primary">{m.format(m.realized)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Previsto</p>
                      <p className="text-sm font-bold text-text-muted">{m.format(m.forecast)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Falta</p>
                      <p className={`text-sm font-bold ${pct >= 100 ? 'text-success' : 'text-warning'}`}>
                        {pct >= 100 ? '✓' : m.format(m.remaining)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Nec./dia</p>
                      <p className="text-sm font-bold text-text-primary">{m.format(m.perDay)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Main Content — 50/50 Split with slide transition */}
      <main className="relative z-10 flex-1 flex min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={activeView}
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 flex"
          >
            {/* Left — Podium */}
            <div className="w-[45%] flex flex-col items-center justify-center relative px-4">
              {/* Team totals */}
              <div className="flex items-center gap-6 mb-6">
                <div className="text-center">
                  <p className="text-xs text-text-muted uppercase tracking-wide">Total do time</p>
                  <p className="text-2xl font-bold font-display text-primary">
                    <AnimatedNumber value={ranking.reduce((s, r) => s + r.value, 0)} format={(n) => formatMetricValue(n, sortMetric)} />
                  </p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-xs text-text-muted uppercase tracking-wide">Top 3</p>
                  <p className="text-2xl font-bold font-display text-gold">
                    <AnimatedNumber value={top3.reduce((s, r) => s + r.value, 0)} format={(n) => formatMetricValue(n, sortMetric)} />
                  </p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-xs text-text-muted uppercase tracking-wide">Participantes</p>
                  <p className="text-2xl font-bold font-display text-text-primary">{ranking.length}</p>
                </div>
              </div>

              {/* Podium with shields */}
              <div className="flex items-end justify-center gap-4 lg:gap-6">
                {/* 2nd Place */}
                {top3[1] && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.3, y: 100 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 150, damping: 18 }}
                    className="flex flex-col items-center relative"
                  >
                    <RankingParticles active color="var(--color-rank-2)" />
                    <div className="shield-2nd px-6 pt-6 pb-4 flex flex-col items-center">
                      <div className="relative mb-2">
                        <Avatar name={top3[1].name} src={top3[1].avatarUrl} size="xl" className={`border-3 ${podiumBorders[1]}`} />
                        <span className="absolute -top-1 -right-1"><Medal size={24} className="text-rank-2" /></span>
                      </div>
                      <p className="text-base font-bold text-text-primary text-center mt-1">{top3[1].name.split(' ')[0]}</p>
                      <p className={`text-lg font-bold font-display ${podiumColors[1]}`}>
                        <AnimatedNumber value={top3[1].value} format={(n) => formatMetricValue(n, sortMetric)} />
                      </p>
                    </div>
                    <div className={`w-28 lg:w-32 h-36 bg-surface-2/80 border-2 ${podiumBorders[1]}/40 rounded-t-2xl mt-2 flex items-center justify-center backdrop-blur-sm`}>
                      <span className="text-5xl font-bold text-rank-2/80 font-display">2</span>
                    </div>
                  </motion.div>
                )}

                {/* 1st Place */}
                {top3[0] && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.2, y: 120 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 150, damping: 16 }}
                    className="flex flex-col items-center relative"
                  >
                    <RankingParticles active />
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Crown size={44} className="text-gold mb-1" />
                    </motion.div>
                    <div className="shield-1st px-8 pt-6 pb-4 flex flex-col items-center glow-gold-pulse">
                      <div className="relative mb-2">
                        <motion.div
                          animate={{ boxShadow: ['0 0 20px var(--color-gold-glow)', '0 0 50px var(--color-gold-glow)', '0 0 20px var(--color-gold-glow)'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          className="rounded-full"
                        >
                          <Avatar name={top3[0].name} src={top3[0].avatarUrl} size="2xl" className={`border-4 ${podiumBorders[0]}`} />
                        </motion.div>
                        <span className="absolute -top-1 -right-1"><Medal size={32} className="text-rank-1" /></span>
                      </div>
                      <p className="text-lg font-bold text-text-primary text-center mt-1">{top3[0].name.split(' ')[0]}</p>
                      <p className={`text-2xl font-bold font-display ${podiumColors[0]}`}>
                        <AnimatedNumber value={top3[0].value} format={(n) => formatMetricValue(n, sortMetric)} />
                      </p>
                    </div>
                    {/* Neon ring base */}
                    <div className="w-36 lg:w-40 h-48 bg-brand-gradient-subtle border-2 border-gold/30 rounded-t-2xl mt-2 flex items-center justify-center relative">
                      <span className="text-6xl font-bold text-gold/80 font-display">1</span>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[120%] h-6 rounded-full neon-ring-gold opacity-60" />
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place */}
                {top3[2] && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.3, y: 100 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.6, type: 'spring', stiffness: 150, damping: 18 }}
                    className="flex flex-col items-center relative"
                  >
                    <RankingParticles active color="var(--color-rank-3)" />
                    <div className="shield-3rd px-6 pt-6 pb-4 flex flex-col items-center">
                      <div className="relative mb-2">
                        <Avatar name={top3[2].name} src={top3[2].avatarUrl} size="xl" className={`border-3 ${podiumBorders[2]}`} />
                        <span className="absolute -top-1 -right-1"><Medal size={24} className="text-rank-3" /></span>
                      </div>
                      <p className="text-base font-bold text-text-primary text-center mt-1">{top3[2].name.split(' ')[0]}</p>
                      <p className={`text-lg font-bold font-display ${podiumColors[2]}`}>
                        <AnimatedNumber value={top3[2].value} format={(n) => formatMetricValue(n, sortMetric)} />
                      </p>
                    </div>
                    <div className={`w-28 lg:w-32 h-24 bg-surface-2/80 border-2 ${podiumBorders[2]}/40 rounded-t-2xl mt-2 flex items-center justify-center backdrop-blur-sm`}>
                      <span className="text-5xl font-bold text-rank-3/80 font-display">3</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Right — 2-Column Grid */}
            <div className="w-[55%] flex flex-col py-3 px-4 min-h-0">
              <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                <div className="flex flex-col gap-2">
                  <AnimatePresence>
                    {ranking.map((entry, i) => {
                      const extras = userExtras[entry.piperunUserId]
                      const metaValue = entry.target
                      const totalValue = entry.value
                      const pct = entry.percentAchieved
                      const diff = metaValue > 0 ? metaValue - totalValue : 0
                      const passed = pct >= 100
                      const diffDisplay = passed
                        ? Math.round(totalValue - metaValue)
                        : Math.round(diff)

                      return (
                        <motion.div
                          key={entry.piperunUserId}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 + i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
                          className={`bg-surface rounded-xl border border-border p-3 flex items-center gap-3 relative overflow-hidden transition-all duration-200
                            ${entry.position === 1 ? 'glow-gold border-gold/30' : ''}
                            ${overtakeMap[entry.piperunUserId] ? 'ring-2 ring-success/50' : ''}`}
                        >
                          {/* Large Position Number */}
                          <div className={`text-3xl font-bold font-display shrink-0 w-8 text-center
                            ${entry.position <= 3 ? podiumColors[entry.position - 1] : 'text-text-muted/50'}`}
                          >
                            {entry.position}
                          </div>

                          {/* Avatar */}
                          <Avatar name={entry.name} src={entry.avatarUrl} size="md" />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-text-primary truncate">{entry.name.split(' ')[0]}</p>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                              {activeView === 'closer' ? (
                                <>
                                  <span>Meta: <span className="text-text-primary font-semibold">{formatMetricValue(metaValue, sortMetric)}</span></span>
                                  <span>Total: <span className="text-text-primary font-semibold">{formatMetricValue(totalValue, sortMetric)}</span></span>
                                </>
                              ) : (
                                <>
                                  <span>Meta: <span className="text-text-primary font-semibold">{Math.round(metaValue)}</span></span>
                                  <span>Total: <span className="text-text-primary font-semibold">{Math.round(totalValue)}</span></span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <ProgressBar
                                value={totalValue}
                                max={metaValue || 1}
                                color="auto"
                                size="sm"
                                className="flex-1"
                              />
                              <span className="text-[10px] font-bold text-text-muted whitespace-nowrap">
                                {Math.min(pct, 999).toFixed(1)}%
                              </span>
                            </div>
                            {metaValue > 0 && (
                              <p className={`text-[10px] font-semibold mt-0.5 ${passed ? 'text-success' : 'text-warning'}`}>
                                {passed
                                  ? `Passou: ${activeView === 'closer' ? formatMetricValue(diffDisplay, sortMetric) : diffDisplay}`
                                  : `Faltam: ${activeView === 'closer' ? formatMetricValue(diffDisplay, sortMetric) : diffDisplay}`
                                }
                              </p>
                            )}
                          </div>

                          {/* Extra badge for closer: deals won */}
                          {activeView === 'closer' && extras && extras.dealsWon > 0 && (
                            <div className="absolute top-1.5 right-1.5 bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                              {extras.dealsWon} {extras.dealsWon === 1 ? 'contrato' : 'contratos'}
                            </div>
                          )}

                          {/* SDR: meetings + leads badges */}
                          {activeView === 'sdr' && extras && (
                            <div className="absolute top-1.5 right-1.5 flex gap-1">
                              <span className="bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-md">{extras.meetings} reun.</span>
                              <span className="bg-accent/15 text-accent text-[9px] font-bold px-1.5 py-0.5 rounded-md">{extras.leads} leads</span>
                            </div>
                          )}

                          {overtakeMap[entry.piperunUserId] && (
                            <>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: [0, 1.5, 1] }}
                                className="absolute top-1.5 left-1.5"
                              >
                                <Flame size={14} className="text-success" />
                              </motion.div>
                              <RankingParticles active burst />
                            </>
                          )}
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom — Timer + Motivational Quote */}
      <footer className="relative z-10 px-8 py-2 bg-surface/60 backdrop-blur-xl border-t border-border flex items-center justify-between">
        <AnimatePresence mode="wait">
          <motion.p
            key={quoteIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6 }}
            className="text-sm text-text-muted italic font-medium flex-1"
          >
            &ldquo;{MOTIVATIONAL_QUOTES[quoteIndex]}&rdquo;
          </motion.p>
        </AnimatePresence>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <span className="text-xs text-text-muted">{Math.round((ROTATION_INTERVAL / 1000) * (1 - rotationProgress / 100))}s</span>
          <div className="w-24 h-1.5 bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/60 rounded-full transition-[width] duration-100 ease-linear"
              style={{ width: `${rotationProgress}%` }}
            />
          </div>
          <span className="text-[10px] text-text-muted uppercase tracking-wide">
            Próximo: {activeView === 'closer' ? 'SDRs' : 'Closers'}
          </span>
        </div>
      </footer>
    </div>
  )
}
