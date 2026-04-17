import { Menu, Package } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import { SyncIndicator } from './SyncIndicator'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useAuth } from '@/context/AuthContext'
import { useProductFilter, NO_PRODUCT_ID } from '@/context/ProductContext'
import { useTheme } from '@/context/ThemeContext'

interface HeaderProps {
  title: string
  onMenuClick?: () => void
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { profile } = useAuth()
  const { selectedProductId, setSelectedProductId, activeProducts } = useProductFilter()
  const { theme } = useTheme()

  const showProductFilter = activeProducts.length > 0
  const logoSrc = theme === 'dark' ? '/LOGO CEO BRANCO.png' : '/LOGO CEO PRETO.png'

  return (
    <header className="h-16 bg-surface/80 backdrop-blur-xl border-b border-border px-4 lg:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-surface-2 text-text-muted transition-colors cursor-pointer"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
        <img src={logoSrc} alt="Contador CEO" className="h-7 lg:hidden" />
        <div className="hidden lg:block h-5 w-px bg-border mx-1" />
        <h1 className="text-base font-semibold text-text-primary hidden lg:block">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {showProductFilter && (
          <div className="flex items-center gap-1.5">
            <Package size={14} className="text-text-faint hidden sm:block" />
            <select
              value={selectedProductId ?? ''}
              onChange={(e) => setSelectedProductId(e.target.value || null)}
              className="px-2.5 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-text-primary max-w-[140px] truncate focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            >
              <option value="">Todos os Produtos</option>
              {activeProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value={NO_PRODUCT_ID}>Sem Produto</option>
            </select>
          </div>
        )}

        <DateRangePicker />

        <SyncIndicator />

        <ThemeToggle />

        <NotificationBell />

        <div className="hidden sm:block">
          <Avatar name={profile?.name || ''} src={profile?.avatar_url} size="sm" />
        </div>
      </div>
    </header>
  )
}
