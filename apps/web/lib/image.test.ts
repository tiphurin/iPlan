import { describe, expect, it } from 'vitest'
import { fitWithin } from './image'

describe('fitWithin', () => {
  it('shrinks the long edge to the limit and keeps the ratio', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(1170, 2532, 2000)).toEqual({ width: 924, height: 2000 })
  })

  it('never enlarges small images', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
})
