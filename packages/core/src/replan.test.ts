import { describe, expect, it } from 'vitest'
import { type PlanItem, ReplanError, dayBlocks, replanDay } from './replan'

// Times as "HH:MM" on one day, in epoch ms (UTC; zones don't matter for lengths).
const at = (hhmm: string, day = 24) => {
  const [h, m] = hhmm.split(':').map(Number)
  return Date.UTC(2026, 9, day, h as number, m as number)
}
const hm = (ms: number) => new Date(ms).toISOString().slice(11, 16)
const item = (
  id: string,
  kind: string,
  start: string,
  endTime: string | null,
  fixed = false,
): PlanItem => ({
  id,
  kind,
  startsAt: at(start),
  endsAt: endTime === null ? null : at(endTime),
  fixed,
})

/** 24 Oct in the real Seoul plan, trimmed. */
const day = (): PlanItem[] => [
  item('wake', 'wake', '09:00', '09:40'),
  item('hanbok', 'place', '11:20', '12:15'),
  item('palace', 'place', '12:15', '13:45'),
  item('train', 'move', '13:50', '14:00'),
  item('walk', 'move', '14:00', '14:15'),
  item('market', 'place', '14:15', '16:00'),
  item('cafe', 'place', '16:00', '17:15'),
  item('subway', 'move', '17:40', '17:55'),
  item('myeong', 'place', '18:05', '20:10'),
  item('crab', 'place', '20:10', '21:40', true),
  item('home', 'move', '23:20', '23:35'),
  item('sleep', 'sleep', '23:59', null),
]
const order = ['hanbok', 'palace', 'market', 'cafe', 'myeong', 'crab']
/** New times by id, as "HH:MM–HH:MM". */
const times = (items: PlanItem[], o: string[]) => {
  const r = replanDay(items, o)
  const out: Record<string, string> = {}
  for (const c of r.changes) out[c.id] = `${hm(c.startsAt)}–${c.endsAt ? hm(c.endsAt) : ''}`
  return { ...r, times: out }
}

describe('dayBlocks', () => {
  it('puts the travel rows above a place with that place, anchors and tail apart', () => {
    const { anchors, blocks, tail } = dayBlocks(day())
    expect(anchors.map((a) => a.id)).toEqual(['wake', 'sleep'])
    expect(blocks.map((b) => [b.id, b.items.map((i) => i.id)])).toEqual([
      ['hanbok', ['hanbok']],
      ['palace', ['palace']],
      ['market', ['train', 'walk', 'market']],
      ['cafe', ['cafe']],
      ['myeong', ['subway', 'myeong']],
      ['crab', ['crab']],
    ])
    expect(tail.map((t) => t.id)).toEqual(['home'])
  })

  it('keeps the given order for items that start together', () => {
    const items = [
      item('b', 'move', '10:00', '10:10'),
      item('a', 'move', '10:00', '10:05'),
      item('p', 'place', '10:10', '11:00'),
    ]
    expect(dayBlocks(items).blocks[0]?.items.map((i) => i.id)).toEqual(['b', 'a', 'p'])
  })

  it('sorts by time whatever order the items come in', () => {
    const shuffled = [...day()].reverse()
    expect(dayBlocks(shuffled).blocks.map((b) => b.id)).toEqual(order)
  })
})

