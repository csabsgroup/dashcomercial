import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OfflineBanner } from '@/components/OfflineBanner'
import { SyncErrorBanner } from '@/components/SyncErrorBanner'
import { Toaster } from 'sonner'
import { MOCK_ENABLED } from '@/mocks/mockData'

// Lazy-loaded pages
const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Ranking = lazy(() => import('@/pages/Ranking'))
const Goals = lazy(() => import('@/pages/Goals'))
const Profile = lazy(() => import('@/pages/Profile'))
const Settings = lazy(() => import('@/pages/settings/Settings'))
const UsersConfig = lazy(() => import('@/pages/settings/Users'))
const GoalsConfig = lazy(() => import('@/pages/settings/GoalsConfig'))
const PiperunIntegration = lazy(() => import('@/pages/settings/PiperunIntegration'))
const DashboardConfig = lazy(() => import('@/pages/settings/DashboardConfig'))
const ProductsConfig = lazy(() => import('@/pages/settings/ProductsConfig'))
const RankingTV = lazy(() => import('@/pages/RankingTV'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth()

  if (MOCK_ENABLED && profile) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Skeleton className="w-48 h-6" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()

  if (role !== 'master' && role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function PageFallback() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="space-y-3 w-64">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-right" theme="dark" richColors closeButton />
      <OfflineBanner />
      <SyncErrorBanner />
      <Suspense fallback={<PageFallback />}>
        <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/ranking/tv" element={<RankingTV />} />

        {/* Protected */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ranking"
          element={
            <ProtectedRoute>
              <Ranking />
            </ProtectedRoute>
          }
        />

        <Route
          path="/metas"
          element={
            <ProtectedRoute>
              <Goals />
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/configuracoes"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <Settings />
              </AdminRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="usuarios" replace />} />
          <Route path="usuarios" element={<UsersConfig />} />
          <Route path="metas" element={<GoalsConfig />} />
          <Route path="produtos" element={<ProductsConfig />} />
          <Route path="piperun" element={<PiperunIntegration />} />
          <Route path="dashboard" element={<DashboardConfig />} />
        </Route>

        {/* Default */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  </ErrorBoundary>
  )
}
