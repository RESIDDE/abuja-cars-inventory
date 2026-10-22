import { MovementTimeline } from '@/components/vehicles/movement-timeline'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useVehicleEvents } from '@/hooks/use-vehicle-events'
import { vehicleTitle } from '@/lib/format'
import type { VehicleWithOwner } from '@/types/database'

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle: VehicleWithOwner | null
}

export function HistoryDialog({ open, onOpenChange, vehicle }: HistoryDialogProps) {
  const { data: events = [], isLoading } = useVehicleEvents(vehicle?.id, open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Movement history</DialogTitle>
          <DialogDescription>
            {vehicle ? vehicleTitle(vehicle) : ''}
            {vehicle?.plate_number ? ` · ${vehicle.plate_number}` : ''}
          </DialogDescription>
        </DialogHeader>
        <MovementTimeline events={events} isLoading={isLoading} />
      </DialogContent>
    </Dialog>
  )
}
