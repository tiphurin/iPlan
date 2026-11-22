/**
 * Reordering one plan day. A day is read the way it looks on screen:
 *
 *   wake                      ← anchor, never moves
 *   🚇 train to the market    ┐
 *   🚶 walk to the market     ├ block "market": the travel rows above a place are the way there
 *   📍 market                 ┘
 *   📍 café                     block "café" (no travel rows)
 *   🚇 back to the hotel        tail: travel after the last place stays at the end
 *   sleep                     ← anchor, never moves
 *
 * Moving a block moves its travel rows with it. Times are recalculated from the
 * first block whose position changed (everything before it keeps its times):
 * each item keeps its length, the free time that was before a block stays with
 * it, and a fixed-time place keeps its exact time; arriving at it too late is a
 * conflict, arriving early leaves free time.
 */

export interface PlanItem {
  readonly id: string
  /** "move" = travel, "wake" / "sleep" = anchors, anything else = a place. */
  readonly kind: string
  /** Epoch ms. */
  readonly startsAt: number
  readonly endsAt: number | null
  /** A booked time that must not move. */
  readonly fixed: boolean
}

export interface PlanBlock {
  /** The place's id. */
  readonly id: string
  /** Travel rows first, the place last. */
  readonly items: readonly PlanItem[]
  readonly fixed: boolean
}

export interface DayPlan {
  readonly anchors: readonly PlanItem[]
  readonly blocks: readonly PlanBlock[]
  /** Travel after the last place (e.g. back to the hotel). */
  readonly tail: readonly PlanItem[]
}

export interface ReplanResult {
  /** Items whose time changed, with their new times. */
  readonly changes: readonly { id: string; startsAt: number; endsAt: number | null }[]
  /**
   * The first fixed place the new order reaches too late, and by how many
   * minutes; the plan must not be saved while this is set.
   */
  readonly conflict: { readonly blockId: string; readonly minutes: number } | null
  /** Items whose trip there now starts somewhere else ("check the route"). */
  readonly routeChanged: readonly string[]
}

export class ReplanError extends Error {}

const ANCHORS = new Set(['wake', 'sleep'])
const end = (item: PlanItem) => item.endsAt ?? item.startsAt

/** Splits a day into anchors, blocks and tail. Ties keep the order given. */
export function dayBlocks(items: readonly PlanItem[]): DayPlan {
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.startsAt - b.item.startsAt || a.index - b.index)
    .map((x) => x.item)
  const anchors: PlanItem[] = []
  const blocks: PlanBlock[] = []
  let legs: PlanItem[] = []
  for (const item of sorted) {
    if (ANCHORS.has(item.kind)) anchors.push(item)
    else if (item.kind === 'move') legs.push(item)
    else {
      blocks.push({ id: item.id, items: [...legs, item], fixed: item.fixed })
      legs = []
    }
  }
  return { anchors, blocks, tail: legs }
}

const blockStart = (b: PlanBlock) => Math.min(...b.items.map((i) => i.startsAt))
const blockEnd = (b: PlanBlock) => Math.max(...b.items.map(end))
const placeOf = (b: PlanBlock) => b.items[b.items.length - 1] as PlanItem

/**
 * New times for the day when its places come in `order` (every place id once).
 * Throws ReplanError when `order` isn't exactly the day's places. A fixed place
 * may change position in the list but never its time.
 */
export function replanDay(items: readonly PlanItem[], order: readonly string[]): ReplanResult {
  const { blocks, tail } = dayBlocks(items)
  const byId = new Map(blocks.map((b) => [b.id, b]))
  if (order.length !== blocks.length || new Set(order).size !== order.length) {
    throw new ReplanError('The order must list every place of the day once')
  }
  for (const id of order) if (!byId.has(id)) throw new ReplanError(`Unknown place ${id}`)

  // Free time before each block in the current plan (overlaps count as none).
  const gap = new Map<string, number>()
  const before = new Map<string, string | null>()
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1]
    gap.set(b.id, prev ? Math.max(0, blockStart(b) - blockEnd(prev)) : 0)
    before.set(b.id, prev ? prev.id : null)
  })

  const firstMoved = order.findIndex((id, i) => blocks[i]?.id !== id)
  if (firstMoved === -1) return { changes: [], conflict: null, routeChanged: [] }

  const moved = new Map<string, { startsAt: number; endsAt: number | null }>()
  let conflict: ReplanResult['conflict'] = null
  let cursor = firstMoved === 0 ? null : blockEnd(blocks[firstMoved - 1] as PlanBlock)
  // The day keeps its first start time.
  const dayStart = blockStart(blocks[0] as PlanBlock)

  for (let i = firstMoved; i < order.length; i++) {
    const b = byId.get(order[i] as string) as PlanBlock
    let start = cursor === null ? dayStart : cursor + (gap.get(b.id) ?? 0)
    if (b.fixed) {
      // Keep the place itself at its booked time; its travel rows end where they did.
      const booked = blockStart(b)
      if (start > booked && !conflict) {
        conflict = { blockId: b.id, minutes: Math.round((start - booked) / 60_000) }
      }
      start = booked
    }
    const delta = start - blockStart(b)
    for (const item of b.items) {
      if (delta !== 0) {
        moved.set(item.id, {
          startsAt: item.startsAt + delta,
          endsAt: item.endsAt === null ? null : item.endsAt + delta,
        })
      }
    }
    cursor = blockEnd(b) + delta
  }

  // Travel after the last place keeps its distance from it.
  const lastBefore = blocks[blocks.length - 1] as PlanBlock
  const tailDelta = (cursor as number) - blockEnd(lastBefore)
  if (tailDelta !== 0) {
    for (const item of tail) {
      moved.set(item.id, {
        startsAt: item.startsAt + tailDelta,
        endsAt: item.endsAt === null ? null : item.endsAt + tailDelta,
      })
    }
  }

  // A block now reached from a different place: its travel rows (or the place itself) need a look.
  const routeChanged: string[] = []
  order.forEach((id, i) => {
    const from = i === 0 ? null : (order[i - 1] as string)
    if (before.get(id) !== from) {
      const b = byId.get(id) as PlanBlock
      const legs = b.items.filter((x) => x.kind === 'move')
      routeChanged.push(...(legs.length > 0 ? legs.map((x) => x.id) : [placeOf(b).id]))
    }
  })
  if (order[order.length - 1] !== lastBefore.id) routeChanged.push(...tail.map((x) => x.id))

  return {
    changes: [...moved].map(([id, t]) => ({ id, ...t })),
    conflict,
    routeChanged,
  }
}
