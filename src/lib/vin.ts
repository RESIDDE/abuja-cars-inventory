/**
 * VIN helpers.
 *
 * A VIN identifies one physical vehicle, and this app refuses duplicates on
 * that basis, so it is worth checking a VIN before it enters a record. The
 * check digit catches most OCR slips — but NOT all of them: D and U both
 * transliterate to 4, so reading "JTDKB20D…" for "JTDKB20U…" passes the check.
 * That is why a decoded VIN is always shown for a person to confirm rather
 * than filled in silently.
 */

const TRANSLITERATION: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

/** I, O and Q are never used — they read as 1, 0 and 0. */
export const VIN_FORBIDDEN = /[IOQ]/

export function normalizeVin(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function vinCheckDigit(vin: string): string | null {
  const value = normalizeVin(vin)
  if (value.length !== 17) return null
  let total = 0
  for (let i = 0; i < 17; i += 1) {
    const digit = TRANSLITERATION[value[i]]
    if (digit === undefined) return null
    total += digit * WEIGHTS[i]
  }
  const remainder = total % 11
  return remainder === 10 ? 'X' : String(remainder)
}

export interface VinCheck {
  /** Structurally usable: 17 characters, no I/O/Q, known alphabet. */
  wellFormed: boolean
  /**
   * Whether position 9 matches. North America mandates it; plenty of European
   * and Japanese-market VINs do not comply, so a failure is a warning, never a
   * refusal.
   */
  checkDigitOk: boolean | null
  problem: string | null
}

export function checkVin(raw: string): VinCheck {
  const vin = normalizeVin(raw)

  if (vin.length === 0) {
    return { wellFormed: false, checkDigitOk: null, problem: null }
  }
  if (vin.length !== 17) {
    return {
      wellFormed: false,
      checkDigitOk: null,
      problem: `A VIN is 17 characters — this one has ${vin.length}`,
    }
  }
  if (VIN_FORBIDDEN.test(vin)) {
    return {
      wellFormed: false,
      checkDigitOk: null,
      problem: 'A VIN never contains the letters I, O or Q',
    }
  }

  const expected = vinCheckDigit(vin)
  if (expected === null) {
    return { wellFormed: false, checkDigitOk: null, problem: 'That VIN has characters a VIN cannot contain' }
  }

  const ok = vin[8] === expected
  return {
    wellFormed: true,
    checkDigitOk: ok,
    problem: ok
      ? null
      : 'The check digit does not match — worth reading the plate again (some non-US vehicles do not use one)',
  }
}

/**
 * World Manufacturer Identifier → make. A best-effort offline fallback for
 * when the authoritative decoder has nothing; it leans towards what actually
 * turns up on an Abuja lot.
 */
const WMI_MAKES: Record<string, string> = {
  JT: 'Toyota', '4T': 'Toyota', '5T': 'Toyota', '2T': 'Toyota', MR0: 'Toyota', SB1: 'Toyota',
  JTH: 'Lexus', '58A': 'Lexus', JTJ: 'Lexus',
  JH: 'Honda', '1HG': 'Honda', '2HG': 'Honda', '5FN': 'Honda', '5J6': 'Honda', '3CZ': 'Honda',
  '19U': 'Acura', '19X': 'Acura', JH4: 'Acura',
  JN: 'Nissan', '1N4': 'Nissan', '3N1': 'Nissan', '5N1': 'Nissan',
  JNK: 'Infiniti', JNR: 'Infiniti', '5N3': 'Infiniti',
  WDB: 'Mercedes-Benz', WDD: 'Mercedes-Benz', WDC: 'Mercedes-Benz', W1K: 'Mercedes-Benz',
  W1N: 'Mercedes-Benz', '4JG': 'Mercedes-Benz', WMX: 'Mercedes-Benz',
  WBA: 'BMW', WBS: 'BMW', WBY: 'BMW', '4US': 'BMW', '5UX': 'BMW', '5YM': 'BMW',
  '1FA': 'Ford', '1FM': 'Ford', '1FT': 'Ford', '2FM': 'Ford', '3FA': 'Ford', WF0: 'Ford',
  KMH: 'Hyundai', KM8: 'Hyundai', '5NP': 'Hyundai', '5NM': 'Hyundai',
  KNA: 'Kia', KND: 'Kia', KNM: 'Kia', '5XY': 'Kia', '3KP': 'Kia',
  WVW: 'Volkswagen', WV1: 'Volkswagen', WV2: 'Volkswagen', '3VW': 'Volkswagen', '1VW': 'Volkswagen',
  WAU: 'Audi', TRU: 'Audi', WA1: 'Audi',
  JM1: 'Mazda', JM3: 'Mazda', '3MZ': 'Mazda', '4F2': 'Mazda',
  JA3: 'Mitsubishi', JA4: 'Mitsubishi', '4A3': 'Mitsubishi', ML3: 'Mitsubishi',
  JF1: 'Subaru', JF2: 'Subaru', '4S3': 'Subaru', '4S4': 'Subaru',
  SAL: 'Land Rover', SAJ: 'Jaguar',
  YV1: 'Volvo', YV4: 'Volvo',
  '1G1': 'Chevrolet', '2G1': 'Chevrolet', '3G1': 'Chevrolet', KL1: 'Chevrolet', '1GC': 'Chevrolet',
  '1GK': 'GMC', '2GK': 'GMC', '1GT': 'GMC',
  '1C4': 'Jeep', '1J4': 'Jeep', '3C4': 'Chrysler', '2C3': 'Chrysler',
  '1B3': 'Dodge', '2B3': 'Dodge', '1D7': 'Dodge',
  VF3: 'Peugeot', VF1: 'Renault', VF7: 'Citroën',
  JS2: 'Suzuki', JS3: 'Suzuki',
  '5GA': 'Buick', '1G4': 'Buick', '1LN': 'Lincoln', '5LM': 'Lincoln',
}

/** Make from the first three characters, when nothing better is available. */
export function makeFromWmi(raw: string): string | null {
  const vin = normalizeVin(raw)
  if (vin.length < 3) return null
  return WMI_MAKES[vin.slice(0, 3)] ?? WMI_MAKES[vin.slice(0, 2)] ?? null
}

/** NHTSA's "Body Class" phrasing mapped onto this app's body types. */
export function bodyTypeFromBodyClass(bodyClass: string | null | undefined): string | null {
  if (!bodyClass) return null
  const value = bodyClass.toLowerCase()
  if (value.includes('sport utility') || value.includes('suv') || value.includes('multi-purpose')) return 'SUV'
  if (value.includes('pickup')) return 'Pickup'
  if (value.includes('hatchback') || value.includes('liftback')) return 'Hatchback'
  if (value.includes('sedan') || value.includes('saloon')) return 'Sedan'
  if (value.includes('coupe')) return 'Coupe'
  if (value.includes('wagon')) return 'Wagon'
  if (value.includes('van') || value.includes('minivan')) return 'Van'
  if (value.includes('bus')) return 'Bus'
  if (value.includes('truck') || value.includes('chassis cab')) return 'Truck'
  return 'Other'
}
