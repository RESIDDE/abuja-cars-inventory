# AbujaCar Inventory

A vehicle inventory and custody dashboard for a car business in Abuja. It
tracks vehicles held on site on behalf of their owners: what came in, what it
arrived with, who owns it, and every time it changes hands.

## Stack

Vite · React 18 · TypeScript · Tailwind CSS · shadcn/ui (Radix) · Supabase
(Postgres + Auth) · TanStack Query v5 · react-hook-form + zod · sonner ·
Recharts · lucide-react. The `@/` path alias points at `src/`.

## Getting started

```bash
npm install
cp .env.example .env     # then fill in your Supabase URL and anon key
npm run dev
```

Until `.env` has credentials the app renders a setup notice instead of trying
to sign anyone in.

### Database

Run `supabase/migrations/20261022090000_init.sql` once against your project — the SQL
editor in the Supabase dashboard, or `supabase db push`. It creates:

- `vi_owners`, `vi_vehicles`, `vi_vehicle_events`
- an `update_updated_at()` trigger on both tables that have `updated_at`
- a **partial unique index on `upper(vin)`** where the VIN is present, so a VIN
  identifies exactly one physical vehicle while any number of records may still
  have no VIN recorded
- RLS on all three tables, with full access for authenticated users
- `vi_record_movement(...)`, which is the only way custody should change

### Auth

Email and password, via Supabase. `/login` toggles between signing in and
creating an account, and also wires up a password reset and a magic link —
both returning to `/dashboard`. Set your site URL and that redirect under
**Authentication → URL Configuration** in the Supabase dashboard, or the
emailed links will bounce.

## On a phone

The platform-layer fixes that separate "a website in a browser" from something
that feels installed. Each is one declaration, and each is there for a reason:

| Symptom | Fix |
| --- | --- |
| Page zooms in on an input and never zooms back | Inputs are 16px under `(pointer: coarse)` |
| Hover state stuck after a tap | `hoverOnlyWhenSupported`, plus `(hover: hover)` around the hand-written rules |
| Grey flash on tap | `-webkit-tap-highlight-color: transparent`, with `:active` feedback to replace it |
| Pull-to-refresh hijacks a scroll | `overscroll-behavior: none` on the root, `contain` on dialogs |
| Content under the notch or home indicator | `viewport-fit=cover` plus `env(safe-area-inset-*)` on the header, main and dialogs |
| Taps feel laggy | `touch-action: manipulation` on controls |
| Long press selects a button's label | `user-select: none` on controls only — never on `<a>`, since the tel: and mailto: links are content people copy |

**Pinch-zoom is disabled**, by request — see [src/lib/lock-zoom.ts](src/lib/lock-zoom.ts),
which documents the three mechanisms it takes and how to undo it. The viewport
meta covers Android, `touch-action: pan-x pan-y` is the standards-based half,
and a `gesture*` listener is needed because iOS Safari has ignored
`user-scalable=no` since iOS 10.

This has a real cost: nobody can pinch to read small text. It is mitigated
rather than ignored — inputs are 16px so nothing needs zooming to read or type,
and the detail-page gallery opens photos in a new browser tab, which keeps its
own normal zoom, so a VIN plate can still be inspected closely.

Tailwind v3's `hoverOnlyWhenSupported` does not cover `group-hover`, which
compiles to `.group:hover .group-hover\:x`. Those decorative nudges are
neutralised under `@media (hover: none)` instead.

## Deploying

The app is a static bundle plus a Supabase project. [vercel.json](vercel.json)
handles the two things a Vite SPA needs on Vercel:

- **A rewrite to `index.html`.** Routing is client-side, so without it
  `/dashboard` and `/vehicles/:id` return 404 on a refresh or a shared link.
  Vercel checks the filesystem before applying rewrites, so `/assets/*` is
  unaffected.
- **Cache headers.** Asset filenames carry a content hash and are cached for a
  year; `index.html` is never cached, or a deploy would keep serving the old
  asset names.

### Environment variables

Set these in the host's dashboard, not in a file — `.env` is gitignored and
never reaches the build:

```
VITE_SUPABASE_URL       https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY  <anon key>
```

`VITE_*` variables are read **at build time**, so changing them requires a
redeploy; editing them alone does nothing to the running site. If the deployed
app shows the "Connect your Supabase project" screen, these are missing — the
bundle will contain `localhost:54321` instead of the project URL, which is worth
checking directly before assuming anything else is wrong.

