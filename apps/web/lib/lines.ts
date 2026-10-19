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

const walk: LinePreset = { line: 'W', color: '#9aa3ae', label: 'walk', emoji: '🚶', mode: 'walk' }
const taxi: LinePreset = {
  line: 'TAXI',
  color: '#e0a100',
  label: 'taxi',
  emoji: '🚕',
  mode: 'taxi',
}
const drive: LinePreset = {
  line: 'car',
  color: '#4a5563',
  label: 'drive',
  emoji: '🚗',
  mode: 'drive',
}
const train: LinePreset = {
  line: 'TRAIN',
  color: '#1f2a37',
  label: 'train',
  emoji: '🚆',
  mode: 'train',
}
const bus: LinePreset = { line: 'BUS', color: '#0068b7', label: 'bus', emoji: '🚌', mode: 'bus' }
const boat: LinePreset = {
  line: 'BOAT',
  color: '#0e7490',
  label: 'boat',
  emoji: '⛴️',
  mode: 'boat',
}
const plane: LinePreset = {
  line: 'FLY',
  color: '#6366f1',
  label: 'plane',
  emoji: '✈️',
  mode: 'plane',
}

/** Ride apps and long-distance trains that belong to one country. */
const LOCAL_MODES: Record<Country, LinePreset[]> = {
  TH: [
    { line: 'GRAB', color: '#00b14f', label: 'grab', emoji: '🟢', mode: 'grab', country: 'TH' },
    { line: 'BOLT', color: '#2a9d5c', label: 'bolt', emoji: '⚡', mode: 'bolt', country: 'TH' },
    {
      line: 'LINEMAN',
      color: '#06c755',
      label: 'lineman',
      emoji: '🛵',
      mode: 'lineman',
      country: 'TH',
    },
  ],
  KR: [
    {
      line: 'KAKAOT',
      color: '#f7c600',
      label: 'kakao_t',
      emoji: '🟡',
      mode: 'kakao_t',
      country: 'KR',
    },
  ],
  JP: [
    { line: 'GO', color: '#111827', label: 'go', emoji: '🚖', mode: 'go', country: 'JP' },
    {
      line: 'SHINKANSEN',
      color: '#1d4ed8',
      label: 'shinkansen',
      emoji: '🚄',
      mode: 'shinkansen',
      country: 'JP',
    },
  ],
  TW: [
    { line: 'UBER', color: '#000000', label: 'uber', emoji: '⚫', mode: 'uber', country: 'TW' },
    { line: 'THSR', color: '#f26522', label: 'thsr', emoji: '🚄', mode: 'thsr', country: 'TW' },
  ],
  OTHER: [],
}

/** Ways of getting around in a country: the basics plus its own ride apps and trains. */
export function modesFor(country: Country): LinePreset[] {
  return [walk, taxi, ...LOCAL_MODES[country], drive, bus, train, boat, plane]
}

/** Every mode preset, from every country (for reading items saved earlier). */
export const MODE_PRESETS: LinePreset[] = [
  walk,
  taxi,
  ...Object.values(LOCAL_MODES).flat(),
  drive,
  bus,
  train,
  boat,
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
    mode: 'train' as const,
    country,
  }))

export interface LineGroup {
  /** Message key under "lines.groups". */
  key: string
  lines: LinePreset[]
}

/** City rail networks in their official colours, by country. */
export const RAIL_GROUPS: Record<Country, LineGroup[]> = {
  TH: [
    {
      key: 'bangkok',
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
          mode: 'train' as const,
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

const ALL_PRESETS: LinePreset[] = [
  ...MODE_PRESETS,
  ...Object.values(RAIL_GROUPS).flatMap((groups) => groups.flatMap((g) => g.lines)),
]

export function findPreset(line: string | undefined, color: string | undefined) {
  return ALL_PRESETS.find(
    (p) => p.line === line && p.color.toLowerCase() === (color ?? '').toLowerCase(),
  )
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
