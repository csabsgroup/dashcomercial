import { useSyncStatus } from '@/context/SyncContext'
import { formatSyncTime } from '@/utils/formatters'

export function SyncIndicator() {
  const { status, lastSyncAt } = useSyncStatus()

  const statusConfig = {
    success: { color: 'bg-sync-ok', label: 'Sincronizado' },
    running: { color: 'bg-sync-running', label: 'Sincronizando...' },
    error: { color: 'bg-sync-error', label: 'Erro de sync' },
    never: { color: 'bg-text-faint', label: 'Aguardando sync' },
  }

  const config = statusConfig[status]

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${config.color} ${status === 'running' ? 'animate-pulse' : ''}`} />
      <span className="text-text-muted">{config.label}</span>
      {lastSyncAt && (
        <span className="text-text-faint">{formatSyncTime(new Date(lastSyncAt))}</span>
      )}
    </div>
  )
}
