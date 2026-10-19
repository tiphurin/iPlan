// Builds apps/web/lib/stations.json: the stations of each rail line in iPlan's
// line picker, in running order, from OpenStreetMap public-transport routes.
// Data © OpenStreetMap contributors (ODbL). Run: node scripts/fetch-stations.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/** Our line id → OSM route relation ids (main route first, then branches). */
const LINES = {
  'BTS-SUK': [444651],
  'BTS-SIL': [2067854, 7989385],
  'BTS-GOLD': [11681439],
  'MRT-BL': [444659],
  'MRT-PP': [7725057],
  'MRT-YL': [15806897, 15806898],
  'MRT-PK': [16740886],
  'TH-ARL': [2148241],
  'TH-RED': [13058384, 13058390],
  'TH-LRED': [13178788, 14071495],
  1: [10700979, 15055927],
  2: [2404374, 4729406, 4729408],
  3: [443803],
  4: [4744311, 16665966],
  5: [12497486, 4744338],
  6: [7919153, 11509732, 4727111, 12080315],
  7: [12746494],
  8: [17953733, 7919018, 17953804, 2718901],
  9: [2718888],
  AREX: [7919000],
  S: [6060963],
  K: [5993211, 8667956],
  'TYO-G': [443281],
  'TYO-M': [443282, 8015930],
  'TYO-H': [443272],
  'TYO-T': [5371620],
  'TYO-C': [443284, 8026050],
  'TYO-Y': [443269],
  'TYO-Z': [443279],
  'TYO-N': [7730199],
  'TYO-F': [5375678],
  'TYO-A': [3302734],
  'TYO-I': [443286],
  'TYO-S': [443259],
  'TYO-E': [3355612, 8019883],
  'JR-JY': [1972920],
  'OSA-M': [2411153],
  'OSA-T': [444907],
  'OSA-Y': [444899],
  'OSA-C': [444881],
  'OSA-S': [444891],
  'OSA-K': [444905],
  'OSA-N': [444878],
  'TPE-BR': [447449],
  'TPE-R': [5378981, 5633242, 9439377, 3343808, 2665129],
  'TPE-G': [447471, 9437777, 4250356, 4250357, 4250381],
  'TPE-O': [4250352, 4250353],
  'TPE-BL': [199038],
  'TPE-Y': [3322093],
  'TYN-A': [2108764],
}

/** Thai lines also keep their Thai names; other lines show English (or the local name). */
const THAI = (line) => /^(BTS|MRT|TH)-/.test(line)

/**
 * Where the OSM route is incomplete, the official station list fills the gap
 * (checked against the operators' maps). Each fix gets the imported list.
 */
const st = (en, th) => ({ en, local: th, th })
const FIXES = {
  // OSM's Silom route lacks the three stations north of Ratchadamri's end and Bang Wa.
  'BTS-SIL': () => [
    st('National Stadium', 'สนามกีฬาแห่งชาติ'),
    st('Siam', 'สยาม'),
    st('Ratchadamri', 'ราชดำริ'),
    st('Sala Daeng', 'ศาลาแดง'),
    st('Chong Nonsi', 'ช่องนนทรี'),
    st('Saint Louis', 'เซนต์หลุยส์'),
    st('Surasak', 'สุรศักดิ์'),
    st('Saphan Taksin', 'สะพานตากสิน'),
    st('Krung Thon Buri', 'กรุงธนบุรี'),
    st('Wongwian Yai', 'วงเวียนใหญ่'),
    st('Pho Nimit', 'โพธิ์นิมิตร'),
    st('Talat Phlu', 'ตลาดพลู'),
    st('Wutthakat', 'วุฒากาศ'),
    st('Bang Wa', 'บางหว้า'),
  ],
  // Missing Hua Mak, Suan Luang Rama IX and Si Udom.
  'MRT-YL': (list) =>
    insertAfter(insertAfter(list, 'Si Kritha', [st('Hua Mak', 'หัวหมาก')]), 'Srinagarindra 38', [
      st('Suan Luang Rama IX', 'สวนหลวง ร.9'),
      st('Si Udom', 'ศรีอุดม'),
    ]),
  // The Kita-Ayase branch is outside the downloaded area.
  'TYO-C': (list) => insertAfter(list, 'Ayase', [{ en: 'Kita-Ayase', local: '北綾瀬' }]),
}

function insertAfter(list, en, add) {
  const i = list.findIndex((s) => s.en === en)
  if (i === -1) throw new Error(`insertAfter: no station ${en}`)
  return [...list.slice(0, i + 1), ...add, ...list.slice(i + 1)]
}

