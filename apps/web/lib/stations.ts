/** One station of a rail line, from scripts/fetch-stations.mjs (OpenStreetMap). */
export interface Station {
  en: string
  /** Name in the local script (Thai, Hangul, kanji, hanzi). */
  local: string
  /** Thai name, for Thai lines. */
  th?: string
}

/** Stations whose English, local or Thai name contains the text (all when it is empty). */
export function filterStations<T extends Station>(stations: readonly T[], text: string): T[] {
  const q = text.trim().toLowerCase()
  if (!q) return [...stations]
  return stations.filter((s) => [s.en, s.local, s.th].some((n) => n?.toLowerCase().includes(q)))
}

/**
 * What to show and save: Thai name on Thai lines for Thai readers, otherwise
 * English; the other script appears as a hint ("Hongdae · 홍대입구").
 */
export function stationLabel(s: Station, thai: boolean): { label: string; hint?: string } {
  // Thai lines whose Thai tag is missing still carry the Thai name as the local name.
  const thaiName = s.th ?? (/[\u0E00-\u0E7F]/.test(s.local) ? s.local : undefined)
  const label = thai && thaiName ? thaiName : s.en
  const other = label === s.en ? s.local : s.en
  return other && other !== label ? { label, hint: other } : { label }
}

/** A station of a city network with the lines that stop there ("Siam" → SUK, SIL). */
export interface CityStation extends Station {
  /** Badges of the lines that stop here, e.g. ["PP", "BL"]. */
  lines: string[]
  /** The same lines as ids, e.g. ["MRT-PP", "MRT-BL"]. */
  lineIds: string[]
}

/**
 * Every station of a city's rail lines, for picking a station before a line:
 * stations shared by several lines appear once, listing all of them.
 */
export function cityStations(
  byLine: Readonly<Record<string, readonly Station[]>>,
  lines: readonly { line: string; badge: string }[],
): CityStation[] {
  const out = new Map<string, CityStation>()
  for (const { line, badge } of lines) {
    for (const s of byLine[line] ?? []) {
      const key = s.en.toLowerCase()
      const known = out.get(key)
      if (known) {
        if (!known.lineIds.includes(line)) {
          known.lines.push(badge)
          known.lineIds.push(line)
        }
      } else out.set(key, { ...s, lines: [badge], lineIds: [line] })
    }
  }
  return [...out.values()]
}
