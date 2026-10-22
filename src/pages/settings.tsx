import * as React from 'react'
import {
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { ErrorState } from '@/components/common/error-state'
import { Field } from '@/components/common/field'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/auth-context'
import {
  useCreateStaffMember,
  useDeleteStaffMember,
  useStaffAccounts,
  useStaffMembers,
  useUpdateStaffMember,
} from '@/hooks/use-staff-members'
import { describeDbError } from '@/lib/errors'
import { formatDate, initialsOf, telHref } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StaffMember } from '@/types/database'

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <section className="glass-tile-solid rounded-[1.75rem] p-5 sm:p-6">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const staff = useStaffMembers()
  const accounts = useStaffAccounts()
  const createStaff = useCreateStaffMember()
  const updateStaff = useUpdateStaffMember()
  const deleteStaff = useDeleteStaffMember()

  const [name, setName] = React.useState('')
  const [role, setRole] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [editing, setEditing] = React.useState<StaffMember | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<StaffMember | null>(null)

  const resetForm = () => {
    setName('')
    setRole('')
    setPhone('')
    setEditing(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      toast.error('Give the staff member a name.')
      return
    }
    try {
      if (editing) {
        await updateStaff.mutateAsync({ id: editing.id, name, role, phone })
        toast.success('Staff member updated')
      } else {
        await createStaff.mutateAsync({ name, role, phone })
        toast.success(`${name.trim()} added`)
      }
      resetForm()
    } catch (error) {
      const message = describeDbError(error)
      toast.error(
        message.includes('already exists') ? 'Someone with that name is already listed.' : message,
      )
    }
  }

  const toggleActive = async (member: StaffMember) => {
    try {
      await updateStaff.mutateAsync({
        id: member.id,
        name: member.name,
        role: member.role,
        phone: member.phone,
        active: !member.active,
      })
      toast.success(member.active ? `${member.name} marked as left` : `${member.name} is back on`)
    } catch (error) {
      toast.error(describeDbError(error))
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteStaff.mutateAsync(pendingDelete.id)
      toast.success('Staff member removed')
    } catch (error) {
      toast.error(describeDbError(error))
    } finally {
      setPendingDelete(null)
    }
  }

  const busy = createStaff.isPending || updateStaff.isPending
  const members = staff.data ?? []

  return (
    <div className="page-enter space-y-5">
      <header className="glass-hero rounded-[2rem] p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Account</p>
        <h1 className="mt-2 text-4xl tracking-tight text-display sm:text-5xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Who works here, and who can sign in.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section
            title="Staff members"
            description="These names fill the dropdown when a vehicle is released or checked back in."
            icon={Users}
          >
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Name" htmlFor="staffName">
                <Input
                  id="staffName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Bayo Adeyemi"
                />
              </Field>
              <Field label="Role" htmlFor="staffRole" hint="Optional">
                <Input
                  id="staffRole"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="Yard hand"
                />
              </Field>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Plus />}
                  {editing ? 'Save' : 'Add'}
                </Button>
                {editing ? (
                  <Button type="button" variant="ghost" size="icon" onClick={resetForm}>
                    <X />
                  </Button>
                ) : null}
              </div>

              <Field label="Phone" htmlFor="staffPhone" hint="Optional" className="sm:col-span-3">
                <Input
                  id="staffPhone"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0803 000 0000"
                />
              </Field>
            </form>

            <div className="mt-5">
              {staff.isError ? (
                <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
              ) : staff.isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : members.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/50 px-4 py-5 text-sm text-muted-foreground">
                  Nobody listed yet. Add the people who hand vehicles over — until then the
                  movement form falls back to typing a name.
                </p>
              ) : (
                <ul className="space-y-2">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className={cn(
                        'flex flex-wrap items-center gap-3 rounded-2xl border border-white/40 bg-white/30 px-4 py-2.5',
                        !member.active && 'opacity-60',
                      )}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/50 bg-white/55 text-xs font-semibold">
                        {initialsOf(member.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.role ?? 'No role recorded'}
                          {member.phone ? (
                            <>
                              <span className="mx-1.5 opacity-50">·</span>
                              <a href={telHref(member.phone)} className="hover:underline">
                                {member.phone}
                              </a>
                            </>
                          ) : null}
                        </p>
                      </div>

                      {!member.active ? <Badge variant="muted">Left</Badge> : null}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleActive(member)}
                      >
                        {member.active ? 'Mark as left' : 'Reinstate'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${member.name}`}
                        onClick={() => {
                          setEditing(member)
                          setName(member.name)
                          setRole(member.role ?? '')
                          setPhone(member.phone ?? '')
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${member.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete(member)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Signed in as" icon={UserRound}>
            <p className="truncate text-sm font-medium">{user?.email ?? 'Unknown'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Signed in since {formatDate(user?.last_sign_in_at ?? user?.created_at)}
            </p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => void signOut()}>
              <LogOut /> Sign out
            </Button>
          </Section>

          <Section
            title="Accounts with access"
            description="Who can sign in to AbujaCar. Managed in SQL, deliberately — the app cannot grant itself access."
            icon={ShieldCheck}
          >
            {accounts.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (accounts.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody listed.</p>
            ) : (
              <ul className="space-y-2">
                {(accounts.data ?? []).map((account) => (
                  <li
                    key={account.user_id}
                    className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white/30 px-3.5 py-2 text-sm"
                  >
                    <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {account.full_name ?? 'Unnamed'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(account.added_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Movements they already handled keep their name — those are a record of what
              happened and are not changed. If they have simply left, &ldquo;Mark as left&rdquo;
              is the better choice: it keeps the history tidy and takes them out of the
              dropdown.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteStaff.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteStaff.isPending}
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
