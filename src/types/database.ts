export type VehicleStatus = 'in_stock' | 'released' | 'sold'
export type VehicleEventType = 'checked_in' | 'released' | 'sold'

/** One line of the arrival checklist. */
export interface Belonging {
  item: string
  qty: number
  note?: string | null
}

/** A stored picture of the vehicle, in the private vehicle-photos bucket. */
export interface VehiclePhoto {
  path: string
  bytes: number
  width: number
  height: number
}

/** Someone who handles vehicles. Not necessarily someone who can sign in. */
export interface StaffMember {
  id: string
  name: string
  role: string | null
  phone: string | null
  active: boolean
  created_at: string
  updated_at: string
}

/** A row of the login allowlist — these do have an auth account. */
export interface StaffAccount {
  user_id: string
  full_name: string | null
  added_at: string
}

export interface Owner {
  id: string
  full_name: string
  phone_primary: string
  phone_secondary: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type VehicleCondition = 'new' | 'used'
export type MileageUnit = 'km' | 'mi'
/** Where the vehicle is registered: here, or abroad / not yet registered. */
export type RegistrationOrigin = 'nigeria' | 'foreign'

export interface Vehicle {
  id: string
  owner_id: string
  make: string
  model: string
  body_type: string | null
  year: number | null
  vin: string | null
  color: string | null
  plate_number: string | null
  keys_count: number
  condition: VehicleCondition | null
  mileage: number | null
  mileage_unit: MileageUnit
  registration: RegistrationOrigin | null
  interior: string | null
  belongings: Belonging[]
  photos: VehiclePhoto[]
  price: number | null
  status: VehicleStatus
  intake_date: string
  released_date: string | null
  sold_date: string | null
  sale_price: number | null
  buyer_name: string | null
  /** Customer record of the buyer, in vi_owners. Null if only a name was taken. */
  buyer_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** A vehicle row joined to its owner, which is how the UI always reads them. */
export interface VehicleWithOwner extends Vehicle {
  owner: Owner | null
  /** The customer who bought it, when there is one on record. */
  buyer: Owner | null
}

export interface VehicleEvent {
  id: string
  vehicle_id: string
  event_type: VehicleEventType
  occurred_at: string
  staff_name: string | null
  recipient_name: string | null
  notes: string | null
  /** Keys handed over on a release, or brought back on a check-in. */
  keys_count: number | null
  /** Path in the movement-signatures bucket; null when nobody signed. */
  signature_path: string | null
  created_by: string | null
  created_at: string
}

export interface OwnerWithCount extends Owner {
  vehicle_count: number
}
