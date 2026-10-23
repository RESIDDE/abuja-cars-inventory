/** The columns an imported sheet can supply. */
export const IMPORT_FIELDS = [
  { key: 'ownerName', label: "Owner's name", required: true,
    aliases: ['owner', 'ownername', 'customer', 'client', 'fullname', 'name', 'customername'] },
  { key: 'ownerPhone', label: 'Owner telephone', required: true,
    aliases: ['phone', 'telephone', 'ownerphone', 'mobile', 'contact', 'phone1', 'tel', 'phoneno', 'phonenumber'] },
  { key: 'ownerPhone2', label: 'Owner telephone 2', required: false,
    aliases: ['phone2', 'telephone2', 'altphone', 'secondphone', 'otherphone'] },
  { key: 'ownerEmail', label: 'Owner email', required: false,
    aliases: ['email', 'emailaddress', 'owneremail'] },

  { key: 'make', label: 'Car type / Make', required: true,
    aliases: ['make', 'cartype', 'brand', 'manufacturer', 'car', 'vehiclemake'] },
  { key: 'model', label: 'Model', required: true,
    aliases: ['model', 'vehiclemodel'] },
  { key: 'bodyType', label: 'Body type', required: false,
    aliases: ['bodytype', 'body', 'type', 'vehicletype'] },
  { key: 'year', label: 'Year', required: false,
    aliases: ['year', 'modelyear', 'yr', 'yearofmanufacture'] },
  { key: 'vin', label: 'VIN', required: false,
    aliases: ['vin', 'chassis', 'chassisnumber', 'chassisno', 'vinnumber', 'vinno'] },
  { key: 'color', label: 'Colour', required: false,
    aliases: ['colour', 'color'] },
  { key: 'plate', label: 'Plate number', required: false,
    aliases: ['plate', 'platenumber', 'plateno', 'reg', 'registration', 'regno', 'numberplate'] },
  { key: 'keys', label: 'Number of keys', required: false,
    aliases: ['keys', 'keycount', 'numberofkeys', 'nokeys'] },
  { key: 'price', label: 'Price', required: false,
    aliases: ['price', 'amount', 'value', 'cost', 'worth', 'pricengn'] },
  { key: 'intakeDate', label: 'Intake date', required: false,
    aliases: ['intakedate', 'datein', 'datereceived', 'date', 'checkindate', 'dateofintake'] },
  { key: 'notes', label: 'Notes', required: false,
    aliases: ['notes', 'remarks', 'comment', 'comments', 'description'] },
] as const

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]['key']

export const REQUIRED_FIELDS = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key)

/** Lowercase, letters and digits only — so "Phone No." matches "phoneno". */
export function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Best guess at which sheet column feeds which field. An exact alias match
 * wins; otherwise a column whose name contains an alias (or vice versa) is
 * accepted, which catches "Owner Phone Number" for "ownerphone".
 */
export function autoMapColumns(headers: string[]): Partial<Record<ImportFieldKey, number>> {
  const normalized = headers.map(normalizeHeader)
  const taken = new Set<number>()
  const mapping: Partial<Record<ImportFieldKey, number>> = {}

  for (const pass of ['exact', 'fuzzy'] as const) {
    for (const field of IMPORT_FIELDS) {
      if (mapping[field.key] !== undefined) continue
      const index = normalized.findIndex((header, i) => {
        if (taken.has(i) || !header) return false
        return pass === 'exact'
          ? (field.aliases as readonly string[]).includes(header)
          : (field.aliases as readonly string[]).some(
              (alias) => alias.length > 3 && (header.includes(alias) || alias.includes(header)),
            )
      })
      if (index !== -1) {
        mapping[field.key] = index
        taken.add(index)
      }
    }
  }

  return mapping
}

/** The header row of the downloadable template. */
export const TEMPLATE_HEADERS = IMPORT_FIELDS.map((f) => f.label)
