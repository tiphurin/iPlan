'use client'

import { formatMonth, todayKey } from '@iplan/i18n'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useFormat } from '@/lib/use-format'
import { Button } from './button'
import { MonthCalendar } from './month-calendar'
import { Sheet } from './sheet'

const trigger =
  'flex min-h-[46px] w-full items-center gap-2 rounded-xl border bg-background px-3 text-left text-base disabled:opacity-50'

/** Same field shape everywhere: a hidden input for forms plus an in-app picker. */
function useValue(value: string | undefined, defaultValue: string | undefined) {
  const [inner, setInner] = useState(defaultValue ?? '')
  return [value ?? inner, setInner, value !== undefined] as const
}

/**
 * Date picker using the app's month calendar (not the browser's), so it looks
 * the same on iPhone, Android and desktop. Value is "YYYY-MM-DD".
 */
export function DateField({
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  label,
}: {
  name?: string
  value?: string
  defaultValue?: string | undefined
  onChange?: (date: string) => void
  min?: string | undefined
  max?: string | undefined
  label: string
}) {
  const t = useTranslations('dates')
  const f = useFormat()
  const [current, setInner, controlled] = useValue(value, defaultValue)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState((current || todayKey('Asia/Bangkok')).slice(0, 7))
  const set = (date: string) => {
    if (!controlled) setInner(date)
    onChange?.(date)
    setOpen(false)
  }
  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          setMonth((current || min || todayKey('Asia/Bangkok')).slice(0, 7))
          setOpen(true)
        }}
        className={trigger}
      >
        <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn('flex-1', !current && 'text-muted-foreground')}>
          {current ? f.day(current) + ' ' + current.slice(0, 4) : t('pick')}
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={current || null}
          onSelect={set}
          today={todayKey('Asia/Bangkok')}
          isEnabled={(d) => (!min || d >= min) && (!max || d <= max)}
          {...(min && max ? { range: { start: min, end: max } } : {})}
        />
        <Button variant="secondary" className="mt-3" onClick={() => set(todayKey('Asia/Bangkok'))}>
          {t('today')}
        </Button>
      </Sheet>
    </>
  )
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, '0'))

