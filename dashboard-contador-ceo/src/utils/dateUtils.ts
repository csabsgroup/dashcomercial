import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  isWeekend,
  differenceInDays,
  differenceInHours,
  format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DateRange, DatePreset } from '@/types/dashboard'

export function getDateRangeFromPreset(preset: DatePreset): DateRange {
  const now = new Date()

  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'this_week':
      return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) }
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'this_quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) }
    case 'this_year':
      return { start: startOfYear(now), end: endOfYear(now) }
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) }
  }
}

export function getWorkingDaysInMonth(date: Date = new Date()): number {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  const days = eachDayOfInterval({ start, end })
  return days.filter((d) => !isWeekend(d)).length
}

export function getWorkingDaysElapsed(date: Date = new Date()): number {
  const start = startOfMonth(date)
  const today = new Date()
  const end = today > endOfMonth(date) ? endOfMonth(date) : today
  const days = eachDayOfInterval({ start, end })
  return days.filter((d) => !isWeekend(d)).length
}

export function daysBetween(a: Date | string, b: Date | string): number {
  return differenceInDays(new Date(b), new Date(a))
}

export function hoursBetween(a: Date | string, b: Date | string): number {
  return differenceInHours(new Date(b), new Date(a))
}

export function formatDateForAPI(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export { differenceInDays, differenceInHours }
