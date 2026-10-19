import type { TransportMode } from '@iplan/contracts'

/** Countries with their own ride apps and rail lines; everything else is "OTHER". */
export const COUNTRIES = ['TH', 'KR', 'JP', 'TW', 'OTHER'] as const
export type Country = (typeof COUNTRIES)[number]

export const COUNTRY_FLAG: Record<Country, string> = {
  TH: '🇹🇭',
  KR: '🇰🇷',
  JP: '🇯🇵',
  TW: '🇹🇼',
  OTHER: '🌐',
}

const ZONE_COUNTRY: Record<string, Country> = {
  'Asia/Bangkok': 'TH',
  'Asia/Seoul': 'KR',
  'Asia/Tokyo': 'JP',
  'Asia/Taipei': 'TW',
}

/** Which country's transport to suggest for an item in this time zone. */
export function countryOfZone(timeZone: string | null | undefined): Country {
  return (timeZone && ZONE_COUNTRY[timeZone]) || 'OTHER'
}

/** Ready-made route styles for "move" items: tap one instead of picking a colour. */
export interface LinePreset {
  /** Stored as details.line; "W" draws a dotted walking line. */
  line: string
  color: string
  /** Message key under "lines" (modes) or a literal label (rail lines). */
  label: string
  /** Short text in the coloured line badge, e.g. "2", "G", "BTS". */
  badge?: string
  /** Thai name for a rail line, when it has one. */
  labelTh?: string
  emoji?: string
  /** The matching transport expense kind, for "add expense here". */
  mode?: TransportMode
  /** Set for ride apps and rail lines that only exist in one country. */
  country?: Country
}

const mode = (
  line: string,
  color: string,
  label: string,
  emoji: string,
  m: TransportMode,
  country?: Country,
): LinePreset => ({ line, color, label, emoji, mode: m, ...(country && { country }) })

const walk = mode('W', '#9aa3ae', 'walk', '🚶', 'walk')
const taxi = mode('TAXI', '#e0a100', 'taxi', '🚕', 'taxi')
const drive = mode('car', '#4a5563', 'drive', '🚗', 'drive')
const bus = mode('BUS', '#0068b7', 'bus', '🚌', 'bus')
const boat = mode('BOAT', '#0e7490', 'boat', '⛴️', 'boat')
const plane = mode('FLY', '#6366f1', 'plane', '✈️', 'plane')
/** City rail (BTS/MRT, subway, metro): opens that country's lines. Labelled per country. */
const metro = (country: Country) => mode('METRO', '#64748b', `metro_${country}`, '🚇', 'metro')
/** Intercity / regional trains, labelled the way each country calls them. */
const train = (country: Country) => mode('TRAIN', '#8b5e3c', `train_${country}`, '🚆', 'train')

/** Ride apps, local rides and long-distance trains that belong to one country. */
const LOCAL_MODES: Record<Country, LinePreset[]> = {
  TH: [
    mode('GRAB', '#00b14f', 'grab', '🟢', 'grab', 'TH'),
    mode('BOLT', '#2a9d5c', 'bolt', '⚡', 'bolt', 'TH'),
    mode('LINEMAN', '#06c755', 'lineman', '🛵', 'lineman', 'TH'),
    mode('TUKTUK', '#2563eb', 'tuktuk', '🛺', 'tuktuk', 'TH'),
    mode('MOTO', '#ea580c', 'motorbike', '🏍️', 'motorbike', 'TH'),
  ],
  KR: [mode('KAKAOT', '#f7c600', 'kakao_t', '🟡', 'kakao_t', 'KR')],
  JP: [mode('GO', '#111827', 'go', '🚖', 'go', 'JP')],
  TW: [mode('UBER', '#000000', 'uber', '⚫', 'uber', 'TW')],
  OTHER: [],
}

/** High-speed trains with their own name. */
const FAST_TRAINS: Record<Country, LinePreset[]> = {
  TH: [],
  KR: [],
  JP: [mode('SHINKANSEN', '#1d4ed8', 'shinkansen', '🚄', 'shinkansen', 'JP')],
  TW: [mode('THSR', '#f26522', 'thsr', '🚄', 'thsr', 'TW')],
  OTHER: [],
}

/** Ways of getting around in a country, in the order people reach for them there. */
export function modesFor(country: Country): LinePreset[] {
  return [
    walk,
    taxi,
    ...LOCAL_MODES[country],
    metro(country),
    ...FAST_TRAINS[country],
    train(country),
    bus,
    // River and canal boats are an everyday ride in Bangkok; elsewhere they are rare.
    ...(country === 'TH' || country === 'OTHER' ? [boat] : []),
    drive,
    plane,
  ]
}

