/** Lightweight SVG donut (no chart library) for category breakdowns. */
export interface DonutSlice {
  key: string
  label: string
  /** Optional amount shown before the percentage (print pages), so the label never gets cut. */
  amount?: string
  value: number
  color: string
}

const R = 40
const C = 2 * Math.PI * R

export function Donut({ slices, center }: { slices: DonutSlice[]; center?: string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 100 100"
        className="size-32 shrink-0 -rotate-90"
        role="img"
        aria-label={center}
      >
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="14" className="stroke-muted" />
        {total > 0 &&
          slices.map((slice) => {
            const length = (slice.value / total) * C
            const circle = (
              <circle
                key={slice.key}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={slice.color}
                strokeWidth="14"
                strokeDasharray={`${length} ${C - length}`}
                strokeDashoffset={-offset}
              />
            )
            offset += length
            return circle
          })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="flex-1 truncate">{slice.label}</span>
            {slice.amount && <span className="tabular-nums">{slice.amount}</span>}
            <span className="text-muted-foreground tabular-nums">
              {total > 0 ? Math.round((slice.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const CATEGORY_COLORS: Record<string, string> = {
  food: '#f97316',
  transport: '#0ea5e9',
  shopping: '#ec4899',
  stay: '#8b5cf6',
  activity: '#22c55e',
  health: '#ef4444',
  other: '#94a3b8',
}
