import type { RetimeItemsInput, TripItemDto } from '@iplan/contracts'
import type { PlanItem, ReplanResult } from '@iplan/core'

type Change = RetimeItemsInput['changes'][number]

/** Plan items as the reorder maths sees them (times in epoch ms). */
export function toPlanItems(items: readonly TripItemDto[]): PlanItem[] {
  return items.map((i) => ({
    id: i.id,
    kind: i.kind,
    startsAt: Date.parse(i.startsAt),
    endsAt: i.endsAt === null ? null : Date.parse(i.endsAt),
    fixed: i.details.fixed === true,
  }))
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString())

/**
 * What to send to save a new order, and what to send to undo it afterwards.
 * Items whose route changed are marked "to check"; undo puts their old mark back.
 */
export function retimePayload(
  items: readonly TripItemDto[],
  result: ReplanResult,
): { save: Change[]; undo: Change[] } {
  const byId = new Map(items.map((i) => [i.id, i]))
  const times = new Map(result.changes.map((c) => [c.id, c]))
  const flagged = new Set(result.routeChanged)
  const ids = [...new Set([...times.keys(), ...flagged])]
  const save: Change[] = []
  const undo: Change[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (!item) continue
    const next = times.get(id)
    const startsAt = next ? (iso(next.startsAt) as string) : item.startsAt
    const endsAt = next ? iso(next.endsAt) : item.endsAt
    save.push({
      id,
      expectStartsAt: item.startsAt,
      startsAt,
      endsAt,
      ...(flagged.has(id) && { verify: true }),
    })
    undo.push({
      id,
      expectStartsAt: startsAt,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      ...(flagged.has(id) && { verify: item.details.verify === true }),
    })
  }
  return { save, undo }
}
