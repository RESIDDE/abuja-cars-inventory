import * as React from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useOwners } from '@/hooks/use-owners'
import { useVehicles } from '@/hooks/use-vehicles'
import { useImportVehicles } from '@/hooks/use-import-vehicles'
import type { ImportResult } from '@/hooks/use-import-vehicles'
import { autoMapColumns, IMPORT_FIELDS, TEMPLATE_HEADERS } from '@/lib/import/fields'
import type { ImportFieldKey } from '@/lib/import/fields'
import { parseSheet } from '@/lib/import/parse-sheet'
import type { ParsedSheet } from '@/lib/import/parse-sheet'
import { importableRows, prepareRows } from '@/lib/import/prepare-rows'
import type { PreparedRow } from '@/lib/import/prepare-rows'
import { cn } from '@/lib/utils'

const NONE = '__none__'

function Section({
  step,
  title,
  description,
  children,
}: {
  step: number
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="glass-tile-solid rounded-[1.75rem] p-5 sm:p-6">
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/50 bg-white/55 text-xs font-semibold">
          {step}
        </span>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  )
}

export default function ImportPage() {
  const navigate = useNavigate()
  const { data: owners = [], isLoading: ownersLoading } = useOwners()
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles()
  const importVehicles = useImportVehicles()

  const [sheet, setSheet] = React.useState<ParsedSheet | null>(null)
  const [fileName, setFileName] = React.useState('')
  const [parsing, setParsing] = React.useState(false)
  const [mapping, setMapping] = React.useState<Partial<Record<ImportFieldKey, number>>>({})
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = React.useState<ImportResult | null>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)

  const existingVins = React.useMemo(
    () =>
      new Set(
        vehicles.map((v) => (v.vin ?? '').toUpperCase()).filter((v): v is string => Boolean(v)),
      ),
    [vehicles],
  )

  const prepared: PreparedRow[] = React.useMemo(() => {
    if (!sheet) return []
    return prepareRows({ rows: sheet.rows, mapping, existingOwners: owners, existingVins })
  }, [sheet, mapping, owners, existingVins])

  const ready = React.useMemo(() => importableRows(prepared), [prepared])
  const problems = prepared.filter((row) => row.errors.length > 0)
  const warned = prepared.filter((row) => row.errors.length === 0 && row.warnings.length > 0)
  const newOwnerCount = React.useMemo(
    () => new Set(ready.filter((r) => !r.owner.existingOwnerId).map((r) => r.owner.phone_primary)).size,
    [ready],
  )

  const missingRequired = IMPORT_FIELDS.filter(
    (field) => field.required && mapping[field.key] === undefined,
  )

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setParsing(true)
    setResult(null)
    try {
      const parsed = await parseSheet(file)
      setSheet(parsed)
      setFileName(file.name)
      setMapping(autoMapColumns(parsed.headers))
      toast.success(
        `Read ${parsed.rows.length} row${parsed.rows.length === 1 ? '' : 's'}${
          parsed.sheetName ? ` from "${parsed.sheetName}"` : ''
        }`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That file could not be read.')
    } finally {
      setParsing(false)
    }
  }

  const downloadTemplate = () => {
    const csv = `${TEMPLATE_HEADERS.join(',')}\n`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'abujacar-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const runImport = async () => {
    if (ready.length === 0) return
    setProgress({ done: 0, total: ready.length })
    try {
      const outcome = await importVehicles.mutateAsync({
        rows: ready,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setResult(outcome)
      if (outcome.vehiclesCreated > 0) {
        toast.success(
          `Imported ${outcome.vehiclesCreated} vehicle${outcome.vehiclesCreated === 1 ? '' : 's'}`,
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The import failed.')
    } finally {
      setProgress(null)
    }
  }

  const loading = ownersLoading || vehiclesLoading

  return (
    <div className="page-enter space-y-5">
      <Link
        to="/vehicles"
        className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/30 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/50"
      >
        <ArrowLeft className="size-4" /> All vehicles
      </Link>

      <header className="glass-hero rounded-[2rem] p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bulk</p>
        <h1 className="mt-2 text-4xl tracking-tight text-display sm:text-5xl">Import records</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Upload a spreadsheet and each row becomes its own vehicle record, attached to its
          owner. Nothing is written until you have seen what will be created.
        </p>
      </header>

      {/* ---------------- 1. the file ---------------- */}
      <Section
        step={1}
        title="Choose a file"
        description="CSV or Excel (.xlsx). The first row must be the column names."
      >
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.xlsx,.xlsm,text/csv"
          className="sr-only"
          onChange={(event) => {
            void pickFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => fileInput.current?.click()} disabled={parsing}>
            {parsing ? <Loader2 className="animate-spin" /> : <Upload />}
            {parsing ? 'Reading…' : 'Choose spreadsheet'}
          </Button>
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download /> Download template
          </Button>
        </div>

        {sheet ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <FileSpreadsheet className="size-4 text-muted-foreground" />
            <span className="font-medium">{fileName}</span>
            <Badge variant="muted">
              {sheet.rows.length} row{sheet.rows.length === 1 ? '' : 's'}
            </Badge>
            {sheet.blankRowsSkipped > 0 ? (
              <Badge variant="muted">{sheet.blankRowsSkipped} blank skipped</Badge>
            ) : null}
          </p>
        ) : null}
      </Section>

      {/* ---------------- 2. mapping ---------------- */}
      {sheet ? (
        <Section
          step={2}
          title="Match the columns"
          description="Guessed from your headings — correct anything that is wrong."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {IMPORT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>
                  {field.label}
                  {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                </Label>
                <Select
                  value={mapping[field.key] === undefined ? NONE : String(mapping[field.key])}
                  onValueChange={(value) =>
                    setMapping((current) => ({
                      ...current,
                      [field.key]: value === NONE ? undefined : Number(value),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not in my sheet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not in my sheet</SelectItem>
                    {sheet.headers.map((header, index) => (
                      <SelectItem key={`${header}-${index}`} value={String(index)}>
                        {header || `Column ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {missingRequired.length > 0 ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              <span>
                Still needed: {missingRequired.map((f) => f.label).join(', ')}. Every record
                needs those.
              </span>
            </p>
          ) : null}
        </Section>
      ) : null}

      {/* ---------------- 3. preview ---------------- */}
      {sheet && missingRequired.length === 0 ? (
        <Section
          step={3}
          title="Check what will be created"
          description="Rows with a problem are skipped; the rest import."
        >
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="inStock">{ready.length} ready</Badge>
                <Badge variant="muted">{newOwnerCount} new owner{newOwnerCount === 1 ? '' : 's'}</Badge>
                {warned.length > 0 ? <Badge variant="muted">{warned.length} with notes</Badge> : null}
                {problems.length > 0 ? (
                  <Badge variant="released">{problems.length} skipped</Badge>
                ) : null}
              </div>

              {prepared.length > 0 ? (
                <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-white/40">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[hsl(158_22%_85%/.95)] backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Vehicle</th>
                        <th className="px-3 py-2 font-medium">Owner</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prepared.map((row) => (
                        <tr
                          key={row.lineNumber}
                          className={cn(
                            'border-t border-white/35 align-top',
                            row.errors.length > 0 && 'bg-destructive/10',
                          )}
                        >
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {row.lineNumber}
                          </td>
                          <td className="px-3 py-2">
                            {[row.vehicle.year, row.vehicle.make, row.vehicle.model]
                              .filter(Boolean)
                              .join(' ') || '—'}
                            {row.vehicle.vin ? (
                              <span className="block font-mono text-[0.7rem] text-muted-foreground">
                                {row.vehicle.vin}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            {row.owner.full_name || '—'}
                            <span className="block text-[0.7rem] text-muted-foreground">
                              {row.owner.existingOwnerId ? 'already on record' : 'new owner'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {row.errors.length > 0 ? (
                              <ul className="space-y-0.5 text-destructive">
                                {row.errors.map((e) => (
                                  <li key={e}>{e}</li>
                                ))}
                              </ul>
                            ) : row.warnings.length > 0 ? (
                              <ul className="space-y-0.5 text-muted-foreground">
                                {row.warnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[hsl(140_40%_28%)]">
                                <CheckCircle2 className="size-3" /> Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}
        </Section>
      ) : null}

      {/* ---------------- 4. import ---------------- */}
      {sheet && missingRequired.length === 0 && !loading ? (
        <Section
          step={4}
          title="Import"
          description={`${ready.length} record${ready.length === 1 ? '' : 's'} will be created.`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => void runImport()}
              disabled={ready.length === 0 || importVehicles.isPending}
            >
              {importVehicles.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              Import {ready.length} record{ready.length === 1 ? '' : 's'}
            </Button>
            {progress ? (
              <span className="text-sm text-muted-foreground">
                {progress.done} of {progress.total}…
              </span>
            ) : null}
          </div>

          {result ? (
            <div className="mt-4 rounded-2xl border border-white/45 bg-white/35 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4" />
                {result.vehiclesCreated} vehicle{result.vehiclesCreated === 1 ? '' : 's'} and{' '}
                {result.ownersCreated} owner{result.ownersCreated === 1 ? '' : 's'} created
              </p>
              {result.failures.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs font-medium text-destructive">
                    {result.failures.length} could not be saved:
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {result.failures.map((f, i) => (
                      <li key={`${f.lineNumber}-${i}`}>
                        {f.lineNumber > 0 ? `Row ${f.lineNumber}: ` : ''}
                        {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate('/vehicles')}
              >
                See the vehicles
              </Button>
            </div>
          ) : null}
        </Section>
      ) : null}
    </div>
  )
}
