/* Render the component layer with fixture data to prove nothing throws. */
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { BelongingsEditor } from '@/components/vehicles/belongings-editor'
import { BrandMark } from '@/components/common/brand-mark'
import { SignaturePad } from '@/components/common/signature-pad'
import { CurrencyInput } from '@/components/vehicles/currency-input'
import { CustodyTile } from '@/components/dashboard/custody-tile'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { IntakeChartTile } from '@/components/dashboard/intake-chart-tile'
import { MovementTimeline } from '@/components/vehicles/movement-timeline'
import { OwnerCard } from '@/components/owners/owner-card'
import { RecentVehiclesTile } from '@/components/dashboard/recent-vehicles-tile'
import { StockGaugeTile } from '@/components/dashboard/stock-gauge-tile'
import { VehicleCard } from '@/components/vehicles/vehicle-card'
import { buildInventorySeries, custodyTotals } from '@/lib/analytics'
import {
  countBelongings,
  formatDate,
  formatNaira,
  formatNairaCompact,
  groupDigits,
  parseCurrency,
  telHref,
  toDateInputValue,
  toDateTimeInputValue,
  vehicleTitle,
} from '@/lib/format'
import { normalizeBelongings, normalizeVehicle } from '@/lib/normalize'
import { parseModelJson } from '@/lib/model-json'
import { formatBytes, MAX_UPLOAD_BYTES, validatePhotoFile } from '@/lib/image'
import { formatMileage } from '@/lib/format'
import { MAX_VEHICLE_PHOTOS } from '@/lib/constants'
import { normalizePhotos } from '@/lib/normalize'
import { findOwnersByPhone, phoneKey } from '@/lib/phone'
import { rankCustomers } from '@/lib/rank-customers'
import { autoMapColumns, normalizeHeader } from '@/lib/import/fields'
import { importableRows, parseSheetDate, prepareRows } from '@/lib/import/prepare-rows'
import { OwnerMatchHint } from '@/components/owners/owner-match-hint'
import { planVinApply } from '@/lib/apply-vin-read'
import {
  bodyTypeFromBodyClass,
  checkVin,
  makeFromWmi,
  normalizeVin,
  vinCheckDigit,
} from '@/lib/vin'
import { describeAuthError, describeDbError } from '@/lib/errors'
import type { Owner, VehicleEvent, VehicleWithOwner } from '@/types/database'
import type { VinReadResult } from '@/types/vin'

const owner: Owner = {
  id: 'o1',
  full_name: 'Amaka Okonkwo',
  phone_primary: '0803 111 2222',
  phone_secondary: '0701 555 4444',
  email: 'amaka@example.com',
  address: '14 Aminu Kano Crescent, Wuse II, Abuja',
  notes: 'Prefers a call before release.',
  created_at: '2026-09-01T09:00:00Z',
  updated_at: '2026-09-01T09:00:00Z',
}

const today = toDateInputValue(new Date())

const vehicles: VehicleWithOwner[] = [
  {
    id: 'v1',
    owner_id: 'o1',
    make: 'Toyota',
    model: 'Corolla',
    body_type: 'Sedan',
    year: 2016,
    vin: 'JTDBR32E030123456',
    color: 'Silver',
    plate_number: 'ABC 123 XY',
    keys_count: 2,
    condition: 'used',
    mileage: 84000,
    mileage_unit: 'mi',
    registration: 'foreign',
    interior: 'Black leather',
    belongings: [
      { item: 'Spare tyre', qty: 1, note: 'Worn' },
      { item: 'Jack', qty: 1, note: null },
    ],
    photos: [{ path: 'v1/1-0.webp', bytes: 310_000, width: 1800, height: 1200 }],
    price: 12_500_000,
    status: 'in_stock',
    intake_date: today,
    released_date: null,
    sold_date: null,
    sale_price: null,
    buyer_name: null,
    notes: 'Dent on rear bumper.',
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    owner,
    buyer: null,
  },
  {
    id: 'v2',
    owner_id: 'o1',
    make: 'Lexus',
    model: 'RX 350',
    body_type: 'SUV',
    year: null,
    vin: null,
    color: null,
    plate_number: null,
    keys_count: 0,
    condition: null,
    mileage: null,
    mileage_unit: 'km',
    registration: null,
    interior: null,
    belongings: [],
    photos: [],
    price: null,
    status: 'sold',
    intake_date: '2026-10-01',
    released_date: '2026-10-15',
    sold_date: '2026-10-15',
    sale_price: 7_250_000,
    buyer_name: 'Chidi Obi',
    buyer_id: 'o1',
    notes: null,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-15T10:00:00Z',
    owner: null,
    buyer: owner,
  },
]