describe('replanDay', () => {
  it('changes nothing when the order is the same', () => {
    expect(replanDay(day(), order)).toEqual({ changes: [], conflict: null, routeChanged: [] })
  })

  it('swaps market and café: lengths kept, free time travels with its place', () => {
    const r = times(day(), ['hanbok', 'palace', 'cafe', 'market', 'myeong', 'crab'])
    expect(r.conflict).toBeNull()
    expect(r.times).toEqual({
      cafe: '13:45–15:00',
      // The 5 minutes before the train stay with the market block.
      train: '15:05–15:15',
      walk: '15:15–15:30',
      market: '15:30–17:15',
    })
    // Myeongdong's block keeps its time: the day's total is unchanged.
    expect(r.times.myeong).toBeUndefined()
    // The train now leaves from the café; Myeongdong's subway from the market.
    expect(r.routeChanged).toEqual(['cafe', 'train', 'walk', 'subway'])
  })

  it('keeps every item before the first moved block exactly as it was', () => {
    const r = times(day(), ['hanbok', 'palace', 'market', 'myeong', 'cafe', 'crab'])
    for (const id of ['hanbok', 'palace', 'train', 'walk', 'market']) {
      expect(r.times[id]).toBeUndefined()
    }
  })

  it('keeps the day starting when it did when the first place moves', () => {
    const r = times(day(), ['palace', 'hanbok', 'market', 'cafe', 'myeong', 'crab'])
    expect(r.times.palace).toBe('11:20–12:50')
    expect(r.times.hanbok).toBe('12:50–13:45')
    expect(r.routeChanged).toEqual(['palace', 'hanbok', 'train', 'walk'])
  })

  it('refuses to reach a fixed place late, and says by how much', () => {
    // The stream (40 min free before it + 1 h) moved before the 20:10 booking: Myeongdong ends
    // 20:10, the stream runs 20:50–21:50, so the crab would start 21:50, 100 minutes late.
    const items = [
      ...day().filter((i) => i.id !== 'home'),
      item('stream', 'place', '22:20', '23:20'),
    ]
    const r = times(items, ['hanbok', 'palace', 'market', 'cafe', 'myeong', 'stream', 'crab'])
    expect(r.conflict).toEqual({ blockId: 'crab', minutes: 100 })
    // The fixed place itself never moves.
    expect(r.times.crab).toBeUndefined()
  })

  it('leaves free time before a fixed place that is reached early', () => {
    const r = times(day(), ['hanbok', 'palace', 'market', 'cafe', 'crab', 'myeong'])
    expect(r.conflict).toBeNull()
    expect(r.times.crab).toBeUndefined()
    // After the crab dinner (ends 21:40): the 25 min that were free before the subway, then
    // the subway (15 min) and the 10 min between it and Myeongdong, as before.
    expect(r.times.subway).toBe('22:05–22:20')
    expect(r.times.myeong).toBe('22:30–00:35')
  })

  it('moves the tail with the last place, and flags it when the last place changes', () => {
    const r = times(day(), ['hanbok', 'palace', 'market', 'cafe', 'crab', 'myeong'])
    // Myeongdong now ends 00:35 instead of the crab at 21:40: +2 h 55 for the way home.
    expect(r.times.home).toBe('02:15–02:30')
    expect(r.routeChanged).toContain('home')
  })

  it('never moves the anchors (wake, sleep)', () => {
    const r = times(day(), ['palace', 'hanbok', 'cafe', 'market', 'crab', 'myeong'])
    expect(r.times.wake).toBeUndefined()
    expect(r.times.sleep).toBeUndefined()
  })

  it('keeps items without an end as instants', () => {
    const items = [
      item('a', 'place', '10:00', '11:00'),
      item('ride', 'move', '11:10', null),
      item('b', 'place', '11:30', '12:00'),
    ]
    const r = times(items, ['b', 'a'])
    expect(r.times).toEqual({ ride: '10:00–', b: '10:20–10:50', a: '10:50–11:50' })
  })

  it('treats overlapping items as no free time instead of going backwards', () => {
    const items = [
      item('a', 'place', '09:50', '10:25'),
      item('train', 'move', '10:15', '10:30'),
      item('b', 'place', '10:30', '11:00'),
      item('c', 'place', '11:00', '11:30'),
    ]
    const r = times(items, ['a', 'c', 'b'])
    // c starts when a ends (10:25), then b's block with its train, which keeps its length.
    expect(r.times.c).toBe('10:25–10:55')
    expect(r.times.train).toBe('10:55–11:10')
    expect(r.times.b).toBe('11:10–11:40')
  })

  it('works across midnight and keeps every length', () => {
    const items = [item('late', 'place', '22:00', '23:30'), item('bar', 'place', '23:30', '23:59')]
    const r = replanDay(items, ['bar', 'late'])
    const byId = Object.fromEntries(r.changes.map((c) => [c.id, c]))
    expect(hm(byId.bar?.startsAt as number)).toBe('22:00')
    expect(((byId.late?.endsAt as number) - (byId.late?.startsAt as number)) / 60_000).toBe(90)
    expect(byId.late?.endsAt).toBe(at('23:59'))
  })

  it('a day with one place has nothing to reorder', () => {
    expect(replanDay([item('a', 'place', '10:00', '11:00')], ['a']).changes).toEqual([])
  })

  it('refuses an order that is not exactly the day’s places', () => {
    expect(() => replanDay(day(), order.slice(1))).toThrow(ReplanError)
    expect(() => replanDay(day(), [...order.slice(1), 'hanbok', 'hanbok'])).toThrow(ReplanError)
    expect(() => replanDay(day(), [...order.slice(1), 'train'])).toThrow(ReplanError)
  })

  it('never changes a length, for every possible order of a 5-place day', () => {
    const items = day()
    const places = ['hanbok', 'palace', 'market', 'cafe', 'myeong']
    const permutations = (xs: string[]): string[][] =>
      xs.length <= 1
        ? [xs]
        : xs.flatMap((x, i) =>
            permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]),
          )
    const len = new Map(items.map((i) => [i.id, i.endsAt === null ? null : i.endsAt - i.startsAt]))
    for (const p of permutations(places)) {
      const r = replanDay(items, [...p, 'crab'])
      for (const c of r.changes) {
        expect(c.endsAt === null ? null : c.endsAt - c.startsAt).toBe(len.get(c.id))
      }
      // Nothing moves before the day's first start, and the fixed dinner never moves.
      expect(r.changes.every((c) => c.startsAt >= at('11:20'))).toBe(true)
      expect(r.changes.some((c) => c.id === 'crab' || c.id === 'wake' || c.id === 'sleep')).toBe(
        false,
      )
      // No two places overlap after the change.
      const next = new Map(items.map((i) => [i.id, { s: i.startsAt, e: i.endsAt ?? i.startsAt }]))
      for (const c of r.changes) next.set(c.id, { s: c.startsAt, e: c.endsAt ?? c.startsAt })
      const placeTimes = [...p, 'crab'].map((id) => next.get(id) as { s: number; e: number })
      if (!r.conflict) {
        for (let k = 1; k < placeTimes.length; k++) {
          expect((placeTimes[k] as { s: number }).s).toBeGreaterThanOrEqual(
            (placeTimes[k - 1] as { e: number }).e,
          )
        }
      }
    }
  })
})
