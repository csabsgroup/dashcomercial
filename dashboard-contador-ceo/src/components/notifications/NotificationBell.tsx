import { useState, useRef, useEffect } from 'react'
import { Bell, Check, Target, TrendingUp, AlertTriangle, DollarSign, Wifi } from 'lucide-react'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { NotificationType } from '@/types/database'

const typeIcons: Record<NotificationType, React.ReactNode> = {
  goal_reached: <Target size={16} className="text-success" />,
  ranking_change: <TrendingUp size={16} className="text-gold" />,
  gap_alert: <AlertTriangle size={16} className="text-warning" />,
  high_value_deal: <DollarSign size={16} className="text-success" />,
  sync_error: <Wifi size={16} className="text-danger" />,
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealtimeNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-surface-2 text-text-muted transition-all duration-200 cursor-pointer"
        aria-label="Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-text-primary">Notificações</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:text-primary/80 cursor-pointer flex items-center gap-1"
              >
                <Check size={12} />
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">
                Nenhuma notificação
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.read) markAsRead(n.id) }}
                  className={`w-full text-left px-4 py-3 flex gap-3 transition-colors cursor-pointer border-b border-border/50 last:border-0
                    ${n.read ? 'opacity-60' : 'bg-surface-2/50 hover:bg-surface-2'}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {typeIcons[n.type] || <Bell size={16} className="text-text-muted" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{n.title}</p>
                    <p className="text-xs text-text-muted line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-text-faint mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