const events: VehicleEvent[] = [
  {
    id: 'e2',
    vehicle_id: 'v1',
    event_type: 'released',
    occurred_at: '2026-10-21T14:30:00Z',
    staff_name: 'Bayo',
    recipient_name: 'Amaka Okonkwo',
    notes: 'Collected at the gate.',
    keys_count: 2,
    signature_path: 'v1/1700000000.webp',
    created_by: null,
    created_at: '2026-10-21T14:30:00Z',
  },
  {
    id: 'e1',
    vehicle_id: 'v1',
    event_type: 'checked_in',
    occurred_at: '2026-10-20T09:00:00Z',
    staff_name: null,
    recipient_name: null,
    notes: null,
    keys_count: null,
    signature_path: null,
    created_by: null,
    created_at: '2026-10-20T09:00:00Z',
  },
]

const EMPTY_FORM = { vin: '', make: '', model: '', year: '', bodyType: '' }
const goodRead: VinReadResult = {
  vin: 'JTDKB20U793094567',
  readable: true,
  checkDigitOk: true,
  confidence: 'high',
  uncertain: [],
  notes: null,
  make: 'Toyota',
  model: 'Prius',
  year: '2009',
  bodyClass: 'Hatchback/Liftback/Notchback',
  source: 'nhtsa',
}

const series = buildInventorySeries(vehicles, 30)
const totals = custodyTotals(vehicles.filter((v) => v.status === 'in_stock'))
const noop = () => {}

const tree = (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <DashboardHero
        totalCount={vehicles.length}
        inStockCount={1}
        releasedCount={1}
        soldCount={0}
        ownerCount={1}
        series={series}
        onCheckIn={noop}
      />
      <RecentVehiclesTile vehicles={vehicles} />
      <StockGaugeTile rate={0.5} inStockCount={1} totalCount={2} />
      <IntakeChartTile series={series} total={1} />
      <CustodyTile totals={totals} inStockCount={1} />
      {vehicles.map((vehicle) => (
        <VehicleCard
          key={vehicle.id}
          vehicle={vehicle}
          onMove={noop}
          onSell={noop}
          onHistory={noop}
          onEdit={noop}
          onDelete={noop}
        />
      ))}
      <OwnerCard
        owner={owner}
        rank={1}
        vehicleCount={2}
        purchases={[vehicles[1]]}
        onEdit={noop}
        onDelete={noop}
      />
      <MovementTimeline events={events} />
      <MovementTimeline events={[]} />
      <BelongingsEditor value={vehicles[0].belongings} onChange={noop} />
      <CurrencyInput value={9_500_000} onChange={noop} />
      <BrandMark />
      <OwnerMatchHint matches={[owner]} onUse={noop} />
      <SignaturePad hint="Amaka Okonkwo" />
    </MemoryRouter>
  </QueryClientProvider>
)

// React's SSR writer puts a <!-- --> marker between adjacent text and an
// interpolated expression ("Signed by <!-- -->Amaka"), which would make every
// text assertion below depend on where the JSX happened to split.
const html = renderToString(tree).replace(/<!--\s*-->/g, '')

