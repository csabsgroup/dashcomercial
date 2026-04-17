import { describe, it, expect } from 'vitest'
import {
  filterDealsByDateRange,
  calcTotalRevenue,
  calcTotalEntry,
  calcConversionRate,
  calcWinRate,
  calcAverageTicket,
  calcMRR,
  calcSalesCycle,
  calcPipelineTotal,
  calcPipelineCoverage,
  calcContactRate,
  calcQualificationRate,
  calcShowRate,
  calcFirstContactSLA,
  calcLeadsWorked,
  calcAvgActivitiesPerDeal,
  calcRevenuePerMeeting,
  calcWinRateByOrigin,
  calcSdrToCloserRate,
  calcForecastGap,
} from '../metrics'
import type { CachedDeal, CachedActivity } from '@/types/database'

// ===== Helpers =====

function makeDeal(overrides: Partial<CachedDeal> = {}): CachedDeal {
  return {
    id: 'test-id',
    piperun_deal_id: 1,
    pipeline_id: 100,
    stage_id: null,
    user_id: null,
    status: 'open',
    value: 0,
    title: 'Test Deal',
    origin_id: null,
    lost_reason_id: null,
    person_id: null,
    company_id: null,
    custom_fields: {},
    item_id: null,
    piperun_created_at: '2026-04-01T10:00:00Z',
    piperun_updated_at: '2026-04-10T10:00:00Z',
    last_stage_updated_at: null,
    raw_data: null,
    synced_at: '2026-04-10T10:00:00Z',
    ...overrides,
  }
}

function makeActivity(overrides: Partial<CachedActivity> = {}): CachedActivity {
  return {
    id: 'act-id',
    piperun_activity_id: 1,
    deal_id: null,
    user_id: null,
    activity_type_id: null,
    status: 'done',
    title: 'Test Activity',
    piperun_created_at: '2026-04-02T10:00:00Z',
    piperun_updated_at: '2026-04-02T10:00:00Z',
    synced_at: '2026-04-10T10:00:00Z',
    ...overrides,
  }
}

// ===== Tests =====

describe('filterDealsByDateRange', () => {
  it('returns deals within the date range', () => {
    const deals = [
      makeDeal({ piperun_deal_id: 1, piperun_created_at: '2026-04-05T10:00:00Z' }),
      makeDeal({ piperun_deal_id: 2, piperun_created_at: '2026-03-01T10:00:00Z' }),
      makeDeal({ piperun_deal_id: 3, piperun_created_at: '2026-04-15T10:00:00Z' }),
    ]
    const result = filterDealsByDateRange(deals, new Date('2026-04-01'), new Date('2026-04-30'))
    expect(result).toHaveLength(2)
    expect(result.map(d => d.piperun_deal_id)).toEqual([1, 3])
  })

  it('returns empty for deals outside range', () => {
    const deals = [makeDeal({ piperun_created_at: '2026-01-01T10:00:00Z' })]
    const result = filterDealsByDateRange(deals, new Date('2026-04-01'), new Date('2026-04-30'))
    expect(result).toHaveLength(0)
  })

  it('skips deals with null created_at', () => {
    const deals = [makeDeal({ piperun_created_at: null })]
    const result = filterDealsByDateRange(deals, new Date('2026-04-01'), new Date('2026-04-30'))
    expect(result).toHaveLength(0)
  })
})

describe('calcTotalRevenue', () => {
  it('sums value of won deals when no field mapping', () => {
    const deals = [
      makeDeal({ status: 'won', value: 1000 }),
      makeDeal({ status: 'won', value: 2000 }),
      makeDeal({ status: 'open', value: 500 }),
    ]
    expect(calcTotalRevenue(deals, {})).toBe(3000)
  })

  it('returns 0 when no won deals', () => {
    const deals = [makeDeal({ status: 'open', value: 500 })]
    expect(calcTotalRevenue(deals, {})).toBe(0)
  })
})

describe('calcTotalEntry', () => {
  it('returns 0 when no entry field mapping', () => {
    const deals = [makeDeal({ status: 'won', value: 1000 })]
    expect(calcTotalEntry(deals, {})).toBe(0)
  })
})

