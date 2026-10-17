import { formatOffset, offsetMinutes } from '@iplan/core'

/** Zones offered in pickers; any valid IANA zone still works through the API. */
export const TIME_ZONES = [
  'Asia/Bangkok',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Taipei',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Ho_Chi_Minh',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Zurich',
  'Australia/Sydney',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
] as const

/** "Seoul" from "Asia/Seoul". */
export function zoneCity(timeZone: string): string {
  return (timeZone.split('/').at(-1) ?? timeZone).replaceAll('_', ' ')
}

/** "Seoul (UTC+9)" at a given moment. */
export function zoneLabel(timeZone: string, at = new Date()): string {
  return `${zoneCity(timeZone)} (${formatOffset(offsetMinutes(at, timeZone))})`
}

export const CURRENCIES = [
  'THB',
  'KRW',
  'JPY',
  'USD',
  'EUR',
  'SGD',
  'TWD',
  'HKD',
  'CNY',
  'VND',
  'GBP',
  'AUD',
] as const
