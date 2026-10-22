import { Outlet } from 'react-router-dom'

import { TopNav } from '@/components/layout/top-nav'

export function AppShell() {
  return (
    <div className="min-h-dvh">
      <TopNav />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
