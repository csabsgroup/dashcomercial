import { AlertTriangle, TrendingDown, Users, PhoneOff } from 'lucide-react'

interface DiagnosticAlertProps {
  alerts: DiagnosticItem[]
}

export interface DiagnosticItem {
  id: string
  severity: 'warning' | 'danger'
  message: string
  icon: 'qualification' | 'showrate' | 'volume' | 'pipeline'
}

const iconMap = {
  qualification: <Users size={16} />,
  showrate: <PhoneOff size={16} />,
  volume: <TrendingDown size={16} />,
  pipeline: <AlertTriangle size={16} />,
}

export function DiagnosticAlert({ alerts }: DiagnosticAlertProps) {
  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm
            ${alert.severity === 'danger'
              ? 'bg-danger/5 border-danger/20 text-danger'
              : 'bg-warning/5 border-warning/20 text-warning'
            }`}
        >
          {iconMap[alert.icon]}
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  )
}

export function generateDiagnostics(metrics: {
  qualificationRate?: number
  showRate?: number
  leadsCount?: number
  leadsGoal?: number
  pipelineCoverage?: number
}): DiagnosticItem[] {
  const alerts: DiagnosticItem[] = []

  if (metrics.qualificationRate !== undefined && metrics.qualificationRate < 20) {
    alerts.push({
      id: 'low-qualification',
      severity: 'warning',
      message: `Taxa de qualificação baixa (${metrics.qualificationRate.toFixed(1)}%). Revisar ICP ou preparação do SDR.`,
      icon: 'qualification',
    })
  }

  if (metrics.showRate !== undefined && metrics.showRate < 70) {
    alerts.push({
      id: 'low-showrate',
      severity: 'warning',
      message: `Show rate baixo (${metrics.showRate.toFixed(1)}%). Revisar expectativa e confirmação de reuniões.`,
      icon: 'showrate',
    })
  }

  if (metrics.leadsCount !== undefined && metrics.leadsGoal !== undefined && metrics.leadsCount < metrics.leadsGoal) {
    alerts.push({
      id: 'low-volume',
      severity: 'danger',
      message: `Volume de leads abaixo da meta (${metrics.leadsCount}/${metrics.leadsGoal}). Verificar canal de marketing.`,
      icon: 'volume',
    })
  }

  if (metrics.pipelineCoverage !== undefined && metrics.pipelineCoverage < 3) {
    alerts.push({
      id: 'low-pipeline',
      severity: 'warning',
      message: `Cobertura de pipeline baixa (${metrics.pipelineCoverage.toFixed(1)}x). Ideal: 3x a meta.`,
      icon: 'pipeline',
    })
  }

  return alerts
}
