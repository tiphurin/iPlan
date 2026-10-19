import { money } from '@iplan/core'
import { formatMoney } from '@iplan/i18n'

/** Server-safe "฿1,500.00" from a THB minor-unit string. */
export function fmtServer(minor: string, currency = 'THB'): string {
  return formatMoney(money(BigInt(minor), currency))
}
