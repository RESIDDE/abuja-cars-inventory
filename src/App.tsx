import { Suspense, lazy } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { FullPageLoader } from '@/components/common/full-page-loader'
import { SetupNotice } from '@/components/common/setup-notice'
import { AppShell } from '@/components/layout/app-shell'
import { ProtectedRoute } from '@/components/layout/protected-route'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/context/auth-context'
import { useThemeClass } from '@/hooks/use-theme-class'
import { isSupabaseConfigured } from '@/lib/supabase'

// Split per route, so Recharts only loads for whoever opens the dashboard.
const LoginPage = lazy(() => import('@/pages/login'))
const DashboardPage = lazy(() => import('@/pages/dashboard'))
const VehiclesPage = lazy(() => import('@/pages/vehicles'))
const VehicleDetailPage = lazy(() => import('@/pages/vehicle-detail'))
const OwnersPage = lazy(() => import('@/pages/owners'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  // Puts the palette on <html> and <body> so portalled Radix UI inherits it.
  useThemeClass()

  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/vehicles" element={<VehiclesPage />} />
                  <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
                  <Route path="/owners" element={<OwnersPage />} />
                </Route>
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
