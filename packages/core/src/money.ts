/**
 * Money is always an integer amount of the currency's minor unit (satang for THB,
 * won for KRW) held in a bigint, so sums never drift.
 */
export interface Money {
  readonly amount: bigint
  readonly currency: string
}

export class MoneyError extends Error {
  override readonly name = 'MoneyError'
}

const fractionDigitsCache = new Map<string, number>()

/** Number of minor-unit digits for an ISO 4217 currency (THB → 2, KRW → 0). */
export function fractionDigits(currency: string): number {
  const code = normalizeCurrency(currency)
  let digits = fractionDigitsCache.get(code)
  if (digits === undefined) {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
      .maximumFractionDigits as number
    fractionDigitsCache.set(code, digits)
  }
  return digits
}

function normalizeCurrency(currency: string): string {
  const code = currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) throw new MoneyError(`Invalid currency code: ${currency}`)
  return code
}

export function money(amount: bigint, currency: string): Money {
  return { amount, currency: normalizeCurrency(currency) }
}

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/

/**
 * Parses a decimal string in major units ("1,500.25") into minor units.
 * Rejects more decimals than the currency allows instead of silently rounding.
 */
export function parseMoney(input: string, currency: string): Money {
  const code = normalizeCurrency(currency)
  const digits = fractionDigits(code)
  const match = DECIMAL.exec(input.replaceAll(',', '').trim())
  if (!match) throw new MoneyError(`Not a number: ${input}`)
  const [, sign, whole = '0', fraction = ''] = match
  if (fraction.length > digits) {
    throw new MoneyError(`${code} allows at most ${digits} decimal places: ${input}`)
  }
  const minor = BigInt(whole + fraction.padEnd(digits, '0'))
  return money(sign ? -minor : minor, code)
}

/** Major-unit decimal string without grouping ("1500.25"), the inverse of parseMoney. */
export function toDecimalString(value: Money): string {
  const digits = fractionDigits(value.currency)
  const negative = value.amount < 0n
  const abs = (negative ? -value.amount : value.amount).toString().padStart(digits + 1, '0')
  const whole = abs.slice(0, abs.length - digits)
  const fraction = digits > 0 ? `.${abs.slice(abs.length - digits)}` : ''
  return `${negative ? '-' : ''}${whole}${fraction}`
}

export function formatMoney(value: Money, locale = 'th-TH'): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: value.currency })
  // Intl accepts decimal strings, which keeps precision for large bigint amounts.
  return formatter.format(toDecimalString(value) as `${number}`)
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`)
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount + b.amount, a.currency)
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount - b.amount, a.currency)
}

export function sumMoney(values: readonly Money[], currency: string): Money {
  return values.reduce((total, value) => addMoney(total, value), money(0n, currency))
}

/**
 * An exchange rate as a decimal string: how many units of `to` one unit of `from`
 * buys, in major units ("0.0255" THB per KRW). Kept as a string so it can be
 * stored exactly next to each expense.
 */
export interface ExchangeRate {
  readonly from: string
  readonly to: string
  readonly rate: string
}

/** Integer division rounding half away from zero. */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new MoneyError('Division by zero')
  const negative = numerator < 0n !== denominator < 0n
  const n = numerator < 0n ? -numerator : numerator
  const d = denominator < 0n ? -denominator : denominator
  const quotient = (n * 2n + d) / (d * 2n)
  return negative ? -quotient : quotient
}

export function convertMoney(value: Money, rate: ExchangeRate): Money {
  const from = normalizeCurrency(rate.from)
  const to = normalizeCurrency(rate.to)
  if (value.currency !== from) {
    throw new MoneyError(`Rate is for ${from}, money is ${value.currency}`)
  }
  const match = DECIMAL.exec(rate.rate.trim())
  if (!match || match[1]) throw new MoneyError(`Invalid rate: ${rate.rate}`)
  const [, , whole = '0', fraction = ''] = match
  const rateScaled = BigInt(whole + fraction)
  const rateScale = 10n ** BigInt(fraction.length)
  const shift = BigInt(fractionDigits(to) - fractionDigits(from))
  const numerator = value.amount * rateScaled * (shift >= 0n ? 10n ** shift : 1n)
  const denominator = rateScale * (shift < 0n ? 10n ** -shift : 1n)
  return money(divRound(numerator, denominator), to)
}
