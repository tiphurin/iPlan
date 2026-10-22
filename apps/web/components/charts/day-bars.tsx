'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { DayBar } from '@/lib/expense-charts'

/**
 * Spending per day as vertical bars with the daily budget as a dashed line.
 * Plain SVG; callers pass ready-formatted text so it also renders from
 * Server Components (the print page). Tapping a bar shows its numbers.
 */
export interface DayBarsProps {
  bars: (DayBar & {
    /** Full line for the caption and screen readers: "Thu 22 Oct · ฿3,200 · over by ฿200". */
    detail: string
  })[]
  labels: {
    title: string
    spent: string
    /** "Dashed line = daily budget ฿3,000"; null when there is no budget. */
    budget: string | null
    over: string
    hint: string
  }
  /** Print: no tap caption, and the per-day numbers are listed under the chart. */
  static?: boolean
}

const W = 340
const H = 150
const PAD = { top: 10, right: 4, bottom: 20, left: 4 }

export function DayBars({ bars, labels, static: isStatic = false }: DayBarsProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const max = Math.max(1, ...bars.map((b) => Math.max(b.spent, b.budget ?? 0)))
  const plotH = H - PAD.top - PAD.bottom
  const y = (v: number) => PAD.top + (1 - v / max) * plotH
  const slot = (W - PAD.left - PAD.right) / Math.max(bars.length, 1)
  const width = Math.max(4, Math.min(28, slot - 4))
  const budget = bars.find((b) => b.budget !== null)?.budget ?? null
  const anyOver = bars.some((b) => b.over)
  // Keep axis labels readable on long trips: show every nth day.
  const every = Math.ceil(bars.length / 12)
  const picked = bars.find((b) => b.key === selected)

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={labels.title}
        onMouseLeave={() => setSelected(null)}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
          className="stroke-border"
          strokeWidth="1"
        />
        {bars.map((b, i) => {
          const cx = PAD.left + slot * i + slot / 2
          const top = y(b.spent)
          const active = selected === b.key
          return (
            <g
              key={b.key}
              onClick={() => setSelected(active ? null : b.key)}
              onMouseEnter={() => setSelected(b.key)}
              className={isStatic ? undefined : 'cursor-pointer'}
            >
              <title>{b.detail}</title>
              {/* Hit target: the whole column, bigger than the bar. */}
              <rect x={cx - slot / 2} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              {b.spent > 0 && (
                <path
                  d={roundedTop(cx - width / 2, top, width, y(0) - top, Math.min(4, width / 2))}
                  className={cn(
                    b.over ? 'fill-danger' : 'fill-primary',
                    selected && !active && 'opacity-40',
                  )}
                />
              )}
              {i % every === 0 && (
                <text
                  x={cx}
                  y={H - 6}
                  textAnchor="middle"
                  className={cn(
                    'text-[10px]',
                    active ? 'fill-foreground font-semibold' : 'fill-muted-foreground',
                  )}
                >
                  {b.label}
                </text>
              )}
            </g>
          )
        })}
        {budget !== null && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(budget)}
            y2={y(budget)}
            strokeWidth="1.5"
            strokeDasharray="5 4"
            className="pointer-events-none stroke-foreground/70"
          />
        )}
      </svg>
      <figcaption className="mt-2 space-y-1 text-xs text-muted-foreground">
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" />
            {labels.spent}
          </span>
          {anyOver && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-danger" />
              {labels.over}
            </span>
          )}
          {labels.budget && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-[1.5px] border-dashed border-foreground/70" />
              {labels.budget}
            </span>
          )}
        </span>
        {!isStatic && (
          <span
            className={cn('block min-h-4 tabular-nums', picked && 'font-medium text-foreground')}
            aria-live="polite"
          >
            {picked ? picked.detail : labels.hint}
          </span>
        )}
      </figcaption>
      <table className={isStatic ? 'mt-2 w-full text-sm tabular-nums' : 'sr-only'}>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <td>{b.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/** A bar with rounded top corners and a square base on the axis. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h)
  return [
    `M${x},${y + h}`,
    `V${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `H${x + w - rr}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `V${y + h}`,
    'Z',
  ].join(' ')
}
