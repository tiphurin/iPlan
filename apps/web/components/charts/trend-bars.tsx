/**
 * Income vs spending per month as paired bars, with the month's balance as a
 * line. Plain SVG (no chart library) to keep the bundle small.
 */
export interface TrendPoint {
  key: string
  label: string
  income: number
  expense: number
  balance: number
}

const W = 340
const H = 180
const PAD = { top: 12, right: 8, bottom: 24, left: 8 }

export function TrendBars({
  points,
  labels,
  format,
}: {
  points: TrendPoint[]
  labels: { income: string; expense: string; balance: string }
  format: (value: number) => string
}) {
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense, Math.abs(p.balance)]))
  const min = Math.min(0, ...points.map((p) => p.balance))
  const range = max - min
  const plotH = H - PAD.top - PAD.bottom
  const y = (v: number) => PAD.top + ((max - v) / range) * plotH
  const slot = (W - PAD.left - PAD.right) / Math.max(points.length, 1)
  const bar = Math.min(16, slot / 3)
  const zero = y(0)
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${PAD.left + slot * i + slot / 2},${y(p.balance)}`)
    .join(' ')

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${labels.income} / ${labels.expense}`}
      >
        <line x1={PAD.left} x2={W - PAD.right} y1={zero} y2={zero} className="stroke-border" />
        {points.map((p, i) => {
          const cx = PAD.left + slot * i + slot / 2
          return (
            <g key={p.key}>
              <rect
                x={cx - bar - 1}
                y={y(p.income)}
                width={bar}
                height={Math.max(0, zero - y(p.income))}
                rx="3"
                className="fill-success"
              />
              <rect
                x={cx + 1}
                y={y(p.expense)}
                width={bar}
                height={Math.max(0, zero - y(p.expense))}
                rx="3"
                className="fill-danger/80"
              />
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {p.label}
              </text>
            </g>
          )
        })}
        <path
          d={line}
          fill="none"
          strokeWidth="2.5"
          strokeLinejoin="round"
          className="stroke-primary"
        />
        {points.map((p, i) => (
          <circle
            key={p.key}
            cx={PAD.left + slot * i + slot / 2}
            cy={y(p.balance)}
            r="3.5"
            className="fill-primary"
          />
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-success" />
          {labels.income}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-danger/80" />
          {labels.expense}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-primary" />
          {labels.balance}
        </span>
      </figcaption>
      {/* Screen readers get the numbers as a table. */}
      <table className="sr-only">
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th>{p.label}</th>
              <td>{format(p.income)}</td>
              <td>{format(p.expense)}</td>
              <td>{format(p.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
