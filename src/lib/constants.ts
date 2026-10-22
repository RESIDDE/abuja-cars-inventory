import type { VehicleStatus } from '@/types/database'

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
}

/** How far back the dashboard charts look. */
export const CHART_DAYS = 30