/** Every mode preset, from every country (for reading items saved earlier). */
export const MODE_PRESETS: LinePreset[] = [
  walk,
  taxi,
  ...Object.values(LOCAL_MODES).flat(),
  metro('OTHER'),
  ...Object.values(FAST_TRAINS).flat(),
  train('OTHER'),
  bus,
  boat,
  drive,
  plane,
]

const rail = (
  country: Country,
  prefix: string,
  rows: [code: string, color: string, label: string, labelTh?: string][],
): LinePreset[] =>
  rows.map(([code, color, label, labelTh]) => ({
    line: prefix ? `${prefix}-${code}` : code,
    badge: code,
    color,
    label,
    ...(labelTh && { labelTh }),
    mode: 'metro' as const,
    country,
  }))

export interface LineGroup {
  /** Message key under "lines.groups". */
  key: string
  /** City centre, to rank station search results near it. */
  center: { lat: number; lng: number }
  lines: LinePreset[]
}

/** City rail networks in their official colours, by country. */
export const RAIL_GROUPS: Record<Country, LineGroup[]> = {
  TH: [
    {
      key: 'bangkok',
      center: { lat: 13.7466, lng: 100.5393 },
      lines: [
        ...rail('TH', 'BTS', [
          ['SUK', '#7fbf3a', 'BTS Sukhumvit', 'BTS สุขุมวิท'],
          ['SIL', '#00826a', 'BTS Silom', 'BTS สีลม'],
          ['GOLD', '#b8995a', 'BTS Gold', 'BTS สายสีทอง'],
        ]),
        ...rail('TH', 'MRT', [
          ['BL', '#1d4f9c', 'MRT Blue', 'MRT สายสีน้ำเงิน'],
          ['PP', '#6c2c8d', 'MRT Purple', 'MRT สายสีม่วง'],
          ['YL', '#f4c300', 'MRT Yellow', 'MRT สายสีเหลือง'],
          ['PK', '#e5007e', 'MRT Pink', 'MRT สายสีชมพู'],
        ]),
        ...rail('TH', 'TH', [
          ['ARL', '#a51f36', 'Airport Rail Link', 'แอร์พอร์ต เรล ลิงก์'],
          ['RED', '#b5121b', 'SRT Dark Red', 'รถไฟสายสีแดงเข้ม'],
          ['LRED', '#e57373', 'SRT Light Red', 'รถไฟสายสีแดงอ่อน'],
        ]),
      ],
    },
  ],
  KR: [
    {
      key: 'seoul',
      center: { lat: 37.5665, lng: 126.978 },
      // Saved before countries existed, so these keep their short line ids.
      lines: [
        ...(
          [
            ['1', '#0052a4'],
            ['2', '#00a84d'],
            ['3', '#ef7c1c'],
            ['4', '#00a5de'],
            ['5', '#996cac'],
            ['6', '#cd7c2f'],
            ['7', '#747f00'],
            ['8', '#e6186c'],
            ['9', '#bdb092'],
          ] as const
        ).map(([n, color]) => ({
          line: n,
          badge: n,
          color,
          label: `Line ${n}`,
          labelTh: `สาย ${n}`,
          mode: 'metro' as const,
          country: 'KR' as const,
        })),
        ...rail('KR', '', [
          ['AREX', '#0090d2', 'AREX'],
          ['S', '#d4003b', 'Shinbundang'],
          ['K', '#77c4a3', 'Gyeongui–Jungang'],
        ]),
      ],
    },
  ],
  JP: [
    {
      key: 'tokyo',
      center: { lat: 35.6812, lng: 139.7671 },
      lines: [
        ...rail('JP', 'TYO', [
          ['G', '#ff9500', 'Ginza'],
          ['M', '#f62e36', 'Marunouchi'],
          ['H', '#b5b5ac', 'Hibiya'],
          ['T', '#009bbf', 'Tozai'],
          ['C', '#00bb85', 'Chiyoda'],
          ['Y', '#c1a470', 'Yurakucho'],
          ['Z', '#8f76d6', 'Hanzomon'],
          ['N', '#00ac9b', 'Namboku'],
          ['F', '#9c5e31', 'Fukutoshin'],
          ['A', '#e85298', 'Toei Asakusa'],
          ['I', '#0079c2', 'Toei Mita'],
          ['S', '#6cbb5a', 'Toei Shinjuku'],
          ['E', '#b6007a', 'Toei Oedo'],
        ]),
        ...rail('JP', 'JR', [['JY', '#80c241', 'JR Yamanote']]),
      ],
    },
    {
      key: 'osaka',
      center: { lat: 34.6937, lng: 135.5023 },
      lines: rail('JP', 'OSA', [
        ['M', '#e5171f', 'Midosuji'],
        ['T', '#522886', 'Tanimachi'],
        ['Y', '#0078ba', 'Yotsubashi'],
        ['C', '#019a66', 'Chuo'],
        ['S', '#e44d93', 'Sennichimae'],
        ['K', '#814721', 'Sakaisuji'],
        ['N', '#a9cc51', 'Nagahori Tsurumi-ryokuchi'],
      ]),
    },
  ],
  TW: [
    {
      key: 'taipei',
      center: { lat: 25.0478, lng: 121.517 },
      lines: [
        ...rail('TW', 'TPE', [
          ['BR', '#c48c31', 'Wenhu'],
          ['R', '#e3002c', 'Tamsui–Xinyi'],
          ['G', '#008659', 'Songshan–Xindian'],
          ['O', '#f8b61c', 'Zhonghe–Xinlu'],
          ['BL', '#0070bd', 'Bannan'],
          ['Y', '#ffdb00', 'Circular'],
        ]),
        ...rail('TW', 'TYN', [['A', '#8246af', 'Taoyuan Airport MRT']]),
      ],
    },
  ],
  OTHER: [],
}

