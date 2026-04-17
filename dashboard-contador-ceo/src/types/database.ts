export type UserRole = 'master' | 'admin' | 'closer' | 'sdr'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  avatar_url: string | null
  piperun_user_id: number | null
  active: boolean
  created_at: string
  updated_at: string
}

export type GoalPeriodType = 'annual' | 'quarterly' | 'monthly'
export type GoalType = 'revenue' | 'entry' | 'meetings' | 'leads' | 'deals_won'

export interface Goal {
  id: string
  year: number
  period_type: GoalPeriodType
  period_value: number | null
  goal_type: GoalType
  target_value: number
  user_id: string | null
  product_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ActiveProduct {
  id: string
  piperun_item_id: number
  name: string
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PiperunItemCache {
  id: string
  piperun_item_id: number
  name: string
  price: number | null
  data: Record<string, unknown>
  synced_at: string
}

export interface PiperunConfig {
  id: string
  api_token_encrypted: string
  base_url: string
  account_name: string | null
  token_user_email: string | null
  token_user_acl: string | null
  closer_pipeline_id: number | null
  closer_pipeline_name: string | null
  sdr_pipeline_id: number | null
  sdr_pipeline_name: string | null
  stage_mappings: StageMappings
  field_mappings: FieldMappings
  visible_fields: Record<string, boolean>
  dashboard_config: DashboardConfig
  sync_interval_minutes: number
  last_sync_at: string | null
  last_sync_status: string
  is_configured: boolean
  created_at: string
  updated_at: string
}

export interface CloserStageMappings {
  qualification_stage_id?: number
  meeting_scheduled_stage_id?: number
  meeting_done_stage_id?: number
  proposal_stage_id?: number
  negotiation_stage_id?: number
  [key: string]: number | undefined
}

export interface SdrStageMappings {
  new_lead_stage_id?: number
  contacted_stage_id?: number
  qualified_stage_id?: number
  scheduled_stage_id?: number
  meeting_done_stage_id?: number
  passed_to_closer_stage_id?: number
  [key: string]: number | undefined
}

export interface StageMappings {
  // Legacy flat fields (backward compat)
  qualification_stage_id?: number
  meeting_scheduled_stage_id?: number
  meeting_done_stage_id?: number
  proposal_stage_id?: number
  negotiation_stage_id?: number
  // Structured per-pipeline mappings
  closer?: CloserStageMappings
  sdr?: SdrStageMappings
  [key: string]: number | CloserStageMappings | SdrStageMappings | undefined
}

export interface FieldMappings {
  revenue_field_id?: string
  entry_field_id?: string
  mrr_field_id?: string
  plan_field_id?: string
  discount_field_id?: string
  origin_field_id?: string
  [key: string]: string | undefined
}

export interface DashboardConfig {
  overview_kpis?: string[]
  sdr_blocks?: string[]
  closer_blocks?: string[]
  block_order?: Record<string, string[]>
  default_ranking_metric_closer?: string
  default_ranking_metric_sdr?: string
}

export type DealStatus = 'open' | 'won' | 'lost'

export interface CachedDeal {
  id: string
  piperun_deal_id: number
  pipeline_id: number
  stage_id: number | null
  user_id: number | null
  status: DealStatus | null
  value: number | null
  title: string | null
  origin_id: number | null
  lost_reason_id: number | null
  person_id: number | null
  company_id: number | null
  custom_fields: Record<string, unknown>
  item_id: number | null
  piperun_created_at: string | null
  piperun_updated_at: string | null
  last_stage_updated_at: string | null
  raw_data: Record<string, unknown> | null
  synced_at: string
}

export interface CachedActivity {
  id: string
  piperun_activity_id: number
  deal_id: number | null
  user_id: number | null
  activity_type_id: number | null
  status: string | null
  title: string | null
  piperun_created_at: string | null
  piperun_updated_at: string | null
  synced_at: string
}

export type SyncType = 'full' | 'incremental' | 'error'
export type SyncStatus = 'success' | 'error' | 'running'

export interface SyncLogEntry {
  id: string
  synced_at: string
  sync_type: SyncType
  deals_synced: number
  activities_synced: number
  status: SyncStatus
  error_message: string | null
  duration_ms: number | null
}

export interface RankingSnapshot {
  id: string
  snapshot_at: string
  period_month: number
  period_year: number
  role_type: 'closer' | 'sdr'
  metric: string
  ranking_data: RankingEntry[]
}

export interface RankingEntry {
  piperun_user_id: number
  value: number
  deals_count?: number
  previous_position?: number
}

export type NotificationType = 'goal_reached' | 'ranking_change' | 'gap_alert' | 'high_value_deal' | 'sync_error'

export interface Notification {
  id: string
  user_id: string | null
  type: NotificationType
  title: string
  message: string
  read: boolean
  data: Record<string, unknown>
  created_at: string
}

export interface PiperunStage {
  piperun_stage_id: number
  pipeline_id: number
  name: string
  position: number | null
  synced_at: string
}

export interface PiperunOrigin {
  piperun_origin_id: number
  name: string
  synced_at: string
}

export interface PiperunLostReason {
  piperun_reason_id: number
  name: string
  synced_at: string
}

export interface PiperunActivityType {
  piperun_type_id: number
  name: string
  synced_at: string
}
