import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'
import { useAuth } from '@/context/AuthContext'
import { Users, Target, Plug, LayoutDashboard, Package } from 'lucide-react'

const settingsLinks = [
  { path: '/configuracoes/usuarios', label: 'Usuários', icon: Users },
  { path: '/configuracoes/metas', label: 'Metas', icon: Target },
  { path: '/configuracoes/produtos', label: 'Produtos', icon: Package },
  { path: '/configuracoes/piperun', label: 'PipeRun', icon: Plug },
  { path: '/configuracoes/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

export default function Settings() {
  const { role } = useAuth()

  if (role !== 'master' && role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <PageLayout title="Configurações">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Nav */}
        <nav className="lg:w-56 shrink-0">
          <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {settingsLinks.map((link) => (
              <li key={link.path}>
                <NavLink
                  to={link.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200
                    ${isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
                    }`
                  }
                >
                  <link.icon size={18} />
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </PageLayout>
  )
}
