/**
 * Mock data for development/demo mode.
 * Enable with VITE_MOCK_DATA=true in .env
 */
import type {
  UserProfile,
  CachedDeal,
  CachedActivity,
  Goal,
  Notification,
  SyncLogEntry,
  PiperunConfig,
  ActiveProduct,
  DashboardConfig,
  StageMappings,
  FieldMappings,
} from '@/types/database'

// ─── Flag ───────────────────────────────────────────────
export const MOCK_ENABLED = import.meta.env.VITE_MOCK_DATA === 'true'

// ─── IDs ────────────────────────────────────────────────
const CLOSER_PIPELINE = 1
const SDR_PIPELINE = 2

const STAGE_QUALIFICATION = 10
const STAGE_MEETING_SCHEDULED = 20
const STAGE_MEETING_DONE = 30
const STAGE_PROPOSAL = 40
const STAGE_NEGOTIATION = 50

const PRODUCT_A_ITEM_ID = 501
const PRODUCT_B_ITEM_ID = 502

// ─── Users ──────────────────────────────────────────────
const masterUserId = '00000000-0000-0000-0000-000000000001'

export const MOCK_USERS: UserProfile[] = [
  {
    id: masterUserId,
    name: 'CEO Demo',
    email: 'ceo@absgroup.com.br',
    role: 'master',
    avatar_url: null,
    piperun_user_id: null,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
  },
  // Closers
  {
    id: '00000000-0000-0000-0000-000000000101',
    name: 'João Silva',
    email: 'joao@absgroup.com.br',
    role: 'closer',
    avatar_url: null,
    piperun_user_id: 101,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    name: 'Maria Santos',
    email: 'maria@absgroup.com.br',
    role: 'closer',
    avatar_url: null,
    piperun_user_id: 102,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    name: 'Pedro Oliveira',
    email: 'pedro@absgroup.com.br',
    role: 'closer',
    avatar_url: null,
    piperun_user_id: 103,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
  },
  // SDRs
  {
    id: '00000000-0000-0000-0000-000000000201',
    name: 'Ana Costa',
    email: 'ana@absgroup.com.br',
    role: 'sdr',
    avatar_url: null,
    piperun_user_id: 201,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000202',
    name: 'Lucas Ferreira',
    email: 'lucas@absgroup.com.br',
    role: 'sdr',
    avatar_url: null,
    piperun_user_id: 202,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000203',
    name: 'Carla Mendes',
    email: 'carla@absgroup.com.br',
    role: 'sdr',
    avatar_url: null,
    piperun_user_id: 203,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
  },
]

export const MOCK_MASTER_PROFILE = MOCK_USERS[0]

// ─── Products ───────────────────────────────────────────
export const MOCK_PRODUCTS: ActiveProduct[] = [
  {
    id: 'product-a-uuid',
    piperun_item_id: PRODUCT_A_ITEM_ID,
    name: 'Plano Pro',
    is_active: true,
    created_by: masterUserId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
  },
  {
    id: 'product-b-uuid',
    piperun_item_id: PRODUCT_B_ITEM_ID,
    name: 'Plano Enterprise',
    is_active: true,
    created_by: masterUserId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
  },
]

// ─── Config ─────────────────────────────────────────────
export const MOCK_FIELD_MAPPINGS: FieldMappings = {
  revenue_field_id: 'cf_revenue',
  entry_field_id: 'cf_entry',
}

export const MOCK_STAGE_MAPPINGS: StageMappings = {
  qualification_stage_id: STAGE_QUALIFICATION,
  meeting_scheduled_stage_id: STAGE_MEETING_SCHEDULED,
  meeting_done_stage_id: STAGE_MEETING_DONE,
  proposal_stage_id: STAGE_PROPOSAL,
  negotiation_stage_id: STAGE_NEGOTIATION,
}

export const MOCK_DASHBOARD_CONFIG: DashboardConfig = {}

export const MOCK_PIPERUN_CONFIG: Partial<PiperunConfig> = {
  closer_pipeline_id: CLOSER_PIPELINE,
  closer_pipeline_name: 'Pipeline Closer',
  sdr_pipeline_id: SDR_PIPELINE,
  sdr_pipeline_name: 'Pipeline SDR',
  field_mappings: MOCK_FIELD_MAPPINGS,
  stage_mappings: MOCK_STAGE_MAPPINGS,
  dashboard_config: MOCK_DASHBOARD_CONFIG,
  is_configured: true,
  last_sync_status: 'success',
  last_sync_at: new Date().toISOString(),
}

