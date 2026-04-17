// Types from PipeRun API responses

export interface PiperunPipeline {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface PiperunStageAPI {
  id: number
  pipeline_id: number
  name: string
  position: number
  created_at: string
  updated_at: string
}

export interface PiperunDeal {
  id: number
  title: string
  pipeline_id: number
  stage_id: number
  user_id: number
  status: 'open' | 'won' | 'lost'
  value: number | null
  origin_id: number | null
  lost_reason_id: number | null
  person_id: number | null
  company_id: number | null
  created_at: string
  updated_at: string
  last_stage_updated_at?: string
  customForms?: PiperunCustomForm[]
  custom_fields?: Record<string, unknown>
}

export interface PiperunCustomForm {
  id: number
  name: string
  fields: PiperunCustomField[]
}

export interface PiperunCustomField {
  id: number
  key: string
  label: string
  value: string | null
  type: string
}

export interface PiperunActivity {
  id: number
  deal_id: number | null
  user_id: number
  activity_type_id: number
  status: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface PiperunUser {
  id: number
  name: string
  email: string
  role?: string
}

export interface PiperunOriginAPI {
  id: number
  name: string
}

export interface PiperunLostReasonAPI {
  id: number
  name: string
}

export interface PiperunActivityTypeAPI {
  id: number
  name: string
}

export interface PiperunItem {
  id: number
  name: string
  price: number | null
  unit?: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface PiperunAPIResponse<T> {
  data: T[]
  meta?: {
    cursor?: {
      current: string | null
      prev: string | null
      next: string | null
      count: number | null
    }
  }
  success?: boolean
}

export interface PiperunConnectionInfo {
  account_id?: number
  user_email?: string
  user_acl?: string
  api_version?: string
}

// Custom fields discovery from /customFields endpoint
export interface PiperunCustomFieldDefinition {
  id: number
  key: string
  name: string
  label: string
  type: string // text, number, select, date, etc.
  form_id?: number
  form_name?: string
  options?: { id: number; label: string; value: string }[]
}