**Do not set `VITE_OPENROUTER_API_KEY` on the host.** It is a development
convenience only, gated behind `import.meta.env.DEV`; in production VIN reading
goes through the `decode-vin` edge function, which holds the key server-side.

### Auth redirect URLs

Supabase must know the deployed origin or every confirmation, reset and magic
link will send people to localhost. Under **Authentication → URL Configuration**,
or in `supabase/config.toml` followed by `supabase config push`:

```toml
site_url = "https://<your-domain>"
additional_redirect_urls = ["https://<your-domain>/**", "http://localhost:5173/**"]
```

Vercel preview deployments get their own generated hostnames, which will not
match. Either test auth on the production domain, or add a specific preview URL
— not a `*.vercel.app` wildcard, which would let any site on that domain
receive your auth redirects.

## Scripts

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Dev server on http://localhost:5173                       |
| `npm run build`     | Typecheck, then a production build                        |
| `npm run typecheck` | `tsc -b` on its own                                       |
| `npm run lint`      | oxlint over `src`                                         |
| `npm run smoke`     | Renders the component layer with fixture data and asserts |
| `npm run verify:live` | Runs the app's real queries against the live project (needs `.env`) |
|                     | the formatting, normalising and error-mapping helpers      |

## Routes

| Route            | Screen                                             |
| ---------------- | -------------------------------------------------- |
| `/login`         | Sign in / create account                           |
| `/dashboard`     | Overview, charts and tiles                         |
| `/vehicles`      | List, search, status filter, check-in form         |
| `/vehicles/:id`  | Full record and movement timeline                  |
| `/owners`        | Owner list and CRUD                                |

Everything except `/login` sits behind the auth guard. The vehicle list reads
its filters from the URL (`?status=in_stock|released`, `?owner=<id>`), so
dashboard tiles can deep-link into a filtered view and it survives a refresh.
`?new=1` opens the check-in form.

## Settings, and who counts as staff

Reached from the profile menu in the nav. Two lists live there, and they are
deliberately not the same thing:

| | What it is | Managed where |
| --- | --- | --- |
| `vi_staff_members` | People who **handle vehicles**. Fills the "Handled by" dropdown on a movement. No login required. | Settings page |
| `vi_staff` | Accounts that **can sign in**. Every row points at an `auth.users` record. | SQL only |

A yard hand who hands a car back may never sign in to anything, so needing an
account to be named on a movement would be wrong. Equally, the app cannot grant
itself access — the login allowlist is shown on the Settings page read-only.

Staff who leave are marked as left rather than deleted: movements they handled
keep their name, and the name drops out of the dropdown. Deleting is offered,
but the confirmation points at the better option.

Names are unique on `lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))`, so
`"Bayo  Adeyemi"`, `"bayo adeyemi"` and `"  BAYO   ADEYEMI "` are one person,
while `"Bayo Adeyemo"` is someone else. The first version of that index used
plain `btrim` and let inner double-spaces through — worth testing rather than
assuming.

The movement dialog falls back to a free-text field when nobody is listed yet,
and always offers "Someone else…", so a cover shift is never a reason to leave
the field blank.

## A trap: two foreign keys to the same table

`vi_vehicles` points at `vi_owners` twice — `owner_id` and `buyer_id`. The
moment the second one existed, this embed stopped working:

```ts
'*, owner:vi_owners(*)'   // 300: more than one relationship was found
```

PostgREST will not guess which foreign key is meant, so the embed has to name
it:

```ts
'*, owner:vi_owners!owner_id(*), buyer:vi_owners!buyer_id(*)'
```

Every unit test stayed green through that break, because they run against
fixtures and never touch PostgREST. `npm run verify:live` exists for exactly
this class of failure: it issues the app's real select strings, every column
the client reads, and `vi_record_movement` with every argument, against the
live project. **Run it after any migration.**

## Ranking customers

The customers page lists the busiest first — alphabetical stops being useful
the moment the list is longer than a screen. An **Order by** toggle switches
back to A–Z.

The score follows the tab you are on: **Buyers** ranks on purchases alone,
**Storing** on vehicles held, **Everyone** on the two together. Ranking the
Buyers list by a combined total would put somebody who has bought nothing above
somebody who has bought three.

Ties share a position — two customers with four cars each are both #1, not one
of them arbitrarily second — and break alphabetically so the order never
shuffles between renders. Anybody with no vehicles gets no rank at all rather
than a meaningless one. The top three are marked with a trophy.

The logic is pure and in [src/lib/rank-customers.ts](src/lib/rank-customers.ts),
so the ordering is tested without a database.