// ─── Helpers ────────────────────────────────────────────
let dealIdCounter = 1
let activityIdCounter = 1

function dateInMonth(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 10, 0, 0).toISOString()
}

function makeDeal(overrides: Partial<CachedDeal> & { piperun_deal_id: number }): CachedDeal {
  const now = new Date().toISOString()
  return {
    id: `deal-${overrides.piperun_deal_id}`,
    pipeline_id: CLOSER_PIPELINE,
    stage_id: null,
    user_id: null,
    status: 'open',
    value: null,
    title: null,
    origin_id: null,
    lost_reason_id: null,
    person_id: null,
    company_id: null,
    custom_fields: {},
    item_id: null,
    piperun_created_at: now,
    piperun_updated_at: now,
    last_stage_updated_at: null,
    raw_data: null,
    synced_at: now,
    ...overrides,
  }
}

function makeActivity(overrides: Partial<CachedActivity> & { piperun_activity_id: number }): CachedActivity {
  const now = new Date().toISOString()
  return {
    id: `act-${overrides.piperun_activity_id}`,
    deal_id: null,
    user_id: null,
    activity_type_id: 1,
    status: 'done',
    title: 'Atividade',
    piperun_created_at: now,
    piperun_updated_at: now,
    synced_at: now,
    ...overrides,
  }
}

// ─── Deals ──────────────────────────────────────────────
// Revenue stored in custom_fields so extractNumericField picks it up
function cfRevEntry(revenue: number, entry: number) {
  return { cf_revenue: String(revenue), cf_entry: String(entry) }
}

const now = new Date()
const Y = now.getFullYear()
const M = now.getMonth() + 1 // 1-based

// ── Closer deals ────
export const MOCK_CLOSER_DEALS: CachedDeal[] = []

// João Silva (101) - Top closer: ~R$85k revenue
const joaoDeals = [
  { value: 28000, entry: 8400, status: 'won' as const, day: 2, origin: 1, item: PRODUCT_A_ITEM_ID },
  { value: 22000, entry: 6600, status: 'won' as const, day: 5, origin: 2, item: PRODUCT_B_ITEM_ID },
  { value: 18000, entry: 5400, status: 'won' as const, day: 8, origin: 1, item: PRODUCT_A_ITEM_ID },
  { value: 12000, entry: 3600, status: 'won' as const, day: 11, origin: 3, item: PRODUCT_B_ITEM_ID },
  { value: 5000, entry: 1500, status: 'won' as const, day: 14, origin: 2, item: PRODUCT_A_ITEM_ID },
  { value: 15000, entry: 0, status: 'open' as const, day: 3, origin: 1, item: PRODUCT_A_ITEM_ID },
  { value: 25000, entry: 0, status: 'open' as const, day: 7, origin: 3, item: PRODUCT_B_ITEM_ID },
  { value: 20000, entry: 0, status: 'open' as const, day: 10, origin: 2, item: PRODUCT_A_ITEM_ID },
  { value: 10000, entry: 0, status: 'open' as const, day: 13, origin: 1, item: PRODUCT_B_ITEM_ID },
  { value: 8000, entry: 0, status: 'lost' as const, day: 4, origin: 2, lostReason: 1, item: PRODUCT_A_ITEM_ID },
  { value: 6000, entry: 0, status: 'lost' as const, day: 9, origin: 3, lostReason: 2, item: PRODUCT_B_ITEM_ID },
]

joaoDeals.forEach((d) => {
  const id = dealIdCounter++
  MOCK_CLOSER_DEALS.push(
    makeDeal({
      piperun_deal_id: id,
      pipeline_id: CLOSER_PIPELINE,
      user_id: 101,
      status: d.status,
      value: d.value,
      title: `Deal ${id} - João`,
      origin_id: d.origin,
      lost_reason_id: d.lostReason ?? null,
      item_id: d.item,
      stage_id: d.status === 'won' ? 99 : d.status === 'lost' ? 98 : STAGE_NEGOTIATION,
      custom_fields: cfRevEntry(d.status === 'won' ? d.value : 0, d.status === 'won' ? d.entry : 0),
      piperun_created_at: dateInMonth(Y, M, d.day),
      piperun_updated_at: dateInMonth(Y, M, Math.min(d.day + 3, 17)),
    })
  )
})

