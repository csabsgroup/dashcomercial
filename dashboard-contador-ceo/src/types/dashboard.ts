export interface DateRange {
  start: Date
  end: Date
}

export type DatePreset = 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'custom'

export interface KPIData {
  label: string
  value: number
  target: number
  previousValue?: number
  format: 'currency' | 'percent' | 'number' | 'days' | 'hours'
  icon?: string
}

export interface ForecastData {
  expectedByNow: number
  realized: number
  gap: number
  remaining: number
  remainingDays: number
  dailyNeeded: number
}

export interface FunnelStep {
  name: string
  value: number
  fill?: string
}

export interface RankingDisplayEntry {
  position: number
  previousPosition: number | null
  userId: string
  piperunUserId: number
  name: string
  avatarUrl: string | null
  value: number
  target: number
  percentAchieved: number
  positionChange: 'up' | 'down' | 'same' | 'new'
}

export type RankingSortMetric =
  | 'revenue'
  | 'entry'
  | 'deals_closed'
  | 'conversion_rate'
  | 'meetings_scheduled'
  | 'leads_qualified'
  | 'scheduling_rate'

export interface ChartDataPoint {
  date: string
  value?: number
  label?: string
  [key: string]: string | number | undefined
}

export interface BarChartEntry {
  name: string
  value?: number
  target?: number
  fill?: string
  [key: string]: string | number | undefined
}

export interface DonutChartEntry {
  name: string
  value: number
  fill?: string
}
