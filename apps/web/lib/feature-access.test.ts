import { describe, expect, it } from 'vitest'
import { effectiveFeatures, planAccess } from './feature-access'

const travelers = { id: 'travelers', features: ['trips'] as const }
const full = { id: 'full', features: ['trips', 'finance', 'shared'] as const }
const groups = [travelers, full]

describe('feature access', () => {
  it('shows group features as ticked', () => {
    expect(effectiveFeatures(['full'], [], groups).sort()).toEqual(['finance', 'shared', 'trips'])
    expect(effectiveFeatures([], ['finance'], groups)).toEqual(['finance'])
    expect(effectiveFeatures(['travelers'], ['shared'], groups).sort()).toEqual(['shared', 'trips'])
  })

  it('ticking every feature selects Full access', () => {
    expect(planAccess(['trips', 'finance', 'shared'], groups, [])).toEqual({
      groupIds: ['full'],
      features: [],
    })
  })

  it('unticking one feature leaves Full access and keeps the rest', () => {
    expect(planAccess(['trips', 'shared'], groups, ['full'])).toEqual({
      groupIds: ['travelers'],
      features: ['shared'],
    })
  })

  it('nothing ticked means no groups and no grants', () => {
    expect(planAccess([], groups, ['full', 'travelers'])).toEqual({ groupIds: [], features: [] })
  })

  it('prefers the current group when two groups grant the same features', () => {
    const twin = { id: 'twin', features: ['trips'] as const }
    expect(planAccess(['trips'], [travelers, twin], ['twin']).groupIds).toEqual(['twin'])
    expect(planAccess(['trips'], [travelers, twin], []).groupIds).toEqual(['travelers'])
  })

  it('round-trips: the plan grants exactly what was ticked', () => {
    for (const wanted of [
      ['trips'],
      ['finance'],
      ['trips', 'finance'],
      ['shared', 'finance'],
    ] as const) {
      const plan = planAccess(wanted, groups, [])
      expect(effectiveFeatures(plan.groupIds, plan.features, groups).sort()).toEqual(
        [...wanted].sort(),
      )
    }
  })
})
