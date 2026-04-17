import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Trophy, Target, User, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const items = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ranking', label: 'Ranking', icon: Trophy },
  { path: '/metas', label: 'Metas', icon: Target },
  { path: '/perfil', label: 'Perfil', icon: User },
]

const adminNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ranking', label: 'Ranking', icon: Trophy },
  { path: '/metas', label: 'Metas', icon: Target },
  { path: '/configuracoes', label: 'Config', icon: Settings },
  { path: '/perfil', label: 'Perfil', icon: User },
]

export function BottomNav() {
  const { role } = useAuth()
  const isAdmin = role === 'master' || role === 'admin'
  const navItems = isAdmin ? adminNavItems : items

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-border">
      <ul className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              aria-label={item.label}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-all duration-200 relative
                ${isActive ? 'text-primary font-medium' : 'text-text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} aria-hidden="true" />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
