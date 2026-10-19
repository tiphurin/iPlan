import { todayKey } from '@iplan/i18n'

/** Current "YYYY-MM" in Thailand, where personal finance is tracked. */
export function thisMonth(): string {
  return todayKey('Asia/Bangkok').slice(0, 7)
}

export function validMonth(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null
}
