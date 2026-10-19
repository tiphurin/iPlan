import type { Country } from './lines'

/** Main passenger airports of the countries iPlan knows, with their IATA codes. */
export interface Airport {
  code: string
  en: string
  th?: string
  country: Exclude<Country, 'OTHER'>
}

export const AIRPORTS: readonly Airport[] = [
  { code: 'BKK', en: 'Suvarnabhumi', th: 'สุวรรณภูมิ', country: 'TH' },
  { code: 'DMK', en: 'Don Mueang', th: 'ดอนเมือง', country: 'TH' },
  { code: 'CNX', en: 'Chiang Mai', th: 'เชียงใหม่', country: 'TH' },
  { code: 'CEI', en: 'Chiang Rai', th: 'เชียงราย', country: 'TH' },
  { code: 'HKT', en: 'Phuket', th: 'ภูเก็ต', country: 'TH' },
  { code: 'KBV', en: 'Krabi', th: 'กระบี่', country: 'TH' },
  { code: 'USM', en: 'Samui', th: 'สมุย', country: 'TH' },
  { code: 'HDY', en: 'Hat Yai', th: 'หาดใหญ่', country: 'TH' },
  { code: 'ICN', en: 'Incheon', th: 'อินชอน', country: 'KR' },
  { code: 'GMP', en: 'Gimpo', th: 'กิมโป', country: 'KR' },
  { code: 'PUS', en: 'Gimhae (Busan)', th: 'กิมแฮ (ปูซาน)', country: 'KR' },
  { code: 'CJU', en: 'Jeju', th: 'เชจู', country: 'KR' },
  { code: 'NRT', en: 'Narita (Tokyo)', th: 'นาริตะ (โตเกียว)', country: 'JP' },
  { code: 'HND', en: 'Haneda (Tokyo)', th: 'ฮาเนดะ (โตเกียว)', country: 'JP' },
  { code: 'KIX', en: 'Kansai (Osaka)', th: 'คันไซ (โอซาก้า)', country: 'JP' },
  { code: 'ITM', en: 'Itami (Osaka)', th: 'อิตามิ (โอซาก้า)', country: 'JP' },
  { code: 'NGO', en: 'Chubu Centrair (Nagoya)', th: 'ชูบุ (นาโกย่า)', country: 'JP' },
  { code: 'FUK', en: 'Fukuoka', th: 'ฟุกุโอกะ', country: 'JP' },
  { code: 'CTS', en: 'New Chitose (Sapporo)', th: 'ชิโตเสะ (ซัปโปโร)', country: 'JP' },
  { code: 'OKA', en: 'Naha (Okinawa)', th: 'นาฮะ (โอกินาวา)', country: 'JP' },
  { code: 'TPE', en: 'Taoyuan (Taipei)', th: 'เถาหยวน (ไทเป)', country: 'TW' },
  { code: 'TSA', en: 'Songshan (Taipei)', th: 'ซงซาน (ไทเป)', country: 'TW' },
  { code: 'KHH', en: 'Kaohsiung', th: 'เกาสง', country: 'TW' },
  { code: 'RMQ', en: 'Taichung', th: 'ไถจง', country: 'TW' },
]

/** "Suvarnabhumi (BKK)": what is shown and saved. */
export function airportLabel(a: Airport, thai: boolean): string {
  return `${thai && a.th ? a.th : a.en} (${a.code})`
}

/**
 * Airports matching the text by code or name, the trip's country first and
 * home (Thailand) next, so both ends of a flight are a tap away.
 */
export function findAirports(text: string, country: Country): Airport[] {
  const q = text.trim().toLowerCase()
  const rank = (a: Airport) => (a.country === country ? 0 : a.country === 'TH' ? 1 : 2)
  return AIRPORTS.filter(
    (a) =>
      !q ||
      a.code.toLowerCase().startsWith(q) ||
      a.en.toLowerCase().includes(q) ||
      (a.th?.includes(q) ?? false),
  ).sort((a, b) => rank(a) - rank(b))
}