const checks: [string, boolean][] = [
  ['hero renders the total', html.includes('All Vehicles')],
  ['greeting present', html.includes('Explore your inventory history')],
  ['bow sits on the right of the hero', html.includes('/bow.png')],
  ['bow is decorative, not announced', html.includes('src="/bow.png" alt="" aria-hidden="true"')],
  // Identity lives in the nav account menu; repeating it in the hero was noise.
  ['hero does not repeat the signed-in email', !html.includes('staff@abujacar.ng')],
  ['check-in button is labelled for icon-only mode', html.includes('aria-label="Check in vehicle"')],
  ['vehicle title', html.includes('2016 Toyota Corolla')],
  ['vin shown', html.includes('JTDBR32E030123456')],
  ['naira formatting', html.includes('12,500,000')],
  ['status badge', html.includes('In Stock') && html.includes('Sold')],
  ['owner tel link', html.includes('tel:08031112222')],
  ['owner mailto', html.includes('mailto:amaka@example.com')],
  ['timeline recipient label', html.includes('Released to')],
  // "handed over" rather than "released", so the same chip reads correctly on
  // a sale as well.
  ['timeline shows the keys handed over', html.includes('handed over')],
  ['timeline credits the signatory', html.includes('Signed by Amaka Okonkwo')],
  ['signature pad prompts with the name', html.includes('Sign with a finger, stylus or mouse')],
  ['timeline omits keys when not recorded', !html.includes('brought back')],
  ['empty timeline copy', html.includes('No movements recorded yet.')],
  ['belongings chip', html.includes('Wheel spanner')],
  ['gauge percentage', html.includes('50%')],
  ['card shows the mileage with its unit', html.includes('84,000 mi')],
  ['card shows the condition', html.includes('Used')],
  ['card offers a Sold button', html.includes('Sold')],
  // A sold vehicle must not offer to be released or checked back in — the
  // database refuses it, and the card should not invite the attempt.
  ['sold card shows who bought it', html.includes('Sold to Amaka Okonkwo')],
  ['sold card offers no check-back-in', !html.includes('Check back in')],
  ['customer card lists what they bought', html.includes('Bought from you')],
  ['purchase shows its sale price', html.includes('7,250,000')],
  ['customer card counts both relationships', html.includes('2 stored') && html.includes('1 bought')],
  ['customer card shows its rank', html.includes('#1 by vehicles')],
  ['brand mark points at the logo', html.includes('/abujacar-logo.png')],
  ['owner match hint names the owner', html.includes('That number is already on record')],
  ['owner match hint offers the switch', html.includes('Use this owner')],
  ['brand mark is decorative for screen readers', html.includes('aria-hidden="true"')],
]

const customer = (id: string, name: string): Owner => ({
  ...owner,
  id,
  full_name: name,
})

// stored / bought per person
const rankPeople = [
  customer('c1', 'Musa (4)'),
  customer('c2', 'Grace (3)'),
  customer('c3', 'Chidi (5)'),
  customer('c4', 'Tunde (1)'),
  customer('c5', 'Idle (0)'),
]
const storedCounts = { c1: 4, c2: 0, c3: 2, c4: 1, c5: 0 }
const boughtCounts = { c1: 0, c2: 3, c3: 3, c4: 0, c5: 0 }

const rankTotals = rankCustomers({
  owners: rankPeople, storedCounts, boughtCounts, scope: 'all', by: 'activity',
})
const rankBuyers = rankCustomers({
  owners: rankPeople, storedCounts, boughtCounts, scope: 'buyers', by: 'activity',
})
const rankStoring = rankCustomers({
  owners: rankPeople, storedCounts, boughtCounts, scope: 'storing', by: 'activity',
})
const rankByName = rankCustomers({
  owners: rankPeople, storedCounts, boughtCounts, scope: 'all', by: 'name',
})
const rankTies = rankCustomers({
  owners: [customer('t1', 'A'), customer('t2', 'B'), customer('t3', 'C')],
  storedCounts: { t1: 4, t2: 4, t3: 1 },
  boughtCounts: {},
  scope: 'all',
  by: 'activity',
})