/** City areas, to look up English names of stations whose stop has only a local name. */
const AREAS = [
  '13.55,100.3,14.1,100.95',
  '37.2,126.4,37.95,127.3',
  '35.5,139.5,35.85,139.95',
  '34.55,135.4,34.8,135.6',
  '24.9,121.2,25.2,121.7',
]

const ids = [...new Set(Object.values(LINES).flat())]
const query = `[out:json][timeout:180];relation(id:${ids.join(',')});out body;node(r);out tags;way(r);out tags;(${AREAS.map((a) => `node["railway"="station"]["name"](${a});`).join('')});out tags;`

async function overpass() {
  for (let wait = 15; ; wait *= 2) {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'iPlan-station-import/1.0 (personal trip planner)',
      },
      body: new URLSearchParams({ data: query }),
    })
    const text = await res.text()
    if (res.ok && text.startsWith('{')) return JSON.parse(text)
    if (wait > 480) throw new Error(`Overpass failed: ${res.status} ${text.slice(0, 200)}`)
    console.warn(`Overpass busy (${res.status}), retrying in ${wait}s`)
    await new Promise((r) => setTimeout(r, wait * 1000))
  }
}

/** "Siam (BTS)" / "สถานีสยาม" / "Platform 2" → a clean station name. */
const clean = (name) =>
  name
    ?.replace(/\s*\((BTS|MRT|ARL|SRT)[^)]*\)\s*$/i, '')
    .replace(/^สถานี\s*/, '')
    .replace(/\s+(station|stn\.?)$/i, '')
    .replace(/\s*[;,].*$/, '')
    .trim() || undefined

// STATIONS_CACHE=<file> reuses one download while tuning the line list.
const cache = process.env.STATIONS_CACHE
const data = cache && existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : await overpass()
if (cache && !existsSync(cache)) writeFileSync(cache, JSON.stringify(data))
const byKey = new Map(data.elements.map((e) => [`${e.type}/${e.id}`, e]))
// Local name → English name, from station nodes that have both.
const english = new Map()
for (const e of data.elements) {
  const t = e.tags ?? {}
  if (t.railway === 'station' && t.name && t['name:en'])
    english.set(clean(t.name), clean(t['name:en']))
}
const out = {}
for (const [line, relIds] of Object.entries(LINES)) {
  const stations = []
  const seen = new Set()
  for (const id of relIds) {
    const rel = byKey.get(`relation/${id}`)
    if (!rel) throw new Error(`Missing relation ${id} for ${line}`)
    // Mappers tag the stop positions, the platforms, or only the stations (often without a
    // role) with names; use whichever of those lists is longest.
    const isStation = (t) =>
      ['stop_position', 'platform', 'station'].includes(t?.public_transport) ||
      ['station', 'stop', 'halt', 'platform'].includes(t?.railway)
    const named = (test) =>
      rel.members.filter((m) => {
        const t = byKey.get(`${m.type}/${m.ref}`)?.tags
        return t?.name && test(m.role, t)
      })
    const lists = [
      named((role) => /^stop/.test(role)),
      named((role) => /^platform/.test(role)),
      named((role, t) => role === '' && isStation(t)),
    ]
    const members = lists.reduce((a, b) => (b.length > a.length ? b : a))
    for (const m of members) {
      const t = byKey.get(`${m.type}/${m.ref}`)?.tags ?? {}
      const local = clean(t.name)
      if (!local) continue
      const en = clean(t['name:en']) ?? english.get(local) ?? local
      const key = en.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const th = THAI(line) ? clean(t['name:th']) : undefined
      stations.push({ en, local, ...(th && { th }) })
    }
  }
  const fixed = FIXES[line] ? FIXES[line](stations) : stations
  if (fixed.length < 3) throw new Error(`${line}: only ${fixed.length} stations`)
  out[line] = fixed
  const untranslated = fixed.filter((s) => !/[A-Za-z]/.test(s.en)).length
  if (untranslated) console.warn(`   ${line}: ${untranslated} without an English name`)
  console.log(
    `${line.padEnd(9)} ${String(fixed.length).padStart(3)}  ${fixed[0].en} … ${fixed.at(-1).en}`,
  )
}
const file = new URL('../apps/web/lib/stations.json', import.meta.url)
writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`)
console.log(`Wrote ${Object.keys(out).length} lines to apps/web/lib/stations.json`)
