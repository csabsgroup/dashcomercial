import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/services/supabase'
import { testPiperunConnection, callPiperunProxy, triggerSync } from '@/services/piperunProxy'
import {
  CheckCircle, ChevronRight, ChevronLeft, Plug, GitBranch, Settings2,
  Rocket, Target, RefreshCw, Loader2
} from 'lucide-react'

interface Pipeline {
  id: number
  name: string
}

interface Stage {
  id: number
  name: string
  pipeline_id: number
}

const steps = [
  { label: 'Conexão', icon: Plug },
  { label: 'Funis', icon: GitBranch },
  { label: 'Etapas', icon: GitBranch },
  { label: 'Campos', icon: Settings2 },
  { label: 'Metas', icon: Target },
  { label: 'Sincronizar', icon: RefreshCw },
  { label: 'Finalizar', icon: Rocket },
]

const STAGE_MAPPINGS_KEYS = [
  { key: 'qualification_stage_id', label: 'Qualificação' },
  { key: 'meeting_scheduled_stage_id', label: 'Reunião Agendada' },
  { key: 'meeting_done_stage_id', label: 'Reunião Realizada' },
  { key: 'proposal_stage_id', label: 'Proposta Enviada' },
  { key: 'negotiation_stage_id', label: 'Negociação' },
]

