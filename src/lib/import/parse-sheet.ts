import Papa from 'papaparse'

export interface ParsedSheet {
  headers: string[]
  rows: string[][]
  sheetName?: string
  /** Rows dropped because every cell was blank. */
  blankRowsSkipped: number
}

const isBlankRow = (row: string[]) => row.every((cell) => !cell || !cell.trim())

function tidy(headers: string[], rows: string[][]): ParsedSheet {
  const before = rows.length
  const kept = rows.filter((row) => !isBlankRow(row))
  return {
    headers: headers.map((h) => (h ?? '').toString().trim()),
    rows: kept,
    blankRowsSkipped: before - kept.length,
  }
}

function parseCsv(text: string): ParsedSheet {
  // A BOM from Excel's "CSV UTF-8" would otherwise become part of the first
  // header, so the first column silently fails to map.
  const clean = text.replace(/^﻿/, '')
  const result = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' })
  const data = (result.data ?? []).filter(Array.isArray)
  if (data.length === 0) throw new Error('That file has no rows in it.')
  const [headers, ...rows] = data
  return tidy(headers.map(String), rows.map((r) => r.map((c) => (c ?? '').toString())))
}

/** exceljs hands back strings, numbers, dates, rich text and formula results. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (Array.isArray(v.richText)) {
      return v.richText.map((part) => (part as { text?: string }).text ?? '').join('')
    }
    if ('result' in v) return cellToString(v.result)
    if ('text' in v) return cellToString(v.text)
    if ('hyperlink' in v) return cellToString(v.text ?? v.hyperlink)
  }
  return String(value).trim()
}

async function parseXlsx(file: File): Promise<ParsedSheet> {
  // Loaded on demand: the workbook parser is far larger than the rest of this
  // page, and most imports are CSV.
  //
  // exceljs is CommonJS, so a dynamic import yields a namespace whose real
  // exports sit under `default` in some interop paths and at the top level in
  // others. Taking whichever is present works in both.
  const imported = await import('exceljs')
  const ExcelJS =
    ((imported as unknown as { default?: typeof imported }).default ?? imported)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())

  const sheet = workbook.worksheets.find((w) => w.rowCount > 0) ?? workbook.worksheets[0]
  if (!sheet) throw new Error('That workbook has no sheets in it.')

  const table: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    // `values` is 1-based with a hole at index 0.
    const values = row.values as unknown[]
    for (let i = 1; i < values.length; i += 1) cells.push(cellToString(values[i]))
    table.push(cells)
  })

  if (table.length === 0) throw new Error('That sheet has no rows in it.')
  const [headers, ...rows] = table
  const width = headers.length
  return {
    ...tidy(headers, rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))),
    sheetName: sheet.name,
  }
}

export async function parseSheet(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') {
    return parseCsv(await file.text())
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    return parseXlsx(file)
  }
  if (name.endsWith('.xls')) {
    throw new Error(
      'The old .xls format is not supported. Open it in Excel and save as .xlsx or CSV.',
    )
  }
  throw new Error('Use a .csv or .xlsx file.')
}
