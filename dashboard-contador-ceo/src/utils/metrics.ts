import type { CachedDeal, CachedActivity, FieldMappings } from '@/types/database'
import type { ForecastData } from '@/types/dashboard'
import { extractNumericField } from './piperunFields'
import { getWorkingDaysInMonth, getWorkingDaysElapsed, hoursBetween, daysBetween } from './dateUtils'

// ===== SHARED =====

export function filterDealsByDateRange(
  deals: CachedDeal[],
  start: Date,
  end: Date
): CachedDeal[] {
  return deals.filter((d) => {
    const created = d.piperun_created_at ? new Date(d.piperun_created_at) : null
    return created && created >= start && created <= end
  })
}

// ===== CLOSERS =====

export function calcTotalRevenue(
  deals: CachedDeal[],
  fieldMappings: FieldMappings
): number {
  const wonDeals = deals.filter((d) => d.status === 'won')
  return wonDeals.reduce((sum, d) => {
    const val = fieldMappings.revenue_field_id
      ? extractNumericField(d, fieldMappings.revenue_field_id)
      : (d.value || 0)
    return sum + val
  }, 0)
}

export function calcTotalEntry(
  deals: CachedDeal[],
  fieldMappings: FieldMappings
): number {
  const wonDeals = deals.filter((d) => d.status === 'won')
  return wonDeals.reduce((sum, d) => {
    if (!fieldMappings.entry_field_id) return sum
    return sum + extractNumericField(d, fieldMappings.entry_field_id)
  }, 0)
}

export function countDealsWon(deals: CachedDeal[]): number {
  return deals.filter((d) => d.status === 'won').length
}

export function calcConversionRate(deals: CachedDeal[]): number {
  const total = deals.length
  const won = deals.filter((d) => d.status === 'won').length
  return total > 0 ? (won / total) * 100 : 0
}

export function calcWinRate(deals: CachedDeal[]): number {
  const won = deals.filter((d) => d.status === 'won').length
  const lost = deals.filter((d) => d.status === 'lost').length
  const decided = won + lost
  return decided > 0 ? (won / decided) * 100 : 0
}

export function calcAverageTicket(
  deals: CachedDeal[],
  fieldMappings: FieldMappings
): number {
  const wonDeals = deals.filter((d) => d.status === 'won')
  if (wonDeals.length === 0) return 0
  const total = calcTotalRevenue(deals, fieldMappings)
  return total / wonDeals.length
}

export function calcMRR(
  deals: CachedDeal[],
  fieldMappings: FieldMappings
): number {
  // Use dedicated MRR field if mapped, otherwise derive from revenue / 12
  if (fieldMappings.mrr_field_id) {
    const wonDeals = deals.filter((d) => d.status === 'won')
    return wonDeals.reduce((sum, d) => {
      return sum + extractNumericField(d, fieldMappings.mrr_field_id!)
    }, 0)
  }
  return calcTotalRevenue(deals, fieldMappings) / 12
}

export function calcSalesCycle(deals: CachedDeal[]): number {
  const wonDeals = deals.filter(
    (d) => d.status === 'won' && d.piperun_created_at && d.piperun_updated_at
  )
  if (wonDeals.length === 0) return 0

  const totalDays = wonDeals.reduce((sum, d) => {
    return sum + daysBetween(d.piperun_created_at!, d.piperun_updated_at!)
  }, 0)

  return totalDays / wonDeals.length
}

export function calcPipelineTotal(deals: CachedDeal[]): number {
  return deals
    .filter((d) => d.status === 'open')
    .reduce((sum, d) => sum + (d.value || 0), 0)
}

export function calcPipelineCoverage(deals: CachedDeal[], monthlyGoal: number): number {
  const openValue = calcPipelineTotal(deals)
  return monthlyGoal > 0 ? openValue / monthlyGoal : 0
}

// ===== SDRs =====

export function calcContactRate(
  deals: CachedDeal[],
  activities: CachedActivity[]
): number {
  const dealIdsWithActivity = new Set(activities.map((a) => a.deal_id))
  const contacted = deals.filter((d) => dealIdsWithActivity.has(d.piperun_deal_id)).length
  return deals.length > 0 ? (contacted / deals.length) * 100 : 0
}

export function calcQualificationRate(
  deals: CachedDeal[],
  qualificationStageId: number
): number {
  const qualified = deals.filter(
    (d) => d.stage_id !== null && d.stage_id >= qualificationStageId
  ).length
  return deals.length > 0 ? (qualified / deals.length) * 100 : 0
}