export default function Setup() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)

  // Step 0 - Token
  const [token, setToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [accountInfo, setAccountInfo] = useState<{ name: string; email: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Step 1 - Pipelines (from API)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loadingPipelines, setLoadingPipelines] = useState(false)
  const [closerPipelineId, setCloserPipelineId] = useState('')
  const [sdrPipelineId, setSdrPipelineId] = useState('')

  // Step 2 - Stage mappings
  const [stages, setStages] = useState<Stage[]>([])
  const [loadingStages, setLoadingStages] = useState(false)
  const [stageMappings, setStageMappings] = useState<Record<string, string>>({})

  // Step 3 - Custom fields
  const [revenueFieldId, setRevenueFieldId] = useState('')
  const [entryFieldId, setEntryFieldId] = useState('')

  // Step 4 - Initial goals
  const [annualGoal, setAnnualGoal] = useState('')
  const [monthlyGoal, setMonthlyGoal] = useState('')

  // Step 5 - Sync
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)

  const [saving, setSaving] = useState(false)

  // Fetch pipelines when entering step 1
  useEffect(() => {
    if (currentStep === 1 && connected && pipelines.length === 0) {
      fetchPipelines()
    }
  }, [currentStep, connected])

  // Fetch stages when entering step 2
  useEffect(() => {
    if (currentStep === 2 && closerPipelineId) {
      fetchStages()
    }
  }, [currentStep, closerPipelineId])

  const fetchPipelines = async () => {
    setLoadingPipelines(true)
    try {
      const res = await callPiperunProxy<Pipeline>({
        endpoint: '/pipelines',
        params: { show: '20' },
      })
      if (res.success && res.data) {
        setPipelines(res.data)
      }
    } catch {
      setError('Erro ao buscar funis')
    }
    setLoadingPipelines(false)
  }

  const fetchStages = async () => {
    setLoadingStages(true)
    try {
      const res = await callPiperunProxy<Stage>({
        endpoint: '/stages',
        params: { pipeline_id: closerPipelineId },
      })
      if (res.success && res.data) {
        setStages(res.data)
      }
    } catch {
      setError('Erro ao buscar etapas')
    }
    setLoadingStages(false)
  }

  const handleTestToken = async () => {
    setTesting(true)
    setError(null)
    try {
      const result = await testPiperunConnection(token)
      if (result.success) {
        setConnected(true)
        setAccountInfo({
          name: result.data?.account_name || '',
          email: result.data?.user_email || '',
        })
      } else {
        setError(result.error || 'Token inválido')
      }
    } catch {
      setError('Erro de rede')
    } finally {
      setTesting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      await saveConfig()
      const result = await triggerSync()
      setSyncResult({
        success: result.success,
        message: result.success ? 'Sincronização concluída com sucesso!' : (result.error || 'Erro na sincronização'),
      })
    } catch {
      setSyncResult({ success: false, message: 'Erro ao iniciar sincronização' })
    }
    setSyncing(false)
  }

  const saveConfig = async () => {
    const { data: existing } = await supabase
      .from('piperun_config')
      .select('id')
      .limit(1)
      .single()

    const configId = existing?.id || crypto.randomUUID()

    const stageMappingsClean: Record<string, number> = {}
    for (const [key, val] of Object.entries(stageMappings)) {
      if (val) stageMappingsClean[key] = Number(val)
    }

    const configData = {
      id: configId,
      api_token_encrypted: token,
      account_name: accountInfo?.name || '',
      token_user_email: accountInfo?.email || '',
      closer_pipeline_id: closerPipelineId ? Number(closerPipelineId) : null,
      sdr_pipeline_id: sdrPipelineId ? Number(sdrPipelineId) : null,
      stage_mappings: stageMappingsClean,
      field_mappings: {
        revenue_field_id: revenueFieldId || undefined,
        entry_field_id: entryFieldId || undefined,
      },
      is_configured: true,
      updated_at: new Date().toISOString(),
    }

    const { error: err } = await supabase.from('piperun_config').upsert(configData, { onConflict: 'id' })
    if (err) throw err
  }

  const handleFinish = async () => {
    setSaving(true)
    setError(null)

    try {
      await saveConfig()

      if (annualGoal || monthlyGoal) {
        const currentYear = new Date().getFullYear()
        const goalsToInsert = []

        if (annualGoal) {
          goalsToInsert.push({
            year: currentYear,
            period_type: 'annual',
            period_value: null,
            goal_type: 'revenue',
            target_value: Number(annualGoal),
            user_id: null,
          })
        }

        if (monthlyGoal) {
          for (let month = 1; month <= 12; month++) {
            goalsToInsert.push({
              year: currentYear,
              period_type: 'monthly',
              period_value: month,
              goal_type: 'revenue',
              target_value: Number(monthlyGoal),
              user_id: null,
            })
          }
        }

        if (goalsToInsert.length > 0) {
          await supabase.from('goals').insert(goalsToInsert)
        }
      }

      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  const canAdvance = () => {
    if (currentStep === 0) return connected
    if (currentStep === 1) return closerPipelineId !== ''
    return true
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/LOGO CEO VERMELHO.png.png" alt="Contador CEO" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-display text-text-primary">
            Configuração Inicial
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Configure a integração com o PipeRun em poucos passos
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-between mb-8 px-4 overflow-x-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs
                ${i < currentStep ? 'bg-success text-white' :
                  i === currentStep ? 'bg-primary text-white' :
                  'bg-surface-2 text-text-muted'}`}
              >
                {i < currentStep ? <CheckCircle size={14} /> : <step.icon size={14} />}
              </div>
              <span className={`text-[10px] hidden sm:inline ${i === currentStep ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div className={`w-6 h-px ${i < currentStep ? 'bg-success' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          {/* Step 0: Token */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">Conexão com o PipeRun</h2>
              <p className="text-sm text-text-muted">
                Insira o token da API do PipeRun. Você pode encontrá-lo em Configurações → Integrações no PipeRun.
              </p>
              <Input
                label="Token da API"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Cole o token aqui"
              />
              {connected && accountInfo && (
                <div className="bg-success/10 border border-success/30 rounded-xl p-3 text-sm text-success flex items-center gap-2">
                  <CheckCircle size={16} />
                  Conectado! Conta: {accountInfo.name}
                </div>
              )}
              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}
              <Button onClick={handleTestToken} loading={testing} variant="secondary">
                Testar Conexão
              </Button>
            </div>
          )}

          {/* Step 1: Pipelines dropdown */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">Funis (Pipelines)</h2>
              <p className="text-sm text-text-muted">
                Selecione os funis do PipeRun que correspondem ao processo de vendas.
              </p>

              {loadingPipelines ? (
                <div className="flex items-center gap-2 text-sm text-text-muted py-4">
                  <Loader2 size={16} className="animate-spin" />
                  Carregando funis...
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Funil Closer (principal) *
                    </label>
                    <select
                      value={closerPipelineId}
                      onChange={(e) => setCloserPipelineId(e.target.value)}
                      className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    >
                      <option value="">Selecione o funil</option>
                      {pipelines.map(p => (
                        <option key={p.id} value={String(p.id)}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Funil SDR (opcional)
                    </label>
                    <select
                      value={sdrPipelineId}
                      onChange={(e) => setSdrPipelineId(e.target.value)}
                      className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    >
                      <option value="">Selecione o funil</option>
                      {pipelines.map(p => (
                        <option key={p.id} value={String(p.id)}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {pipelines.length === 0 && (
                    <p className="text-sm text-warning">
                      Nenhum funil encontrado. Verifique as permissões do token.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 2: Stage Mapping */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">Mapeamento de Etapas</h2>
              <p className="text-sm text-text-muted">
                Relacione as etapas do seu funil com as etapas do dashboard.
              </p>

              {loadingStages ? (
                <div className="flex items-center gap-2 text-sm text-text-muted py-4">
                  <Loader2 size={16} className="animate-spin" />
                  Carregando etapas...
                </div>
              ) : (
                <div className="space-y-3">
                  {STAGE_MAPPINGS_KEYS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        {label}
                      </label>
                      <select
                        value={stageMappings[key] || ''}
                        onChange={(e) => setStageMappings(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      >
                        <option value="">Selecione a etapa</option>
                        {stages.map(s => (
                          <option key={s.id} value={String(s.id)}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {stages.length === 0 && (
                    <p className="text-sm text-warning">
                      Nenhuma etapa encontrada para o funil selecionado.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Custom Fields */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">Campos Customizados</h2>
              <p className="text-sm text-text-muted">
                IDs dos campos customizados do PipeRun para calcular métricas de faturamento.
              </p>
              <Input
                label="ID do campo de Faturamento (opcional)"
                type="text"
                value={revenueFieldId}
                onChange={(e) => setRevenueFieldId(e.target.value)}
                placeholder="Ex: custom_123"
              />
              <Input
                label="ID do campo de Entrada (opcional)"
                type="text"
                value={entryFieldId}
                onChange={(e) => setEntryFieldId(e.target.value)}
                placeholder="Ex: custom_456"
              />
            </div>
          )}

          {/* Step 4: Initial Goals */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">Metas Iniciais</h2>
              <p className="text-sm text-text-muted">
                Defina as metas de receita para {new Date().getFullYear()}. Você pode ajustar depois.
              </p>
              <Input
                label="Meta anual de receita (R$)"
                type="number"
                value={annualGoal}
                onChange={(e) => {
                  setAnnualGoal(e.target.value)
                  if (e.target.value) {
                    setMonthlyGoal(String(Math.round(Number(e.target.value) / 12)))
                  }
                }}
                placeholder="Ex: 2000000"
              />
              <Input
                label="Meta mensal de receita (R$)"
                type="number"
                value={monthlyGoal}
                onChange={(e) => setMonthlyGoal(e.target.value)}
                placeholder="Calculado automaticamente"
              />
              {annualGoal && (
                <p className="text-xs text-text-muted">
                  Meta mensal sugerida: R$ {Number(Number(annualGoal) / 12).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </p>
              )}
            </div>
          )}

          {/* Step 5: Sync */}
          {currentStep === 5 && (
            <div className="space-y-4 text-center">
              <RefreshCw size={48} className={`text-primary mx-auto ${syncing ? 'animate-spin' : ''}`} />
              <h2 className="text-lg font-semibold text-text-primary">Primeira Sincronização</h2>
              <p className="text-sm text-text-muted">
                Vamos importar os dados do PipeRun para o dashboard. Isso pode levar alguns minutos.
              </p>

              {!syncResult && !syncing && (
                <Button onClick={handleSync} className="mx-auto">
                  <RefreshCw size={16} /> Iniciar Sincronização
                </Button>
              )}

              {syncing && (
                <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
                  <Loader2 size={16} className="animate-spin" />
                  Sincronizando dados...
                </div>
              )}

              {syncResult && (
                <div className={`rounded-xl p-3 text-sm flex items-center gap-2 justify-center
                  ${syncResult.success
                    ? 'bg-success/10 border border-success/30 text-success'
                    : 'bg-danger/10 border border-danger/30 text-danger'
                  }`}>
                  {syncResult.success ? <CheckCircle size={16} /> : null}
                  {syncResult.message}
                </div>
              )}
            </div>
          )}

          {/* Step 6: Finish */}
          {currentStep === 6 && (
            <div className="text-center py-4 space-y-4">
              <Rocket size={48} className="text-gold mx-auto" />
              <h2 className="text-lg font-semibold text-text-primary">Tudo pronto!</h2>
              <p className="text-sm text-text-muted">
                A configuração será salva e você será redirecionado para o dashboard.
              </p>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep((s) => s - 1)}
              disabled={currentStep === 0}
            >
              <ChevronLeft size={16} /> Voltar
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={!canAdvance()}>
                Próximo <ChevronRight size={16} />
              </Button>
            ) : (
              <Button onClick={handleFinish} loading={saving}>
                Finalizar <Rocket size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