const RAIL_LINES = Object.values(RAIL_GROUPS).flatMap((groups) => groups.flatMap((g) => g.lines))

/** True for a saved city rail line (BTS, Seoul line 2, Ginza…), not a travel mode. */
export function isRailLine(line: string | undefined): boolean {
  return RAIL_LINES.some((p) => p.line === line)
}

/**
 * What the start and end of a ride are, so the boxes suggest the right things:
 * a rail line's own stations, every station of the city's network (city rail
 * before a line is picked), railway stations, airports, or any place.
 */
export type EndpointKind = 'line' | 'city' | 'station' | 'airport' | 'place'
const STATION_MODES = new Set(['TRAIN', 'SHINKANSEN', 'THSR'])
export function endpointKind(line: string | undefined): EndpointKind | null {
  if (!line?.trim()) return null
  if (isRailLine(line)) return 'line'
  if (line === 'METRO') return 'city'
  if (STATION_MODES.has(line)) return 'station'
  if (line === 'FLY') return 'airport'
  return 'place'
}

/** The rail lines of a country's cities, with their badges (for the city-wide station list). */
export function countryLines(country: Country): { line: string; badge: string }[] {
  return RAIL_GROUPS[country].flatMap((g) =>
    g.lines.map((p) => ({ line: p.line, badge: p.badge ?? p.line })),
  )
}

/** Where to look for stations: the line's city, else the country's first city. */
export function stationArea(
  line: string | undefined,
  country: Country,
): { lat: number; lng: number } | undefined {
  const groups = RAIL_GROUPS[country]
  return (groups.find((g) => g.lines.some((p) => p.line === line)) ?? groups[0])?.center
}

/** The short badge text for a saved line ("BTS-SUK" → "SUK"). */
export function lineBadge(line: string): string {
  return RAIL_LINES.find((p) => p.line === line)?.badge ?? line
}

const ALL_PRESETS: LinePreset[] = [...MODE_PRESETS, ...RAIL_LINES]

export function findPreset(line: string | undefined, color: string | undefined) {
  return ALL_PRESETS.find(
    (p) => p.line === line && p.color.toLowerCase() === (color ?? '').toLowerCase(),
  )
}

/** The preset for a saved line id, whatever its colour ("MRT-PP" → MRT Purple). */
export function presetOf(line: string | undefined): LinePreset | undefined {
  return ALL_PRESETS.find((p) => p.line === line)
}

/** The country a saved line belongs to, if it is a country-only app or rail line. */
export function countryOfLine(line: string | undefined): Country | undefined {
  return ALL_PRESETS.find((p) => p.line === line)?.country
}

/** The country a saved transport expense kind belongs to (e.g. "grab" → TH). */
export function countryOfMode(mode: string | null | undefined): Country | undefined {
  return MODE_PRESETS.find((p) => p.mode === mode)?.country
}

/** The emoji for a travel mode line ("GRAB" → 🟢), if it is one. */
export function modeEmoji(line: string | undefined): string | undefined {
  return MODE_PRESETS.find((p) => p.line === line)?.emoji
}

/** Transport kind for an item's line, e.g. to prefill a transport expense. */
export function modeOfLine(line: string | undefined): TransportMode | undefined {
  return ALL_PRESETS.find((p) => p.line === line)?.mode
}