## Sold is terminal

A sold vehicle cannot be released or checked back in. This is enforced in
`vi_record_movement`, not only hidden in the UI — it reads the current status
`for update` (so two people cannot both see "not sold yet" and both write) and
refuses any movement other than another sale.

It mattered because the old behaviour silently corrupted the record: checking a
sold vehicle back in reset it to `in_stock` and cleared `sold_date` while
leaving `sale_price` and `buyer_name` in place, so it looked both on the lot and
sold at once.

**Recording the sale again is still allowed**, so a wrong price or buyer can be
corrected — the detail page offers "Correct sale". That leaves a second `sold`
event, which is an honest trail of the correction rather than a silent edit.
A released vehicle can still be checked back in, as before.

## Buyers are customers, not a separate list

A buyer is a row in `vi_owners` like anybody else, linked from the vehicle by
`buyer_id`. The same person may store a car with you *and* buy one, with one
name and one phone number either way — and the phone matching then works across
both relationships, so recording a sale to an existing customer does not create
a second copy of them.

`buyer_id` is **`on delete set null`**, unlike `owner_id` which cascades.
Removing a customer must never delete a vehicle somebody bought; it only forgets
who bought it, and `buyer_name` is kept alongside so the sale still reads.
Verified: deleting a buyer leaves the vehicle and its name intact, while
deleting the owner still cascades.

The customers page has **Everyone / Storing / Buyers** tabs, each card counts
both relationships, and a buyer's card lists the vehicles they bought with the
price and date. The dashboard has a matching **Sold** tab.

Recording a sale **requires** a buyer — existing or new. A sale with nothing but
a typed name is what makes the customer list useless six months later.

## Selling a vehicle

**Sold** sits alongside In Stock and Released as a third state, not a flag. A
sold vehicle has left the yard like a released one, but ownership and money
moved too, so the status constraint, the event type and `vi_record_movement`
were extended together — a sale cannot be recorded without its movement.

A sale sets `sold_date`, `sale_price` and `buyer_name`, deducts the keys handed
over, **and sets `released_date`**. That last one matters: the dashboard's "held
on this day" figure keys off `released_date`, so without it a sold vehicle would
go on counting as if it were still on the lot.

The sale price defaults to the asking price on the record, and the buyer's name
and signature use the same fields as any other movement — "Sold to" rather than
"Released to".

## Condition, mileage, registration, interior

On the vehicle record and on the import:

| Field | Notes |
| --- | --- |
| Condition | New or Used |
| Mileage | **With a unit.** A US import's odometer reads miles and a European one km; 100,000 of each is a very different car, so the unit is stored rather than assumed |
| Registration | Registered in Nigeria, or foreign / not registered here |
| Interior | Free text — "Black leather" |

The importer reads how these are actually written locally: "Nigerian Used" and
"Tokunbo" are both *used*, "Tokunbo", "Belgium" and "foreign used" all mean
foreign registration, and mileage accepts `84,000`, `84000 km` and `52k miles`.

## Signatures on a movement

Releasing or checking a vehicle back in offers a signature pad — finger, stylus
or mouse. The image is WebP, stored in a **private** `movement-signatures`
bucket and shown through signed URLs, like the vehicle photos.

The pad keeps strokes as points and redraws them rather than painting straight
to the canvas. A canvas loses its bitmap whenever its backing size changes, so
a signature would otherwise vanish when the keyboard opens or the phone turns.
The canvas sets `touch-action: none`, overriding the page's `pan-x pan-y`, or
signing would scroll the dialog instead of drawing.

The upload happens *before* the movement is recorded, so the path goes into the
same transaction as the custody change rather than being attached afterwards.

That bucket grants staff **select and insert only — no update or delete**.
A signature is evidence attached to a movement, and swapping or quietly
removing one while leaving the movement intact is exactly what should not be
possible from the app. The trade is that a failed write can leave an orphaned
object, and deleting a vehicle leaves its signatures behind; clean those up in
the Supabase dashboard if it ever matters.

### Fingerprints

Not possible, and not a question of screen space. No browser API can capture a
fingerprint from a customer. WebAuthn authenticates the *device owner* with
their own Touch ID and never exposes an image, so it cannot enrol a stranger.
Capturing one would need a dedicated scanner and a native bridge; the signature
is the web's answer to this.

## Keys changing hands

Releasing or checking a vehicle back in records **how many keys moved**, with a
stepper rather than a text field — it gets used one-handed next to a car.

