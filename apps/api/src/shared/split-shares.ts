import type { SplitInput } from '@iplan/contracts'
import {
  MoneyError,
  SplitError,
  parseMoney,
  splitEqual,
  splitExact,
  splitPercent,
} from '@iplan/core'
import { validationFailed } from './errors'

export interface ComputedShare {
  userId: string
  amountMinor: bigint
  percentBp: number | null
}

export function splitParticipants(split: SplitInput): string[] {
  return split.mode === 'equal' ? split.participants : Object.keys(split.shares)
}

/**
 * Turns a split request into exact per-person amounts that add up to `amount`
 * (minor units). Problems become a VALIDATION_FAILED error on the `split` field.
 */
export function computeShares(
  amount: bigint,
  currency: string,
  split: SplitInput,
): ComputedShare[] {
  try {
    if (split.mode === 'equal') {
      return Object.entries(splitEqual(amount, split.participants)).map(
        ([userId, amountMinor]) => ({ userId, amountMinor, percentBp: null }),
      )
    }
    if (split.mode === 'exact') {
      const parts = splitExact(
        amount,
        Object.fromEntries(
          Object.entries(split.shares).map(([id, value]) => [
            id,
            parseMoney(value, currency).amount,
          ]),
        ),
      )
      return Object.entries(parts).map(([userId, amountMinor]) => ({
        userId,
        amountMinor,
        percentBp: null,
      }))
    }
    const bp = Object.fromEntries(
      Object.entries(split.shares).map(([id, pct]) => [id, Math.round(pct * 100)]),
    )
    return Object.entries(splitPercent(amount, bp)).map(([userId, amountMinor]) => ({
      userId,
      amountMinor,
      percentBp: bp[userId] ?? null,
    }))
  } catch (error) {
    if (error instanceof SplitError || error instanceof MoneyError) {
      throw validationFailed({ split: error.message })
    }
    throw error
  }
}
