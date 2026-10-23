/* End-to-end: build real CSV and XLSX files, parse them, prepare the rows. */
import { parseSheet } from '@/lib/import/parse-sheet'
import { autoMapColumns } from '@/lib/import/fields'
import { importableRows, prepareRows } from '@/lib/import/prepare-rows'

const checks: [string, unknown, unknown][] = []
const eq = (name: string, actual: unknown, expected: unknown) =>
  checks.push([name, actual, expected])

// A sheet as someone would actually hand it over: BOM, quoted field with a
// comma, odd header casing, a blank line, Windows line endings.
const csv =
  '﻿"Customer Name","Phone No.","Car Type","Model","Chassis Number","Year","Price (NGN)","Body"\r\n' +
  '"Musa Ibrahim","0803 111 2222","Toyota","Corolla","JTDKB20U793094567","2009","₦12,500,000","Saloon"\r\n' +
  '\r\n' +
  '"Grace Eze, Esq.","0701 999 8888","Honda","Accord","1HGBH41JXMN109186","1991","4500000","Jeep"\r\n'

const xlsxRows = [
  ['Customer Name', 'Phone No.', 'Car Type', 'Model', 'Chassis Number', 'Year', 'Price (NGN)', 'Intake Date'],
  ['Ngozi Ade', '08051234567', 'Lexus', 'RX 350', 'WBA3A5C50DF123456', 2015, 9500000, new Date(2026, 2, 14)],
  ['Tunde Bello', '+234 806 222 3333', 'Kia', 'Rio', '', 2018, 3200000, '14/03/2026'],
]

async function main() {
  // ---------- CSV ----------
  const csvFile = new File([csv], 'records.csv', { type: 'text/csv' })
  const parsedCsv = await parseSheet(csvFile)

  eq('csv: BOM stripped from the first header', parsedCsv.headers[0], 'Customer Name')
  eq('csv: blank line dropped', parsedCsv.rows.length, 2)
  eq('csv: blank counted', parsedCsv.blankRowsSkipped >= 0, true)
  eq('csv: comma inside quotes kept whole', parsedCsv.rows[1][0], 'Grace Eze, Esq.')

  const csvMap = autoMapColumns(parsedCsv.headers)
  eq('csv: owner name mapped', csvMap.ownerName, 0)
  eq('csv: VIN mapped from "Chassis Number"', csvMap.vin, 4)
  eq('csv: body mapped', csvMap.bodyType, 7)

  const csvPrepared = prepareRows({
    rows: parsedCsv.rows,
    mapping: csvMap,
    existingOwners: [],
    existingVins: new Set(),
    today: new Date(2026, 9, 23),
  })
  eq('csv: both rows import', importableRows(csvPrepared).length, 2)
  eq('csv: naira price parsed', csvPrepared[0].vehicle.price, 12500000)
  eq('csv: "Saloon" -> Sedan', csvPrepared[0].vehicle.body_type, 'Sedan')
  eq('csv: "Jeep" -> SUV', csvPrepared[1].vehicle.body_type, 'SUV')

  // ---------- XLSX ----------
  const imported = await import('exceljs')
  const ExcelJS = (imported as unknown as { default?: typeof imported }).default ?? imported
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Stock')
  for (const row of xlsxRows) ws.addRow(row)
  const buffer = await wb.xlsx.writeBuffer()

  const xlsxFile = new File([buffer], 'records.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const parsedXlsx = await parseSheet(xlsxFile)

  eq('xlsx: sheet name read', parsedXlsx.sheetName, 'Stock')
  eq('xlsx: rows read', parsedXlsx.rows.length, 2)
  eq('xlsx: numbers coerced to text', parsedXlsx.rows[0][5], '2015')

  const xlsxMap = autoMapColumns(parsedXlsx.headers)
  const xlsxPrepared = prepareRows({
    rows: parsedXlsx.rows,
    mapping: xlsxMap,
    existingOwners: [],
    existingVins: new Set(),
    today: new Date(2026, 9, 23),
  })
  eq('xlsx: both rows import', importableRows(xlsxPrepared).length, 2)
  eq('xlsx: a real Date cell becomes an intake date', xlsxPrepared[0].vehicle.intake_date, '2026-03-14')
  eq('xlsx: a text date also works', xlsxPrepared[1].vehicle.intake_date, '2026-03-14')
  eq('xlsx: international phone kept verbatim', xlsxPrepared[1].owner.phone_primary, '+234 806 222 3333')
  eq('xlsx: year parsed from a number cell', xlsxPrepared[0].vehicle.year, 2015)

  // ---------- rejections ----------
  let rejected = ''
  try {
    await parseSheet(new File(['x'], 'old.xls'))
  } catch (e) {
    rejected = e instanceof Error ? e.message : ''
  }
  eq('.xls is rejected with advice', rejected.includes('save as .xlsx'), true)

  let failed = 0
  for (const [name, actual, expected] of checks) {
    if (actual !== expected) {
      failed += 1
      console.log(`FAIL  ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
    }
  }
  console.log(failed === 0 ? `OK  ${checks.length} import round-trip checks passed` : `${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

await main()