// Maria Santos (102) - ~R$62k revenue
const mariaDeals = [
  { value: 30000, entry: 9000, status: 'won' as const, day: 1, origin: 2, item: PRODUCT_B_ITEM_ID },
  { value: 18000, entry: 5400, status: 'won' as const, day: 4, origin: 1, item: PRODUCT_A_ITEM_ID },
  { value: 14000, entry: 4200, status: 'won' as const, day: 9, origin: 3, item: PRODUCT_B_ITEM_ID },
  { value: 12000, entry: 0, status: 'open' as const, day: 6, origin: 2, item: PRODUCT_A_ITEM_ID },
  { value: 22000, entry: 0, status: 'open' as const, day: 10, origin: 1, item: PRODUCT_B_ITEM_ID },
  { value: 18000, entry: 0, status: 'open' as const, day: 12, origin: 3, item: PRODUCT_A_ITEM_ID },
  { value: 9000, entry: 0, status: 'lost' as const, day: 3, origin: 1, lostReason: 3, item: PRODUCT_A_ITEM_ID },
  { value: 7500, entry: 0, status: 'lost' as const, day: 7, origin: 2, lostReason: 1, item: PRODUCT_B_ITEM_ID },
  { value: 5500, entry: 0, status: 'lost' as const, day: 11, origin: 3, lostReason: 2, item: PRODUCT_A_ITEM_ID },
]

mariaDeals.forEach((d) => {
  const id = dealIdCounter++
  MOCK_CLOSER_DEALS.push(
    makeDeal({
      piperun_deal_id: id,
      pipeline_id: CLOSER_PIPELINE,
      user_id: 102,
      status: d.status,
      value: d.value,
      title: `Deal ${id} - Maria`,
      origin_id: d.origin,
      lost_reason_id: d.lostReason ?? null,
      item_id: d.item,
      stage_id: d.status === 'won' ? 99 : d.status === 'lost' ? 98 : STAGE_PROPOSAL,
      custom_fields: cfRevEntry(d.status === 'won' ? d.value : 0, d.status === 'won' ? d.entry : 0),
      piperun_created_at: dateInMonth(Y, M, d.day),
      piperun_updated_at: dateInMonth(Y, M, Math.min(d.day + 2, 17)),
    })
  )
})

// Pedro Oliveira (103) - ~R$41k revenue
const pedroDeals = [
  { value: 20000, entry: 6000, status: 'won' as const, day: 2, origin: 3, item: PRODUCT_A_ITEM_ID },
  { value: 15000, entry: 4500, status: 'won' as const, day: 6, origin: 1, item: PRODUCT_B_ITEM_ID },
  { value: 6000, entry: 1800, status: 'won' as const, day: 12, origin: 2, item: PRODUCT_A_ITEM_ID },
  { value: 18000, entry: 0, status: 'open' as const, day: 4, origin: 2, item: PRODUCT_B_ITEM_ID },
  { value: 14000, entry: 0, status: 'open' as const, day: 8, origin: 1, item: PRODUCT_A_ITEM_ID },
  { value: 25000, entry: 0, status: 'open' as const, day: 11, origin: 3, item: PRODUCT_B_ITEM_ID },
  { value: 16000, entry: 0, status: 'open' as const, day: 14, origin: 1, item: PRODUCT_A_ITEM_ID },
  { value: 10000, entry: 0, status: 'lost' as const, day: 5, origin: 2, lostReason: 1, item: PRODUCT_A_ITEM_ID },
  { value: 7000, entry: 0, status: 'lost' as const, day: 10, origin: 3, lostReason: 3, item: PRODUCT_B_ITEM_ID },
]

