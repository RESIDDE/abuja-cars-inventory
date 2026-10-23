/*
 * Runs the queries the app actually issues against the real project.
 *
 * The fixture suite cannot see this class of break: adding buyer_id gave
 * vi_vehicles a second foreign key to vi_owners, which made an unqualified
 * embed ambiguous and every vehicle query fail with a 300 — while every unit
 * test stayed green. Needs .env; not part of `npm run smoke`.
 */
import { supabase } from '@/lib/supabase'
import { vehicleKeys } from '@/hooks/use-vehicles'

const results: [string, boolean, string][] = []

async function check(name: string, run: () => Promise<{ error: unknown }>) {
  const { error } = await run()
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : ''
  results.push([name, !error, message])
}

// Exactly the select strings the hooks use.
const SELECT_WITH_OWNER = '*, owner:vi_owners!owner_id(*), buyer:vi_owners!buyer_id(*)'

await check('vehicles list (with owner + buyer embed)', () =>
  supabase.from('vi_vehicles').select(SELECT_WITH_OWNER).order('created_at', { ascending: false }).limit(1),
)
await check('single vehicle', () =>
  supabase.from('vi_vehicles').select(SELECT_WITH_OWNER).limit(1).maybeSingle(),
)
await check('owners list', () =>
  supabase.from('vi_owners').select('*').order('full_name', { ascending: true }).limit(1),
)
await check('owner vehicle counts', () => supabase.from('vi_vehicles').select('owner_id').limit(1))
await check('vehicle events', () =>
  supabase.from('vi_vehicle_events').select('*').order('occurred_at', { ascending: false }).limit(1),
)
await check('staff members', () =>
  supabase.from('vi_staff_members').select('*').order('active', { ascending: false }).limit(1),
)
await check('staff accounts', () =>
  supabase.from('vi_staff').select('user_id, full_name, added_at').limit(1),
)

// Every column the client reads, named explicitly — a dropped or renamed one
// shows up here rather than as an undefined on a card.
await check('every vehicle column the client reads', () =>
  supabase
    .from('vi_vehicles')
    .select(
      'id,owner_id,make,model,body_type,year,vin,color,plate_number,keys_count,' +
        'condition,mileage,mileage_unit,registration,interior,belongings,photos,price,' +
        'status,intake_date,released_date,sold_date,sale_price,buyer_name,buyer_id,' +
        'notes,created_at,updated_at',
    )
    .limit(1),
)
await check('every event column the client reads', () =>
  supabase
    .from('vi_vehicle_events')
    .select('id,vehicle_id,event_type,occurred_at,staff_name,recipient_name,notes,keys_count,signature_path,created_by,created_at')
    .limit(1),
)

// The movement function, with every argument the client sends. A missing
// vehicle is the expected outcome; a 404 would mean the signature drifted.
const { error: rpcError } = await supabase.rpc('vi_record_movement', {
  p_vehicle_id: '00000000-0000-0000-0000-000000000000',
  p_event_type: 'sold',
  p_occurred_at: new Date().toISOString(),
  p_staff_name: null,
  p_recipient_name: null,
  p_notes: null,
  p_keys_count: 1,
  p_signature_path: null,
  p_sale_price: 1,
  p_buyer_id: null,
})
const rpcMessage = rpcError?.message ?? ''
results.push([
  'vi_record_movement accepts every argument the client sends',
  rpcMessage.includes('not found'),
  rpcMessage.includes('Could not find the function')
    ? `signature drifted: ${rpcMessage}`
    : rpcMessage,
])

let failed = 0
for (const [name, ok, message] of results) {
  if (!ok) {
    failed += 1
    console.log(`FAIL  ${name}${message ? `: ${message.slice(0, 120)}` : ''}`)
  }
}
console.log(
  failed === 0
    ? `OK  ${results.length} live schema checks passed`
    : `${failed} of ${results.length} live schema checks failed`,
)
process.exit(failed === 0 ? 0 : 1)