// Pure-function spot checks, including the edge cases that bite in the yard.
const units: [string, unknown, unknown][] = [
  ['groupDigits strips junk', groupDigits('a1b2c3,4'), '1,234'],
  ['groupDigits leading zeros', groupDigits('000450'), '450'],
  ['groupDigits empty', groupDigits('abc'), ''],
  ['parseCurrency', parseCurrency('12,500,000'), 12500000],
  ['parseCurrency empty', parseCurrency(''), null],
  ['formatNaira null', formatNaira(null), '—'],
  ['formatNairaCompact millions', formatNairaCompact(12_500_000), '₦12.5M'],
  ['formatNairaCompact zero', formatNairaCompact(0, '₦0'), '₦0'],
  ['formatDate no drift', formatDate('2026-03-01'), '1 Mar 2026'],
  ['formatDate null', formatDate(null), '—'],
  ['countBelongings', countBelongings(vehicles[0].belongings), 2],
  ['countBelongings junk', countBelongings(null), 0],
  ['vehicleTitle without year', vehicleTitle(vehicles[1]), 'Lexus RX 350'],
  ['telHref', telHref('+234 (803) 111-2222'), 'tel:+2348031112222'],
  [
    'normalizeBelongings drops rubbish',
    JSON.stringify(normalizeBelongings(['x', { item: '  ' }, { item: 'Jack', qty: '2' }])),
    JSON.stringify([{ item: 'Jack', qty: 2, note: null }]),
  ],
  [
    'normalizeBelongings parses a json string',
    normalizeBelongings('[{"item":"Mats","qty":4}]').length,
    1,
  ],
  [
    'normalizeVehicle coerces a numeric string price and array owner',
    normalizeVehicle({ ...vehicles[0], price: '900000.00', owner: [owner] } as never).price,
    900000,
  ],
  [
    'vin clash message',
    describeDbError({ code: '23505', message: 'duplicate key value violates unique constraint "vi_vehicles_vin_unique_idx"', details: 'Key (upper(vin))=(ABC) already exists.' }),
    'A vehicle with that VIN is already on record',
  ],
  [
    'missing vehicle message',
    describeDbError({ code: 'P0002', message: 'Vehicle x not found' }),
    'That vehicle could not be found. It may have been deleted.',
  ],
  // The exact PostgREST failure seen when saving an edit to a deleted row.
  [
    'PGRST116 by code',
    describeDbError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }),
    'That record no longer exists — someone may have deleted it. The list has been refreshed.',
  ],
  [
    'PGRST116 by message, as the UI received it',
    describeDbError({ message: 'Cannot coerce the result to a single JSON object' }),
    'That record no longer exists — someone may have deleted it. The list has been refreshed.',
  ],
  [
    'our own vanished-row error passes through intact',
    describeDbError(new Error('That staff member no longer exists. It may have been deleted.')),
    'That staff member no longer exists. It may have been deleted.',
  ],

  [
    'auth message',
    describeAuthError({ message: 'Invalid login credentials' }),
    'That email and password do not match an account.',
  ],
  ['toDateInputValue shape', /^\d{4}-\d{2}-\d{2}$/.test(toDateInputValue(new Date())), true],
  [
    'toDateTimeInputValue shape',
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(toDateTimeInputValue(new Date())),
    true,
  ],
  ['series length', series.length, 30],
  ['series ends today', series[29].date, today],
  ['held on the last day', series[29].held, 1],
  ['checked in today', series[29].checkedIn, 1],
  ['custody keys', totals.keys, 2],
  ['custody belongings', totals.belongings, 2],
  ['custody stock value', totals.stockValue, 12500000],

  // --- VIN validation -------------------------------------------------------
  // The canonical check-digit test vector.
  ['canonical VIN passes', checkVin('1HGBH41JXMN109186').checkDigitOk, true],
  ['canonical VIN well formed', checkVin('1HGBH41JXMN109186').wellFormed, true],
  ['check digit computed', vinCheckDigit('1HGBH41JXMN109186'), 'X'],
  // A single transposed character is caught.
  ['B->8 typo is caught', checkVin('1HG8H41JXMN109186').checkDigitOk, false],
  ['I/O/Q rejected', checkVin('1HGBH41JXMN1O9186').wellFormed, false],
  [
    'I/O/Q message',
    checkVin('1HGBH41JXMN1O9186').problem,
    'A VIN never contains the letters I, O or Q',
  ],
  ['short VIN rejected', checkVin('1HGBH41JX').wellFormed, false],
  ['empty VIN is not an error', checkVin('').problem, null],
  ['normalizeVin strips separators', normalizeVin(' jtd-kb20u 793094567 '), 'JTDKB20U793094567'],

  // Real misreads captured from vision models during model selection.
  // Gemini Flash returned 18 characters, Flash-Lite 19 — both rejected on length.
  ['gemini-flash 18-char misread rejected', checkVin('JTDKP2000093094567').wellFormed, false],
  ['gemini-lite 19-char misread rejected', checkVin('JTDKB20000093094567').wellFormed, false],
  // Qwen-30b's U->D slip passes the check digit (both transliterate to 4),
  // which is exactly why a read is shown for confirmation, never applied blind.
  ['U->D slip slips past the check digit', checkVin('JTDKB20D793094567').checkDigitOk, true],
  ['correct read passes', checkVin('JTDKB20U793094567').checkDigitOk, true],

  // --- WMI fallback and body class mapping ---------------------------------
  ['WMI 1HG -> Honda', makeFromWmi('1HGBH41JXMN109186'), 'Honda'],
  ['WMI JTD -> Toyota', makeFromWmi('JTDKB20U793094567'), 'Toyota'],
  ['WMI WBA -> BMW', makeFromWmi('WBA3A5C50DF123456'), 'BMW'],
  ['WMI unknown -> null', makeFromWmi('ZZZ3A5C50DF123456'), null],
  ['body class sedan', bodyTypeFromBodyClass('Sedan/Saloon'), 'Sedan'],
  ['body class hatchback', bodyTypeFromBodyClass('Hatchback/Liftback/Notchback'), 'Hatchback'],
  [
    'body class SUV',
    bodyTypeFromBodyClass('Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)'),
    'SUV',
  ],
  ['body class null', bodyTypeFromBodyClass(null), null],

  // --- Model reply parsing --------------------------------------------------
  // Verbatim replies captured from each model during selection.
  [
    'gemini wraps JSON in code fences',
    String(parseModelJson('```json\n{ "vin": "1HGBH41JXMN109186", "make": "Honda" }\n```')?.vin),
    '1HGBH41JXMN109186',
  ],
  [
    'qwen returns bare JSON',
    String(parseModelJson('{ "vin": "JTDKB20U793094567", "make": "Toyota" }')?.vin),
    'JTDKB20U793094567',
  ],
  [
    'haiku returns an explicit null VIN',
    parseModelJson('{"vin": null, "make": "Toyota", "confidence": "low"}')?.vin,
    null,
  ],
  [
    'prose around the JSON still parses',
    String(parseModelJson('Here you go:\n{"vin":"1HGBH41JXMN109186"}\nHope that helps')?.vin),
    '1HGBH41JXMN109186',
  ],
  ['unparseable reply returns null', parseModelJson('I cannot read this plate.'), null],

  // --- Applying a reading to the form --------------------------------------
  // The photo wins: existing values are overwritten, not preserved.
  [
    'overwrites a contradicting make',
    planVinApply(
      { vin: '', make: 'Honda', model: '', year: '', bodyType: '' },
      goodRead,
    ).updates.make,
    'Toyota',
  ],
  [
    'reports what it replaced',
    planVinApply(
      { vin: 'WBA3A5C50DF123456', make: 'BMW', model: '328i', year: '2013', bodyType: 'Sedan' },
      goodRead,
    ).replaced.join('|'),
    'VIN|make|model|year|body type',
  ],
  [
    'nothing counted as newly filled when all were occupied',
    planVinApply(
      { vin: 'WBA3A5C50DF123456', make: 'BMW', model: '328i', year: '2013', bodyType: 'Sedan' },
      goodRead,
    ).filled.length,
    0,
  ],
  [
    'fills an empty form and calls them filled, not replaced',
    planVinApply(EMPTY_FORM, goodRead).filled.join('|'),
    'VIN|make|model|year|body type',
  ],
  [
    'maps body class onto the select value',
    planVinApply(EMPTY_FORM, goodRead).updates.bodyType,
    'Hatchback',
  ],
  [
    'no change when the photo agrees, case-insensitively',
    Object.keys(
      planVinApply(
        { vin: 'jtdkb20u793094567', make: 'toyota', model: 'Prius', year: '2009', bodyType: 'Hatchback' },
        goodRead,
      ).updates,
    ).length,
    0,
  ],
  [
    'a field the decoder knows nothing about is left alone',
    planVinApply(
      { vin: '', make: '', model: 'Camry', year: '', bodyType: '' },
      { ...goodRead, model: null, bodyClass: null },
    ).updates.model,
    undefined,
  ],
  // --- Photo handling -------------------------------------------------------
  ['formatBytes MB', formatBytes(4_404_019), '4.2 MB'],
  ['formatBytes KB', formatBytes(310_000), '303 KB'],
  ['formatBytes bytes', formatBytes(512), '512 B'],
  ['5 MB limit matches the bucket', MAX_UPLOAD_BYTES, 5_242_880],
  // Mirrors the check constraint on vi_vehicles.photos.
  ['at most five pictures per vehicle', MAX_VEHICLE_PHOTOS, 5],
  [
    'oversize file rejected with its size',
    validatePhotoFile({ type: 'image/jpeg', size: 6_000_000, name: 'big.jpg' }),
    'big.jpg is 5.7 MB — the limit is 5.0 MB.',
  ],
  [
    'file exactly at the limit is allowed',
    validatePhotoFile({ type: 'image/jpeg', size: MAX_UPLOAD_BYTES, name: 'edge.jpg' }),
    null,
  ],
  [
    'non-image rejected',
    validatePhotoFile({ type: 'application/pdf', size: 1000, name: 'doc.pdf' }),
    'doc.pdf is not an image.',
  ],
  [
    'empty file rejected',
    validatePhotoFile({ type: 'image/png', size: 0, name: 'blank.png' }),
    'blank.png is empty.',
  ],
  ['ordinary photo accepted', validatePhotoFile({ type: 'image/heic', size: 2_000_000, name: 'a.heic' }), null],
  [
    'normalizePhotos drops rubbish rows',
    JSON.stringify(normalizePhotos(['x', { bytes: 1 }, { path: 'a.webp', bytes: '42' }])),
    JSON.stringify([{ path: 'a.webp', bytes: 42, width: 0, height: 0 }]),
  ],
  ['normalizePhotos on null', normalizePhotos(null).length, 0],
  [
    'vehicle normalizer keeps photos',
    normalizeVehicle({ ...vehicles[0], photos: [{ path: 'p.webp', bytes: 10, width: 1, height: 1 }] } as never)
      .photos[0].path,
    'p.webp',
  ],

  // --- Matching an owner by phone number ------------------------------------
  // The same line, typed the ways people actually type it.
  ['spaced national form', phoneKey('0803 111 2222'), '8031112222'],
  ['plain national form', phoneKey('08031112222'), '8031112222'],
  ['international with +234', phoneKey('+234 803 111 2222'), '8031112222'],
  ['international, dashes, no plus', phoneKey('234-803-111-2222'), '8031112222'],
  ['bare subscriber number', phoneKey('8031112222'), '8031112222'],
  ['parenthesised', phoneKey('(0803) 111-2222'), '8031112222'],
  ['too short to guess from', phoneKey('0803'), ''],
  ['empty', phoneKey(''), ''],
  ['null', phoneKey(null), ''],

  [
    'finds the owner by their first number, typed differently',
    findOwnersByPhone([owner], '+2348031112222')[0]?.full_name,
    'Amaka Okonkwo',
  ],
  [
    'finds the owner by their second number',
    findOwnersByPhone([owner], '07015554444')[0]?.full_name,
    'Amaka Okonkwo',
  ],
  ['a different number matches nobody', findOwnersByPhone([owner], '08099998888').length, 0],
  [
    'an owner being edited never matches itself',
    findOwnersByPhone([owner], '0803 111 2222', owner.id).length,
    0,
  ],
  ['a half-typed number suggests nothing', findOwnersByPhone([owner], '080').length, 0],

  // --- Condition, mileage, registration -------------------------------------
  ['mileage keeps its unit', formatMileage(84000, 'mi'), '84,000 mi'],
  ['mileage defaults to km', formatMileage(120000, null), '120,000 km'],
  ['no mileage recorded', formatMileage(null, 'km'), '—'],

  // --- Customer ranking -----------------------------------------------------
  ['busiest customer first', rankTotals.map((r) => r.owner.full_name).join('|'),
    'Chidi (5)|Musa (4)|Grace (3)|Tunde (1)|Idle (0)'],
  ['rank numbers assigned in order', rankTotals.map((r) => r.rank).join(','), '1,2,3,4,'],
  ['nobody with zero vehicles is ranked', rankTotals[4].rank, null],
  [
    // Grace and Chidi both bought 3, so they tie and break alphabetically.
    // Musa is top on the Everyone tab but has bought nothing, so he drops.
    'the Buyers tab ranks on purchases alone',
    rankBuyers.map((r) => r.owner.full_name).join('|'),
    'Chidi (5)|Grace (3)|Idle (0)|Musa (4)|Tunde (1)',
  ],
  ['tied buyers share first place', rankBuyers.slice(0, 2).map((r) => r.rank).join(','), '1,1'],
  [
    'the Storing tab ranks on vehicles held',
    rankStoring.map((r) => r.owner.full_name).join('|'),
    'Musa (4)|Chidi (5)|Tunde (1)|Grace (3)|Idle (0)',
  ],
  ['equal scores share a position', rankTies.map((r) => r.rank).join(','), '1,1,3'],
  ['sorting by name ignores the counts', rankByName.map((r) => r.owner.full_name).join('|'),
    'Chidi (5)|Grace (3)|Idle (0)|Musa (4)|Tunde (1)'],
  ['sorting by name assigns no rank', rankByName.every((r) => r.rank === null), true],

  // --- Sheet import -------------------------------------------------------
  ['header normalisation', normalizeHeader('Phone No.'), 'phoneno'],
  [
    'auto-maps a realistic header row',
    JSON.stringify(
      Object.entries(
        autoMapColumns(['Customer Name', 'Phone No.', 'Car Type', 'Model', 'Chassis Number', 'Year', 'Price (NGN)']),
      ).sort(),
    ),
    JSON.stringify(
      Object.entries({ ownerName: 0, ownerPhone: 1, make: 2, model: 3, vin: 4, year: 5, price: 6 }).sort(),
    ),
  ],
  ['a column maps only once', Object.values(autoMapColumns(['Name', 'Name'])).length, 1],

  // Dates, in the shapes a Nigerian yard's sheet actually holds them.
  ['ISO date', parseSheetDate('2026-03-01').value, '2026-03-01'],
  ['day-first slash date', parseSheetDate('14/03/2026').value, '2026-03-14'],
  ['two-digit year', parseSheetDate('14/03/26').value, '2026-03-14'],
  ['unambiguous day > 12 stays day-first', parseSheetDate('25/03/2026').value, '2026-03-25'],
  ['month > 12 is swapped', parseSheetDate('03/25/2026').value, '2026-03-25'],
  [
    'ambiguous date warns about the assumption',
    (parseSheetDate('03/04/2026').warning ?? '').includes('day first'),
    true,
  ],
  ['Excel serial number', parseSheetDate('45717').value, '2025-03-01'],
  ['Excel serial, second check', parseSheetDate('45730').value, '2025-03-14'],
  ['blank date falls back to today', parseSheetDate('', new Date(2026, 9, 23)).value, '2026-10-23'],
  [
    'unreadable date warns rather than failing the row',
    (parseSheetDate('next tuesday', new Date(2026, 9, 23)).warning ?? '').includes('used today'),
    true,
  ],
]

