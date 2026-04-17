import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Trophy,
  Target,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadge } from '@/components/ui/Badge'

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ranking', label: 'Ranking', icon: Trophy },
  { path: '/metas', label: 'Metas', icon: Target },
]

const adminItems = [
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { profile, signOut } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'master' || profile?.role === 'admin'

  const logoSrc = theme === 'dark' ? '/LOGO CEO BRANCO.png' : '/LOGO CEO VERMELHO.png.png'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside
      className={`hidden lg:flex flex-col h-screen bg-surface border-r border-border transition-all duration-300
        ${collapsed ? 'w-[72px]' : 'w-[250px]'}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        {collapsed ? (
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
            C
          </div>
        ) : (
          <img src={logoSrc} alt="Contador CEO" className="h-8 object-contain" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium
                  ${isActive
                    ? 'bg-primary/10 text-primary border-l-[3px] border-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-2 border-l-[3px] border-transparent'
                  }`
                }
              >
                <item.icon size={20} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}

          {isAdmin &&
            adminItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium
                    ${isActive
                      ? 'bg-primary/10 text-primary border-l-[3px] border-primary'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-2 border-l-[3px] border-transparent'
                    }`
                  }
                >
                  <item.icon size={20} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>

      {/* User Section */}
      <div className="border-t border-border p-3 space-y-2 shrink-0">
        <NavLink
          to="/perfil"
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-2 transition-all duration-200"
        >
          <Avatar name={profile?.name || ''} src={profile?.avatar_url} size="sm" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {profile?.name}
              </p>
              <RoleBadge role={profile?.role || 'closer'} />
            </div>
          )}
        </NavLink>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-all duration-200 w-full text-sm cursor-pointer"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-border text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
