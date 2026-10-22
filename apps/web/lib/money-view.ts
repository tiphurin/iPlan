'use client'

import { fmt } from './expenses'
import { baseToLocal, usableRate } from './money-convert'
import { useTripDisplay } from './trip-display'

/**
 * Formatter for trip totals that follows the trip's ₩ | ฿ switch: base amounts
 * become the local currency when the switch says so and a rate is saved;
 * amounts in any other currency stay as they are.
 */
export function useShownMoney(
  base: string,
  local: string | undefined,
  rates: Record<string, string>,
) {
  const { display } = useTripDisplay()
  const rate = local && local !== base ? usableRate(rates, local) : undefined
  const target = display.money === 'local' && rate ? local : undefined
  return {
    /** The currency totals are shown in. */
    shown: target ?? base,
    converted: target !== undefined,
    fmt: (minor: string | bigint | number, currency: string) =>
      target && rate && currency === base
        ? fmt(baseToLocal(BigInt(minor), base, target, rate), target)
        : fmt(BigInt(minor), currency),
  }
}
