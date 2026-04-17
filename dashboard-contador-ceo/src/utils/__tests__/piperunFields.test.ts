import { describe, it, expect } from 'vitest'
import { extractCustomField, extractNumericField } from '../piperunFields'
import type { CachedDeal } from '@/types/database'

function makeDeal(custom_fields: Record<string, unknown>): CachedDeal {
  return {
    id: 'test-id',
    piperun_deal_id: 1,
    pipeline_id: 100,
    stage_id: null,
    user_id: null,
    status: 'won',
    value: 0,
    title: 'Test',
    origin_id: null,
    lost_reason_id: null,
    person_id: null,
    company_id: null,
    custom_fields,
    item_id: null,
    piperun_created_at: '2026-04-01T10:00:00Z',
    piperun_updated_at: '2026-04-10T10:00:00Z',
    last_stage_updated_at: null,
    raw_data: null,
    synced_at: '2026-04-10T10:00:00Z',
  }
}

describe('extractCustomField', () => {
  it('extracts from customForms array by field id', () => {
    const deal = makeDeal({
      customForms: [
        {
          id: 1,
          name: 'Formulário',
          fields: [
            { id: 101, key: 'cf_faturamento', label: 'Faturamento', value: '90000.00' },
            { id: 102, key: 'cf_entrada', label: 'Entrada', value: '30000.00' },
          ],
        },
      ],
    })

    expect(extractCustomField(deal, '101')).toBe('90000.00')
    expect(extractCustomField(deal, '102')).toBe('30000.00')
  })

  it('extracts from customForms by key', () => {
    const deal = makeDeal({
      customForms: [
        {
          id: 1,
          fields: [
            { id: 101, key: 'cf_faturamento', value: '50000' },
          ],
        },
      ],
    })
    expect(extractCustomField(deal, 'cf_faturamento')).toBe('50000')
  })

  it('extracts from flat structure', () => {
    const deal = makeDeal({ revenue_total: '75000' })
    expect(extractCustomField(deal, 'revenue_total')).toBe('75000')
  })

  it('returns null for missing field', () => {
    const deal = makeDeal({})
    expect(extractCustomField(deal, 'nonexistent')).toBeNull()
  })

  it('returns null for null custom_fields', () => {
    const deal = makeDeal({})
    deal.custom_fields = null as unknown as Record<string, unknown>
    expect(extractCustomField(deal, '101')).toBeNull()
  })

  it('handles multiple forms', () => {
    const deal = makeDeal({
      customForms: [
        { id: 1, fields: [{ id: 10, key: 'a', value: 'wrong' }] },
        { id: 2, fields: [{ id: 20, key: 'b', value: 'right' }] },
      ],
    })
    expect(extractCustomField(deal, '20')).toBe('right')
  })
})

describe('extractNumericField', () => {
  it('parses numeric value correctly', () => {
    const deal = makeDeal({
      customForms: [
        { id: 1, fields: [{ id: 101, key: 'cf', value: '90000.50' }] },
      ],
    })
    expect(extractNumericField(deal, '101')).toBe(90000.5)
  })

  it('handles comma decimal separator', () => {
    const deal = makeDeal({
      customForms: [
        { id: 1, fields: [{ id: 101, key: 'cf', value: '1234,56' }] },
      ],
    })
    expect(extractNumericField(deal, '101')).toBe(1234.56)
  })

  it('strips currency symbols', () => {
    const deal = makeDeal({
      customForms: [
        { id: 1, fields: [{ id: 101, key: 'cf', value: 'R$ 5000' }] },
      ],
    })
    expect(extractNumericField(deal, '101')).toBe(5000)
  })

  it('returns 0 for non-numeric value', () => {
    const deal = makeDeal({
      customForms: [
        { id: 1, fields: [{ id: 101, key: 'cf', value: 'abc' }] },
      ],
    })
    expect(extractNumericField(deal, '101')).toBe(0)
  })

  it('returns 0 for missing field', () => {
    const deal = makeDeal({})
    expect(extractNumericField(deal, '999')).toBe(0)
  })
})