The number is not just logged, it adjusts what the yard holds:

| Movement | Effect on `vi_vehicles.keys_count` |
| --- | --- |
| Released with *n* | `greatest(0, held - n)` — never negative |
| Checked in with *n* | `held + n` |
| Either, not recorded (`null`) | unchanged |

Null meaning "not recorded" is what lets the opening check-in leave the count
alone, so intake does not double up on the keys the form already captured.

The defaults follow what normally happens: releasing offers every key the yard
holds, checking back in offers however many went out last time. If fewer come
back than went out, the dialog says so and asks for a note. It never blocks —
sometimes a key really is lost, and the log should say that rather than refuse
to record it.

## Importing a spreadsheet

`/import`, reached from the Vehicles page or the account menu. Each row becomes
its own vehicle record attached to its owner, and **nothing is written until you
have seen exactly what will be created**.

Four steps: choose a CSV or `.xlsx`, confirm the column mapping (guessed from
your headings), review a row-by-row preview, then import. A blank template is
downloadable from step one.

**Parsers.** `papaparse` for CSV, `exceljs` for `.xlsx`. Deliberately **not**
`xlsx`/SheetJS: the npm build carries two HIGH advisories — prototype pollution
and ReDoS — with **no fix published** there, and pointing that at a file
somebody emailed you is a poor trade. exceljs loads only when an `.xlsx` is
actually opened, so the 929 KB parser never reaches anyone importing CSV.

**It expects real-world sheets**, not clean ones:

- A UTF-8 BOM from Excel's "CSV UTF-8" export, which would otherwise corrupt the
  first header so that column silently fails to map
- Quoted fields containing commas, and CRLF line endings
- Blank rows, which are counted and skipped
- Prices as `₦12,500,000`, `NGN 4500000` or `4500000.00`
- Dates as ISO, `14/03/2026` (day-first, the local convention), two-digit years,
  Excel serial numbers, or a real Date cell
- **Local vocabulary**: "Saloon" is a Sedan and "Jeep" is an SUV — in a body-type
  column that is a shape, not a manufacturer

**Validation happens before anything is written.** A row is skipped, with the
reason against its line number, for a missing required field, an impossible
year, a malformed VIN, a VIN already on record, or a VIN repeated earlier in the
same file. Softer problems become notes and still import.

**Owners are matched by phone**, using the same last-ten-digits rule as the
check-in form, so a sheet listing one customer's five cars creates one owner.
If the number already belongs to somebody, the vehicle attaches to them and the
preview says so.

**Failures are isolated.** Vehicles insert in chunks of 25; if a chunk fails the
rows are retried individually, so one bad record is reported rather than taking
twenty-four good ones down with it.

Opening `checked_in` events are inserted directly rather than through
`vi_record_movement`. These rows are created as `in_stock`, so there is no
status transition to keep in step, and one round trip per vehicle would be
painful on a sheet of several hundred.

## Not creating the same customer twice

Typing a phone number into the "New" owner section checks it against everyone
already on record, and suggests the match. In the check-in form the suggestion
carries a **Use this owner** button that switches to the existing record; in the
Owners dialog, where there is nothing to switch to, it only warns.

Matching compares the **last ten digits**, because the same line gets typed as
`0803 111 2222`, `08031112222`, `+234 803 111 2222` and `234-803-111-2222`, and
those all have to collapse onto one key. Both of an owner's numbers are checked,
an owner being edited never matches itself, and fewer than seven digits suggests
nothing at all.

It suggests; it never blocks. Two people genuinely do share a number sometimes.

## Pictures of the vehicle

The check-in form takes up to **five** pictures of the car, below the owner
section. Each one is capped at 5 MB and **converted to WebP in the browser**
before it is uploaded, and the form shows the before-and-after so the saving is
visible.

The encoder aims at **150 KB** rather than using one fixed quality. It resizes
to 1600px, encodes at 0.78, then walks the quality ladder down — 0.70, 0.62,
0.54, 0.46 — stopping at the first result under target; if it bottoms out still
too large it redraws at 1200px and tries again, keeping the smallest attempt
either way. A plain shot of a door panel lands at the top of the ladder, a busy
forecourt further down.

The floor is deliberate. These are condition photographs and somebody will zoom
in later to argue about a scratch, so "as small as possible" is bounded by
staying legible: below about 0.46 WebP goes visibly blocky, and below 1200px a
plate stops being readable.