const importMapping = {
  ownerName: 0, ownerPhone: 1, make: 2, model: 3, vin: 4, year: 5, price: 6,
  keys: 7, bodyType: 8, intakeDate: 9, condition: 10, mileage: 11, registration: 12,
} as const

const importRows = prepareRows({
  rows: [
    ['Musa Ibrahim', '0803 111 2222', 'Toyota', 'Corolla', 'JTDKB20U793094567', '2009', '₦12,500,000', '2', 'Sedan', '14/03/2026', 'Nigerian Used', '84,000 km', 'Tokunbo'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Grace Eze', '0701 999 8888', 'Honda', 'Accord', '1HGBH41JXMN109186', '1991', '4,500,000', '1', 'saloon', ''],
    ['Copycat', '0805 000 1111', 'Kia', 'Rio', 'JTDKB20U793094567', '2015', '', '', '', ''],
    ['Dup Of Existing', '0812 777 6666', 'Mazda', '3', 'WBA3A5C50DF123456', '2013', '', '', '', ''],
    ['Bad Year', '0806 222 3333', 'Ford', 'Focus', '', '1776', '', '', '', ''],
    ['Amaka Okonkwo Mistyped', '+234 803 111 2222', 'Lexus', 'RX', '', '', '', '', '', ''],
  ],
  mapping: importMapping,
  existingOwners: [owner],
  existingVins: new Set(['WBA3A5C50DF123456']),
  today: new Date(2026, 9, 23),
})

const byLine = (n: number) => importRows.find((r) => r.lineNumber === n)!

const moreUnits: [string, unknown, unknown][] = [
  ['every row is prepared', importRows.length, 7],
  ['row numbers match the sheet (header is row 1)', importRows[0].lineNumber, 2],

  ['a good row has no errors', byLine(2).errors.length, 0],
  ['price symbols and commas stripped', byLine(2).vehicle.price, 12500000],
  ['day-first date applied', byLine(2).vehicle.intake_date, '2026-03-14'],
  ['keys parsed', byLine(2).vehicle.keys_count, 2],

  ['an empty row reports every missing required field', byLine(3).errors.length, 4],
  ['"saloon" is a Sedan', byLine(4).vehicle.body_type, 'Sedan'],
  ['missing date defaults to today', byLine(4).vehicle.intake_date, '2026-10-23'],
  ['keys default to 1', byLine(4).vehicle.keys_count, 1],

  [
    'a VIN repeated inside the file is caught',
    byLine(5).errors.some((e) => e.includes('Same VIN as row 2')),
    true,
  ],
  [
    'a VIN already in the database is caught',
    byLine(6).errors.some((e) => e.includes('already on record')),
    true,
  ],
  ['an impossible year blocks the row', byLine(7).errors.length > 0, true],
  [
    'a known phone attaches to the existing owner',
    byLine(8).owner.existingOwnerId,
    owner.id,
  ],
  [
    'and warns that the name differs',
    byLine(8).warnings.some((w) => w.includes('Amaka Okonkwo')),
    true,
  ],
  ['only the clean rows import', importableRows(importRows).length, 3],
  ['"Nigerian Used" is a used car', byLine(2).vehicle.condition, 'used'],
  ['mileage with a comma and unit', byLine(2).vehicle.mileage, 84000],
  ['mileage unit detected', byLine(2).vehicle.mileage_unit, 'km'],
  ['"Tokunbo" means foreign registration', byLine(2).vehicle.registration, 'foreign'],
]

units.push(...moreUnits)

const _unusedTail: [string, unknown, unknown][] = [
  [
    'an unreadable photo changes nothing',
    Object.keys(
      planVinApply(
        { vin: '', make: 'Honda', model: '', year: '', bodyType: '' },
        { vin: null, readable: false, confidence: 'low', notes: null },
      ).updates,
    ).length,
    0,
  ],
]
units.push(..._unusedTail)

let failed = 0

for (const [name, ok] of checks) {
  if (!ok) {
    failed += 1
    console.log(`FAIL  render: ${name}`)
  }
}

for (const [name, actual, expected] of units) {
  if (actual !== expected) {
    failed += 1
    console.log(`FAIL  ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
  }
}

console.log(
  failed === 0
    ? `OK  ${checks.length} render checks and ${units.length} unit checks passed (${html.length} bytes of HTML)`
    : `${failed} check(s) failed`,
)
process.exit(failed === 0 ? 0 : 1)
