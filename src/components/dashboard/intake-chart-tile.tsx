import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

import { ClickableTile } from '@/components/dashboard/clickable-tile'
import { CHART_DAYS } from '@/lib/constants'
import type { InventoryDay } from '@/lib/analytics'

interface IntakeChartTileProps {
  series: InventoryDay[]
  total: number
  className?: string
}

function IntakeTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: InventoryDay }[]
}) {
  if (!active || !payload?.length) return null
  const day = payload[0].payload
  return (
    <div className="rounded-xl border border-white/45 bg-[hsl(158_24%_90%/.92)] px-3 py-2 text-xs backdrop-blur-xl">
      <span className="font-medium">{day.label}</span>
      <span className="mx-1.5 opacity-50">·</span>
      {day.checkedIn} in
    </div>
  )
}

export function IntakeChartTile({ series, total, className }: IntakeChartTileProps) {
  const navigate = useNavigate()
  const peak = Math.max(...series.map((d) => d.checkedIn), 0)

  return (
    <ClickableTile
      title={`${CHART_DAYS}-day intake`}
      subtitle={`${total} checked in`}
      ariaLabel="See all vehicles"
      onActivate={() => navigate('/vehicles')}
      className={className}
    >
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              interval={Math.max(0, Math.floor(series.length / 4) - 1)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: 'hsl(160 8% 30%)' }}
            />
            <Tooltip content={<IntakeTooltip />} cursor={{ fill: 'hsl(0 0% 100% / 0.22)' }} />
            <Bar dataKey="checkedIn" radius={[4, 4, 0, 0]} maxBarSize={9}>
              {series.map((day) => (
                <Cell
                  key={day.date}
                  // The busiest day of the month stands out in chartreuse.
                  fill={
                    peak > 0 && day.checkedIn === peak
                      ? 'hsl(69 100% 66%)'
                      : 'hsl(0 0% 100% / 0.85)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ClickableTile>
  )
}
