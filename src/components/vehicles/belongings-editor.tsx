import * as React from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COMMON_BELONGINGS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Belonging } from '@/types/database'

interface BelongingsEditorProps {
  value: Belonging[]
  onChange: (next: Belonging[]) => void
}

const key = (item: string) => item.trim().toLowerCase()

/**
 * The arrival checklist: free-text item, quantity, optional condition note.
 * Duplicates are rejected — two "Spare tyre" rows with different counts is a
 * dispute waiting to happen, so the quantity on the existing row is what moves.
 */
export function BelongingsEditor({ value, onChange }: BelongingsEditorProps) {
  const [draftItem, setDraftItem] = React.useState('')
  const [draftQty, setDraftQty] = React.useState('1')
  const [draftNote, setDraftNote] = React.useState('')
  const [message, setMessage] = React.useState<string | null>(null)

  const taken = React.useMemo(() => new Set(value.map((b) => key(b.item))), [value])

  const addRow = (item: string, qty: number, note: string) => {
    const trimmed = item.trim()
    if (!trimmed) {
      setMessage('Give the item a name first.')
      return false
    }
    if (taken.has(key(trimmed))) {
      setMessage(`"${trimmed}" is already on the list.`)
      return false
    }
    onChange([...value, { item: trimmed, qty: qty > 0 ? qty : 1, note }])
    setMessage(null)
    return true
  }

  const commitDraft = () => {
    if (addRow(draftItem, Number(draftQty) || 1, draftNote.trim())) {
      setDraftItem('')
      setDraftQty('1')
      setDraftNote('')
    }
  }

  const updateRow = (index: number, patch: Partial<Belonging>) => {
    if (patch.item !== undefined) {
      const nextKey = key(patch.item)
      const clash = value.some((b, i) => i !== index && key(b.item) === nextKey)
      if (clash) {
        setMessage(`"${patch.item.trim()}" is already on the list.`)
        return
      }
      setMessage(null)
    }
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    setMessage(null)
  }

  return (
    <div className="space-y-3">
      {/* One-tap chips for the usual things */}
      <div className="flex flex-wrap gap-2">
        {COMMON_BELONGINGS.map((item) => {
          const added = taken.has(key(item))
          return (
            <button
              key={item}
              type="button"
              onClick={() => (added ? undefined : addRow(item, 1, ''))}
              aria-pressed={added}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                added
                  ? 'cursor-default border-primary/50 bg-primary/35 text-primary-foreground'
                  : 'border-white/45 bg-white/35 text-foreground hover:bg-white/60',
              )}
            >
              {added ? <Check className="size-3" /> : <Plus className="size-3" />}
              {item}
            </button>
          )
        })}
      </div>

      {/* Current list */}
      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((row, index) => (
            <li
              key={`${row.item}-${index}`}
              className="rounded-2xl border border-white/40 bg-white/30 p-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Item ${index + 1}`}
                  value={row.item}
                  onChange={(event) => updateRow(index, { item: event.target.value })}
                  className="h-9 min-w-[8rem] flex-1 text-sm"
                />
                <Input
                  aria-label={`Quantity of ${row.item}`}
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={(event) =>
                    updateRow(index, { qty: Math.max(1, Number(event.target.value) || 1) })
                  }
                  className="h-9 w-20 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove ${row.item}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
              <Input
                aria-label={`Condition note for ${row.item}`}
                value={row.note ?? ''}
                onChange={(event) => updateRow(index, { note: event.target.value })}
                placeholder="Condition note (optional)"
                className="mt-2 h-9 text-sm"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/50 px-4 py-3 text-xs text-muted-foreground">
          Nothing recorded yet. Tap a chip above or add an item below.
        </p>
      )}

      {/* Draft row */}
      <div className="rounded-2xl border border-white/40 bg-white/20 p-3">
        <Label className="mb-2 block">Add an item</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draftItem}
            onChange={(event) => setDraftItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDraft()
              }
            }}
            placeholder="e.g. Second key fob"
            className="h-9 min-w-[8rem] flex-1 text-sm"
          />
          <Input
            type="number"
            min={1}
            value={draftQty}
            onChange={(event) => setDraftQty(event.target.value)}
            aria-label="Quantity"
            className="h-9 w-20 text-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={commitDraft}>
            <Plus /> Add
          </Button>
        </div>
        <Input
          value={draftNote}
          onChange={(event) => setDraftNote(event.target.value)}
          placeholder="Condition note (optional)"
          className="mt-2 h-9 text-sm"
        />
      </div>

      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  )
}