They go to a **private** `vehicle-photos` bucket, not a public one: these are
photographs of customers' cars, usually with plates visible. They are displayed
through signed URLs that expire after an hour. The bucket itself rejects
anything that is not `image/webp` or larger than 5 MB, so the browser-side check
is a convenience rather than the control.

Uploads happen only after the vehicle row exists, so abandoning the form leaves
nothing behind in the bucket. If a save fails after the pictures went up, they
are removed again. If the pictures fail but the vehicle saved, the check-in
stands and the toast says what did not upload — the record matters more than the
photographs.

Both limits are enforced in the database as well as the browser: the bucket
rejects anything that is not `image/webp` or over 5 MB, and a check constraint
on `vi_vehicles.photos` rejects a sixth picture. The browser checks stop
somebody picking one; these stop anything else writing one.

Access follows the same staff rule as everything else: four policies on
`storage.objects` scoped to `vi_is_staff()`.

## Reading the VIN from a photo

On the check-in form you can photograph the VIN plate (or pick files — up to
three angles of the same plate). A vision model reads the characters, and the
make, model, year and body type are filled in for you.

### How it works, and why it is built this way

1. Photos are resized to 1600px and re-encoded as JPEG **in the browser**, before
   anything is sent. A raw phone photo is several megabytes of detail no OCR needs.
   These are sent for reading only and never stored — vehicle pictures are a
   separate thing, above.
2. The `decode-vin` edge function sends them to OpenRouter and asks for the VIN,
   a confidence, and the character positions the model was unsure of.
3. The reading is validated locally: 17 characters, no I/O/Q, and the check digit
   in position 9.
4. The make comes from **NHTSA's free vPIC decoder**, not from the model. Asking a
   model to name the make is unreliable — in testing one returned a Toyota VIN
   labelled "Honda". vPIC also returns the model, year and body class. The model's
   own guess is only a fallback, and the UI says which source was used.
5. The reading wins. Fields already holding a different value are overwritten —
   the plate is the source of truth, and a half-corrected record is worse than one
   that matches what was read. The toast names whatever it replaced, so the change
   is never silent. A field the decoder says nothing about is left alone: a missing
   model must not wipe a model somebody typed.

### The API key never reaches the browser