pedroDeals.forEach((d) => {
  const id = dealIdCounter++
  MOCK_CLOSER_DEALS.push(
    makeDeal({
      piperun_deal_id: id,
      pipeline_id: CLOSER_PIPELINE,
      user_id: 103,
      status: d.status,
      value: d.value,
      title: `Deal ${id} - Pedro`,
      origin_id: d.origin,
      lost_reason_id: d.lostReason ?? null,
      item_id: d.item,
      stage_id: d.status === 'won' ? 99 : d.status === 'lost' ? 98 : STAGE_MEETING_DONE,
      custom_fields: cfRevEntry(d.status === 'won' ? d.value : 0, d.status === 'won' ? d.entry : 0),
      piperun_created_at: dateInMonth(Y, M, d.day),
      piperun_updated_at: dateInMonth(Y, M, Math.min(d.day + 4, 17)),
    })
  )
})

// ── SDR deals ────
export const MOCK_SDR_DEALS: CachedDeal[] = []

// Ana Costa (201) - top SDR: 25 leads
function makeSdrDeals(userId: number, count: number, wonCount: number, lostCount: number) {
  const result: CachedDeal[] = []
  for (let i = 0; i < count; i++) {
    const id = dealIdCounter++
    const day = (i % 15) + 1
    let status: 'open' | 'won' | 'lost' = 'open'
    if (i < wonCount) status = 'won'
    else if (i < wonCount + lostCount) status = 'lost'

    result.push(
      makeDeal({
        piperun_deal_id: id,
        pipeline_id: SDR_PIPELINE,
        user_id: userId,
        status,
        value: status === 'won' ? 5000 : 0,
        title: `Lead ${id} - SDR ${userId}`,
        stage_id: status === 'won' ? STAGE_MEETING_DONE
          : status === 'lost' ? 98
          : [STAGE_QUALIFICATION, STAGE_MEETING_SCHEDULED, STAGE_MEETING_DONE][i % 3],
        custom_fields: {},
        piperun_created_at: dateInMonth(Y, M, day),
        piperun_updated_at: dateInMonth(Y, M, Math.min(day + 2, 17)),
      })
    )
  }
  return result
}

// Ana: 25 leads, 10 won, 3 lost
MOCK_SDR_DEALS.push(...makeSdrDeals(201, 25, 10, 3))
// Lucas: 20 leads, 7 won, 4 lost
MOCK_SDR_DEALS.push(...makeSdrDeals(202, 20, 7, 4))
// Carla: 18 leads, 6 won, 5 lost
MOCK_SDR_DEALS.push(...makeSdrDeals(203, 18, 6, 5))

export const MOCK_DEALS: CachedDeal[] = [...MOCK_CLOSER_DEALS, ...MOCK_SDR_DEALS]

// ─── Activities ─────────────────────────────────────────
export const MOCK_ACTIVITIES: CachedActivity[] = []

// Generate activities for closer deals
MOCK_CLOSER_DEALS.forEach((deal) => {
  const actCount = deal.status === 'won' ? 4 : deal.status === 'lost' ? 2 : 3
  for (let i = 0; i < actCount; i++) {
    MOCK_ACTIVITIES.push(
      makeActivity({
        piperun_activity_id: activityIdCounter++,
        deal_id: deal.piperun_deal_id,
        user_id: deal.user_id,
        activity_type_id: (i % 3) + 1, // 1=Call, 2=Meeting, 3=Email
        status: 'done',
        title: ['Ligação', 'Reunião', 'E-mail'][i % 3],
        piperun_created_at: deal.piperun_created_at,
      })
    )
  }
})

// Generate activities for SDR deals
MOCK_SDR_DEALS.forEach((deal) => {
  const actCount = deal.status === 'won' ? 3 : deal.status === 'lost' ? 1 : 2
  for (let i = 0; i < actCount; i++) {
    MOCK_ACTIVITIES.push(
      makeActivity({
        piperun_activity_id: activityIdCounter++,
        deal_id: deal.piperun_deal_id,
        user_id: deal.user_id,
        activity_type_id: (i % 3) + 1,
        status: 'done',
        title: ['Ligação', 'Qualificação', 'Agendamento'][i % 3],
        piperun_created_at: deal.piperun_created_at,
      })
    )
  }
})

// ─── Goals ──────────────────────────────────────────────
export const MOCK_GOALS: Goal[] = []

const closerUserIds = [
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103',
]

