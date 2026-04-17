import { useState, useCallback } from 'react'
import { callPiperunProxy } from '@/services/piperunProxy'
import type { PiperunCustomFieldDefinition } from '@/types/piperun'

export function useCustomFields() {
  const [fields, setFields] = useState<PiperunCustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (token?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await callPiperunProxy<PiperunCustomFieldDefinition>({
        endpoint: '/customFields',
        params: {},
        ...(token ? { token } : {}),
      })

      // The API may return nested forms with fields, or flat field list.
      // Normalize to a flat list of field definitions.
      const raw = res.data || []
      const normalized: PiperunCustomFieldDefinition[] = []

      for (const item of raw as any[]) {
        if (item.fields && Array.isArray(item.fields)) {
          // This is a form with nested fields
          for (const field of item.fields) {
            normalized.push({
              id: field.id,
              key: field.key || `custom_${field.id}`,
              name: field.name || field.label || `Campo ${field.id}`,
              label: field.label || field.name || `Campo ${field.id}`,
              type: field.type || 'text',
              form_id: item.id,
              form_name: item.name,
              options: field.options,
            })
          }
        } else {
          // Flat field
          normalized.push({
            id: item.id,
            key: item.key || `custom_${item.id}`,
            name: item.name || item.label || `Campo ${item.id}`,
            label: item.label || item.name || `Campo ${item.id}`,
            type: item.type || 'text',
            options: item.options,
          })
        }
      }

      setFields(normalized)
    } catch (err) {
      setError((err as Error).message)
      setFields([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { fields, loading, error, fetch }
}
