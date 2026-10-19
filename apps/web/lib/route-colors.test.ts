import { describe, expect, it } from 'vitest'
import { routeColors } from './route-colors'

const day = '#00a84d'
const place = (lineColor?: string) => ({
  kind: 'place' as const,
  details: lineColor ? { lineColor } : {},
})
const move = (line: string, lineColor: string) => ({
  kind: 'move' as const,
  details: { line, lineColor },
})

describe('route colours', () => {
  it('a place takes the colour of the ride that brought you there', () => {
    expect(routeColors([place(), move('4', '#00a5de'), place(), place()], day)).toEqual([
      day,
      day,
      '#00a5de',
      '#00a5de',
    ])
  })

  it('walking keeps the previous line colour; the next ride changes it', () => {
    expect(
      routeColors(
        [move('2', '#00a84d'), move('W', '#9aa3ae'), place(), move('TAXI', '#e0a100'), place()],
        day,
      ),
    ).toEqual([day, day, '#00a84d', day, '#e0a100'])
  })

  it('a place with its own colour keeps it', () => {
    expect(routeColors([move('4', '#00a5de'), place('#e5007e')], day)).toEqual([day, '#e5007e'])
  })

  it('waking up and sleep keep the day colour', () => {
    const sleep = { kind: 'sleep' as const, details: {} }
    expect(routeColors([move('4', '#00a5de'), place(), sleep], day)).toEqual([day, '#00a5de', day])
  })
})
