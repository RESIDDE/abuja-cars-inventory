import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { InventoryDay } from '@/lib/analytics'

interface TooltipPayloadEntry {
  payload: InventoryDay
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}) {
  if (!active || !payload?.length) return null
  const day = payload[0].payload
  return (
    <div className="rounded-2xl border border-white/45 bg-[hsl(158_24%_90%/.92)] px-3.5 py-2.5 text-xs shadow-[0_16px_34px_-18px_hsl(160_20%_20%/.5)] backdrop-blur-xl">
      <p className="font-medium">{day.label}</p>
      <p className="mt-1 text-muted-foreground">
        Checked in: <span className="font-semibold text-foreground">{day.checkedIn}</span>
      </p>
      <p className="text-muted-foreground">
        Still held: <span className="font-semibold text-foreground">{day.held}</span>
      </p>
    </div>
  )
}

/**
 * White bars are the vehicles checked in that day; the chartreuse line is how
 * many were still held at the end of it. Real rows, not a sample.
 */
export function InventoryChart({ data }: { data: InventoryDay[] }) {
  return (
    <div className="h-[13rem] w-full sm:h-[15rem]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 6, bottom: 0, left: 0 }}>
          <defs>
            {/* The line's glow: blur a copy, then merge the sharp stroke over it. */}
            <filter id="abujacar-line-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="glowBlur" />
              <feMerge>
                <feMergeNode in="glowBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="hsl(0 0% 100% / 0.28)"
            strokeDasharray="4 6"
          />
          <XAxis
            dataKey="label"
            interval={Math.max(0, Math.floor(data.length / 6) - 1)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'hsl(160 8% 28%)' }}
            dy={6}
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'hsl(160 8% 28%)' }}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: 'hsl(0 0% 100% / 0.22)' }}
          />

          <Bar
            dataKey="checkedIn"
            name="Checked in"
            fill="hsl(0 0% 100% / 0.88)"
            radius={[5, 5, 0, 0]}
            maxBarSize={10}
          />
          {/* A wide translucent pass under the crisp stroke, so the glow reads
              even where the SVG filter is not composited. */}
          <Line
            type="monotone"
            dataKey="held"
            stroke="hsl(69 100% 66% / 0.45)"
            strokeWidth={8}
            dot={false}
            activeDot={false}
            filter="url(#abujacar-line-glow)"
            isAnimationActive={false}
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="held"
            name="Still held"
            stroke="hsl(69 100% 66%)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{
              r: 4,
              fill: 'hsl(69 100% 66%)',
              stroke: 'hsl(69 45% 13%)',
              strokeWidth: 1.5,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
