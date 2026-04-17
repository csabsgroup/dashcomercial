import type { CachedDeal } from '@/types/database'

export function extractCustomField(deal: CachedDeal, fieldMapping: string): string | null {
  const customFields = deal.custom_fields
  if (!customFields) return null

  // Try direct access if customForms structure
  const forms = (customFields as Record<string, unknown>).customForms || customFields
  if (Array.isArray(forms)) {
    for (const form of forms) {
      const fields = (form as Record<string, unknown>).fields
      if (Array.isArray(fields)) {
        for (const field of fields) {
          const f = field as Record<string, unknown>
          if (String(f.id) === fieldMapping || f.key === fieldMapping) {
            return f.value as string | null
          }
        }
      }
    }
  }

  // Try flat structure
  if (typeof customFields === 'object' && fieldMapping in customFields) {
    return String((customFields as Record<string, unknown>)[fieldMapping])
  }

  return null
}

export function extractNumericField(deal: CachedDeal, fieldMapping: string): number {
  const val = extractCustomField(deal, fieldMapping)
  if (val === null || val === undefined) return 0
  const num = parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return isNaN(num) ? 0 : num
}
