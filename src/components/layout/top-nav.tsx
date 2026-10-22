import { Car, LayoutDashboard, LogOut, Plus, Search, Users } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { BrandMark } from '@/components/common/brand-mark'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/auth-context'
import { initialsOf } from '@/lib/format'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/vehicles', label: 'Vehicles', icon: Car },
  { to: '/owners', label: 'Owners', icon: Users },
]

export function TopNav() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const email = user?.email ?? ''

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <div className="glass-hero mx-auto flex max-w-7xl items-center gap-3 rounded-full px-3 py-2.5 sm:px-4">
        <Link
          to="/dashboard"
          className="flex shrink-0 items-center gap-2.5 rounded-full pr-2 focus-visible:outline-none"
        >
          <BrandMark />
          {/* The wordmark is decorative here: the link's name comes from the
              sr-only text, which stays put at every width. */}
          <img
            src="/abujacar-wordmark.png"
            alt=""
            aria-hidden="true"
            className="hidden h-[18px] w-auto md:block"
          />
          <span className="sr-only">AbujaCar</span>
        </Link>

        <nav className="no-scrollbar mx-auto flex items-center gap-1 overflow-x-auto rounded-full border border-white/30 bg-white/25 p-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:px-4',
                  isActive
                    ? 'pill-nav-active text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/vehicles')}
            className="icon-button-frosted hidden size-10 place-items-center rounded-full text-foreground/80 transition-colors hover:text-foreground sm:grid"
            aria-label="Search vehicles"
          >
            <Search className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/vehicles?new=1')}
            className="icon-button-frosted hidden size-10 place-items-center rounded-full text-foreground/80 transition-colors hover:text-foreground sm:grid"
            aria-label="Check in a vehicle"
          >
            <Plus className="size-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-10 place-items-center rounded-full border border-white/50 bg-white/70 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-white/85 focus-visible:outline-none"
              aria-label="Account menu"
            >
              {initialsOf(email || 'AbujaCar')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Signed in</DropdownMenuLabel>
              <div className="truncate px-3 pb-2 text-sm">{email || 'Staff'}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/vehicles?new=1')}>
                <Plus /> Check in vehicle
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
