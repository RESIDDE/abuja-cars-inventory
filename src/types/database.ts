export type VehicleStatus = 'in_stock' | 'released'
export type VehicleEventType = 'checked_in' | 'released'

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
  belongings: Belonging[]
  photos: VehiclePhoto[]
  price: number | null
  status: VehicleStatus
  intake_date: string
  released_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** A vehicle row joined to its owner, which is how the UI always reads them. */
export interface VehicleWithOwner extends Vehicle {
  owner: Owner | null
}

export interface VehicleEvent {
  id: string
  vehicle_id: string
  event_type: VehicleEventType
  occurred_at: string
  staff_name: string | null
  recipient_name: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface OwnerWithCount extends Owner {
  vehicle_count: number
}
