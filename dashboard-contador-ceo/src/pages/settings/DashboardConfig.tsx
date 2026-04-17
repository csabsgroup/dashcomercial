import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { Button } from '@/components/ui/Button'
import { LayoutDashboard, Save, Check, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DashboardConfig as DashboardConfigType } from '@/types/database'

const OVERVIEW_KPIS = [
  { id: 'revenue', label: 'Faturamento' },
  { id: 'entry', label: 'Entrada' },
  { id: 'mrr', label: 'MRR Gerado' },
  { id: 'pipeline', label: 'Pipeline Total' },
  { id: 'coverage', label: 'Cobertura de Pipeline' },
  { id: 'forecast', label: 'Previsão do Mês' },
  { id: 'conversion', label: 'Taxa de Conversão' },
  { id: 'winrate', label: 'Win Rate' },
]

const SDR_BLOCKS = [
  { id: 'leads_received', label: 'Leads Recebidos' },
  { id: 'leads_worked', label: 'Leads Trabalhados' },
  { id: 'contact_rate', label: 'Taxa de Contato' },
  { id: 'cadence', label: 'Cadência Média' },
  { id: 'qualification_rate', label: 'Taxa de Qualificação' },
  { id: 'show_rate', label: 'Show Rate' },
  { id: 'sla', label: 'SLA Primeiro Contato' },
  { id: 'funnel_chart', label: 'Gráfico de Funil' },
  { id: 'daily_chart', label: 'Evolução Diária' },
  { id: 'sdr_comparison', label: 'Comparativo por SDR' },
]

const CLOSER_BLOCKS = [
  { id: 'revenue', label: 'Receita Gerada' },
  { id: 'ticket', label: 'Ticket Médio' },
  { id: 'winrate', label: 'Win Rate' },
  { id: 'cycle', label: 'Ciclo de Vendas' },
  { id: 'conversion', label: 'Taxa de Conversão' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'coverage', label: 'Cobertura' },
  { id: 'funnel_chart', label: 'Gráfico de Funil' },
  { id: 'revenue_chart', label: 'Evolução de Receita' },
  { id: 'closer_comparison', label: 'Receita por Closer' },
  { id: 'lost_reasons', label: 'Motivos de Perda' },
]

const RANKING_METRICS_CLOSER = [
  { id: 'revenue', label: 'Receita / Faturamento' },
  { id: 'entry', label: 'Valor de Entrada' },
  { id: 'deals_closed', label: 'Deals Fechados' },
  { id: 'conversion_rate', label: 'Taxa de Conversão' },
]

const RANKING_METRICS_SDR = [
  { id: 'meetings_scheduled', label: 'Reuniões Agendadas' },
  { id: 'leads_qualified', label: 'Leads Qualificados' },
  { id: 'scheduling_rate', label: 'Taxa de Agendamento' },
]

