import { KeyRound, Package, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { ClickableTile } from '@/components/dashboard/clickable-tile'
import { formatNairaCompact } from '@/lib/format'
import type { CustodyTotals } from '@/lib/analytics'

interface CustodyTileProps {
  totals: CustodyTotals
  inStockCount: number
}

export function CustodyTile({ totals, inStockCount }: CustodyTileProps) {
  const navigate = useNavigate()

  const rows = [
    { icon: KeyRound, label: 'Keys held', value: String(totals.keys) },
    { icon: Package, label: 'Belongings logged', value: String(totals.belongings) },
    {
      icon: Wallet,
      label: 'Stock value',
      value: formatNairaCompact(totals.stockValue, '₦0'),
    },
  ]

  return (
    <ClickableTile
      title="In your custody"
      subtitle={`${inStockCount} vehicle${inStockCount === 1 ? '' : 's'} on site`}
      ariaLabel="See the vehicles in your custody"
      onActivate={() => navigate('/vehicles?status=in_stock')}
    >
      <ul className="space-y-2">
        {rows.map(({ icon: Icon, label, value }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-2xl border border-white/35 bg-white/30 px-3.5 py-2.5"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/45 bg-white/50">
              <Icon className="size-4 text-muted-foreground" />
            </span>
            <span className="flex-1 text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-semibold tracking-tight">{value}</span>
          </li>
        ))}
      </ul>
      {totals.pricedCount < inStockCount ? (
        <p className="mt-3 text-[0.7rem] text-muted-foreground">
          {inStockCount - totals.pricedCount} held vehicle
          {inStockCount - totals.pricedCount === 1 ? ' has' : 's have'} no price recorded.
        </p>
      ) : null}
    </ClickableTile>
  )
}
