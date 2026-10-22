/* Live end-to-end check of the shipped decode path. Not part of `npm run smoke`. */
import { readFileSync } from 'node:fs'

import { decodeVinInBrowser } from '@/lib/decode-vin-dev'

const image = process.argv[2]
const expectVin = process.argv[3]
const expectMake = process.argv[4]

const dataUrl = `data:image/png;base64,${readFileSync(image).toString('base64')}`

const started = Date.now()
const result = await decodeVinInBrowser([dataUrl])
const elapsed = ((Date.now() - started) / 1000).toFixed(2)

console.log(`\n--- ${image.split('/').pop()}  (${elapsed}s, model ${result.modelUsed}) ---`)
console.log(JSON.stringify(result, null, 2))

const checks: [string, unknown, unknown][] = [
  ['vin', result.vin, expectVin],
  ['make', result.make, expectMake],
  ['readable', result.readable, true],
  ['checkDigitOk', result.checkDigitOk, true],
  ['source', result.source, 'nhtsa'],
]

let failed = 0
for (const [name, actual, expected] of checks) {
  const ok = actual === expected
  if (!ok) failed += 1
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}: ${JSON.stringify(actual)}`)
}
process.exit(failed === 0 ? 0 : 1)
