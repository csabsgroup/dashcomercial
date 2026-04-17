import { useState } from 'react'
import { useSyncStatus } from '@/context/SyncContext'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { toast } from 'sonner'

export function SyncErrorBanner() {
  const { status, lastEntry } = useSyncStatus()
  const [dismissed, setDismissed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  if (status !== 'error' || dismissed) return null

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const { error } = await supabase.functions.invoke('sync-piperun')
      if (error) {
        toast.error('Falha ao resincronizar. Tente novamente.')
      } else {
        toast.success('Sincronização iniciada.')
        setDismissed(true)
      }
    } catch {
      toast.error('Erro ao chamar sincronização.')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning/90 backdrop-blur-sm text-warning-foreground px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-3">
      <AlertTriangle size={14} />
      <span>
        Última sincronização falhou
        {lastEntry?.error_message && (
          <span className="hidden sm:inline"> — {lastEntry.error_message}</span>
        )}
      </span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/10 hover:bg-black/20 transition-all duration-200 text-xs font-medium disabled:opacity-50"
        aria-label="Tentar sincronizar novamente"
      >
        <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
        Tentar novamente
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 hover:bg-black/10 rounded p-0.5 transition-colors"
        aria-label="Fechar alerta de sincronização"
      >
        <X size={14} />
      </button>
    </div>
  )
}
