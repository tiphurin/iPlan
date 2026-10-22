import { convertMoney, money } from '@iplan/core'

/** A saved rate (base units per 1 foreign unit) when it is a positive decimal. */
export function usableRate(rates: Record<string, string>, code: string | undefined) {
  const saved = code ? rates[code] : undefined
  return saved && /^\d+(\.\d+)?$/.test(saved) && Number(saved) > 0 ? saved : undefined
}

/** Base-currency minor units in the local currency, e.g. ฿484.50 → ₩19,000 at 0.0255. */
export function baseToLocal(minor: bigint, base: string, local: string, rate: string): bigint {
  return convertMoney(money(minor, base), {
    from: base,
    to: local,
    rate: (1 / Number(rate)).toFixed(10),
  }).amount
}
