// Money and access end to end: personal finance, shared wallets, admin reads,
// the auth surface, pending users and profile rules. Run: node scripts/e2e/api-money.mjs

import { randomUUID } from 'node:crypto'
import { USERS, anonymous, login, requireServer, runSuite, uid } from './lib.mjs'

/** A month far from real data so the checks never touch it. */
const MONTH = '2031-07'
const NEXT = '2031-08'

await requireServer()

await runSuite('api-money', async ({ check, status, error, section, cleanup }) => {
  const owner = await login(USERS.owner.email)
  let friend = await login(USERS.friend.email)
  const waiting = await login(USERS.waiting.email)
  const OWNER = USERS.owner.id
  const FRIEND = USERS.friend.id

  // ───────────────────────── Auth surface
  section('Auth surface')
  for (const [method, path] of [
    ['POST', '/auth/admin/set-role'],
    ['POST', '/auth/admin/ban-user'],
    ['GET', '/auth/admin/list-users'],
    ['POST', '/auth/update-user'],
    ['POST', '/auth/sign-in/email'],
    ['POST', '/auth/sign-up/email'],
    ['POST', '/auth/change-password'],
  ]) {
    const res = await owner(
      method,
      path,
      method === 'POST' ? { userId: OWNER, role: 'admin' } : undefined,
    )
    error(`${method} /api${path} is not exposed`, res, 404, 'NOT_FOUND')
  }
  const session = await owner('GET', '/auth/get-session')
  check(
    'get-session still works',
    session.status === 200 && session.json?.user?.id === OWNER,
    session,
  )
  error('signed out /api/me', await anonymous()('GET', '/me'), 401, 'UNAUTHORIZED')
  error('signed out /api/ledgers', await anonymous()('GET', '/ledgers'), 401, 'UNAUTHORIZED')

  // ───────────────────────── Pending user
  section('Pending user')
  const waitingMe = await waiting('GET', '/me')
  check(
    'pending user can read /me',
    waitingMe.status === 200 && waitingMe.json?.status === 'pending',
    waitingMe,
  )
  for (const path of [
    '/trips',
    '/finance/categories',
    '/ledgers',
    '/people?q=demo',
    '/invitations',
  ]) {
    error(`pending user blocked from ${path}`, await waiting('GET', path), 403, 'ACCOUNT_PENDING')
  }
  error(
    'pending user cannot create a trip',
    await waiting('POST', '/trips', { name: 'x', startDate: '2031-01-01', endDate: '2031-01-02' }),
    403,
    'ACCOUNT_PENDING',
  )
  error(
    'pending user cannot reach admin',
    await waiting('GET', '/admin/users'),
    403,
    'ACCOUNT_PENDING',
  )

  // ───────────────────────── Friend vs admin APIs
  section('Non-admin cannot reach admin APIs')
  for (const path of [
    '/admin/users',
    '/admin/stats',
    '/admin/groups',
    '/admin/circles',
    '/admin/audit',
    '/admin/trips',
    '/admin/ledgers',
  ]) {
    error(`friend GET ${path}`, await friend('GET', path), 403, 'FORBIDDEN')
  }
  error(
    'friend cannot grant themselves features',
    await friend('PATCH', `/admin/users/${FRIEND}`, { features: ['finance', 'shared'] }),
    403,
    'FORBIDDEN',
  )
  error(
    'friend cannot read the owner’s month',
    await friend('GET', `/admin/users/${OWNER}/finance/months/${MONTH}`),
    403,
  )

  // Give the friend finance + shared for this run; put the original features back at the end.
  const users = await owner('GET', '/admin/users')
  status('admin lists users', users, 200)
  const friendRow = users.json?.users?.find((u) => u.id === FRIEND)
  const originalFeatures = friendRow?.features ?? []
  const friendMe = await friend('GET', '/me')
  const hadFinance = friendMe.json?.features?.includes('finance')
  const hadShared = friendMe.json?.features?.includes('shared')
  if (!hadFinance) {
    error(
      'friend without finance is gated',
      await friend('GET', '/finance/categories'),
      403,
      'FEATURE_DISABLED',
    )
  }
  if (!hadShared) {
    error(
      'friend without shared is gated',
      await friend('GET', '/ledgers'),
      403,
      'FEATURE_DISABLED',
    )
  }
  cleanup.add('restore demo-friend features', async () => {
    const res = await owner('PATCH', `/admin/users/${FRIEND}`, { features: originalFeatures })
    if (res.status !== 200) throw new Error(`restore features → ${res.status} ${res.text}`)
  })
  const granted = await owner('PATCH', `/admin/users/${FRIEND}`, {
    features: [...new Set([...originalFeatures, 'finance', 'shared'])],
  })
  status('admin grants friend finance + shared', granted, 200)
  friend = await login(USERS.friend.email)
  const friendNow = await friend('GET', '/me')
  check(
    '/me features follow the grant',
    ['finance', 'shared', 'trips'].every((f) => friendNow.json?.features?.includes(f)),
    friendNow,
  )

  // ───────────────────────── Personal finance
  section('Personal finance: categories')
  const parallel = await Promise.all(
    Array.from({ length: 6 }, () => friend('GET', '/finance/categories')),
  )
  check(
    'parallel category reads all succeed',
    parallel.every((r) => r.status === 200),
    parallel.find((r) => r.status !== 200),
  )
  const cats = await friend('GET', '/finance/categories')
  const names = (cats.json ?? []).map((c) => `${c.kind}:${c.name}`)
  check(
    'no duplicate categories after a parallel first visit',
    names.length > 0 && new Set(names).size === names.length,
    cats,
  )
  // If these are just the untouched defaults, remove them so the next run is a first visit again.
  const friendRules = await friend('GET', '/finance/rules')
  const friendOverview = await friend('GET', '/finance/overview')
  const untouched =
    (cats.json ?? []).every((c) => c.name.startsWith('default:') && c.budgetMinor === null) &&
    friendRules.json?.length === 0 &&
    (friendOverview.json?.months ?? []).every(
      (m) => m.totalIncomeMinor === '0' && m.totalExpensesMinor === '0',
    )
  if (untouched) {
    cleanup.add('reset demo-friend default categories', async () => {
      for (const c of cats.json ?? []) await friend('DELETE', `/finance/categories/${c.id}`)
    })
  }
  error(
    'reserved category name',
    await owner('POST', '/finance/categories', { kind: 'expense', name: 'default:food' }),
    422,
    'VALIDATION_FAILED',
  )
  const ownCat = await owner('POST', '/finance/categories', {
    kind: 'expense',
    name: `  ${uid('cat')}`,
    budget: '500',
  })
  check(
    'create category (name trimmed)',
    ownCat.status === 201 && ownCat.json?.name === uid('cat'),
    ownCat,
  )
  if (ownCat.json?.id) {
    cleanup.add('category', () => owner('DELETE', `/finance/categories/${ownCat.json.id}`))
  }

  section('Personal finance: transactions and month balance')
  const monthBefore = await owner('GET', `/finance/months/${MONTH}`)
  status('read month', monthBefore, 200)
  const balance0 = BigInt(monthBefore.json?.summary?.balanceMinor ?? 0)
  const tx = (fields) => ({
    kind: 'expense',
    title: uid('tx'),
    amount: '123.45',
    date: `${MONTH}-15`,
    ...fields,
  })
  const spend = await owner('POST', '/finance/transactions', tx({ categoryId: ownCat.json?.id }))
  status('create expense transaction', spend, 201)
  if (spend.json?.id)
    cleanup.add('transaction', () => owner('DELETE', `/finance/transactions/${spend.json.id}`))
  const income = await owner(
    'POST',
    '/finance/transactions',
    tx({ kind: 'income', amount: '1000' }),
  )
  status('create income transaction', income, 201)
  if (income.json?.id)
    cleanup.add('transaction', () => owner('DELETE', `/finance/transactions/${income.json.id}`))
  for (const [label, fields] of [
    ['zero amount', { amount: '0' }],
    ['negative amount', { amount: '-5' }],
    ['impossible date', { date: '2031-02-30' }],
    ['huge amount', { amount: '1234567890123' }],
    ['three decimals', { amount: '1.234' }],
    ['unknown category', { categoryId: randomUUID() }],
    ['blank title', { title: '  ' }],
  ]) {
    error(
      `transaction rejects ${label}`,
      await owner('POST', '/finance/transactions', tx(fields)),
      422,
      'VALIDATION_FAILED',
    )
  }
  const monthAfter = await owner('GET', `/finance/months/${MONTH}`)
  check(
    'month balance moves by +1000 − 123.45',
    BigInt(monthAfter.json?.summary?.balanceMinor ?? 0) - balance0 === 100000n - 12345n,
    monthAfter,
  )
  const budget = monthAfter.json?.budgets?.find((b) => b.categoryId === ownCat.json?.id)
  check(
    'category budget shows spending',
    budget?.limitMinor === '50000' && budget?.spentMinor === '12345',
    monthAfter,
  )
  const txEdit = await owner(
    'PUT',
    `/finance/transactions/${spend.json?.id}`,
    tx({ amount: '200' }),
  )
  check('edit transaction', txEdit.status === 200 && txEdit.json?.amountMinor === '20000', txEdit)
  error(
    'someone else cannot edit my transaction',
    await friend('PUT', `/finance/transactions/${spend.json?.id}`, tx({ amount: '1' })),
    404,
    'NOT_FOUND',
  )

  section('Personal finance: recurring rule and month override')
  const rule = await owner('POST', '/finance/rules', {
    kind: 'fixed',
    name: uid('rent'),
    amount: '1000',
    startMonth: MONTH,
    endMonth: NEXT,
  })
  status('create recurring rule', rule, 201)
  if (rule.json?.id) cleanup.add('rule', () => owner('DELETE', `/finance/rules/${rule.json.id}`))
  error(
    'rule ending before it starts',
    await owner('POST', '/finance/rules', {
      kind: 'fixed',
      name: 'x',
      amount: '1',
      startMonth: NEXT,
      endMonth: MONTH,
    }),
    422,
    'VALIDATION_FAILED',
  )
  error(
    'rule with a bad month',
    await owner('POST', '/finance/rules', {
      kind: 'fixed',
      name: 'x',
      amount: '1',
      startMonth: '2031-13',
    }),
    422,
    'VALIDATION_FAILED',
  )
  const lineIn = async (month) =>
    (await owner('GET', `/finance/months/${month}`)).json?.lines?.find(
      (l) => l.ruleId === rule.json?.id,
    )
  const planned = await lineIn(MONTH)
  check(
    'rule appears in its month',
    planned?.amountMinor === '100000' && planned?.overridden === false,
    planned,
  )
  const withRule = await owner('GET', `/finance/months/${MONTH}`)
  check(
    'fixed cost lowers the balance by 1000',
    BigInt(withRule.json?.summary?.balanceMinor ?? 0) - balance0 === 100000n - 20000n - 100000n,
    withRule,
  )
  status(
    'override one month to 750',
    await owner('PUT', `/finance/rules/${rule.json?.id}/months/${MONTH}`, { amount: '750' }),
    204,
  )
  const overridden = await lineIn(MONTH)
  check(
    'override applies to that month',
    overridden?.amountMinor === '75000' && overridden?.overridden === true,
    overridden,
  )
  const nextLine = await lineIn(NEXT)
  check(
    'next month keeps the planned amount',
    nextLine?.amountMinor === '100000' && !nextLine?.overridden,
    nextLine,
  )
  status(
    'skip the month',
    await owner('PUT', `/finance/rules/${rule.json?.id}/months/${MONTH}`, { amount: null }),
    204,
  )
  const skipped = await lineIn(MONTH)
  const skippedMonth = await owner('GET', `/finance/months/${MONTH}`)
  check(
    'skipped month drops the line and its cost',
    skipped === undefined &&
      BigInt(skippedMonth.json?.summary?.balanceMinor ?? 0) - balance0 === 100000n - 20000n,
    skippedMonth,
  )
  status(
    'clear override',
    await owner('DELETE', `/finance/rules/${rule.json?.id}/months/${MONTH}`),
    204,
  )
  const cleared = await lineIn(MONTH)
  check(
    'back to the planned amount',
    cleared?.amountMinor === '100000' && cleared?.overridden === false,
    cleared,
  )
  error(
    'someone else cannot override my rule',
    await friend('PUT', `/finance/rules/${rule.json?.id}/months/${MONTH}`, { amount: '1' }),
    404,
    'NOT_FOUND',
  )

  section('Admin reads another user’s month')
  const adminView = await owner('GET', `/admin/users/${FRIEND}/finance/months/${MONTH}`)
  check(
    'admin can read the friend’s month',
    adminView.status === 200 && adminView.json?.month === MONTH,
    adminView,
  )
  error(
    'admin read of an unknown user',
    await owner('GET', `/admin/users/no-such-user/finance/months/${MONTH}`),
    404,
    'NOT_FOUND',
  )

  // ───────────────────────── Shared wallets
  section('Shared wallets: invitations and circles')
  const circleTarget = users.json?.users?.find(
    (u) =>
      u.id !== FRIEND &&
      u.status === 'active' &&
      !u.banned &&
      u.role === 'user' &&
      !u.circleIds.some((c) => friendRow?.circleIds?.includes(c)),
  )
  const friendLedger = await friend('POST', '/ledgers', { name: uid('friend-wallet') })
  status('friend creates a wallet', friendLedger, 201)
  if (friendLedger.json?.id) cleanup.ledger(friend, friendLedger.json.id)
  const FL = friendLedger.json?.id
  if (circleTarget) {
    error(
      'invite outside a shared circle',
      await friend('POST', `/ledgers/${FL}/invites`, { userId: circleTarget.id }),
      403,
      'NOT_IN_CIRCLE',
    )
  } else {
    check(
      'found a user outside the friend’s circles to test NOT_IN_CIRCLE',
      false,
      'no such user in the seed',
    )
  }
  const friendInvitesOwner = await friend('POST', `/ledgers/${FL}/invites`, { userId: OWNER })
  check(
    'invite inside a shared circle',
    friendInvitesOwner.status === 200 && friendInvitesOwner.json?.some((p) => p.userId === OWNER),
    friendInvitesOwner,
  )
  error(
    'inviting twice',
    await friend('POST', `/ledgers/${FL}/invites`, { userId: OWNER }),
    409,
    'CONFLICT',
  )
  const ownerInbox = await owner('GET', '/invitations')
  const toDecline = ownerInbox.json?.find((i) => i.targetId === FL)
  check('owner sees the invitation', Boolean(toDecline), ownerInbox)
  status('owner declines', await owner('DELETE', `/invitations/${toDecline?.id}`), 204)
  const adminLook = await owner('GET', `/ledgers/${FL}`)
  check(
    'admin sees someone else’s wallet read-only',
    adminLook.status === 200 && adminLook.json?.readOnly === true,
    adminLook,
  )
  error(
    'admin cannot write to someone else’s wallet',
    await owner('POST', `/ledgers/${FL}/entries`, {
      title: 'x',
      amount: '1',
      date: `${MONTH}-01`,
      paidBy: FRIEND,
      split: { mode: 'equal', participants: [FRIEND] },
    }),
    403,
    'FORBIDDEN',
  )

  section('Shared wallets: entries and month status')
  const created = await owner('POST', '/ledgers', { name: `   ${uid('wallet')}` })
  status('create wallet', created, 201)
  const L = created.json?.id
  if (L) cleanup.ledger(owner, L)
  check('wallet name trimmed', created.json?.name === uid('wallet'), created)
  error(
    'blank wallet name',
    await owner('POST', '/ledgers', { name: '   ' }),
    422,
    'VALIDATION_FAILED',
  )
  error('outsider cannot open the wallet', await friend('GET', `/ledgers/${L}`), 404, 'NOT_FOUND')
  const invited = await owner('POST', `/ledgers/${L}/invites`, { userId: FRIEND })
  status('invite friend', invited, 200)
  const inbox = await friend('GET', '/invitations')
  const invitation = inbox.json?.find((i) => i.targetId === L)
  check('friend has the invitation', invitation?.kind === 'ledger', inbox)
  error(
    'inviter cannot accept for them',
    await owner('POST', `/invitations/${invitation?.id}/accept`),
    404,
    'NOT_FOUND',
  )
  const accepted = await friend('POST', `/invitations/${invitation?.id}/accept`)
  check('invitee accepts', accepted.status === 200 && accepted.json?.targetId === L, accepted)

  const entry = (fields) => ({
    title: uid('cost'),
    category: 'groceries',
    amount: '1000',
    date: `${MONTH}-05`,
    paidBy: OWNER,
    split: { mode: 'equal', participants: [OWNER, FRIEND] },
    ...fields,
  })
  const l1 = await owner('POST', `/ledgers/${L}/entries`, entry({}))
  status('equal entry', l1, 201)
  for (const [label, fields] of [
    ['zero amount', { amount: '0' }],
    ['outsider in split', { split: { mode: 'equal', participants: [OWNER, USERS.waiting.id] } }],
    ['outsider payer', { paidBy: USERS.waiting.id }],
    ['mismatched exact', { split: { mode: 'exact', shares: { [OWNER]: '100', [FRIEND]: '100' } } }],
    ['percent not 100', { split: { mode: 'percent', shares: { [OWNER]: 50, [FRIEND]: 40 } } }],
  ]) {
    error(
      `entry rejects ${label}`,
      await owner('POST', `/ledgers/${L}/entries`, entry(fields)),
      422,
      'VALIDATION_FAILED',
    )
  }
  const monthOf = async (who = owner) =>
    (await who('GET', `/ledgers/${L}`)).json?.months?.find((m) => m.month === MONTH)
  let m = await monthOf()
  check(
    'month starts unpaid; friend needs 500',
    m?.status === 'unpaid' && m?.needMinor === '50000',
    m,
  )
  let set = await owner('PUT', `/ledgers/${L}/months/${MONTH}/status`, {
    status: 'partial',
    amount: '200',
  })
  m = set.json?.months?.find((x) => x.month === MONTH)
  check(
    'partial payment',
    set.status === 200 && m?.status === 'partial' && m?.paidMinor === '20000',
    set,
  )
  error(
    'partial without an amount',
    await owner('PUT', `/ledgers/${L}/months/${MONTH}/status`, { status: 'partial' }),
    422,
    'VALIDATION_FAILED',
  )
  set = await friend('PUT', `/ledgers/${L}/months/${MONTH}/status`, { status: 'paid' })
  m = set.json?.months?.find((x) => x.month === MONTH)
  check(
    'member marks the month paid',
    set.status === 200 && m?.status === 'paid' && m?.paidMinor === '50000',
    set,
  )
  set = await owner('PUT', `/ledgers/${L}/months/${MONTH}/status`, { status: 'unpaid' })
  m = set.json?.months?.find((x) => x.month === MONTH)
  check('back to unpaid', m?.status === 'unpaid' && m?.paidMinor === '0', set)
  error(
    'status for a month without entries',
    await owner('PUT', `/ledgers/${L}/months/2031-01/status`, { status: 'paid' }),
    404,
    'NOT_FOUND',
  )

  let paid = await owner('PUT', `/ledger-entries/${l1.json?.id}/paid`, { paidBack: true })
  check('mark entry paid back', paid.status === 200 && paid.json?.paidBack === true, paid)
  check('month becomes paid', (await monthOf())?.status === 'paid', await monthOf())
  paid = await owner('PUT', `/ledger-entries/${l1.json?.id}/paid`, { paidBack: false })
  check(
    'unmark entry',
    paid.json?.paidBack === false && (await monthOf())?.status === 'unpaid',
    paid,
  )
  await owner('PUT', `/ledger-entries/${l1.json?.id}/paid`, { paidBack: true })
  const editedEntry = await owner(
    'PUT',
    `/ledger-entries/${l1.json?.id}`,
    entry({ amount: '1200' }),
  )
  check(
    'editing an entry drops its stale payback',
    editedEntry.status === 200 &&
      editedEntry.json?.paidBack === false &&
      editedEntry.json?.amountMinor === '120000',
    editedEntry,
  )
  m = await monthOf()
  check(
    'month unpaid again with the new need (600)',
    m?.status === 'unpaid' && m?.needMinor === '60000',
    m,
  )

  const l2 = await friend(
    'POST',
    `/ledgers/${L}/entries`,
    entry({
      amount: '300',
      paidBy: FRIEND,
      split: { mode: 'exact', shares: { [OWNER]: '100', [FRIEND]: '200' } },
    }),
  )
  check('exact entry by the member', l2.status === 201 && l2.json?.splitMode === 'exact', l2)
  const l3 = await owner(
    'POST',
    `/ledgers/${L}/entries`,
    entry({ amount: '50', split: { mode: 'equal', participants: [OWNER] } }),
  )
  check('no-split entry has one share', l3.status === 201 && l3.json?.shares?.length === 1, l3)
  const friendView = await friend('GET', `/ledgers/${L}`)
  check(
    'friend balance −500 (−600 + 100)',
    friendView.json?.myBalanceMinor === '-50000',
    friendView,
  )
  check(
    'one transfer friend → owner 500',
    JSON.stringify(friendView.json?.transfers) ===
      JSON.stringify([{ from: FRIEND, to: OWNER, amountMinor: '50000' }]),
    friendView,
  )

  section('Shared wallets: permissions, leave and delete')
  error(
    'member cannot rename',
    await friend('PATCH', `/ledgers/${L}`, { name: 'mine now' }),
    403,
    'FORBIDDEN',
  )
  const renamed = await owner('PATCH', `/ledgers/${L}`, { name: `  ${uid('wallet2')}` })
  check(
    'owner renames (trimmed)',
    renamed.status === 200 && renamed.json?.name === uid('wallet2'),
    renamed,
  )
  error('member cannot delete', await friend('DELETE', `/ledgers/${L}`), 403, 'FORBIDDEN')
  error(
    'member cannot remove the owner',
    await friend('DELETE', `/ledgers/${L}/members/${OWNER}`),
    403,
    'FORBIDDEN',
  )
  error(
    'owner cannot leave',
    await owner('DELETE', `/ledgers/${L}/members/${OWNER}`),
    409,
    'OWNER_CANNOT_LEAVE',
  )
  error(
    'leaving with a balance',
    await friend('DELETE', `/ledgers/${L}/members/${FRIEND}`),
    409,
    'BALANCE_NOT_SETTLED',
  )
  await owner('PUT', `/ledgers/${L}/months/${MONTH}/status`, { status: 'paid' })
  const settled = await friend('GET', `/ledgers/${L}`)
  check('month paid settles the balance', settled.json?.myBalanceMinor === '0', settled)
  status(
    'member leaves once settled',
    await friend('DELETE', `/ledgers/${L}/members/${FRIEND}`),
    204,
  )
  error('former member loses access', await friend('GET', `/ledgers/${L}`), 404, 'NOT_FOUND')
  const ownerAfter = await owner('GET', `/ledgers/${L}`)
  check(
    'owner keeps the entries',
    ownerAfter.json?.entries?.some((e) => e.id === l2.json?.id),
    ownerAfter,
  )
  status('owner deletes the wallet', await owner('DELETE', `/ledgers/${L}`), 204)
  error('deleted wallet is gone', await owner('GET', `/ledgers/${L}`), 404, 'NOT_FOUND')
  error(
    'its entries are gone',
    await owner('GET', `/ledger-entries/${l1.json?.id}`),
    404,
    'NOT_FOUND',
  )

  // ───────────────────────── Profile
  section('Profile nickname')
  const original = friendMe.json?.nickname ?? null
  cleanup.add('restore demo-friend nickname', () => friend('PATCH', '/me', { nickname: original }))
  const nick = await friend('PATCH', '/me', { nickname: '   Buddy e2e' })
  check(
    'nickname leading spaces trimmed',
    nick.status === 200 && nick.json?.nickname === 'Buddy e2e',
    nick,
  )
  error(
    'nickname with a control character',
    await friend('PATCH', '/me', { nickname: 'bad\u0007bell' }),
    422,
    'VALIDATION_FAILED',
  )
  error(
    'nickname with a newline',
    await friend('PATCH', '/me', { nickname: 'two\nlines' }),
    422,
    'VALIDATION_FAILED',
  )
  error(
    'nickname too long',
    await friend('PATCH', '/me', { nickname: 'x'.repeat(41) }),
    422,
    'VALIDATION_FAILED',
  )
  const noNick = await friend('PATCH', '/me', { nickname: '' })
  check('empty nickname clears it', noNick.status === 200 && !noNick.json?.nickname, noNick)
  error('unknown locale', await friend('PATCH', '/me', { locale: 'fr' }), 422, 'VALIDATION_FAILED')
})
