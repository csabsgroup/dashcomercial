import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/utils/formatters'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Target, Save, RotateCcw, AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react'
import type { Goal, UserProfile, ActiveProduct } from '@/types/database'
import { MOCK_ENABLED, MOCK_GOALS, MOCK_USERS, MOCK_PRODUCTS } from '@/mocks/mockData'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// State per-product (or "Sem Produto")
interface ProductGoalState {
  annualRevenue: number
  annualEntry: number
  monthlyRevenue: number[]
  monthlyEntry: number[]
  closerGoals: Record<string, number> // userId → monthly revenue
  sdrMeetings: number
  sdrLeads: number
}

function emptyProductGoals(): ProductGoalState {
  return {
    annualRevenue: 0,
    annualEntry: 0,
    monthlyRevenue: Array(12).fill(0),
    monthlyEntry: Array(12).fill(0),
    closerGoals: {},
    sdrMeetings: 0,
    sdrLeads: 0,
  }
}

const NO_PRODUCT_KEY = '__no_product__'

export default function GoalsConfig() {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [, setGoals] = useState<Goal[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [activeProducts, setActiveProducts] = useState<ActiveProduct[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Map: productId (uuid or NO_PRODUCT_KEY) → goals state
  const [productGoals, setProductGoals] = useState<Record<string, ProductGoalState>>({})
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({})

  // Load data
  useEffect(() => {
    const loadData = MOCK_ENABLED
      ? Promise.resolve([
          { data: MOCK_GOALS.filter(g => g.year === year) },
          { data: MOCK_USERS },
          { data: MOCK_PRODUCTS },
        ] as const)
      : Promise.all([
          supabase.from('goals').select('*').eq('year', year),
          supabase.from('user_profiles').select('*').eq('active', true),
          supabase.from('active_products').select('*').eq('is_active', true).order('name'),
        ])

    loadData.then(([goalsRes, usersRes, productsRes]) => {
      const g = ((goalsRes as { data: Goal[] | null }).data || []) as Goal[]
      const u = ((usersRes as { data: UserProfile[] | null }).data || []) as UserProfile[]
      const p = ((productsRes as { data: ActiveProduct[] | null }).data || []) as ActiveProduct[]
      setGoals(g)
      setUsers(u)
      setActiveProducts(p)

      // Build state from existing goals
      const state: Record<string, ProductGoalState> = {}

      // Initialize for each active product + "Sem Produto"
      const productKeys = [...p.map(prod => prod.id), NO_PRODUCT_KEY]
      productKeys.forEach(key => { state[key] = emptyProductGoals() })

      g.forEach(goal => {
        const key = goal.product_id || NO_PRODUCT_KEY
        if (!state[key]) state[key] = emptyProductGoals()

        const s = state[key]
        if (goal.period_type === 'annual' && !goal.user_id) {
          if (goal.goal_type === 'revenue') s.annualRevenue = goal.target_value
          if (goal.goal_type === 'entry') s.annualEntry = goal.target_value
        }
        if (goal.period_type === 'monthly' && !goal.user_id && goal.period_value && goal.period_value >= 1 && goal.period_value <= 12) {
          if (goal.goal_type === 'revenue') s.monthlyRevenue[goal.period_value - 1] = goal.target_value
          if (goal.goal_type === 'entry') s.monthlyEntry[goal.period_value - 1] = goal.target_value
        }
        if (goal.period_type === 'monthly' && goal.goal_type === 'revenue' && goal.user_id) {
          s.closerGoals[goal.user_id] = goal.target_value
        }
        if (goal.period_type === 'monthly' && goal.goal_type === 'meetings' && !goal.user_id) {
          s.sdrMeetings = goal.target_value
        }
        if (goal.period_type === 'monthly' && goal.goal_type === 'leads' && !goal.user_id) {
          s.sdrLeads = goal.target_value
        }
      })

      setProductGoals(state)
    })
  }, [year])

  const closers = useMemo(() => users.filter(u => u.role === 'closer'), [users])

  // All product keys in display order
  const productKeys = useMemo(() => {
    return [...activeProducts.map(p => p.id), NO_PRODUCT_KEY]
  }, [activeProducts])

  const getProductName = (key: string) => {
    if (key === NO_PRODUCT_KEY) return 'Sem Produto'
    return activeProducts.find(p => p.id === key)?.name || 'Produto'
  }

  const updateProductGoal = useCallback((productKey: string, updater: (prev: ProductGoalState) => ProductGoalState) => {
    setProductGoals(prev => ({
      ...prev,
      [productKey]: updater(prev[productKey] || emptyProductGoals()),
    }))
  }, [])

  const toggleExpanded = (key: string) => {
    setExpandedProducts(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Computed totals across all products
  const globalTotals = useMemo(() => {
    let annualRevenue = 0
    let annualEntry = 0
    const monthlyRevenue = Array(12).fill(0)
    const monthlyEntry = Array(12).fill(0)
    let sdrMeetings = 0
    let sdrLeads = 0

    Object.values(productGoals).forEach(pg => {
      annualRevenue += pg.annualRevenue
      annualEntry += pg.annualEntry
      pg.monthlyRevenue.forEach((v, i) => { monthlyRevenue[i] += v })
      pg.monthlyEntry.forEach((v, i) => { monthlyEntry[i] += v })
      sdrMeetings += pg.sdrMeetings
      sdrLeads += pg.sdrLeads
    })

    return { annualRevenue, annualEntry, monthlyRevenue, monthlyEntry, sdrMeetings, sdrLeads }
  }, [productGoals])

  const distributeEvenly = useCallback((productKey: string, type: 'revenue' | 'entry') => {
    updateProductGoal(productKey, prev => {
      const annual = type === 'revenue' ? prev.annualRevenue : prev.annualEntry
      const perMonth = Math.round(annual / 12)
      const arr = Array(12).fill(perMonth)
      arr[11] = annual - perMonth * 11
      return { ...prev, [type === 'revenue' ? 'monthlyRevenue' : 'monthlyEntry']: arr }
    })
  }, [updateProductGoal])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      // Delete existing goals for this year, then re-insert
      await supabase.from('goals').delete().eq('year', year)

      const newGoals: Omit<Goal, 'id' | 'created_at' | 'updated_at'>[] = []

      Object.entries(productGoals).forEach(([productKey, pg]) => {
        const product_id = productKey === NO_PRODUCT_KEY ? null : productKey

        // Annual
        if (pg.annualRevenue > 0) {
          newGoals.push({ year, period_type: 'annual', period_value: null, goal_type: 'revenue', target_value: pg.annualRevenue, user_id: null, product_id, created_by: user.id })
        }
        if (pg.annualEntry > 0) {
          newGoals.push({ year, period_type: 'annual', period_value: null, goal_type: 'entry', target_value: pg.annualEntry, user_id: null, product_id, created_by: user.id })
        }

        // Monthly
        pg.monthlyRevenue.forEach((val, i) => {
          if (val > 0) {
            newGoals.push({ year, period_type: 'monthly', period_value: i + 1, goal_type: 'revenue', target_value: val, user_id: null, product_id, created_by: user.id })
          }
        })
        pg.monthlyEntry.forEach((val, i) => {
          if (val > 0) {
            newGoals.push({ year, period_type: 'monthly', period_value: i + 1, goal_type: 'entry', target_value: val, user_id: null, product_id, created_by: user.id })
          }
        })

        // Closer goals
        Object.entries(pg.closerGoals).forEach(([userId, val]) => {
          if (val > 0) {
            newGoals.push({ year, period_type: 'monthly', period_value: null, goal_type: 'revenue', target_value: val, user_id: userId, product_id, created_by: user.id })
          }
        })

        // SDR goals
        if (pg.sdrMeetings > 0) {
          newGoals.push({ year, period_type: 'monthly', period_value: null, goal_type: 'meetings', target_value: pg.sdrMeetings, user_id: null, product_id, created_by: user.id })
        }
        if (pg.sdrLeads > 0) {
          newGoals.push({ year, period_type: 'monthly', period_value: null, goal_type: 'leads', target_value: pg.sdrLeads, user_id: null, product_id, created_by: user.id })
        }
      })

      if (newGoals.length > 0) {
        // Insert in chunks to avoid payload limits
        for (let i = 0; i < newGoals.length; i += 500) {
          await supabase.from('goals').insert(newGoals.slice(i, i + 500))
        }
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const hasProducts = activeProducts.length > 0

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-gold" />
          <h2 className="text-lg font-semibold text-text-primary">Configuração de Metas</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-sm text-text-primary"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button onClick={handleSave} disabled={saving} variant="primary" size="sm">
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Global Totals (read-only summary) */}
      {hasProducts && (
        <div className="bg-surface rounded-xl border border-gold/30 p-6">
          <h3 className="text-sm font-semibold text-gold mb-3">Meta Global (soma de todos os produtos)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-muted">Faturamento Anual</p>
              <p className="font-bold font-display text-text-primary">{formatCurrency(globalTotals.annualRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Entrada Anual</p>
              <p className="font-bold font-display text-text-primary">{formatCurrency(globalTotals.annualEntry)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Reuniões SDR / mês</p>
              <p className="font-bold font-display text-text-primary">{globalTotals.sdrMeetings}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Leads SDR / mês</p>
              <p className="font-bold font-display text-text-primary">{globalTotals.sdrLeads}</p>
            </div>
          </div>
        </div>
      )}

      {/* Per-product sections */}
      {!hasProducts ? (
        /* Fallback: old-style single product (backward compatible) */
        <SingleProductGoals
          productKey={NO_PRODUCT_KEY}
          productName="Geral"
          state={productGoals[NO_PRODUCT_KEY] || emptyProductGoals()}
          onChange={(updater) => updateProductGoal(NO_PRODUCT_KEY, updater)}
          onDistribute={(type) => distributeEvenly(NO_PRODUCT_KEY, type)}
          closers={closers}
          defaultExpanded
        />
      ) : (
        productKeys.map(key => (
          <ProductGoalsSection
            key={key}
            productKey={key}
            productName={getProductName(key)}
            state={productGoals[key] || emptyProductGoals()}
            onChange={(updater) => updateProductGoal(key, updater)}
            onDistribute={(type) => distributeEvenly(key, type)}
            closers={closers}
            expanded={expandedProducts[key] ?? false}
            onToggleExpand={() => toggleExpanded(key)}
          />
        ))
      )}
    </div>
  )
}

// ==================== Collapsible product section ====================
interface ProductGoalsSectionProps {
  productKey: string
  productName: string
  state: ProductGoalState
  onChange: (updater: (prev: ProductGoalState) => ProductGoalState) => void
  onDistribute: (type: 'revenue' | 'entry') => void
  closers: UserProfile[]
  expanded: boolean
  onToggleExpand: () => void
}

function ProductGoalsSection({ productKey, productName, state, onChange, onDistribute, closers, expanded, onToggleExpand }: ProductGoalsSectionProps) {
  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <h3 className="text-sm font-semibold text-text-primary">{productName}</h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>Fat. Anual: {formatCurrency(state.annualRevenue)}</span>
          <span>Entrada: {formatCurrency(state.annualEntry)}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-border pt-4">
          <SingleProductGoals
            productKey={productKey}
            productName={productName}
            state={state}
            onChange={onChange}
            onDistribute={onDistribute}
            closers={closers}
          />
        </div>
      )}
    </div>
  )
}

// ==================== Inner goals form (reusable) ====================
interface SingleProductGoalsProps {
  productKey: string
  productName: string
  state: ProductGoalState
  onChange: (updater: (prev: ProductGoalState) => ProductGoalState) => void
  onDistribute: (type: 'revenue' | 'entry') => void
  closers: UserProfile[]
  defaultExpanded?: boolean
}

function SingleProductGoals({ state, onChange, onDistribute, closers, defaultExpanded }: SingleProductGoalsProps) {
  const monthlyRevenueSum = useMemo(() => state.monthlyRevenue.reduce((a, b) => a + b, 0), [state.monthlyRevenue])
  const monthlyEntrySum = useMemo(() => state.monthlyEntry.reduce((a, b) => a + b, 0), [state.monthlyEntry])
  const revenueDiff = state.annualRevenue - monthlyRevenueSum
  const entryDiff = state.annualEntry - monthlyEntrySum
  const closerGoalSum = useMemo(() => Object.values(state.closerGoals).reduce((a, b) => a + b, 0), [state.closerGoals])

  return (
    <div className={`space-y-6 ${defaultExpanded ? '' : ''}`}>
      {/* Annual Goals */}
      <div className={defaultExpanded ? 'bg-surface rounded-xl border border-border p-6' : ''}>
        <h3 className="text-sm font-semibold text-text-primary mb-4">Meta Anual</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">Faturamento Anual (R$)</label>
            <Input
              type="number"
              value={state.annualRevenue || ''}
              onChange={(e) => onChange(prev => ({ ...prev, annualRevenue: Number(e.target.value) }))}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Entrada Anual (R$)</label>
            <Input
              type="number"
              value={state.annualEntry || ''}
              onChange={(e) => onChange(prev => ({ ...prev, annualEntry: Number(e.target.value) }))}
              placeholder="0,00"
            />
          </div>
        </div>
      </div>

      {/* Monthly Revenue Breakdown */}
      <div className={defaultExpanded ? 'bg-surface rounded-xl border border-border p-6' : ''}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Balanceamento Mensal — Faturamento</h3>
          <div className="flex items-center gap-2">
            {revenueDiff !== 0 && (
              <span className={`text-xs flex items-center gap-1 ${Math.abs(revenueDiff) < 100 ? 'text-success' : 'text-warning'}`}>
                <AlertTriangle size={12} />
                Diferença: {formatCurrency(revenueDiff)}
              </span>
            )}
            <Button onClick={() => onDistribute('revenue')} variant="secondary" size="sm">
              <RotateCcw size={12} />
              Distribuir igualmente
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {MONTHS.map((month, i) => (
            <div key={month}>
              <label className="text-xs text-text-muted block mb-1">{month}</label>
              <Input
                type="number"
                value={state.monthlyRevenue[i] || ''}
                onChange={(e) => {
                  onChange(prev => {
                    const arr = [...prev.monthlyRevenue]
                    arr[i] = Number(e.target.value)
                    return { ...prev, monthlyRevenue: arr }
                  })
                }}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-3">
          Total: {formatCurrency(monthlyRevenueSum)} / Meta anual: {formatCurrency(state.annualRevenue)}
        </p>
      </div>

      {/* Monthly Entry Breakdown */}
      <div className={defaultExpanded ? 'bg-surface rounded-xl border border-border p-6' : ''}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Balanceamento Mensal — Entrada</h3>
          <div className="flex items-center gap-2">
            {entryDiff !== 0 && (
              <span className={`text-xs flex items-center gap-1 ${Math.abs(entryDiff) < 100 ? 'text-success' : 'text-warning'}`}>
                <AlertTriangle size={12} />
                Diferença: {formatCurrency(entryDiff)}
              </span>
            )}
            <Button onClick={() => onDistribute('entry')} variant="secondary" size="sm">
              <RotateCcw size={12} />
              Distribuir igualmente
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {MONTHS.map((month, i) => (
            <div key={month}>
              <label className="text-xs text-text-muted block mb-1">{month}</label>
              <Input
                type="number"
                value={state.monthlyEntry[i] || ''}
                onChange={(e) => {
                  onChange(prev => {
                    const arr = [...prev.monthlyEntry]
                    arr[i] = Number(e.target.value)
                    return { ...prev, monthlyEntry: arr }
                  })
                }}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-3">
          Total: {formatCurrency(monthlyEntrySum)} / Meta anual: {formatCurrency(state.annualEntry)}
        </p>
      </div>

      {/* Per-closer Goals */}
      {closers.length > 0 && (
        <div className={defaultExpanded ? 'bg-surface rounded-xl border border-border p-6' : ''}>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Meta por Closer (Faturamento Mensal)</h3>
          <div className="space-y-3">
            {closers.map((closer) => (
              <div key={closer.id} className="flex items-center gap-4">
                <span className="text-sm text-text-primary w-40 truncate">{closer.name}</span>
                <Input
                  type="number"
                  value={state.closerGoals[closer.id] || ''}
                  onChange={(e) => onChange(prev => ({
                    ...prev,
                    closerGoals: { ...prev.closerGoals, [closer.id]: Number(e.target.value) },
                  }))}
                  placeholder="0"
                  className="max-w-48"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-3">
            Total individual: {formatCurrency(closerGoalSum)}
          </p>
        </div>
      )}

      {/* SDR Goals */}
      <div className={defaultExpanded ? 'bg-surface rounded-xl border border-border p-6' : ''}>
        <h3 className="text-sm font-semibold text-text-primary mb-4">Metas SDR (Mensal)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">Reuniões Agendadas / mês</label>
            <Input
              type="number"
              value={state.sdrMeetings || ''}
              onChange={(e) => onChange(prev => ({ ...prev, sdrMeetings: Number(e.target.value) }))}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Leads Qualificados / mês</label>
            <Input
              type="number"
              value={state.sdrLeads || ''}
              onChange={(e) => onChange(prev => ({ ...prev, sdrLeads: Number(e.target.value) }))}
              placeholder="0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
