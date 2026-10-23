import type {
  MileageUnit,
  RegistrationOrigin,
  VehicleCondition,
  VehicleStatus,
} from '@/types/database'

export const BODY_TYPES = [
  'Sedan',
  'SUV',
  'Pickup',
  'Hatchback',
  'Coupe',
  'Wagon',
  'Van',
  'Bus',
  'Truck',
  'Other',
] as const

/** One-tap chips for the things that turn up in nearly every vehicle. */
export const COMMON_BELONGINGS = [
  'Spare tyre',
  'Jack',
  'Wheel spanner',
  'Floor mats',
  "Owner's manual",
  'Fire extinguisher',
  'Warning triangle',
  'Charger',
  'Tool kit',
  'Boot cover',
  'Phone holder',
  'Stereo faceplate',
] as const

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  in_stock: 'In Stock',
  released: 'Released',
  sold: 'Sold',
}

export const CONDITION_LABEL: Record<VehicleCondition, string> = {
  new: 'New',
  used: 'Used',
}

export const REGISTRATION_LABEL: Record<RegistrationOrigin, string> = {
  nigeria: 'Registered in Nigeria',
  foreign: 'Foreign / not registered here',
}

/** Short form, for a card where the full phrase would not fit. */
export const REGISTRATION_SHORT: Record<RegistrationOrigin, string> = {
  nigeria: 'Nigerian reg.',
  foreign: 'Foreign reg.',
}

export const MILEAGE_UNITS: MileageUnit[] = ['km', 'mi']

/**
 * Most pictures a vehicle record will hold. Matched by a check constraint on
 * vi_vehicles.photos, so this is a convenience rather than the control.
 */
export const MAX_VEHICLE_PHOTOS = 5

/** How far back the dashboard charts look. */
export const CHART_DAYS = 30
