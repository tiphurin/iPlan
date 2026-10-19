/** One station of a rail line, from scripts/fetch-stations.mjs (OpenStreetMap). */
export interface Station {
  en: string
  /** Name in the local script (Thai, Hangul, kanji, hanzi). */
  local: string
  /** Thai name, for Thai lines. */
  th?: string
}

/** Stations whose English, local or Thai name contains the text (all when it is empty). */
export function filterStations(stations: readonly Station[], text: string): Station[] {
  const q = text.trim().toLowerCase()
  if (!q) return [...stations]
  return stations.filter((s) => [s.en, s.local, s.th].some((n) => n?.toLowerCase().includes(q)))
}

/**
 * What to show and save: Thai name on Thai lines for Thai readers, otherwise
 * English; the other script appears as a hint ("Hongdae · 홍대입구").
 */
export function stationLabel(s: Station, thai: boolean): { label: string; hint?: string } {
  const label = thai && s.th ? s.th : s.en
  const other = label === s.en ? s.local : s.en
  return other && other !== label ? { label, hint: other } : { label }
}
