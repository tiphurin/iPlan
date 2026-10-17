/**
 * Live trip schedule: which item is happening now, how far through it we are,
 * what comes next, and whether we are running late against the plan.
 */
export interface ScheduleItem {
  readonly id: string
  readonly startsAt: Date
  /** Items without an end last until the next item starts (or are instants if last). */
  readonly endsAt?: Date | null
}

export interface TimedItem<T extends ScheduleItem> {
  readonly item: T
  readonly start: number
  readonly end: number
}

/** Sorts by start and resolves each item's effective end time (epoch ms). */
export function timeline<T extends ScheduleItem>(items: readonly T[]): TimedItem<T>[] {
  const sorted = [...items].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id),
  )
  return sorted.map((item, index) => {
    const start = item.startsAt.getTime()
    const nextStart = sorted[index + 1]?.startsAt.getTime()
    const end = item.endsAt ? item.endsAt.getTime() : (nextStart ?? start)
    return { item, start, end: Math.max(start, end) }
  })
}

export interface ScheduleStatus<T extends ScheduleItem> {
  readonly current: {
    readonly item: T
    /** 0..1 through the current item. */
    readonly progress: number
    readonly remainingMs: number
  } | null
  readonly next: { readonly item: T; readonly startsInMs: number } | null
  readonly completed: number
  readonly total: number
  /** 0..1 of items whose end time has passed. */
  readonly dayProgress: number
}

export function scheduleStatus<T extends ScheduleItem>(
  items: readonly T[],
  now: Date,
): ScheduleStatus<T> {
  const t = now.getTime()
  const line = timeline(items)
  // When items overlap, the one that started most recently is "current".
  const running = line.filter((x) => x.start <= t && t < x.end)
  const current = running.at(-1) ?? null
  const upcoming = line.find((x) => x.start > t) ?? null
  const completed = line.filter((x) => x.end <= t).length

  return {
    current: current
      ? {
          item: current.item,
          progress:
            current.end === current.start ? 1 : (t - current.start) / (current.end - current.start),
          remainingMs: current.end - t,
        }
      : null,
    next: upcoming ? { item: upcoming.item, startsInMs: upcoming.start - t } : null,
    completed,
    total: line.length,
    dayProgress: line.length === 0 ? 0 : completed / line.length,
  }
}

/** Minutes between plan and reality: positive = late, negative = early. */
export function delayMinutes(planned: Date, actual: Date): number {
  return Math.round((actual.getTime() - planned.getTime()) / 60_000)
}

export type Punctuality = 'early' | 'on_time' | 'late'

export function punctuality(delay: number, toleranceMinutes = 5): Punctuality {
  if (delay > toleranceMinutes) return 'late'
  if (delay < -toleranceMinutes) return 'early'
  return 'on_time'
}

export interface DurationParts {
  readonly negative: boolean
  readonly days: number
  readonly hours: number
  readonly minutes: number
  readonly seconds: number
}

export function durationParts(ms: number): DurationParts {
  const negative = ms < 0
  let rest = Math.floor(Math.abs(ms) / 1000)
  const days = Math.floor(rest / 86_400)
  rest -= days * 86_400
  const hours = Math.floor(rest / 3600)
  rest -= hours * 3600
  const minutes = Math.floor(rest / 60)
  return { negative, days, hours, minutes, seconds: rest - minutes * 60 }
}

/** Sleep length in minutes; wake must be after sleep. */
export function sleepMinutes(sleptAt: Date, wokeAt: Date): number {
  return Math.max(0, Math.round((wokeAt.getTime() - sleptAt.getTime()) / 60_000))
}