export default function DashboardConfig() {
  const [config, setConfig] = useState<DashboardConfigType>({})
  const [configId, setConfigId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    supabase.from('piperun_config').select('id, dashboard_config').limit(1).single().then(({ data }) => {
      if (data) {
        setConfigId(data.id)
        setConfig((data as { id: string; dashboard_config: DashboardConfigType }).dashboard_config || {})
      }
    })
  }, [])

  const overviewKpis = config.overview_kpis || OVERVIEW_KPIS.map(k => k.id)
  const sdrBlocks = config.sdr_blocks || SDR_BLOCKS.map(b => b.id)
  const closerBlocks = config.closer_blocks || CLOSER_BLOCKS.map(b => b.id)
  const sdrOrder = config.block_order?.sdr || SDR_BLOCKS.map(b => b.id)
  const closerOrder = config.block_order?.closer || CLOSER_BLOCKS.map(b => b.id)
  const defaultCloserMetric = config.default_ranking_metric_closer || 'revenue'
  const defaultSdrMetric = config.default_ranking_metric_sdr || 'meetings_scheduled'

  // Ordered block lists — include any blocks not yet in order at the end
  const orderedSdrBlocks = [...sdrOrder.filter(id => SDR_BLOCKS.some(b => b.id === id)), ...SDR_BLOCKS.filter(b => !sdrOrder.includes(b.id)).map(b => b.id)]
    .map(id => SDR_BLOCKS.find(b => b.id === id)!)
    .filter(Boolean)
  const orderedCloserBlocks = [...closerOrder.filter(id => CLOSER_BLOCKS.some(b => b.id === id)), ...CLOSER_BLOCKS.filter(b => !closerOrder.includes(b.id)).map(b => b.id)]
    .map(id => CLOSER_BLOCKS.find(b => b.id === id)!)
    .filter(Boolean)

  const toggleItem = (list: string[], id: string): string[] => {
    return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
  }

  const handleDragEnd = (section: 'sdr' | 'closer') => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const items = section === 'sdr' ? orderedSdrBlocks.map(b => b.id) : orderedCloserBlocks.map(b => b.id)
    const oldIndex = items.indexOf(active.id as string)
    const newIndex = items.indexOf(over.id as string)
    const newOrder = arrayMove(items, oldIndex, newIndex)

    setConfig(c => ({
      ...c,
      block_order: {
        ...c.block_order,
        [section]: newOrder,
      },
    }))
  }

  const handleSave = async () => {
    if (!configId) return
    setSaving(true)
    try {
      await supabase.from('piperun_config').update({ dashboard_config: config }).eq('id', configId)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Configuração do Dashboard</h2>
        </div>
        <Button onClick={handleSave} disabled={saving} variant="primary" size="sm">
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </Button>
      </div>

      {/* Overview KPIs */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">KPIs da Visão Geral</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {OVERVIEW_KPIS.map(kpi => (
            <label key={kpi.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overviewKpis.includes(kpi.id)}
                onChange={() => setConfig(c => ({ ...c, overview_kpis: toggleItem(overviewKpis, kpi.id) }))}
                className="rounded border-border accent-primary"
              />
              <span className="text-sm text-text-primary">{kpi.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* SDR Blocks */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Blocos da Seção SDR</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd('sdr')}>
          <SortableContext items={orderedSdrBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {orderedSdrBlocks.map(block => (
                <SortableBlockItem
                  key={block.id}
                  id={block.id}
                  label={block.label}
                  checked={sdrBlocks.includes(block.id)}
                  onToggle={() => setConfig(c => ({ ...c, sdr_blocks: toggleItem(sdrBlocks, block.id) }))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Closer Blocks */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Blocos da Seção Closer</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd('closer')}>
          <SortableContext items={orderedCloserBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {orderedCloserBlocks.map(block => (
                <SortableBlockItem
                  key={block.id}
                  id={block.id}
                  label={block.label}
                  checked={closerBlocks.includes(block.id)}
                  onToggle={() => setConfig(c => ({ ...c, closer_blocks: toggleItem(closerBlocks, block.id) }))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Default Ranking Metrics */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Métrica Padrão do Ranking</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-2">Closer</label>
            <select
              value={defaultCloserMetric}
              onChange={(e) => setConfig(c => ({ ...c, default_ranking_metric_closer: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-primary"
            >
              {RANKING_METRICS_CLOSER.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-2">SDR</label>
            <select
              value={defaultSdrMetric}
              onChange={(e) => setConfig(c => ({ ...c, default_ranking_metric_sdr: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm text-text-primary"
            >
              {RANKING_METRICS_SDR.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableBlockItem({ id, label, checked, onToggle }: {
  id: string
  label: string
  checked: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1">
      <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-text-faint hover:text-text-muted">
        <GripVertical size={14} />
      </button>
      <label className="flex items-center gap-2 cursor-pointer flex-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="rounded border-border accent-primary"
        />
        <span className="text-sm text-text-primary">{label}</span>
      </label>
    </div>
  )
}