describe('calcConversionRate', () => {
  it('calculates won / total percentage', () => {
    const deals = [
      makeDeal({ status: 'won' }),
      makeDeal({ status: 'lost' }),
      makeDeal({ status: 'open' }),
      makeDeal({ status: 'won' }),
    ]
    expect(calcConversionRate(deals)).toBe(50)
  })

  it('returns 0 for empty array', () => {
    expect(calcConversionRate([])).toBe(0)
  })
})

describe('calcWinRate', () => {
  it('calculates won / (won + lost) percentage', () => {
    const deals = [
      makeDeal({ status: 'won' }),
      makeDeal({ status: 'lost' }),
      makeDeal({ status: 'lost' }),
      makeDeal({ status: 'open' }),
    ]
    expect(calcWinRate(deals)).toBeCloseTo(33.33, 1)
  })

  it('returns 0 when no decided deals', () => {
    const deals = [makeDeal({ status: 'open' })]
    expect(calcWinRate(deals)).toBe(0)
  })
})

describe('calcAverageTicket', () => {
  it('calculates revenue / won deals', () => {
    const deals = [
      makeDeal({ status: 'won', value: 1000 }),
      makeDeal({ status: 'won', value: 3000 }),
    ]
    expect(calcAverageTicket(deals, {})).toBe(2000)
  })
})

describe('calcMRR', () => {
  it('divides total revenue by 12', () => {
    const deals = [
      makeDeal({ status: 'won', value: 12000 }),
    ]
    expect(calcMRR(deals, {})).toBe(1000)
  })
})

describe('calcSalesCycle', () => {
  it('calculates average days between creation and update for won deals', () => {
    const deals = [
      makeDeal({ status: 'won', piperun_created_at: '2026-04-01T10:00:00Z', piperun_updated_at: '2026-04-11T10:00:00Z' }),
      makeDeal({ status: 'won', piperun_created_at: '2026-04-01T10:00:00Z', piperun_updated_at: '2026-04-21T10:00:00Z' }),
    ]
    expect(calcSalesCycle(deals)).toBe(15) // (10 + 20) / 2
  })

  it('returns 0 for no won deals', () => {
    expect(calcSalesCycle([])).toBe(0)
  })
})

describe('calcPipelineTotal', () => {
  it('sums value of open deals only', () => {
    const deals = [
      makeDeal({ status: 'open', value: 500 }),
      makeDeal({ status: 'open', value: 300 }),
      makeDeal({ status: 'won', value: 1000 }),
    ]
    expect(calcPipelineTotal(deals)).toBe(800)
  })
})

describe('calcPipelineCoverage', () => {
  it('returns pipeline / goal ratio', () => {
    const deals = [makeDeal({ status: 'open', value: 30000 })]
    expect(calcPipelineCoverage(deals, 10000)).toBe(3)
  })

  it('returns 0 when goal is 0', () => {
    expect(calcPipelineCoverage([], 0)).toBe(0)
  })
})

describe('calcContactRate', () => {
  it('calculates % of deals with activities', () => {
    const deals = [
      makeDeal({ piperun_deal_id: 1 }),
      makeDeal({ piperun_deal_id: 2 }),
      makeDeal({ piperun_deal_id: 3 }),
    ]
    const activities = [
      makeActivity({ deal_id: 1 }),
      makeActivity({ deal_id: 1 }),
      makeActivity({ deal_id: 3 }),
    ]
    expect(calcContactRate(deals, activities)).toBeCloseTo(66.67, 1)
  })
})

describe('calcQualificationRate', () => {
  it('counts deals at or past qualification stage', () => {
    const deals = [
      makeDeal({ stage_id: 10 }),
      makeDeal({ stage_id: 20 }),
      makeDeal({ stage_id: 5 }),
    ]
    expect(calcQualificationRate(deals, 10)).toBeCloseTo(66.67, 1)
  })
})

describe('calcShowRate', () => {
  it('calculates completed meetings / all meetings', () => {
    const activities = [
      makeActivity({ activity_type_id: 5, status: 'done' }),
      makeActivity({ activity_type_id: 5, status: 'pending' }),
      makeActivity({ activity_type_id: 5, status: 'done' }),
      makeActivity({ activity_type_id: 99, status: 'done' }), // different type
    ]
    expect(calcShowRate(activities, 5)).toBeCloseTo(66.67, 1)
  })
})

