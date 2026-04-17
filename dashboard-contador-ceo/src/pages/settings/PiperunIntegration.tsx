import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/services/supabase'
import {
  Plug, CheckCircle, XCircle, RefreshCw, Save, Check,
  Database, Clock, ChevronDown, ChevronRight, GitBranch,
  Layers, Settings2, Zap,
} from 'lucide-react'
import { triggerSync, testPiperunConnection } from '@/services/piperunProxy'
import { useSyncStatus } from '@/context/SyncContext'
import { formatDateTime } from '@/utils/formatters'
import { usePiperunPipelines } from '@/hooks/usePiperunPipelines'
import { usePiperunStages } from '@/hooks/usePiperunStages'
import { useCustomFields } from '@/hooks/useCustomFields'
import type { PiperunConfig, FieldMappings, CloserStageMappings, SdrStageMappings } from '@/types/database'
import { MOCK_ENABLED } from '@/mocks/mockData'

// ─── Collapsible Section ────────────────────────────────
function Section({
  title,
  icon: Icon,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string
  icon: React.ElementType
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Re-open when defaultOpen changes to true (e.g. after token save)
  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-surface-2/50 transition-colors cursor-pointer"
      >
        <Icon size={20} className="text-primary shrink-0" />
        <h2 className="text-lg font-semibold text-text-primary flex-1">{title}</h2>
        {badge}
        {open ? <ChevronDown size={18} className="text-text-muted" /> : <ChevronRight size={18} className="text-text-muted" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-border/50 pt-4">{children}</div>}
    </div>
  )
}

// ─── Stage dropdown row ─────────────────────────────────
function StageRow({
  label,
  value,
  stages,
  onChange,
}: {
  label: string
  value: number | undefined
  stages: { id: number; name: string }[]
  onChange: (v: number | undefined) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-text-primary w-48 shrink-0">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
      >
        <option value="">— Selecione —</option>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Field dropdown row ─────────────────────────────────
function FieldRow({
  label,
  value,
  fields,
  loading,
  onChange,
}: {
  label: string
  value: string | undefined
  fields: { id: number; key: string; name: string; label: string; type: string; form_name?: string }[]
  loading: boolean
  onChange: (v: string | undefined) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-text-primary w-48 shrink-0">{label}</span>
      {loading ? (
        <div className="flex-1 h-10 rounded-xl bg-surface-2 animate-pulse" />
      ) : fields.length > 0 ? (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        >
          <option value="">— Nenhum —</option>
          {fields.map((f) => (
            <option key={f.id} value={f.key}>
              {f.form_name ? `${f.form_name} → ` : ''}{f.label || f.name} ({f.type})
            </option>
          ))}
        </select>
      ) : (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="ID do campo (ex: custom_123)"
          className="flex-1"
        />
      )}
    </div>
  )
}

// ─── Save button component ──────────────────────────────
function SaveButton({
  saving,
  saved,
  onClick,
  label = 'Salvar',
}: {
  saving: boolean
  saved: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <Button onClick={onClick} disabled={saving} variant="primary" size="sm">
      {saved ? <Check size={14} /> : <Save size={14} />}
      {saving ? 'Salvando...' : saved ? 'Salvo!' : label}
    </Button>
  )
}

// ─── Closer stage mapping keys ──────────────────────────
const CLOSER_STAGE_KEYS: { key: keyof CloserStageMappings; label: string }[] = [
  { key: 'qualification_stage_id', label: 'Qualificação' },
  { key: 'meeting_scheduled_stage_id', label: 'Reunião Agendada' },
  { key: 'meeting_done_stage_id', label: 'Reunião Realizada' },
  { key: 'proposal_stage_id', label: 'Proposta Enviada' },
  { key: 'negotiation_stage_id', label: 'Negociação' },
]

const SDR_STAGE_KEYS: { key: keyof SdrStageMappings; label: string }[] = [
  { key: 'new_lead_stage_id', label: 'Novo Lead' },
  { key: 'contacted_stage_id', label: 'Contato Feito' },
  { key: 'qualified_stage_id', label: 'Qualificado' },
  { key: 'scheduled_stage_id', label: 'Agendado' },
  { key: 'meeting_done_stage_id', label: 'Reunião Realizada' },
  { key: 'passed_to_closer_stage_id', label: 'Passado para Closer' },
]

const CLOSER_FIELD_KEYS: { key: keyof FieldMappings; label: string }[] = [
  { key: 'revenue_field_id', label: 'Faturamento / Receita' },
  { key: 'entry_field_id', label: 'Entrada / 1º Pagamento' },
  { key: 'mrr_field_id', label: 'MRR (Receita Recorrente)' },
  { key: 'plan_field_id', label: 'Plano / Produto' },
  { key: 'discount_field_id', label: 'Desconto' },
  { key: 'origin_field_id', label: 'Origem' },
]

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════
export default function PiperunIntegration() {
  // ─── Core state ─────────────────────────────────────────
  const [config, setConfig] = useState<PiperunConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)

  // ─── Section 1: Connection ──────────────────────────────
  const [token, setToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; accountName?: string; email?: string } | null>(null)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenSaved, setTokenSaved] = useState(false)

  // ─── Section 2: Pipelines ───────────────────────────────
  const { pipelines, loading: pipelinesLoading, fetch: fetchPipelines } = usePiperunPipelines()
  const [closerPipelineId, setCloserPipelineId] = useState<number | null>(null)
  const [sdrPipelineId, setSdrPipelineId] = useState<number | null>(null)
  const [savingPipelines, setSavingPipelines] = useState(false)
  const [pipelinesSaved, setPipelinesSaved] = useState(false)

  // ─── Section 3: Closer Stages ───────────────────────────
  const { stages: closerStagesApi, loading: closerStagesLoading, fetch: fetchCloserStages } = usePiperunStages()
  const [closerStageMappings, setCloserStageMappings] = useState<CloserStageMappings>({})
  const [savingCloserStages, setSavingCloserStages] = useState(false)
  const [closerStagesSaved, setCloserStagesSaved] = useState(false)

  // ─── Section 4: SDR Stages ──────────────────────────────
  const { stages: sdrStagesApi, loading: sdrStagesLoading, fetch: fetchSdrStages } = usePiperunStages()
  const [sdrStageMappings, setSdrStageMappings] = useState<SdrStageMappings>({})
  const [savingSdrStages, setSavingSdrStages] = useState(false)
  const [sdrStagesSaved, setSdrStagesSaved] = useState(false)

  // ─── Section 5: Custom Fields ───────────────────────────
  const { fields: customFields, loading: fieldsLoading, fetch: fetchCustomFields } = useCustomFields()
  const [fieldMappings, setFieldMappings] = useState<FieldMappings>({})
  const [savingFields, setSavingFields] = useState(false)
  const [fieldsSaved, setFieldsSaved] = useState(false)

  // ─── Section 6: Sync ───────────────────────────────────
  const [syncing, setSyncing] = useState(false)
  const { status, lastSyncAt } = useSyncStatus()
  const [syncStats, setSyncStats] = useState({ totalDeals: 0, totalActivities: 0 })
  const [syncInterval, setSyncInterval] = useState(5)

  // ─── Load config on mount ───────────────────────────────
  useEffect(() => {
    async function load() {
      setConfigLoading(true)
      const { data } = await supabase.from('piperun_config').select('*').single()
      if (data) {
        const c = data as PiperunConfig
        setConfig(c)
        setCloserPipelineId(c.closer_pipeline_id)
        setSdrPipelineId(c.sdr_pipeline_id)
        setSyncInterval(c.sync_interval_minutes || 5)
        setFieldMappings(c.field_mappings || {})

        // Load stage mappings — support both new structured and legacy flat format
        const sm = c.stage_mappings || {}
        if (sm.closer) {
          setCloserStageMappings(sm.closer)
        } else {
          // Legacy flat format
          setCloserStageMappings({
            qualification_stage_id: sm.qualification_stage_id as number | undefined,
            meeting_scheduled_stage_id: sm.meeting_scheduled_stage_id as number | undefined,
            meeting_done_stage_id: sm.meeting_done_stage_id as number | undefined,
            proposal_stage_id: sm.proposal_stage_id as number | undefined,
            negotiation_stage_id: sm.negotiation_stage_id as number | undefined,
          })
        }
        if (sm.sdr) {
          setSdrStageMappings(sm.sdr)
        }
      }
      setConfigLoading(false)

      // Load sync stats
      const [dealsRes, activitiesRes] = await Promise.all([
        supabase.from('piperun_deals_cache').select('id', { count: 'exact', head: true }),
        supabase.from('piperun_activities_cache').select('id', { count: 'exact', head: true }),
      ])
      setSyncStats({
        totalDeals: dealsRes.count || 0,
        totalActivities: activitiesRes.count || 0,
      })
    }
    if (!MOCK_ENABLED) {
      load()
    } else {
      setConfigLoading(false)
    }
  }, [])

  // ─── Helper: update config in DB ────────────────────────
  const updateConfig = useCallback(async (updates: Partial<PiperunConfig>) => {
    if (!config) {
      // First time — insert
      const { data, error } = await supabase.from('piperun_config').insert({ ...updates }).select().single()
      if (error) {
        console.error('Erro ao inserir config:', error)
        alert(`Erro ao salvar: ${error.message}`)
        return null
      }
      if (data) setConfig(data as PiperunConfig)
      return data
    }
    const { data, error } = await supabase.from('piperun_config').update(updates).eq('id', config.id).select().single()
    if (error) {
      console.error('Erro ao atualizar config:', error)
      alert(`Erro ao salvar: ${error.message}`)
      return null
    }
    if (data) setConfig(data as PiperunConfig)
    return data
  }, [config])

  // ═══════════════════════════════════════════════════════
  // Section 1: Connection handlers
  // ═══════════════════════════════════════════════════════
  const handleTestConnection = async () => {
    if (!token && !config?.api_token_encrypted) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testPiperunConnection(token || config?.api_token_encrypted || '')
      if (result.success && result.data) {
        setTestResult({
          success: true,
          message: 'Conexão bem sucedida!',
          accountName: result.data.account_name,
          email: result.data.user_email,
        })
      } else {
        setTestResult({ success: false, message: result.error || 'Falha ao conectar' })
      }
    } catch {
      setTestResult({ success: false, message: 'Erro de rede ao testar conexão' })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveToken = async () => {
    if (!token && !testResult?.success) return
    setSavingToken(true)
    try {
      await updateConfig({
        api_token_encrypted: token || config?.api_token_encrypted || '',
        account_name: testResult?.accountName || config?.account_name || null,
        token_user_email: testResult?.email || config?.token_user_email || null,
        is_configured: true,
      } as Partial<PiperunConfig>)
      setTokenSaved(true)
      setTimeout(() => setTokenSaved(false), 3000)
    } finally {
      setSavingToken(false)
    }
  }

  // ═══════════════════════════════════════════════════════
  // Section 2: Pipelines handlers
  // ═══════════════════════════════════════════════════════
  const handleLoadPipelines = () => {
    fetchPipelines(token || undefined)
  }

  const handleSavePipelines = async () => {
    setSavingPipelines(true)
    try {
      const closerPipeline = pipelines.find((p) => p.id === closerPipelineId)
      const sdrPipeline = pipelines.find((p) => p.id === sdrPipelineId)
      await updateConfig({
        closer_pipeline_id: closerPipelineId,
        closer_pipeline_name: closerPipeline?.name || null,
        sdr_pipeline_id: sdrPipelineId,
        sdr_pipeline_name: sdrPipeline?.name || null,
      } as Partial<PiperunConfig>)
      setPipelinesSaved(true)
      setTimeout(() => setPipelinesSaved(false), 3000)

      // Auto-fetch stages for selected pipelines
      if (closerPipelineId) fetchCloserStages(closerPipelineId, token || undefined)
      if (sdrPipelineId) fetchSdrStages(sdrPipelineId, token || undefined)
    } finally {
      setSavingPipelines(false)
    }
  }

  // ═══════════════════════════════════════════════════════
  // Section 3 & 4: Stages handlers
  // ═══════════════════════════════════════════════════════
  const handleSaveCloserStages = async () => {
    setSavingCloserStages(true)
    try {
      const currentMappings = config?.stage_mappings || {}
      await updateConfig({
        stage_mappings: {
          ...currentMappings,
          closer: closerStageMappings,
          // Keep legacy flat fields in sync for backward compat
          qualification_stage_id: closerStageMappings.qualification_stage_id,
          meeting_scheduled_stage_id: closerStageMappings.meeting_scheduled_stage_id,
          meeting_done_stage_id: closerStageMappings.meeting_done_stage_id,
          proposal_stage_id: closerStageMappings.proposal_stage_id,
          negotiation_stage_id: closerStageMappings.negotiation_stage_id,
        },
      } as Partial<PiperunConfig>)
      setCloserStagesSaved(true)
      setTimeout(() => setCloserStagesSaved(false), 3000)
    } finally {
      setSavingCloserStages(false)
    }
  }

  const handleSaveSdrStages = async () => {
    setSavingSdrStages(true)
    try {
      const currentMappings = config?.stage_mappings || {}
      await updateConfig({
        stage_mappings: {
          ...currentMappings,
          sdr: sdrStageMappings,
        },
      } as Partial<PiperunConfig>)
      setSdrStagesSaved(true)
      setTimeout(() => setSdrStagesSaved(false), 3000)
    } finally {
      setSavingSdrStages(false)
    }
  }

  // ═══════════════════════════════════════════════════════
  // Section 5: Fields handlers
  // ═══════════════════════════════════════════════════════
  const handleLoadFields = () => {
    fetchCustomFields(token || undefined)
  }

  const handleSaveFields = async () => {
    setSavingFields(true)
    try {
      await updateConfig({ field_mappings: fieldMappings } as Partial<PiperunConfig>)
      setFieldsSaved(true)
      setTimeout(() => setFieldsSaved(false), 3000)
    } finally {
      setSavingFields(false)
    }
  }

  // ═══════════════════════════════════════════════════════
  // Section 6: Sync handlers
  // ═══════════════════════════════════════════════════════
  const handleForceSync = async () => {
    setSyncing(true)
    try {
      await triggerSync()
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveSyncInterval = async (newInterval: number) => {
    setSyncInterval(newInterval)
    if (config) {
      await updateConfig({ sync_interval_minutes: newInterval } as Partial<PiperunConfig>)
    }
  }

  // Auto-fetch stages when pipelines are set (from DB on load)
  useEffect(() => {
    if (config && closerPipelineId && closerStagesApi.length === 0 && !closerStagesLoading) {
      fetchCloserStages(closerPipelineId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, closerPipelineId])

  useEffect(() => {
    if (config && sdrPipelineId && sdrStagesApi.length === 0 && !sdrStagesLoading) {
      fetchSdrStages(sdrPipelineId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, sdrPipelineId])

  // ═══════════════════════════════════════════════════════
  // Computed values
  // ═══════════════════════════════════════════════════════
  const isConnected = !!config?.api_token_encrypted && config.api_token_encrypted !== ''
  const nextSyncAt = lastSyncAt
    ? new Date(new Date(lastSyncAt).getTime() + syncInterval * 60 * 1000)
    : null

  if (configLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface rounded-2xl border border-border p-6 animate-pulse">
            <div className="h-6 bg-surface-2 rounded w-48" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ════════════════════════════════════════════════════ */}
      {/* Section 1: Conexão */}
      {/* ════════════════════════════════════════════════════ */}
      <Section
        title="Conexão"
        icon={Plug}
        defaultOpen={!isConnected}
        badge={
          isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
              <CheckCircle size={12} /> Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger/10 text-danger">
              <XCircle size={12} /> Desconectado
            </span>
          )
        }
      >
        <div className="space-y-4">
          <Input
            label="Token da API PipeRun"
            type="password"
            placeholder="Cole o token da API aqui"
            value={token}
            onChange={(e) => { setToken(e.target.value); setTestResult(null) }}
          />

          {isConnected && !token && (
            <p className="text-xs text-text-muted">
              Conta: <strong>{config?.account_name}</strong> | E-mail: <strong>{config?.token_user_email}</strong>
            </p>
          )}

          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-success' : 'text-danger'}`}>
              {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span>{testResult.message}</span>
              {testResult.accountName && (
                <span className="text-text-muted ml-2">
                  ({testResult.accountName} • {testResult.email})
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleTestConnection} loading={testing} variant="secondary" size="sm" disabled={!token && !isConnected}>
              Testar Conexão
            </Button>
            {(testResult?.success || (token && isConnected)) && (
              <SaveButton saving={savingToken} saved={tokenSaved} onClick={handleSaveToken} label="Salvar Token" />
            )}
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════ */}
      {/* Section 2: Pipelines */}
      {/* ════════════════════════════════════════════════════ */}
      <Section
        title="Funis (Pipelines)"
        icon={GitBranch}
        defaultOpen={isConnected && !closerPipelineId}
        badge={
          closerPipelineId ? (
            <span className="text-xs text-text-muted">
              {config?.closer_pipeline_name || `#${closerPipelineId}`}
              {sdrPipelineId ? ` + ${config?.sdr_pipeline_name || `#${sdrPipelineId}`}` : ''}
            </span>
          ) : null
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            Selecione os funis do PipeRun que alimentam o dashboard.
          </p>

          {pipelines.length === 0 && (
            <Button onClick={handleLoadPipelines} loading={pipelinesLoading} variant="secondary" size="sm" disabled={!isConnected}>
              Carregar Funis do PipeRun
            </Button>
          )}

          {pipelines.length > 0 && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-text-muted mb-1.5 block">Funil Closer (obrigatório)</label>
                <select
                  value={closerPipelineId || ''}
                  onChange={(e) => setCloserPipelineId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                >
                  <option value="">— Selecione —</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted mb-1.5 block">Funil SDR (opcional)</label>
                <select
                  value={sdrPipelineId || ''}
                  onChange={(e) => setSdrPipelineId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                >
                  <option value="">— Nenhum —</option>
                  {pipelines.filter((p) => p.id !== closerPipelineId).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <SaveButton saving={savingPipelines} saved={pipelinesSaved} onClick={handleSavePipelines} label="Salvar Funis" />
            </div>
          )}

          {/* Show current config if pipelines not loaded */}
          {pipelines.length === 0 && (closerPipelineId || sdrPipelineId) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="bg-surface-2 rounded-xl p-3">
                <p className="text-xs text-text-muted mb-0.5">Funil Closer</p>
                <p className="text-sm font-medium text-text-primary">{config?.closer_pipeline_name || 'Não configurado'}</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3">
                <p className="text-xs text-text-muted mb-0.5">Funil SDR</p>
                <p className="text-sm font-medium text-text-primary">{config?.sdr_pipeline_name || 'Não configurado'}</p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════ */}
      {/* Section 3: Closer Stages */}
      {/* ════════════════════════════════════════════════════ */}
      {closerPipelineId && (
        <Section title="Etapas — Closer" icon={Layers} defaultOpen={false}>
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Associe cada categoria do dashboard a uma etapa do funil Closer.
            </p>

            {closerStagesApi.length === 0 && !closerStagesLoading && (
              <Button onClick={() => fetchCloserStages(closerPipelineId, token || undefined)} variant="secondary" size="sm">
                Carregar Etapas
              </Button>
            )}

            {closerStagesLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-surface-2 rounded-xl animate-pulse" />)}
              </div>
            )}

            {closerStagesApi.length > 0 && (
              <>
                <div className="space-y-2">
                  {CLOSER_STAGE_KEYS.map(({ key, label }) => (
                    <StageRow
                      key={key}
                      label={label}
                      value={closerStageMappings[key]}
                      stages={closerStagesApi}
                      onChange={(v) => setCloserStageMappings((prev) => ({ ...prev, [key]: v }))}
                    />
                  ))}
                </div>
                <SaveButton saving={savingCloserStages} saved={closerStagesSaved} onClick={handleSaveCloserStages} label="Salvar Etapas Closer" />
              </>
            )}
          </div>
        </Section>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* Section 4: SDR Stages */}
      {/* ════════════════════════════════════════════════════ */}
      {sdrPipelineId && (
        <Section title="Etapas — SDR" icon={Layers} defaultOpen={false}>
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Associe cada categoria do dashboard a uma etapa do funil SDR.
            </p>

            {sdrStagesApi.length === 0 && !sdrStagesLoading && (
              <Button onClick={() => fetchSdrStages(sdrPipelineId, token || undefined)} variant="secondary" size="sm">
                Carregar Etapas
              </Button>
            )}

            {sdrStagesLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-surface-2 rounded-xl animate-pulse" />)}
              </div>
            )}

            {sdrStagesApi.length > 0 && (
              <>
                <div className="space-y-2">
                  {SDR_STAGE_KEYS.map(({ key, label }) => (
                    <StageRow
                      key={key}
                      label={label}
                      value={sdrStageMappings[key]}
                      stages={sdrStagesApi}
                      onChange={(v) => setSdrStageMappings((prev) => ({ ...prev, [key]: v }))}
                    />
                  ))}
                </div>
                <SaveButton saving={savingSdrStages} saved={sdrStagesSaved} onClick={handleSaveSdrStages} label="Salvar Etapas SDR" />
              </>
            )}
          </div>
        </Section>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* Section 5: Custom Fields */}
      {/* ════════════════════════════════════════════════════ */}
      <Section title="Campos Customizados" icon={Settings2} defaultOpen={false}>
        <div className="space-y-5">
          {customFields.length === 0 && !fieldsLoading && (
            <Button onClick={handleLoadFields} variant="secondary" size="sm" disabled={!isConnected}>
              Carregar Campos do PipeRun
            </Button>
          )}

          {fieldsLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-surface-2 rounded-xl animate-pulse" />)}
            </div>
          )}

          {/* Closer fields */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Closer</h3>
            <p className="text-xs text-text-muted mb-3">
              Mapeie os campos customizados do PipeRun que alimentam os indicadores de Closer.
            </p>
            <div className="space-y-2">
              {CLOSER_FIELD_KEYS.map(({ key, label }) => (
                <FieldRow
                  key={key}
                  label={label}
                  value={fieldMappings[key]}
                  fields={customFields}
                  loading={fieldsLoading}
                  onChange={(v) => setFieldMappings((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
            </div>
          </div>

          {/* SDR fields placeholder */}
          {sdrPipelineId && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">SDR</h3>
              <p className="text-xs text-text-muted">
                Os indicadores SDR são calculados automaticamente com base em atividades e etapas. Campos customizados SDR serão adicionados em breve.
              </p>
            </div>
          )}

          <SaveButton saving={savingFields} saved={fieldsSaved} onClick={handleSaveFields} label="Salvar Campos" />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════ */}
      {/* Section 6: Sync (always open) */}
      {/* ════════════════════════════════════════════════════ */}
      <Section title="Sincronização" icon={Zap} defaultOpen={true}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-text-muted mb-1">Status</p>
              <p className={`text-sm font-medium ${status === 'success' ? 'text-success' : status === 'error' ? 'text-danger' : 'text-text-muted'}`}>
                {status === 'success' ? 'Sucesso' : status === 'error' ? 'Erro' : status === 'running' ? 'Em andamento...' : 'Aguardando'}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Última Sincronização</p>
              <p className="text-sm text-text-primary">{lastSyncAt ? formatDateTime(lastSyncAt) : 'Nunca'}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Próxima Sincronização</p>
              <p className="text-sm text-text-primary">{nextSyncAt ? formatDateTime(nextSyncAt.toISOString()) : 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-2 rounded-xl p-3 flex items-center gap-2">
              <Database size={14} className="text-text-faint" />
              <div>
                <p className="text-xs text-text-muted">Deals</p>
                <p className="text-sm font-medium text-text-primary">{syncStats.totalDeals.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="bg-surface-2 rounded-xl p-3 flex items-center gap-2">
              <Database size={14} className="text-text-faint" />
              <div>
                <p className="text-xs text-text-muted">Atividades</p>
                <p className="text-sm font-medium text-text-primary">{syncStats.totalActivities.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={handleForceSync} loading={syncing} variant="secondary" size="sm" disabled={!isConnected}>
              <RefreshCw size={14} /> Sincronizar Agora
            </Button>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-text-faint" />
              <span className="text-xs text-text-muted">Intervalo:</span>
              <select
                value={syncInterval}
                onChange={(e) => handleSaveSyncInterval(Number(e.target.value))}
                className="bg-surface-2 border border-border rounded-xl px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              >
                <option value={2}>2 min</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
              </select>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