Anything in a `VITE_*` variable is compiled into the bundle every visitor
downloads, so a key put there can be read and spent by anyone. The key lives in
the edge function:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set OPENROUTER_API_KEY=sk-or-...
npx supabase functions deploy decode-vin
```

For local development only, setting `VITE_OPENROUTER_API_KEY` in `.env` lets the
browser call OpenRouter directly so you can try the feature before deploying.
That path is guarded by `import.meta.env.DEV`, which is statically false in a
production build — the module and the key are dropped from the bundle entirely.
`npm run build` is checked for this: no `sk-or-` string appears in `dist/`.

### Choosing the model

`OPENROUTER_MODEL` (function secret) or `VITE_OPENROUTER_MODEL` (dev) override the
default, `qwen/qwen3-vl-235b-a22b-instruct`. It was picked by testing candidates
against deliberately poor photos of a known VIN:

| Model | Clean plate | Glare-washed plate |
| --- | --- | --- |
| `qwen/qwen3-vl-235b-a22b-instruct` | exact | **exact**, flagged the two glared characters |
| `anthropic/claude-haiku-5.5` | exact | cautious; explains what it cannot see |
| `qwen/qwen3-vl-30b-a3b-instruct` | exact | one character wrong |
| `google/gemini-2.5-flash` | exact | 18 characters, "high" confidence |
| `google/gemini-2.5-flash-lite` | exact | 19 characters, **and the wrong make** |

A read costs roughly $0.0003.

### Why a reading is always shown, never applied silently

The check digit catches most misreadings, but not all: `D` and `U` both
transliterate to 4, so reading `JTDKB20D…` for `JTDKB20U…` passes validation. A
VIN identifies one physical vehicle and this app refuses duplicates on that
basis, so the reading is always displayed — with the doubtful character positions
called out — for a person to confirm against the plate.

A cropped photo is rejected rather than accepted short, and the rejected reading
is shown so the problem is obvious. An image with no VIN in it returns nothing
rather than an invention.

## Things worth knowing before you change anything

**Custody changes go through `vi_record_movement`.** It updates the vehicle's
status and inserts the log row in one transaction. Doing those as two client
calls means a failure between them leaves a vehicle whose status changed with
nothing in the log to say who moved it, which defeats the point of keeping one.
Checking in a new vehicle writes its opening `checked_in` event through the
same function, so a vehicle's history is never empty.

**The auth context publishes in one state update.** `user`, `session` and
`isLoading` land together. Setting the user first and then awaiting a follow-up
fetch renders a frame of half-initialised auth, and the route guards flash a
wrong screen before correcting themselves. Anything else the context needs must
be awaited *before* that `setState`.

**Two things silently destroy the glass effect:**

1. Radix mounts dialogs, selects and toasts in a portal on `<body>`, outside the
   React tree, so a theme class on a wrapper div never reaches them. `useThemeClass`
   puts it on `<html>` and `<body>` instead.
2. A CSS `filter` on any ancestor creates a backdrop root and neutralises every
   `backdrop-filter` inside it. Page transitions animate opacity and transform
   only — never `filter`.

**The retuned `.bg-card` and `.bg-popover` live in `@layer utilities`,** not
`@layer components`. Tailwind emits its own `.bg-card` utility after the
components layer, so an override there would simply lose and dropdowns would
render as flat opaque panels.

**`[role="alertdialog"]` is listed alongside `[role="dialog"]`** in the surface
styling, because Radix gives `AlertDialog.Content` the former. Style only
`dialog` and every confirmation panel loses its background.

## Sharing this Supabase project with another application

Supabase auth is **per project, not per application**. Anyone who signs up
through any app on the project receives a token with the role `authenticated`
for the whole project. So a policy written as

```sql
for all to authenticated using (true)
```

grants that person access to this app's data — owner names, phone numbers,
addresses, vehicle prices — even though they never used this app. That is the
default pattern in most Supabase tutorials, and it is only safe on a project
with a single application.

[supabase/migrations/20261022090100_staff_scope.sql](supabase/migrations/20261022090100_staff_scope.sql)
replaces it with an explicit allowlist: a `vi_staff` table plus a `vi_is_staff()`
helper, and policies that require membership. Access then depends on being named
staff, not on merely holding an account.

**Applying it locks everyone out until they are listed.** Add yourself in the
same SQL editor session — the statement is at the bottom of that file.

The `decode-vin` function is gated the same way, so a user of the other
application cannot spend your OpenRouter credit. It checks `vi_staff` with the
caller's own token, needs no service-role key, and falls back to allowing any
authenticated caller (with a logged warning) if the migration has not been
applied yet.

Worth checking the other direction too: if that other application also uses
`using (true)`, your staff can read its tables.

## Brand

The AbujaCar badge lives in [public/](public/) and is served at a stable path, so
`index.html`'s icon tags and the in-app mark reference the same file:

| File | Used for |
| --- | --- |
| `abujacar-logo.png` (400px) | the circular badge in the top nav and on the sign-in screen |
| `abujacar-wordmark.png` | the "ABUJACAR" wordmark beside the badge in the nav |
| `abujacar-wordmark-light.png` | the same wordmark unaltered, for a dark background |
| `favicon-32.png`, `favicon-16.png` | browser tab |
| `apple-touch-icon.png` (180px) | iOS home screen |
| `icon-192.png` | spare, for a web manifest if one is added |

The supplied wordmark sets "ABUJA" in white, which is invisible against this
app's light sage surfaces — only "CAR" would have read. Rather than filter it in
CSS, `abujacar-wordmark.png` is a recoloured copy: the white glyphs are redrawn
in the foreground ink, the red is untouched, and the alpha channel is preserved
so the antialiasing survives. The original is kept as `-light.png` for anywhere
dark. Both are cropped to the ink, so their height alone controls their size.

In the nav the wordmark is decorative, and the link takes its accessible name
from an `sr-only` span — the wordmark is hidden below `md`, where the badge
alone carries the brand, and the name has to hold at every width.

All icons are generated from the same 400px artwork, never upscaled. The badge
is already circular on a black field with a white ring just inside the edge, so
`BrandMark` crops it to a circle — that lands on the ring and trims only the
black corners. It is marked decorative, because the word "AbujaCar" sits beside
it as real text in both places it appears.

## Design system

A light "sage glass" look with a chartreuse accent, Poppins 300–600. The
palette is defined as shadcn-convention HSL triplets on `:root` and
`.theme-sage` in [src/index.css](src/index.css), along with the three frosted
surfaces (`.glass-hero`, `.glass-tile`, `.glass-tile-solid`). The dialog
overlay is a soft sage dim rather than a dark one — black both fights the light
page and makes the panel's own `backdrop-filter` sample near-black, so the
"frosted" panel renders grey.