/** A scrolling column of times; the chosen one stays centred, like an iPhone wheel. */
function Column({
  values,
  value,
  onPick,
  label,
}: {
  values: string[]
  value: string
  onPick: (v: string) => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>(`[data-v="${value}"]`)
      ?.scrollIntoView({ block: 'center' })
  }, [value])
  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      className="scrollbar-none h-48 snap-y overflow-y-auto rounded-2xl bg-muted/60 py-20"
    >
      {values.map((v) => (
        <button
          key={v}
          type="button"
          data-v={v}
          role="option"
          aria-selected={v === value}
          onClick={() => onPick(v)}
          className={cn(
            'block h-10 w-full snap-center text-center font-display text-xl tabular-nums',
            v === value
              ? 'rounded-xl bg-primary font-bold text-primary-foreground'
              : 'text-muted-foreground',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

/**
 * Date and time in one sheet: calendar on top, hour and minute wheels below.
 * Value is a local "YYYY-MM-DDTHH:mm" (the zone is chosen separately).
 */
export function DateTimeField({
  name,
  defaultValue,
  label,
  optional = false,
  fallbackDate,
  min,
  max,
  onChange,
}: {
  name: string
  defaultValue?: string | undefined
  label: string
  onChange?: ((value: string) => void) | undefined
  /** Can be left empty (e.g. an end time). */
  optional?: boolean
  /** Day to start from when empty. */
  fallbackDate: string
  min?: string | undefined
  max?: string | undefined
}) {
  const t = useTranslations('dates')
  const f = useFormat()
  const [value, setInner] = useState(defaultValue ?? '')
  const setValue = (next: string) => {
    setInner(next)
    onChange?.(next)
  }
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ date: fallbackDate, hour: '09', minute: '00' })
  const [month, setMonth] = useState(fallbackDate.slice(0, 7))
  const minutes = MINUTES.includes(draft.minute) ? MINUTES : [...MINUTES, draft.minute].sort()

  function start() {
    const [date = fallbackDate, time = '09:00'] = (value || '').split('T')
    const [hour = '09', minute = '00'] = time.split(':')
    setDraft({ date: value ? date : fallbackDate, hour, minute })
    setMonth((value ? date : fallbackDate).slice(0, 7))
    setOpen(true)
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <div className="flex gap-1">
        <button type="button" aria-label={label} onClick={start} className={trigger}>
          <Clock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className={cn('flex-1 truncate', !value && 'text-muted-foreground')}>
            {value ? `${f.day(value.slice(0, 10))} · ${value.slice(11, 16)}` : t('pickTime')}
          </span>
        </button>
        {optional && value && (
          <button
            type="button"
            aria-label={t('clear')}
            onClick={() => setValue('')}
            className="flex size-[46px] shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={draft.date}
          onSelect={(date) => setDraft((d) => ({ ...d, date }))}
          today={todayKey('Asia/Bangkok')}
          isEnabled={(d) => (!min || d >= min) && (!max || d <= max)}
        />
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Column
            values={HOURS}
            value={draft.hour}
            onPick={(hour) => setDraft((d) => ({ ...d, hour }))}
            label={t('hour')}
          />
          <span className="font-display text-2xl font-bold">:</span>
          <Column
            values={minutes}
            value={draft.minute}
            onPick={(minute) => setDraft((d) => ({ ...d, minute }))}
            label={t('minute')}
          />
        </div>
        <Button
          size="lg"
          className="mt-4"
          onClick={() => {
            setValue(`${draft.date}T${draft.hour}:${draft.minute}`)
            setOpen(false)
          }}
        >
          {t('done', { when: `${f.day(draft.date)} · ${draft.hour}:${draft.minute}` })}
        </Button>
      </Sheet>
    </>
  )
}

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

/** Month picker ("YYYY-MM") as a 12-month grid with year arrows. */
export function MonthField({
  name,
  defaultValue,
  label,
  optional = false,
}: {
  name: string
  defaultValue?: string | undefined
  label: string
  optional?: boolean
}) {
  const t = useTranslations('dates')
  const f = useFormat()
  const [value, setValue] = useState(defaultValue ?? '')
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(Number((value || todayKey('Asia/Bangkok')).slice(0, 4)))
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <div className="flex gap-1">
        <button
          type="button"
          aria-label={label}
          onClick={() => {
            setYear(Number((value || todayKey('Asia/Bangkok')).slice(0, 4)))
            setOpen(true)
          }}
          className={trigger}
        >
          <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className={cn('flex-1', !value && 'text-muted-foreground')}>
            {value ? formatMonth(value, { locale: f.locale }) : t('pickMonth')}
          </span>
        </button>
        {optional && value && (
          <button
            type="button"
            aria-label={t('clear')}
            onClick={() => setValue('')}
            className="flex size-[46px] shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label={t('prevYear')}
            onClick={() => setYear((y) => y - 1)}
            className="flex size-11 items-center justify-center rounded-full active:bg-muted"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <p className="font-display text-lg font-semibold">
            {f.locale === 'th' ? year + 543 : year}
          </p>
          <button
            type="button"
            aria-label={t('nextYear')}
            onClick={() => setYear((y) => y + 1)}
            className="flex size-11 items-center justify-center rounded-full active:bg-muted"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTH_NUMBERS.map((m) => {
            const key = `${year}-${m}`
            const on = key === value
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setValue(key)
                  setOpen(false)
                }}
                className={cn('min-h-12 rounded-xl border text-[15px]', on ? 'chip-on' : 'bg-card')}
              >
                {formatMonth(key, { locale: f.locale }).split(' ')[0]}
              </button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}
