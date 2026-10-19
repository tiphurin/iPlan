import type { TripItemDto } from '@iplan/contracts'

/** Colour of each row: own colour, else the last ride's line colour, else the day colour. */
export function routeColors(
  items: readonly Pick<TripItemDto, 'kind' | 'details'>[],
  dayColor: string,
): string[] {
  let carried: string | undefined
  return items.map((item) => {
    const own = item.details.lineColor
    if (item.kind === 'move') {
      // Walking keeps the colour of the line you got off.
      if (own && item.details.line && item.details.line !== 'W') carried = own
      return dayColor
    }
    // Waking up and going to sleep aren't stops on a route: they keep the day colour.
    if (item.kind === 'wake' || item.kind === 'sleep') return own ?? dayColor
    return own ?? carried ?? dayColor
  })
}
