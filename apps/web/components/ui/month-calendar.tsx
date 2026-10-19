'use client'

import { formatMonth, weekdayNames } from '@iplan/i18n'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useRef } from 'react'
import { cn } from '@/lib/cn'
import { addMonths, monthGrid } from '@/lib/month-grid'
import { useFormat } from '@/lib/use-format'

export interface DayMark {
  /** Up to three coloured dots under the number (CSS colours). */
  dots?: string[]
  /** Small text under the number, e.g. a spend total. */
  label?: ReactNode
}

/**
 * Month view for phones: 44px day cells, swipe left/right to change month,
 * optional highlighted range (a trip) and per-day marks.
 */
export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  today,
  range,
  marks,
  isEnabled,
}: {
  month: string
  onMonthChange: (month: string) => void
  selected?: string | null
  onSelect?: (date: string) => void
  today?: string
  range?: { start: string; end: string; color?: string }
  marks?: Record<string, DayMark>
  /** Days that can be tapped; others are dimmed. Defaults to all. */
  isEnabled?: (date: string) => boolean
}) {
  const t = useTranslations('calendar')
  const { locale } = useFormat()
  const touch = useRef<number | null>(null)
  const rangeColor = range?.color ?? 'var(--l2)'

  return (
    <div
      className="rounded-2xl border bg-card p-3 select-none"
      onTouchStart={(e) => {
        touch.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touch.current
        const end = e.changedTouches[0]?.clientX
        touch.current = null
        if (start === null || end === undefined || Math.abs(end - start) < 50) return
        onMonthChange(addMonths(month, end < start ? 1 : -1))
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          aria-label={t('previous')}
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="flex size-11 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <p className="font-display text-lg font-semibold" aria-live="polite">
          {formatMonth(month, { locale })}
        </p>
        <button
          type="button"
          aria-label={t('next')}
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="flex size-11 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </div>
      <table className="w-full table-fixed border-collapse text-center">
        <thead>
          <tr>
            {weekdayNames(locale).map((name) => (
              <th key={name} scope="col" className="pb-1 text-xs font-normal text-faint">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week) => (
            <tr key={week.find(Boolean) ?? month}>
              {week.map((date, i) => {
                if (!date) return <td key={`empty-${i}`} />
                const inRange = range && date >= range.start && date <= range.end
                const enabled = isEnabled ? isEnabled(date) : true
                const mark = marks?.[date]
                const isSelected = date === selected
                return (
                  <td key={date} className="p-0.5">
                    <button
                      type="button"
                      disabled={!onSelect || !enabled}
                      onClick={() => onSelect?.(date)}
                      aria-pressed={isSelected}
                      aria-label={date}
                      className={cn(
                        'relative flex h-12 w-full flex-col items-center justify-center rounded-xl text-[15px] tabular-nums transition-colors',
                        !enabled && 'text-faint',
                        isSelected && 'bg-primary font-semibold text-primary-foreground',
                        !isSelected && date === today && 'font-bold text-primary',
                      )}
                      style={
                        inRange && !isSelected
                          ? {
                              backgroundColor: `color-mix(in srgb, ${rangeColor} 16%, transparent)`,
                            }
                          : undefined
                      }
                    >
                      <span className="leading-none">{Number(date.slice(8))}</span>
                      {mark?.label && (
                        <span className="mt-0.5 max-w-full truncate px-0.5 text-[9px] leading-none opacity-80">
                          {mark.label}
                        </span>
                      )}
                      {mark?.dots && mark.dots.length > 0 && (
                        <span className="mt-1 flex gap-0.5">
                          {mark.dots.slice(0, 3).map((color, j) => (
                            <span
                              key={j}
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: isSelected ? 'currentColor' : color }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
