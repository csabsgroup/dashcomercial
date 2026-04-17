import { createContext, useContext, useState, useMemo, useRef, useCallback, type ReactNode } from 'react'
import type { DateRange, DatePreset } from '@/types/dashboard'
import { getDateRangeFromPreset } from '@/utils/dateUtils'

interface DateRangeContextType {
  preset: DatePreset
  dateRange: DateRange
  setPreset: (preset: DatePreset) => void
  setCustomRange: (range: DateRange) => void
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined)

const DEBOUNCE_MS = 300

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<DatePreset>('this_month')
  const [customRange, setCustomRange] = useState<DateRange | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dateRange = useMemo(() => {
    if (preset === 'custom' && customRange) return customRange
    return getDateRangeFromPreset(preset)
  }, [preset, customRange])

  const setPreset = useCallback((p: DatePreset) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPresetState(p)
      if (p !== 'custom') setCustomRange(null)
    }, DEBOUNCE_MS)
  }, [])

  const handleCustomRange = useCallback((range: DateRange) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPresetState('custom')
      setCustomRange(range)
    }, DEBOUNCE_MS)
  }, [])

  return (
    <DateRangeContext.Provider value={{ preset, dateRange, setPreset, setCustomRange: handleCustomRange }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider')
  return ctx
}