describe('calcFirstContactSLA', () => {
  it('calculates avg hours from deal creation to first activity', () => {
    const deals = [
      makeDeal({ piperun_deal_id: 1, piperun_created_at: '2026-04-01T10:00:00Z' }),
    ]
    const activities = [
      makeActivity({ deal_id: 1, piperun_created_at: '2026-04-01T14:00:00Z' }),
    ]
    expect(calcFirstContactSLA(deals, activities)).toBe(4)
  })
})

describe('calcLeadsWorked', () => {
  it('counts deals that have at least one activity', () => {
    const deals = [
      makeDeal({ piperun_deal_id: 1 }),
      makeDeal({ piperun_deal_id: 2 }),
    ]
    const activities = [makeActivity({ deal_id: 1 })]
    expect(calcLeadsWorked(deals, activities)).toBe(1)
  })
})

describe('calcAvgActivitiesPerDeal', () => {
  it('calculates activities per deal', () => {
    const deals = [makeDeal({ piperun_deal_id: 1 }), makeDeal({ piperun_deal_id: 2 })]
    const activities = [
      makeActivity({ deal_id: 1 }),
      makeActivity({ deal_id: 1 }),
      makeActivity({ deal_id: 2 }),
    ]
    expect(calcAvgActivitiesPerDeal(deals, activities)).toBe(1.5)
  })
})

describe('calcRevenuePerMeeting', () => {
  it('divides revenue by completed meetings', () => {
    const deals = [
      makeDeal({ status: 'won', value: 10000 }),
    ]
    const activities = [
      makeActivity({ activity_type_id: 5, status: 'done' }),
      makeActivity({ activity_type_id: 5, status: 'done' }),
    ]
    expect(calcRevenuePerMeeting(deals, activities, 5, {})).toBe(5000)
  })

  it('returns 0 when no meetings', () => {
    const deals = [makeDeal({ status: 'won', value: 10000 })]
    expect(calcRevenuePerMeeting(deals, [], 5, {})).toBe(0)
  })
})

describe('calcWinRateByOrigin', () => {
  it('groups deals by origin and calculates win rate', () => {
    const deals = [
      makeDeal({ origin_id: 1, status: 'won' }),
      makeDeal({ origin_id: 1, status: 'lost' }),
      makeDeal({ origin_id: 2, status: 'won' }),
      makeDeal({ origin_id: 2, status: 'won' }),
      makeDeal({ origin_id: null, status: 'won' }), // no origin, ignored
    ]
    const result = calcWinRateByOrigin(deals)
    expect(result).toHaveLength(2)

    const origin1 = result.find(r => r.originId === 1)!
    expect(origin1.total).toBe(2)
    expect(origin1.won).toBe(1)
    expect(origin1.winRate).toBe(50)

    const origin2 = result.find(r => r.originId === 2)!
    expect(origin2.total).toBe(2)
    expect(origin2.won).toBe(2)
    expect(origin2.winRate).toBe(100)
  })
})

describe('calcSdrToCloserRate', () => {
  it('detects SDR deals that appear in closer pipeline by person_id', () => {
    const sdrDeals = [
      makeDeal({ piperun_deal_id: 1, person_id: 100, pipeline_id: 1 }),
      makeDeal({ piperun_deal_id: 2, person_id: 200, pipeline_id: 1 }),
      makeDeal({ piperun_deal_id: 3, person_id: 300, pipeline_id: 1 }),
    ]
    const closerDeals = [
      makeDeal({ piperun_deal_id: 10, person_id: 100, pipeline_id: 2 }),
    ]
    expect(calcSdrToCloserRate(sdrDeals, closerDeals)).toBeCloseTo(33.33, 1)
  })

  it('returns 0 with no SDR deals', () => {
    expect(calcSdrToCloserRate([], [])).toBe(0)
  })
})

describe('calcForecastGap', () => {
  it('calculates forecast correctly', () => {
    const result = calcForecastGap(100000, 50000, new Date('2026-04-15'))
    expect(result.realized).toBe(50000)
    expect(result.remaining).toBe(50000)
    expect(result.remainingDays).toBeGreaterThan(0)
    expect(result.dailyNeeded).toBeGreaterThan(0)
  })

  it('handles 0 goal', () => {
    const result = calcForecastGap(0, 0)
    expect(result.expectedByNow).toBe(0)
    expect(result.gap).toBe(0)
  })
})
