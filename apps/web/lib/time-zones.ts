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

/** Country code and local currency for the zones in TIME_ZONES. */
const ZONE_INFO: Record<string, { code: string; currency: string }> = {
  'Asia/Bangkok': { code: 'TH', currency: 'THB' },
  'Asia/Seoul': { code: 'KR', currency: 'KRW' },
  'Asia/Tokyo': { code: 'JP', currency: 'JPY' },
  'Asia/Taipei': { code: 'TW', currency: 'TWD' },
  'Asia/Hong_Kong': { code: 'HK', currency: 'HKD' },
  'Asia/Shanghai': { code: 'CN', currency: 'CNY' },
  'Asia/Singapore': { code: 'SG', currency: 'SGD' },
  'Asia/Kuala_Lumpur': { code: 'MY', currency: 'MYR' },
  'Asia/Ho_Chi_Minh': { code: 'VN', currency: 'VND' },
  'Asia/Jakarta': { code: 'ID', currency: 'IDR' },
  'Asia/Manila': { code: 'PH', currency: 'PHP' },
  'Asia/Kolkata': { code: 'IN', currency: 'INR' },
  'Asia/Dubai': { code: 'AE', currency: 'AED' },
  'Europe/London': { code: 'UK', currency: 'GBP' },
  'Europe/Paris': { code: 'FR', currency: 'EUR' },
  'Europe/Zurich': { code: 'CH', currency: 'CHF' },
  'Australia/Sydney': { code: 'AU', currency: 'AUD' },
  'America/New_York': { code: 'NY', currency: 'USD' },
  'America/Los_Angeles': { code: 'LA', currency: 'USD' },
}

/** Rough city centre of each zone in TIME_ZONES, to bias place search to the right country. */
const ZONE_CENTER: Record<string, { lat: number; lng: number }> = {
  'Asia/Bangkok': { lat: 13.7563, lng: 100.5018 },
  'Asia/Seoul': { lat: 37.5665, lng: 126.978 },
  'Asia/Tokyo': { lat: 35.6762, lng: 139.6503 },
  'Asia/Taipei': { lat: 25.033, lng: 121.5654 },
  'Asia/Hong_Kong': { lat: 22.3193, lng: 114.1694 },
  'Asia/Shanghai': { lat: 31.2304, lng: 121.4737 },
  'Asia/Singapore': { lat: 1.3521, lng: 103.8198 },
  'Asia/Kuala_Lumpur': { lat: 3.139, lng: 101.6869 },
  'Asia/Ho_Chi_Minh': { lat: 10.8231, lng: 106.6297 },
  'Asia/Jakarta': { lat: -6.2088, lng: 106.8456 },
  'Asia/Manila': { lat: 14.5995, lng: 120.9842 },
  'Asia/Kolkata': { lat: 28.6139, lng: 77.209 },
  'Asia/Dubai': { lat: 25.2048, lng: 55.2708 },
  'Europe/London': { lat: 51.5072, lng: -0.1276 },
  'Europe/Paris': { lat: 48.8566, lng: 2.3522 },
  'Europe/Zurich': { lat: 47.3769, lng: 8.5417 },
  'Australia/Sydney': { lat: -33.8688, lng: 151.2093 },
  'America/New_York': { lat: 40.7128, lng: -74.006 },
  'America/Los_Angeles': { lat: 34.0522, lng: -118.2437 },
}

/** Centre of the zone's main city, or undefined for zones we don't know (e.g. UTC). */
export function zoneCenter(timeZone: string): { lat: number; lng: number } | undefined {
  return ZONE_CENTER[timeZone]
}

/** "KR" for Asia/Seoul; the city name for zones we don't know. */
export function zoneShort(timeZone: string): string {
  return ZONE_INFO[timeZone]?.code ?? zoneCity(timeZone)
}

/** The currency people usually pay in at that place, if known. */
export function zoneCurrency(timeZone: string): string | undefined {
  return ZONE_INFO[timeZone]?.currency
}

/** The trip's "away" zone: the most used item zone that isn't home. */
export function awayZone(items: { timeZone: string }[], home: string): string | null {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (item.timeZone !== home) counts.set(item.timeZone, (counts.get(item.timeZone) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
