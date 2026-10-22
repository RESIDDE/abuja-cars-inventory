import { useNavigate } from 'react-router-dom'

import { ClickableTile } from '@/components/dashboard/clickable-tile'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** A three-quarter arc, rotated so the gap sits at the bottom. */
const ARC = CIRCUMFERENCE * 0.75

interface StockGaugeTileProps {
  rate: number
  inStockCount: number
  totalCount: number
}

export function StockGaugeTile({ rate, inStockCount, totalCount }: StockGaugeTileProps) {
  const navigate = useNavigate()
  const clamped = Math.max(0, Math.min(1, rate))
  const percent = Math.round(clamped * 100)

  return (
    <ClickableTile
      title="Stock rate"
      subtitle="Share of records still held"
      ariaLabel="See the vehicles still in stock"
      onActivate={() => navigate('/vehicles?status=in_stock')}
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          <svg viewBox="0 0 120 120" className="size-[9.5rem]" role="img" aria-label={`${percent}% in stock`}>
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke="hsl(0 0% 100% / 0.4)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
              transform="rotate(135 60 60)"
            />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke="hsl(69 100% 66%)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={`${ARC * clamped} ${CIRCUMFERENCE}`}
              transform="rotate(135 60 60)"
              className="transition-[stroke-dasharray] duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-display text-3xl">{percent}%</p>
              <p className="text-[0.7rem] text-muted-foreground">in stock</p>
            </div>
          </div>
        </div>

        <p className="mt-1 text-center text-xs text-muted-foreground">
          {inStockCount} of {totalCount} record{totalCount === 1 ? '' : 's'} still held
        </p>
      </div>
    </ClickableTile>
  )
}