// ── Per-product annual goals ────
// Plano Pro: R$1.440.000/ano (60%), Plano Enterprise: R$960.000/ano (40%)
const productGoalDefs = [
  { productId: 'product-a-uuid', annualRev: 1_440_000, annualEntry: 432_000, monthlyRev: 120_000, monthlyEntry: 36_000, label: 'Pro' },
  { productId: 'product-b-uuid', annualRev: 960_000, annualEntry: 288_000, monthlyRev: 80_000, monthlyEntry: 24_000, label: 'Ent' },
]

productGoalDefs.forEach(({ productId, annualRev, annualEntry, monthlyRev, monthlyEntry, label }) => {
  // Annual revenue
  MOCK_GOALS.push({
    id: `goal-annual-rev-${label}`,
    year: Y,
    period_type: 'annual',
    period_value: null,
    goal_type: 'revenue',
    target_value: annualRev,
    user_id: null,
    product_id: productId,
    created_by: masterUserId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })

  // Annual entry
  MOCK_GOALS.push({
    id: `goal-annual-entry-${label}`,
    year: Y,
    period_type: 'annual',
    period_value: null,
    goal_type: 'entry',
    target_value: annualEntry,
    user_id: null,
    product_id: productId,
    created_by: masterUserId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })

  // Monthly revenue + entry for each month
  for (let m = 1; m <= 12; m++) {
    MOCK_GOALS.push({
      id: `goal-m${m}-rev-${label}`,
      year: Y,
      period_type: 'monthly',
      period_value: m,
      goal_type: 'revenue',
      target_value: monthlyRev,
      user_id: null,
      product_id: productId,
      created_by: masterUserId,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    MOCK_GOALS.push({
      id: `goal-m${m}-entry-${label}`,
      year: Y,
      period_type: 'monthly',
      period_value: m,
      goal_type: 'entry',
      target_value: monthlyEntry,
      user_id: null,
      product_id: productId,
      created_by: masterUserId,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })
  }

  // Per-closer monthly goals for current month (per product)
  // João: 40% Pro, 35% Ent; Maria: 35% Pro, 35% Ent; Pedro: 25% Pro, 30% Ent
  const closerSplitsPro = [48_000, 42_000, 30_000]
  const closerSplitsEnt = [28_000, 28_000, 24_000]
  const splits = label === 'Pro' ? closerSplitsPro : closerSplitsEnt

  closerUserIds.forEach((uid, idx) => {
    MOCK_GOALS.push({
      id: `goal-closer-${idx}-m${M}-${label}`,
      year: Y,
      period_type: 'monthly',
      period_value: M,
      goal_type: 'revenue',
      target_value: splits[idx],
      user_id: uid,
      product_id: productId,
      created_by: masterUserId,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })
  })

  // SDR meetings & leads goals per product (fixed: period_value = M)
  MOCK_GOALS.push({
    id: `goal-sdr-meetings-${label}`,
    year: Y,
    period_type: 'monthly',
    period_value: M,
    goal_type: 'meetings',
    target_value: label === 'Pro' ? 30 : 20,
    user_id: null,
    product_id: productId,
    created_by: masterUserId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })

  MOCK_GOALS.push({
    id: `goal-sdr-leads-${label}`,
    year: Y,
    period_type: 'monthly',
    period_value: M,
    goal_type: 'leads',
    target_value: label === 'Pro' ? 40 : 25,
    user_id: null,
    product_id: productId,
    created_by: masterUserId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })

  // Team deals_won goals per product
  MOCK_GOALS.push({
    id: `goal-deals-won-${label}`,
    year: Y,
    period_type: 'monthly',
    period_value: M,
    goal_type: 'deals_won',
    target_value: label === 'Pro' ? 15 : 10,
    user_id: null,
    product_id: productId,
    created_by: masterUserId,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })

  // Per-SDR individual monthly goals for meetings
  const sdrUserIds = [
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000203',
  ]
  const sdrMeetingSplits = label === 'Pro' ? [12, 10, 8] : [8, 7, 5]

  sdrUserIds.forEach((uid, idx) => {
    MOCK_GOALS.push({
      id: `goal-sdr-${idx}-meetings-m${M}-${label}`,
      year: Y,
      period_type: 'monthly',
      period_value: M,
      goal_type: 'meetings',
      target_value: sdrMeetingSplits[idx],
      user_id: uid,
      product_id: productId,
      created_by: masterUserId,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })
  })
})

// ── Previous months' closer deals (for GoalProgressChart) ─────
export const MOCK_PREVIOUS_MONTH_DEALS: CachedDeal[] = []

// Use a seeded pseudo-random for reproducible data
let seed = 42
function pseudoRandom() {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

for (let m = 1; m < M; m++) {
  // Each closer had deals in previous months, split between products
  ;[101, 102, 103].forEach((userId, idx) => {
    const baseRevenue = [75000, 65000, 50000][idx]
    const monthMultiplier = 0.7 + pseudoRandom() * 0.6 // 70%-130%
    const totalRevenue = baseRevenue * monthMultiplier
    const wonCount = 3 + Math.floor(pseudoRandom() * 4)

    for (let i = 0; i < wonCount; i++) {
      const id = dealIdCounter++
      const revenue = Math.round(totalRevenue / wonCount)
      const itemId = i % 2 === 0 ? PRODUCT_A_ITEM_ID : PRODUCT_B_ITEM_ID
      MOCK_PREVIOUS_MONTH_DEALS.push(
        makeDeal({
          piperun_deal_id: id,
          pipeline_id: CLOSER_PIPELINE,
          user_id: userId,
          status: 'won',
          value: revenue,
          title: `Historic Deal ${id}`,
          item_id: itemId,
          custom_fields: cfRevEntry(revenue, Math.round(revenue * 0.3)),
          piperun_created_at: dateInMonth(Y, m, 1 + (i * 3) % 28),
          piperun_updated_at: dateInMonth(Y, m, 5 + (i * 3) % 25),
        })
      )
    }
  })
}

// Full deal list (current month + previous)
export const MOCK_ALL_DEALS: CachedDeal[] = [...MOCK_DEALS, ...MOCK_PREVIOUS_MONTH_DEALS]

// ─── Notifications ──────────────────────────────────────
export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    user_id: null,
    type: 'high_value_deal',
    title: 'Deal de alto valor!',
    message: 'João Silva fechou um deal de R$28.000 — Plano Pro',
    read: false,
    data: { deal_id: 1, value: 28000 },
    created_at: dateInMonth(Y, M, 14),
  },
  {
    id: 'notif-2',
    user_id: null,
    type: 'ranking_change',
    title: 'Mudança no ranking!',
    message: 'João Silva ultrapassou Pedro Oliveira e agora é o #1 em receita',
    read: false,
    data: {},
    created_at: dateInMonth(Y, M, 13),
  },
  {
    id: 'notif-3',
    user_id: null,
    type: 'goal_reached',
    title: 'Meta atingida! 🎯',
    message: 'João Silva atingiu 100% da meta mensal de receita',
    read: false,
    data: {},
    created_at: dateInMonth(Y, M, 12),
  },
  {
    id: 'notif-4',
    user_id: null,
    type: 'gap_alert',
    title: 'Alerta de gap',
    message: 'A equipe está 15% abaixo do previsto para este mês. Atenção!',
    read: true,
    data: {},
    created_at: dateInMonth(Y, M, 10),
  },
  {
    id: 'notif-5',
    user_id: null,
    type: 'high_value_deal',
    title: 'Deal de alto valor!',
    message: 'Maria Santos fechou um deal de R$30.000 — Plano Enterprise',
    read: true,
    data: { deal_id: 12, value: 30000 },
    created_at: dateInMonth(Y, M, 9),
  },
  {
    id: 'notif-6',
    user_id: null,
    type: 'ranking_change',
    title: 'Mudança no ranking SDR',
    message: 'Ana Costa agora lidera o ranking de SDRs com 25 leads trabalhados',
    read: true,
    data: {},
    created_at: dateInMonth(Y, M, 8),
  },
]

// ─── Sync Log ───────────────────────────────────────────
export const MOCK_SYNC_LOG: SyncLogEntry = {
  id: 'sync-1',
  synced_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
  sync_type: 'full',
  deals_synced: MOCK_DEALS.length,
  activities_synced: MOCK_ACTIVITIES.length,
  status: 'success',
  error_message: null,
  duration_ms: 12500,
}

// ─── Origin names ───────────────────────────────────────
export const MOCK_ORIGINS = new Map<number, string>([
  [1, 'Indicação'],
  [2, 'Google Ads'],
  [3, 'LinkedIn'],
])
