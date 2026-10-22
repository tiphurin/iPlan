// Trips API end to end: trips, items, checklist, members, expenses, money settings,
// pool, calendar, backup, places and cover photos. Run: node scripts/e2e/api-trips.mjs

import { USERS, anonymous, login, requireServer, runSuite, sum, tinyPng, uid } from './lib.mjs'

const START = '2031-03-10'
const END = '2031-03-14'
const at = (day, time, offset = '+09:00') => `${day}T${time}:00${offset}`

await requireServer()

await runSuite('api-trips', async ({ check, status, error, section, cleanup }) => {
  const owner = await login(USERS.owner.email)
  const friend = await login(USERS.friend.email)
  const OWNER = USERS.owner.id
  const FRIEND = USERS.friend.id

  /** Creates a trip and registers it for cleanup. */
  async function newTrip(fields = {}) {
    const res = await owner('POST', '/trips', {
      name: uid('trip'),
      startDate: START,
      endDate: END,
      homeTimeZone: 'Asia/Bangkok',
      baseCurrency: 'THB',
      ...fields,
    })
    if (res.status === 201) cleanup.trip(owner, res.json.id)
    return res
  }

  /** Adds the friend to a trip through a join link with the given role. */
  async function addFriend(tripId, role) {
    const invite = await owner('POST', `/trips/${tripId}/invites`, { role })
    const joined = await friend('POST', `/join/${invite.json?.token}`)
    return { invite, joined }
  }

  // ───────────────────────── Trip create / update
  section('Trip create validation')
  const bad = [
    ['end before start', { startDate: START, endDate: '2031-03-09' }],
    ['longer than 60 days', { startDate: START, endDate: '2031-05-20' }],
    ['impossible date', { startDate: '2031-02-30' }],
    ['lower-case currency', { baseCurrency: 'thb' }],
    ['4-letter currency', { baseCurrency: 'BAHT' }],
    ['blank name', { name: '   ' }],
    ['unknown time zone', { homeTimeZone: 'Mars/Olympus' }],
    ['bad colour', { color: 'red' }],
  ]
  for (const [label, fields] of bad) {
    const res = await newTrip(fields)
    error(`create trip rejects ${label}`, res, 422, 'VALIDATION_FAILED')
  }

  const created = await newTrip({ name: `   ${uid('main')}`, color: '#ABCDEF' })
  status('create trip', created, 201)
  const trip = created.json
  const T = trip?.id
  check('leading spaces trimmed from name', trip?.name === uid('main'), created)
  check('colour stored lower-case', trip?.color === '#abcdef', created)
  check('creator is owner', trip?.role === 'owner' && trip?.memberCount === 1, created)

  const renamed = await owner('PATCH', `/trips/${T}`, { name: `${uid('main')} renamed` })
  status('rename trip', renamed, 200)
  check(
    'rename keeps currency and home zone',
    renamed.json?.baseCurrency === 'THB' && renamed.json?.homeTimeZone === 'Asia/Bangkok',
    renamed,
  )
  error(
    'update with end before start',
    await owner('PATCH', `/trips/${T}`, { endDate: '2031-03-01' }),
    422,
    'VALIDATION_FAILED',
  )

  // A trip without expenses may still change currency (and its saved rates reset).
  const scratch = await newTrip({ name: uid('currency') })
  const S = scratch.json?.id
  await owner('PATCH', `/trips/${S}/money`, { fxRates: { KRW: '0.0255' } })
  const switched = await owner('PATCH', `/trips/${S}`, { baseCurrency: 'USD' })
  check(
    'currency change allowed before expenses; saved rates reset',
    switched.status === 200 &&
      switched.json?.baseCurrency === 'USD' &&
      Object.keys(switched.json?.fxRates ?? {}).length === 0,
    switched,
  )

  // ───────────────────────── Items
  section('Items')
  const place = await owner('POST', `/trips/${T}/items`, {
    dayDate: '2031-03-11',
    kind: 'place',
    title: '  Gyeongbokgung',
    startsAt: at('2031-03-11', '09:00'),
    endsAt: at('2031-03-11', '11:00'),
    timeZone: 'Asia/Seoul',
    details: { url: 'https://example.com/palace', address: 'Seoul' },
  })
  status('create place item', place, 201)
  check('item title trimmed', place.json?.title === 'Gyeongbokgung', place)

  const move = await owner('POST', `/trips/${T}/items`, {
    dayDate: '2031-03-11',
    kind: 'move',
    title: 'Metro to Myeongdong',
    startsAt: at('2031-03-11', '11:15'),
    endsAt: at('2031-03-11', '11:45'),
    timeZone: 'Asia/Seoul',
    details: {
      line: 'Line 3',
      via: ['Line 4'],
      from: 'Gyeongbokgung',
      to: 'Myeongdong',
      arrivalTimeZone: 'Asia/Tokyo',
    },
  })
  status('create move item with from/to/via', move, 201)
  check(
    'move keeps from, to and via lines',
    move.json?.details?.from === 'Gyeongbokgung' &&
      move.json?.details?.to === 'Myeongdong' &&
      JSON.stringify(move.json?.details?.via) === '["Line 4"]',
    move,
  )
  check(
    'arrival zone dropped on a non-flight',
    move.json && !('arrivalTimeZone' in move.json.details),
    move,
  )

  const flight = await owner('POST', `/trips/${T}/items`, {
    dayDate: '2031-03-14',
    kind: 'flight',
    title: 'ICN → BKK',
    startsAt: at('2031-03-14', '18:00'),
    endsAt: at('2031-03-14', '22:00', '+07:00'),
    timeZone: 'Asia/Seoul',
    details: { flightNumber: 'XX123', from: 'ICN', to: 'BKK', arrivalTimeZone: 'Asia/Bangkok' },
  })
  status('create flight item', flight, 201)
  check(
    'flight keeps its arrival zone',
    flight.json?.details?.arrivalTimeZone === 'Asia/Bangkok',
    flight,
  )

  const itemBase = {
    dayDate: '2031-03-12',
    kind: 'place',
    title: 'Bad',
    startsAt: at('2031-03-12', '10:00'),
    timeZone: 'Asia/Seoul',
  }
  const itemBad = [
    ['end before start', { endsAt: at('2031-03-12', '09:00') }],
    ['end equal to start', { endsAt: at('2031-03-12', '10:00') }],
    ['day before the trip', { dayDate: '2031-03-09' }],
    ['day after the trip', { dayDate: '2031-03-15' }],
    ['unknown zone', { timeZone: 'Asia/Atlantis' }],
    ['unknown arrival zone', { kind: 'flight', details: { arrivalTimeZone: 'Nope/Nope' } }],
    ['javascript: url', { details: { url: 'javascript:alert(1)' } }],
    ['data: url', { details: { url: 'data:text/html,hi' } }],
    ['blank via line', { kind: 'move', details: { via: ['  '] } }],
    ['blank title', { title: '   ' }],
    ['unknown kind', { kind: 'teleport' }],
  ]
  for (const [label, fields] of itemBad) {
    error(
      `item rejects ${label}`,
      await owner('POST', `/trips/${T}/items`, { ...itemBase, ...fields }),
      422,
      'VALIDATION_FAILED',
    )
  }

  const patched = await owner('PATCH', `/items/${place.json?.id}`, {
    endsAt: at('2031-03-11', '12:00'),
  })
  check(
    'patch item end time',
    patched.status === 200 &&
      Date.parse(patched.json?.endsAt) === Date.parse(at('2031-03-11', '12:00')),
    patched,
  )
  error(
    'patch item end before its start',
    await owner('PATCH', `/items/${place.json?.id}`, { endsAt: at('2031-03-11', '08:00') }),
    422,
    'VALIDATION_FAILED',
  )

  const dup = await owner('POST', `/items/${place.json?.id}/duplicate`)
  status('duplicate item', dup, 201)
  check(
    'duplicate is a new item with the same title and day',
    dup.json?.id !== place.json?.id &&
      dup.json?.title === place.json?.title &&
      dup.json?.dayDate === place.json?.dayDate,
    dup,
  )
  status('delete duplicated item', await owner('DELETE', `/items/${dup.json?.id}`), 204)
  const items = await owner('GET', `/trips/${T}/items`)
  check('items list has the three items', items.status === 200 && items.json?.length === 3, items)
  error('deleted item is gone', await owner('DELETE', `/items/${dup.json?.id}`), 404, 'NOT_FOUND')

  error(
    'shrinking dates that would hide items',
    await owner('PATCH', `/trips/${T}`, { endDate: '2031-03-13' }),
    409,
    'TRIP_DATES_EXCLUDE_CONTENT',
  )
  error(
    'moving the start past the first item',
    await owner('PATCH', `/trips/${T}`, { startDate: '2031-03-12' }),
    409,
    'TRIP_DATES_EXCLUDE_CONTENT',
  )
  status(
    'shrinking dates that keep every item',
    await owner('PATCH', `/trips/${T}`, { startDate: '2031-03-11' }),
    200,
  )
  await owner('PATCH', `/trips/${T}`, { startDate: START })

  // ───────────────────────── Checklist
  section('Checklist')
  const cl = await owner('POST', `/trips/${T}/checklist`, {
    groupKey: 'documents',
    title: '  Passport',
  })
  status('create checklist item', cl, 201)
  check('checklist title trimmed', cl.json?.title === 'Passport', cl)
  error(
    'checklist rejects upper-case group',
    await owner('POST', `/trips/${T}/checklist`, { groupKey: 'Docs', title: 'x' }),
    422,
    'VALIDATION_FAILED',
  )
  error(
    'checklist rejects blank title',
    await owner('POST', `/trips/${T}/checklist`, { groupKey: 'packing', title: '  ' }),
    422,
    'VALIDATION_FAILED',
  )
  const clEdit = await owner('PATCH', `/checklist/${cl.json?.id}`, { title: 'Passport + copy' })
  check(
    'edit checklist item',
    clEdit.status === 200 && clEdit.json?.title === 'Passport + copy',
    clEdit,
  )
  const ticked = await owner('POST', `/checklist/${cl.json?.id}/tick`)
  check(
    'tick checklist item',
    ticked.status === 200 && ticked.json?.ticks?.some((t) => t.userId === OWNER),
    ticked,
  )
  const unticked = await owner('DELETE', `/checklist/${cl.json?.id}/tick`)
  check(
    'untick checklist item',
    unticked.status === 200 && unticked.json?.ticks?.length === 0,
    unticked,
  )
  const cl2 = await owner('POST', `/trips/${T}/checklist`, {
    groupKey: 'packing',
    title: 'Charger',
  })
  status('delete checklist item', await owner('DELETE', `/checklist/${cl2.json?.id}`), 204)
  const clList = await owner('GET', `/trips/${T}/checklist`)
  check('checklist lists what is left', clList.status === 200 && clList.json?.length === 1, clList)

  // ───────────────────────── Members and invites
  section('Members and invites')
  error('outsider cannot see the trip', await friend('GET', `/trips/${T}`), 404, 'NOT_FOUND')
  const viewerJoin = await addFriend(T, 'viewer')
  status('create viewer join link', viewerJoin.invite, 201)
  check(
    'friend joins as viewer',
    viewerJoin.joined.status === 200 && viewerJoin.joined.json?.role === 'viewer',
    viewerJoin.joined,
  )
  const asViewer = await friend('GET', `/trips/${T}`)
  check(
    'viewer sees the trip',
    asViewer.status === 200 && asViewer.json?.role === 'viewer',
    asViewer,
  )
  error(
    'viewer cannot rename',
    await friend('PATCH', `/trips/${T}`, { name: 'hijack' }),
    403,
    'FORBIDDEN',
  )
  error(
    'viewer cannot add items',
    await friend('POST', `/trips/${T}/items`, { ...itemBase, title: 'Nope' }),
    403,
    'FORBIDDEN',
  )
  error(
    'viewer cannot edit checklist',
    await friend('POST', `/trips/${T}/checklist`, { groupKey: 'packing', title: 'Nope' }),
    403,
    'FORBIDDEN',
  )
  error('viewer cannot delete the trip', await friend('DELETE', `/trips/${T}`), 403, 'FORBIDDEN')
  const promoted = await owner('PATCH', `/trips/${T}/members/${FRIEND}`, { role: 'editor' })
  status('owner promotes viewer to editor', promoted, 204)
  const editorItem = await friend('POST', `/trips/${T}/items`, {
    ...itemBase,
    title: 'Friend idea',
  })
  status('editor can add items', editorItem, 201)
  if (editorItem.json?.id) await owner('DELETE', `/items/${editorItem.json.id}`)
  error(
    'editor still cannot delete the trip',
    await friend('DELETE', `/trips/${T}`),
    403,
    'FORBIDDEN',
  )
  status('owner removes member', await owner('DELETE', `/trips/${T}/members/${FRIEND}`), 204)
  error('removed member loses access', await friend('GET', `/trips/${T}`), 404, 'NOT_FOUND')
  error(
    'removed member cannot list items',
    await friend('GET', `/trips/${T}/items`),
    404,
    'NOT_FOUND',
  )
  const links = await owner('GET', `/trips/${T}/invites`)
  for (const link of links.json ?? []) await owner('DELETE', `/invites/${link.id}`)
  const revokedToken = viewerJoin.invite.json?.token
  check(
    'revoked join link no longer works',
    (await friend('POST', `/join/${revokedToken}`)).status === 410,
    await friend('GET', `/join/${revokedToken}`),
  )
  const editorJoin = await addFriend(T, 'editor')
  check(
    'friend re-joins as editor via a new link',
    editorJoin.joined.status === 200 && editorJoin.joined.json?.role === 'editor',
    editorJoin.joined,
  )

  // ───────────────────────── Expenses
  section('Expenses')
  const expense = (fields) => ({
    dayDate: '2031-03-11',
    title: uid('exp'),
    category: 'food',
    amount: '1000',
    currency: 'THB',
    paidBy: OWNER,
    split: { mode: 'equal', participants: [OWNER, FRIEND] },
    ...fields,
  })
  const shareOf = (res, userId) => res.json?.shares?.find((s) => s.userId === userId)?.amountMinor

  const e1 = await owner('POST', `/trips/${T}/expenses`, expense({}))
  status('equal split expense', e1, 201)
  check(
    'equal split halves 1000 THB',
    shareOf(e1, OWNER) === '50000' && shareOf(e1, FRIEND) === '50000',
    e1,
  )
  const e2 = await owner(
    'POST',
    `/trips/${T}/expenses`,
    expense({
      paidBy: FRIEND,
      split: { mode: 'exact', shares: { [OWNER]: '300', [FRIEND]: '700' } },
    }),
  )
  check(
    'exact split keeps the amounts',
    e2.status === 201 && shareOf(e2, OWNER) === '30000' && shareOf(e2, FRIEND) === '70000',
    e2,
  )
  const e3 = await owner(
    'POST',
    `/trips/${T}/expenses`,
    expense({ split: { mode: 'percent', shares: { [OWNER]: 60, [FRIEND]: 40 } } }),
  )
  check(
    'percent split 60/40',
    e3.status === 201 && shareOf(e3, OWNER) === '60000' && shareOf(e3, FRIEND) === '40000',
    e3,
  )
  const e4 = await owner(
    'POST',
    `/trips/${T}/expenses`,
    expense({ amount: '200', split: { mode: 'equal', participants: [OWNER] } }),
  )
  check(
    'no-split is an equal split with only the payer',
    e4.status === 201 && e4.json?.shares?.length === 1 && shareOf(e4, OWNER) === '20000',
    e4,
  )
  const e5 = await owner('POST', `/trips/${T}/expenses`, expense({ amount: '100.01' }))
  check(
    'odd satang split sums to the total',
    e5.status === 201 &&
      sum(e5.json.shares.map((s) => s.amountMinor)) === 10001n &&
      e5.json.shares.every((s) => s.amountMinor === '5000' || s.amountMinor === '5001'),
    e5,
  )

  const badExpenses = [
    [
      'mismatched exact shares',
      { split: { mode: 'exact', shares: { [OWNER]: '300', [FRIEND]: '600' } } },
    ],
    [
      'percent not adding to 100',
      { split: { mode: 'percent', shares: { [OWNER]: 60, [FRIEND]: 30 } } },
    ],
    ['negative amount', { amount: '-5' }],
    ['zero amount', { amount: '0' }],
    ['huge amount', { amount: '1234567890123' }],
    [
      'outsider in the split',
      { split: { mode: 'equal', participants: [OWNER, USERS.waiting.id] } },
    ],
    ['outsider as payer', { paidBy: USERS.waiting.id }],
    ['currency without a saved rate', { currency: 'JPY' }],
    ['day outside the trip', { dayDate: '2031-03-20' }],
    ['blank title', { title: '  ' }],
  ]
  for (const [label, fields] of badExpenses) {
    error(
      `expense rejects ${label}`,
      await owner('POST', `/trips/${T}/expenses`, expense(fields)),
      422,
      'VALIDATION_FAILED',
    )
  }

  // Money settings: saved rate, daily budget, then rate removal.
  status(
    'save KRW rate and daily budget',
    await owner('PATCH', `/trips/${T}/money`, { fxRates: { KRW: '0.0255' }, dailyBudget: '3000' }),
    204,
  )
  const withRate = await owner('GET', `/trips/${T}`)
  check(
    'trip shows the saved rate and budget',
    withRate.json?.fxRates?.KRW === '0.0255' && withRate.json?.dailyBudgetMinor === '300000',
    withRate,
  )
  const krw = await owner(
    'POST',
    `/trips/${T}/expenses`,
    expense({ amount: '10000', currency: 'KRW', split: { mode: 'equal', participants: [OWNER] } }),
  )
  check(
    'KRW expense uses the saved rate (10,000 KRW = 255 THB)',
    krw.status === 201 && krw.json?.fxRate === '0.0255' && krw.json?.baseAmountMinor === '25500',
    krw,
  )
  error(
    'money settings reject a zero rate',
    await owner('PATCH', `/trips/${T}/money`, { fxRates: { KRW: '0' } }),
    422,
    'VALIDATION_FAILED',
  )
  status('remove saved rates', await owner('PATCH', `/trips/${T}/money`, { fxRates: {} }), 204)
  const noRate = await owner('GET', `/trips/${T}`)
  check('rate removed', Object.keys(noRate.json?.fxRates ?? { x: 1 }).length === 0, noRate)
  error(
    'KRW expense without a rate after removal',
    await owner('POST', `/trips/${T}/expenses`, expense({ currency: 'KRW', amount: '5000' })),
    422,
    'VALIDATION_FAILED',
  )
  const explicitRate = await owner(
    'POST',
    `/trips/${T}/expenses`,
    expense({
      amount: '10000',
      currency: 'KRW',
      fxRate: '0.025',
      split: { mode: 'equal', participants: [OWNER] },
    }),
  )
  check(
    'explicit rate still accepted',
    explicitRate.status === 201 && explicitRate.json?.baseAmountMinor === '25000',
    explicitRate,
  )
  const oldKrw = (await owner('GET', `/trips/${T}/expenses`)).json?.find(
    (e) => e.id === krw.json?.id,
  )
  check('older expense keeps the rate it was saved with', oldKrw?.fxRate === '0.0255', oldKrw)

  error(
    'currency locked once expenses exist',
    await owner('PATCH', `/trips/${T}`, { baseCurrency: 'USD' }),
    409,
    'TRIP_CURRENCY_LOCKED',
  )

  const edited = await owner(
    'PUT',
    `/expenses/${e4.json?.id}`,
    expense({ amount: '250', split: { mode: 'equal', participants: [OWNER] } }),
  )
  check(
    'edit expense amount',
    edited.status === 200 && edited.json?.amountMinor === '25000',
    edited,
  )
  const throwaway = await owner('POST', `/trips/${T}/expenses`, expense({ title: 'throwaway' }))
  status('delete expense', await owner('DELETE', `/expenses/${throwaway.json?.id}`), 204)

  // Summary numbers: owner paid e1 1000, e3 1000, e4 250, e5 100.01, KRW 255 + 250;
  // friend paid e2 1000.
  section('Summary and settle-up')
  const summary = await friend('GET', `/trips/${T}/expenses/summary`)
  status('summary', summary, 200)
  const e5Owner = BigInt(shareOf(e5, OWNER) ?? 0)
  const expectedTotal = 100000n + 100000n + 100000n + 25000n + 10001n + 25500n + 25000n
  check(
    'summary total is every expense in THB',
    summary.json?.totalMinor === String(expectedTotal),
    summary,
  )
  const party = (id) => summary.json?.parties?.find((p) => p.id === id)
  // Owner: +500 (e1) −300 (e2) +400 (e3) +0 (e4, KRW) + (10001 − own share of e5).
  const ownerNet = 50000n - 30000n + 40000n + (10001n - e5Owner)
  check('owner net', party(OWNER)?.netMinor === String(ownerNet), summary)
  check('friend net mirrors owner', party(FRIEND)?.netMinor === String(-ownerNet), summary)
  check(
    'nets add up to zero',
    sum(summary.json?.parties?.map((p) => p.netMinor) ?? ['1']) === 0n,
    summary,
  )
  const transfer = summary.json?.transfers?.[0]
  check(
    'one transfer friend → owner for the net',
    summary.json?.transfers?.length === 1 &&
      transfer?.from === FRIEND &&
      transfer?.to === OWNER &&
      transfer?.amountMinor === String(ownerNet),
    summary,
  )
  check(
    'by-day carries the daily budget',
    summary.json?.byDay?.some((d) => d.dayDate === '2031-03-11' && d.budgetMinor === '300000'),
    summary,
  )
  const csv = await owner('GET', `/trips/${T}/expenses.csv`)
  check(
    'expenses CSV downloads',
    csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type') ?? ''),
    csv,
  )
  check('CSV without a pool has no pool section', !csv.text.includes('Pool'), csv)

  // ───────────────────────── Calendar
  section('Calendar')
  const ics = await owner('GET', `/trips/${T}/calendar.ics`)
  check(
    'trip calendar is text/calendar',
    ics.status === 200 && (ics.headers.get('content-type') ?? '').startsWith('text/calendar'),
    ics,
  )
  check(
    'one VEVENT per item',
    (ics.text.match(/BEGIN:VEVENT/g) ?? []).length === 3 && ics.text.includes('END:VCALENDAR'),
    ics,
  )
  const one = await owner('GET', `/trips/${T}/items/${flight.json?.id}/event.ics`)
  check(
    'single item .ics',
    one.status === 200 && (one.text.match(/BEGIN:VEVENT/g) ?? []).length === 1,
    one,
  )
  const feed = await owner('GET', `/trips/${T}/calendar-feed`)
  check(
    'calendar feed links',
    feed.status === 200 &&
      /^webcal:/.test(feed.json?.webcalUrl ?? '') &&
      /\.ics$/.test(feed.json?.url ?? ''),
    feed,
  )
  const feedPath = feed.json ? new URL(feed.json.url).pathname : '/api/calendar/missing.ics'
  const feedRes = await fetch(`${new URL(feed.json?.url ?? 'http://localhost').origin}${feedPath}`)
  const feedText = await feedRes.text()
  check(
    'feed works without signing in and lists every item',
    feedRes.status === 200 &&
      (feedRes.headers.get('content-type') ?? '').startsWith('text/calendar') &&
      (feedText.match(/BEGIN:VEVENT/g) ?? []).length === 3,
    `GET ${feedPath} → ${feedRes.status} ${feedText.slice(0, 200)}`,
  )
  const rotated = await owner('POST', `/trips/${T}/calendar-feed/rotate`)
  check('rotate feed link', rotated.status === 200 && rotated.json?.url !== feed.json?.url, rotated)
  const oldFeed = await fetch(`${new URL(feed.json?.url ?? 'http://localhost').origin}${feedPath}`)
  check(
    'old feed link stops working',
    oldFeed.status === 404,
    `GET ${feedPath} → ${oldFeed.status}`,
  )

  // ───────────────────────── Backup
  section('Backup export / import')
  const backup = await owner('GET', `/trips/${T}/backup.json`)
  check(
    'export backup',
    backup.status === 200 && backup.json?.format === 'iplan.trip' && backup.json?.version === 1,
    backup,
  )
  check(
    'backup has items, checklist and expenses',
    backup.json?.items?.length === 3 &&
      backup.json?.checklist?.length === 1 &&
      backup.json?.expenses?.length >= 5,
    backup,
  )
  const imported = await owner('POST', '/trips/import', backup.json)
  status('import backup', imported, 201)
  if (imported.json?.tripId) cleanup.trip(owner, imported.json.tripId)
  const copyTrip = await owner('GET', `/trips/${imported.json?.tripId}`)
  const copyItems = await owner('GET', `/trips/${imported.json?.tripId}/items`)
  const copyChecklist = await owner('GET', `/trips/${imported.json?.tripId}/checklist`)
  check(
    'imported trip matches',
    copyTrip.json?.name === backup.json?.trip?.name &&
      copyTrip.json?.startDate === START &&
      copyTrip.json?.role === 'owner' &&
      copyTrip.json?.memberCount === 1,
    copyTrip,
  )
  check(
    'imported items round-trip (titles, kinds, details)',
    JSON.stringify(copyItems.json?.map((i) => [i.title, i.kind, i.details?.to ?? null]).sort()) ===
      JSON.stringify(items.json?.map((i) => [i.title, i.kind, i.details?.to ?? null]).sort()),
    copyItems,
  )
  check('imported checklist', copyChecklist.json?.length === 1, copyChecklist)
  const badImports = [
    ['not a trip file', { hello: 'world' }],
    ['wrong format', { ...backup.json, format: 'other' }],
    ['future version', { ...backup.json, version: 2 }],
    ['end before start', { ...backup.json, trip: { ...backup.json?.trip, endDate: '2031-03-01' } }],
    [
      'item outside the dates',
      { ...backup.json, items: [{ ...backup.json?.items?.[0], dayDate: '2031-04-01' }] },
    ],
    [
      'javascript: link in an item',
      {
        ...backup.json,
        items: [{ ...backup.json?.items?.[0], details: { url: 'javascript:alert(1)' } }],
      },
    ],
    ['unknown time zone', { ...backup.json, trip: { ...backup.json?.trip, homeTimeZone: 'X/Y' } }],
  ]
  for (const [label, body] of badImports) {
    const res = await owner('POST', '/trips/import', body)
    if (res.json?.tripId) cleanup.trip(owner, res.json.tripId)
    error(`import rejects ${label}`, res, 422, 'VALIDATION_FAILED')
  }
  const notJson = await owner('POST', '/trips/import', '{not json')
  // Known app bug (20 Oct 2026): a malformed JSON body reaches the error handler as a
  // plain SyntaxError and comes back as 500 INTERNAL instead of a 4xx validation error.
  const malformed = { bug: 'malformed JSON body answers 500 INTERNAL instead of 4xx' }
  check(
    'import rejects broken JSON (4xx)',
    notJson.status >= 400 && notJson.status < 500,
    notJson,
    malformed,
  )
  const notJsonTrip = await owner('POST', '/trips', '{not json')
  check(
    'create trip rejects broken JSON (4xx)',
    notJsonTrip.status >= 400 && notJsonTrip.status < 500,
    notJsonTrip,
    malformed,
  )

  // ───────────────────────── Places
  section('Places')
  for (const kind of ['station', 'airport']) {
    const res = await owner(
      'GET',
      `/places?q=${kind === 'station' ? 'Myeongdong' : 'Incheon'}&kind=${kind}`,
    )
    check(
      `places kind=${kind} returns an array`,
      res.status === 200 && Array.isArray(res.json),
      res,
    )
  }
  const plain = await owner('GET', '/places?q=Seoul%20Tower&lat=37.55&lng=126.98')
  check(
    'places near a point returns an array',
    plain.status === 200 && Array.isArray(plain.json),
    plain,
  )
  error('places query too short', await owner('GET', '/places?q=a'), 422, 'VALIDATION_FAILED')
  error(
    'places unknown kind',
    await owner('GET', '/places?q=Seoul&kind=port'),
    422,
    'VALIDATION_FAILED',
  )

  // ───────────────────────── Cover photo
  section('Cover photo')
  const png = await tinyPng()
  const form = (bytes, name, type) => {
    const f = new FormData()
    f.append('file', new Blob([bytes], { type }), name)
    return f
  }
  const cover = await owner('PUT', `/trips/${T}/cover`, form(png, 'cover.png', 'image/png'))
  check('upload PNG cover', cover.status === 200 && Boolean(cover.json?.coverUrl), cover)
  if (cover.json?.coverUrl) {
    const img = await owner('GET', cover.json.coverUrl)
    check(
      'cover served to members',
      (img.status === 200 && img.headers.get('content-type') === 'image/png') || img.status === 302,
      img,
    )
    const stranger = await login(USERS.friend.email)
    await owner('DELETE', `/trips/${T}/members/${FRIEND}`)
    error(
      'cover hidden from non-members',
      await stranger('GET', cover.json.coverUrl),
      404,
      'NOT_FOUND',
    )
    const back = await addFriend(T, 'editor')
    check('friend back in as editor', back.joined.status === 200, back.joined)
  }
  error(
    'cover rejects a text file posing as PNG',
    await owner(
      'PUT',
      `/trips/${T}/cover`,
      form(Buffer.from('hello, not an image'), 'x.png', 'image/png'),
    ),
    422,
    'VALIDATION_FAILED',
  )
  const uncover = await owner('DELETE', `/trips/${T}/cover`)
  check('remove cover', uncover.status === 200 && uncover.json?.coverUrl === null, uncover)

  // ───────────────────────── Pool
  section('Pool contributions (7,000 / 5,000 / 10,000 example)')
  const poolTrip = await newTrip({ name: uid('pool') })
  const P = poolTrip.json?.id
  const poolJoin = await addFriend(P, 'editor')
  check('friend joins pool trip', poolJoin.joined.status === 200, poolJoin.joined)
  const c1 = await owner('POST', `/trips/${P}/pool/contributions`, {
    userId: OWNER,
    amount: '7000',
    currency: 'THB',
    date: '2031-03-10',
  })
  status('owner puts in 7,000', c1, 201)
  const c2 = await friend('POST', `/trips/${P}/pool/contributions`, {
    userId: FRIEND,
    amount: '4000',
    currency: 'THB',
    date: '2031-03-10',
  })
  status('friend puts in 4,000', c2, 201)
  const c2fix = await friend('PATCH', `/pool-contributions/${c2.json?.id}`, { amount: '5000' })
  check(
    'edit contribution to 5,000',
    c2fix.status === 200 && c2fix.json?.baseAmountMinor === '500000',
    c2fix,
  )
  error(
    'contribution from an outsider',
    await owner('POST', `/trips/${P}/pool/contributions`, {
      userId: USERS.waiting.id,
      amount: '100',
      currency: 'THB',
    }),
    422,
    'VALIDATION_FAILED',
  )
  error(
    'contribution of zero',
    await owner('POST', `/trips/${P}/pool/contributions`, {
      userId: OWNER,
      amount: '0',
      currency: 'THB',
    }),
    422,
    'VALIDATION_FAILED',
  )
  const extra = await owner('POST', `/trips/${P}/pool/contributions`, {
    userId: OWNER,
    amount: '1',
    currency: 'THB',
  })
  status('delete contribution', await owner('DELETE', `/pool-contributions/${extra.json?.id}`), 204)
  for (const amount of ['6000', '4000']) {
    const res = await owner(
      'POST',
      `/trips/${P}/expenses`,
      expense({ amount, paidBy: 'pool', dayDate: '2031-03-12' }),
    )
    status(`pool pays ${amount}`, res, 201)
  }
  const pool = await friend('GET', `/trips/${P}/pool`)
  check(
    'pool totals: 12,000 in, 10,000 spent, 2,000 left',
    pool.json?.mode === 'actual' &&
      pool.json?.totalBaseMinor === '1200000' &&
      pool.json?.spentBaseMinor === '1000000' &&
      pool.json?.leftoverBaseMinor === '200000',
    pool,
  )
  check(
    'pool shares 58.33% / 41.67%',
    pool.json?.byMember?.find((m) => m.userId === OWNER)?.percentBp === 5833 &&
      pool.json?.byMember?.find((m) => m.userId === FRIEND)?.percentBp === 4167,
    pool,
  )
  const netOf = (res) =>
    Object.fromEntries((res.json?.parties ?? []).map((p) => [p.id, p.netMinor]))
  const transfersOf = (res) =>
    JSON.stringify((res.json?.transfers ?? []).map((t) => [t.from, t.to, t.amountMinor]))
  const actual = await owner('GET', `/trips/${P}/expenses/summary`)
  check(
    'actual mode: pool → owner 2,000',
    actual.json?.poolMode === 'actual' &&
      transfersOf(actual) === JSON.stringify([['pool', OWNER, '200000']]) &&
      netOf(actual)[OWNER] === '200000' &&
      netOf(actual)[FRIEND] === '0',
    actual,
  )
  const switchMode = await friend('PUT', `/trips/${P}/pool`, { mode: 'proportional' })
  check(
    'switch to proportional',
    switchMode.status === 200 && switchMode.json?.mode === 'proportional',
    switchMode,
  )
  const prop = await owner('GET', `/trips/${P}/expenses/summary`)
  check(
    'proportional: owner 1,166.67 / friend 833.33 back',
    transfersOf(prop) ===
      JSON.stringify([
        ['pool', OWNER, '116667'],
        ['pool', FRIEND, '83333'],
      ]) &&
      netOf(prop)[OWNER] === '116667' &&
      netOf(prop)[FRIEND] === '83333',
    prop,
  )
  error(
    'unknown pool mode',
    await owner('PUT', `/trips/${P}/pool`, { mode: 'random' }),
    422,
    'VALIDATION_FAILED',
  )
  const poolCsv = await owner('GET', `/trips/${P}/expenses.csv`)
  check(
    'CSV has the pool section',
    poolCsv.status === 200 &&
      poolCsv.text.includes('Pool') &&
      poolCsv.text.includes('Rule: proportional') &&
      poolCsv.text.includes('Total put in,,,,,12000.00'),
    poolCsv,
  )
  await owner('PUT', `/trips/${P}/pool`, { mode: 'actual' })
  const back = await owner('GET', `/trips/${P}/expenses/summary`)
  check(
    'switching back recomputes live',
    transfersOf(back) === JSON.stringify([['pool', OWNER, '200000']]),
    back,
  )
  error(
    'currency locked once money is in the pool',
    await owner('PATCH', `/trips/${P}`, { baseCurrency: 'USD' }),
    409,
    'TRIP_CURRENCY_LOCKED',
  )
  const poolBackup = await owner('GET', `/trips/${P}/backup.json`)
  check(
    'backup keeps pool contributions',
    poolBackup.json?.poolContributions?.length === 2 &&
      poolBackup.json?.trip?.poolMode === 'actual',
    poolBackup,
  )

  // ───────────────────────── Delete
  section('Delete')
  error('editor cannot delete the trip', await friend('DELETE', `/trips/${P}`), 403, 'FORBIDDEN')
  status('owner deletes trip', await owner('DELETE', `/trips/${S}`), 204)
  error('deleted trip is gone', await owner('GET', `/trips/${S}`), 404, 'NOT_FOUND')
  const list = await owner('GET', '/trips')
  check(
    'deleted trip not in the list',
    list.status === 200 && !list.json?.some((t) => t.id === S),
    list,
  )
  error('signed out gets 401', await anonymous()('GET', '/trips'), 401, 'UNAUTHORIZED')
})
