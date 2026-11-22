'use client'

import { formatMonth, todayKey } from '@iplan/i18n'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { addMinutesLocal, parseTypedTime } from '@/lib/local-time'
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
// Every minute: trains and bookings are rarely on a multiple of five.
const MINUTES = Array.from({ length: 60 }, (_, m) => String(m).padStart(2, '0'))
/** Lengths offered for an end time, in minutes after the start. */
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240]
/** Small nudges for "a bit later / earlier" on the day itself. */
const NUDGES = [-5, 5, 15]

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
    const box = ref.current
    const chosen = box?.querySelector<HTMLElement>(`[data-v="${value}"]`)
    // Scroll only the column itself, never the sheet or the page around it.
    if (box && chosen)
      box.scrollTop = chosen.offsetTop - box.clientHeight / 2 + chosen.clientHeight / 2
  }, [value])
  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      className="scrollbar-none relative h-40 snap-y overflow-y-auto rounded-2xl bg-muted/60 py-16"
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

/** A ready-made answer shown as a chip, e.g. "After the previous item 10:05". */
export interface TimeSuggestion {
  label: string
  /** Local "YYYY-MM-DDTHH:mm". */
  value: string
}

/**
 * Date and time in one sheet. The time can be typed ("1015"), nudged (−5, +5,
 * +15), picked from suggestions or from minute-by-minute wheels; an end time can
 * be picked as a length after the start. The calendar opens only when asked.
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
  suggestions = [],
  durationsFrom,
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
  suggestions?: TimeSuggestion[] | undefined
  /** End times: offer "15:00 · 1 h" lengths after this start ("YYYY-MM-DDTHH:mm"). */
  durationsFrom?: string | undefined
}) {
  const t = useTranslations('dates')
  const f = useFormat()
  const [value, setInner] = useState(defaultValue ?? '')
  const setValue = (next: string) => {
    setInner(next)
    onChange?.(next)
  }
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(`${fallbackDate}T09:00`)
  const [typed, setTyped] = useState('')
  const [typedBad, setTypedBad] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [month, setMonth] = useState(fallbackDate.slice(0, 7))
  const draftDate = draft.slice(0, 10)
  const draftHour = draft.slice(11, 13)
  const draftMinute = draft.slice(14, 16)
  const startValid = durationsFrom && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(durationsFrom)

  function start() {
    // An empty end starts one hour after the start, the usual answer.
    const first =
      value ||
      (startValid && durationsFrom ? addMinutesLocal(durationsFrom, 60) : null) ||
      `${fallbackDate}T09:00`
    setDraft(first)
    setTyped(first.slice(11, 16))
    setTypedBad(false)
    setShowCalendar(!value && !startValid)
    setMonth(first.slice(0, 7))
    setOpen(true)
  }
  function pick(next: string) {
    setDraft(next)
    setTyped(next.slice(11, 16))
    setTypedBad(false)
  }
  const timeOf = (local: string) => local.slice(11, 16)

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
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            aria-expanded={showCalendar}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl border bg-background px-3 text-left"
          >
            <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">{f.day(draftDate)}</span>
            <span className="text-sm text-primary">{t('changeDay')}</span>
          </button>
          {showCalendar && (
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              selected={draftDate}
              onSelect={(date) => {
                pick(`${date}T${timeOf(draft)}`)
                setShowCalendar(false)
              }}
              today={todayKey('Asia/Bangkok')}
              isEnabled={(d) => (!min || d >= min) && (!max || d <= max)}
            />
          )}

          <div className="space-y-1.5">
            <label htmlFor={`${name}-typed`} className="text-sm font-medium text-muted-foreground">
              {t('typeTime')}
            </label>
            <input
              id={`${name}-typed`}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              value={typed}
              aria-invalid={typedBad}
              onFocus={(e) => e.target.select()}
              onBlur={() => {
                const time = parseTypedTime(typed)
                if (time) setTyped(time)
              }}
              onChange={(e) => {
                setTyped(e.target.value)
                const time = parseTypedTime(e.target.value)
                setTypedBad(time === null && e.target.value.trim().length >= 3)
                if (time) setDraft(`${draftDate}T${time}`)
              }}
              className={cn(
                'w-full rounded-2xl border bg-background px-3 py-2 text-center font-display text-4xl font-bold tabular-nums outline-none focus:border-primary',
                typedBad && 'border-danger',
              )}
            />
            {typedBad && <p className="text-sm text-danger">{t('timeInvalid')}</p>}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pick(s.value)}
                className="min-h-10 rounded-full border bg-background px-3 text-sm font-medium"
              >
                {s.label}
              </button>
            ))}
            {NUDGES.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={t('nudge', { minutes: n })}
                onClick={() => {
                  const next = addMinutesLocal(draft, n)
                  if (next) pick(next)
                }}
                className="min-h-10 min-w-12 rounded-full border bg-background px-3 text-sm font-medium tabular-nums"
              >
                {n > 0 ? `+${n}` : `−${-n}`}
              </button>
            ))}
          </div>

          {startValid && durationsFrom && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-muted-foreground">{t('lengths')}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DURATIONS.map((minutes) => {
                  const end = addMinutesLocal(durationsFrom, minutes)
                  if (!end) return null
                  const on = end === draft
                  return (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pick(end)}
                      className={cn(
                        'flex min-h-11 items-center justify-between gap-2 rounded-xl border bg-background px-3 text-sm',
                        on && 'border-primary ring-2 ring-primary/20',
                      )}
                    >
                      <span className="font-semibold tabular-nums">{timeOf(end)}</span>
                      <span className="text-muted-foreground">{f.duration(minutes * 60_000)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Column
              values={HOURS}
              value={draftHour}
              onPick={(hour) => pick(`${draftDate}T${hour}:${draftMinute}`)}
              label={t('hour')}
            />
            <span className="font-display text-2xl font-bold">:</span>
            <Column
              values={MINUTES}
              value={draftMinute}
              onPick={(minute) => pick(`${draftDate}T${draftHour}:${minute}`)}
              label={t('minute')}
            />
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setValue(draft)
              setOpen(false)
            }}
          >
            {t('done', { when: `${f.day(draftDate)} · ${timeOf(draft)}` })}
          </Button>
        </div>
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