export function calcShowRate(
  activities: CachedActivity[],
  meetingTypeId: number
): number {
  const meetings = activities.filter((a) => a.activity_type_id === meetingTypeId)
  const completed = meetings.filter(
    (a) => a.status === 'done' || a.status === 'completed'
  )
  return meetings.length > 0 ? (completed.length / meetings.length) * 100 : 0
}

export function calcFirstContactSLA(
  deals: CachedDeal[],
  activities: CachedActivity[]
): number {
  const slaHours: number[] = []
  for (const deal of deals) {
    if (!deal.piperun_created_at) continue
    const dealActivities = activities
      .filter((a) => a.deal_id === deal.piperun_deal_id && a.piperun_created_at)
      .sort(
        (a, b) =>
          new Date(a.piperun_created_at!).getTime() -
          new Date(b.piperun_created_at!).getTime()
      )
    if (dealActivities.length > 0) {
      slaHours.push(
        hoursBetween(deal.piperun_created_at, dealActivities[0].piperun_created_at!)
      )
    }
  }
  return slaHours.length > 0
    ? slaHours.reduce((a, b) => a + b, 0) / slaHours.length
    : 0
}

export function calcLeadsWorked(
  deals: CachedDeal[],
  activities: CachedActivity[]
): number {
  const dealIdsWithActivity = new Set(activities.map((a) => a.deal_id))
  return deals.filter((d) => dealIdsWithActivity.has(d.piperun_deal_id)).length
}

export function calcAvgActivitiesPerDeal(
  deals: CachedDeal[],
  activities: CachedActivity[]
): number {
  if (deals.length === 0) return 0
  const dealActivities = activities.filter((a) =>
    deals.some((d) => d.piperun_deal_id === a.deal_id)
  )
  return dealActivities.length / deals.length
}

// ===== ADVANCED =====

/**
 * Revenue per meeting — Receita total / Reuniões realizadas
 */
export function calcRevenuePerMeeting(
  deals: CachedDeal[],
  activities: CachedActivity[],
  meetingTypeId: number,
  fieldMappings: FieldMappings
): number {
  const completedMeetings = activities.filter(
    (a) =>
      a.activity_type_id === meetingTypeId &&
      (a.status === 'done' || a.status === 'completed')
  )
  if (completedMeetings.length === 0) return 0
  const totalRevenue = calcTotalRevenue(deals, fieldMappings)
  return totalRevenue / completedMeetings.length
}

/**
 * Win rate by origin — { origin_id → win rate % }
 */
export function calcWinRateByOrigin(
  deals: CachedDeal[]
): { originId: number; total: number; won: number; winRate: number }[] {
  const byOrigin = new Map<number, { total: number; won: number }>()
  for (const d of deals) {
    if (!d.origin_id) continue
    const entry = byOrigin.get(d.origin_id) || { total: 0, won: 0 }
    entry.total++
    if (d.status === 'won') entry.won++
    byOrigin.set(d.origin_id, entry)
  }
  return Array.from(byOrigin.entries()).map(([originId, { total, won }]) => ({
    originId,
    total,
    won,
    winRate: total > 0 ? (won / total) * 100 : 0,
  }))
}

/**
 * SDR → Closer advancement rate
 * Detects deals in the closer pipeline that originated from SDR pipeline
 * by matching person_id/company_id between pipelines.
 */
export function calcSdrToCloserRate(
  sdrDeals: CachedDeal[],
  closerDeals: CachedDeal[]
): number {
  if (sdrDeals.length === 0) return 0

  const closerPersonIds = new Set(
    closerDeals.filter((d) => d.person_id).map((d) => d.person_id)
  )
  const closerCompanyIds = new Set(
    closerDeals.filter((d) => d.company_id).map((d) => d.company_id)
  )

  const advanced = sdrDeals.filter(
    (d) =>
      (d.person_id && closerPersonIds.has(d.person_id)) ||
      (d.company_id && closerCompanyIds.has(d.company_id))
  )

  return (advanced.length / sdrDeals.length) * 100
}

// ===== FORECAST =====

export function calcForecastGap(
  goal: number,
  realized: number,
  date?: Date
): ForecastData {
  const now = date || new Date()
  const workingDaysTotal = getWorkingDaysInMonth(now)
  const workingDaysElapsed = getWorkingDaysElapsed(now)

  const expectedByNow =
    workingDaysTotal > 0 ? (goal / workingDaysTotal) * workingDaysElapsed : 0
  const gap = realized - expectedByNow
  const remaining = goal - realized
  const remainingDays = workingDaysTotal - workingDaysElapsed
  const dailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0

  return { expectedByNow, realized, gap, remaining, remainingDays, dailyNeeded }
}
