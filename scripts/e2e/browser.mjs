// Browser end to end: headless Chrome over the DevTools protocol (no dependencies).
// Visits every main page as an iPhone-sized screen, fails on console errors or
// uncaught exceptions, and runs a few tap flows. Run: node scripts/e2e/browser.mjs
//
// CHROME=/path/to/chrome overrides the browser; E2E_HEADFUL=1 shows the window.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BASE, USERS, addDays, login, requireServer, runSuite, todayKey, uid } from './lib.mjs'

const CHROME =
  process.env.CHROME ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p))

/** Dev mode compiles each page on first visit, so allow a generous first load. */
const LOAD_TIMEOUT = 90_000
const SETTLE_MS = 700

await requireServer()

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(fn, timeout, label) {
  const until = Date.now() + timeout
  let last
  while (Date.now() < until) {
    try {
      last = await fn()
      if (last) return last
    } catch {
      // keep polling
    }
    await sleep(150)
  }
  throw new Error(`timed out waiting for ${label}`)
}

/** Minimal DevTools protocol client over Node's built-in WebSocket. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let next = 0
  const pending = new Map()
  const listeners = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id !== undefined) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p?.reject(new Error(`${p.method}: ${msg.error.message}`))
      else p?.resolve(msg.result)
    } else {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params)
    }
  })
  return {
    /** Every call times out, so a stuck page fails a check instead of hanging the run. */
    send(method, params = {}, timeout = LOAD_TIMEOUT) {
      const id = ++next
      ws.send(JSON.stringify({ id, method, params }))
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`${method} timed out`))
        }, timeout)
        pending.set(id, {
          resolve: (v) => (clearTimeout(timer), resolve(v)),
          reject: (e) => (clearTimeout(timer), reject(e)),
          method,
        })
      })
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, [])
      listeners.get(method).push(fn)
    },
    close: () => ws.close(),
  }
}

await runSuite('browser', async ({ check, status, section, cleanup }) => {
  if (!CHROME) {
    check('Google Chrome found (set CHROME=/path/to/chrome)', false, 'no Chrome binary')
    return
  }

  // ───────────────────────── Test data (created through the API, removed afterwards)
  section('Set-up data')
  const owner = await login(USERS.owner.email)
  const today = todayKey()
  const created = await owner('POST', '/trips', {
    name: uid('browser'),
    destination: 'Seoul',
    startDate: addDays(today, -1),
    endDate: addDays(today, 3),
    homeTimeZone: 'Asia/Bangkok',
    baseCurrency: 'THB',
  })
  status('create trip', created, 201)
  const T = created.json?.id
  if (T) cleanup.trip(owner, T)
  await owner('PATCH', `/trips/${T}/money`, { fxRates: { KRW: '0.0255' } })
  const item = await owner('POST', `/trips/${T}/items`, {
    dayDate: today,
    kind: 'place',
    title: 'N Seoul Tower',
    startsAt: `${today}T10:00:00+09:00`,
    endsAt: `${today}T12:00:00+09:00`,
    timeZone: 'Asia/Seoul',
  })
  status('create item', item, 201)
  await owner('POST', `/trips/${T}/items`, {
    dayDate: today,
    kind: 'move',
    title: 'Metro',
    startsAt: `${today}T12:15:00+09:00`,
    endsAt: `${today}T12:45:00+09:00`,
    timeZone: 'Asia/Seoul',
    details: { line: 'Line 4', from: 'Myeongdong', to: 'Seoul Station' },
  })
  const expense = await owner('POST', `/trips/${T}/expenses`, {
    dayDate: today,
    title: 'Tteokbokki',
    category: 'food',
    amount: '12000',
    currency: 'KRW',
    paidBy: USERS.owner.id,
    split: { mode: 'equal', participants: [USERS.owner.id] },
  })
  status('create expense', expense, 201)
  await owner('POST', `/trips/${T}/checklist`, { groupKey: 'documents', title: 'Passport' })

  const month = today.slice(0, 7)
  const tx = await owner('POST', '/finance/transactions', {
    kind: 'expense',
    title: uid('coffee'),
    amount: '65',
    date: today,
  })
  status('create transaction', tx, 201)
  if (tx.json?.id)
    cleanup.add('transaction', () => owner('DELETE', `/finance/transactions/${tx.json.id}`))
  const ledger = await owner('POST', '/ledgers', { name: uid('wallet') })
  status('create wallet', ledger, 201)
  const L = ledger.json?.id
  if (L) cleanup.ledger(owner, L)
  const entry = await owner('POST', `/ledgers/${L}/entries`, {
    title: 'Groceries',
    amount: '300',
    date: today,
    paidBy: USERS.owner.id,
    split: { mode: 'equal', participants: [USERS.owner.id] },
  })
  status('create wallet entry', entry, 201)

  // ───────────────────────── Chrome
  section('Chrome')
  const port = await freePort()
  const profile = mkdtempSync(join(tmpdir(), 'iplan-e2e-chrome-'))
  const chrome = spawn(
    CHROME,
    [
      ...(process.env.E2E_HEADFUL === '1' ? [] : ['--headless=new']),
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--window-size=390,844',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--mute-audio',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  cleanup.add('chrome', async () => {
    chrome.kill('SIGTERM')
    await Promise.race([new Promise((r) => chrome.once('exit', r)), sleep(3000)])
    if (chrome.exitCode === null) chrome.kill('SIGKILL')
    rmSync(profile, { recursive: true, force: true })
  })
  const target = await waitFor(
    async () => {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      return (await res.json()).find((t) => t.type === 'page')
    },
    20_000,
    'Chrome DevTools',
  )
  const cdp = await connect(target.webSocketDebuggerUrl)
  cleanup.add('devtools connection', async () => cdp.close())
  check('headless Chrome started', true)

  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Log.enable')
  await cdp.send('Network.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  })
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

  // The browser's own "leave site?" prompt (beforeunload) would block navigation; accept it.
  cdp.on('Page.javascriptDialogOpening', () => {
    cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => undefined)
  })

  // Collect problems per page.
  let problems = []
  let documentStatus = 0
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails: d }) => {
    problems.push(`uncaught: ${d.exception?.description ?? d.text}`.split('\n')[0])
  })
  cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
    if (type !== 'error' && type !== 'assert') return
    const text = args.map((a) => a.value ?? a.description ?? a.type).join(' ')
    problems.push(`console.${type}: ${text}`.slice(0, 400))
  })
  cdp.on('Log.entryAdded', ({ entry: e }) => {
    if (e.level === 'error')
      problems.push(`log(${e.source}): ${e.text} ${e.url ?? ''}`.slice(0, 400))
  })
  cdp.on('Network.responseReceived', ({ type, response }) => {
    if (type === 'Document') documentStatus = response.status
  })

  // Sign in by giving the browser the API session cookie.
  for (const pair of owner.cookie.split('; ')) {
    const eq = pair.indexOf('=')
    await cdp.send('Network.setCookie', {
      name: pair.slice(0, eq),
      value: pair.slice(eq + 1),
      url: BASE,
      httpOnly: true,
      sameSite: 'Lax',
    })
  }

  const evaluate = async (expression) => {
    const res = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.exceptionDetails)
      throw new Error(res.exceptionDetails.exception?.description ?? 'evaluate failed')
    return res.result.value
  }
  const currentPath = () => evaluate('location.pathname + location.search')

  async function waitIdle() {
    await waitFor(() => evaluate('document.readyState === "complete"'), LOAD_TIMEOUT, 'page load')
    await sleep(SETTLE_MS)
  }

  async function visit(path) {
    problems = []
    documentStatus = 0
    const nav = await cdp.send('Page.navigate', { url: `${BASE}${path}` })
    if (nav.errorText) throw new Error(`navigate ${path}: ${nav.errorText}`)
    await waitIdle()
  }

  /** Real tap at an element's centre (found by a JS expression returning the element). */
  async function tap(finder, label) {
    const box = await evaluate(`(() => {
      const el = (${finder})()
      if (!el) return null
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      const top = document.elementFromPoint(x, y)
      const covered = top && !el.contains(top) && !top.contains(el)
      return { x, y, covered: covered ? top.outerHTML.slice(0, 160) : null }
    })()`)
    if (!box) throw new Error(`nothing to tap: ${label}`)
    if (box.covered) throw new Error(`${label} is covered by ${box.covered}`)
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', {
        type,
        x: box.x,
        y: box.y,
        button: 'left',
        clickCount: 1,
      })
    }
  }

  /** Saves a PNG of the current screen under the OS temp dir (kept for debugging failures). */
  async function screenshot(name) {
    try {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, 10_000)
      const file = join(tmpdir(), `iplan-e2e-${name}-${Date.now()}.png`)
      writeFileSync(file, Buffer.from(data, 'base64'))
      return file
    } catch (error) {
      return `(no screenshot: ${error.message})`
    }
  }

  // ───────────────────────── Every main page
  section('Pages load without console errors')
  const pages = [
    '/',
    '/trips',
    '/trips/new',
    `/trips/${T}`,
    `/trips/${T}/today`,
    `/trips/${T}/edit`,
    `/trips/${T}/expenses`,
    `/trips/${T}/expenses/new`,
    `/trips/${T}/expenses/${expense.json?.id}`,
    `/trips/${T}/checklist`,
    `/trips/${T}/info`,
    `/trips/${T}/members`,
    `/trips/${T}/items/new`,
    `/trips/${T}/items/${item.json?.id}`,
    `/print/trips/${T}`,
    '/today',
    '/money',
    '/money/categories',
    '/money/rules',
    '/money/transactions/new',
    `/money/transactions/${tx.json?.id}`,
    `/print/money/${month}`,
    '/shared',
    `/shared/${L}`,
    `/shared/${L}?tab=months`,
    `/shared/${L}/new`,
    `/shared/${L}/entries/${entry.json?.id}`,
    '/profile',
    '/settings',
    '/guide',
    '/admin',
    `/admin/users/${USERS.friend.id}`,
  ]
  for (const path of process.env.E2E_SKIP_PAGES === '1' ? [] : pages) {
    try {
      await visit(path)
      const landed = await currentPath()
      const ok = documentStatus < 400 && problems.length === 0 && !landed.startsWith('/login')
      check(
        `${path}`,
        ok,
        `status ${documentStatus}, landed on ${landed}${problems.length ? `\n      ${problems.join('\n      ')}` : ''}`,
      )
    } catch (error) {
      check(`${path}`, false, error.message)
    }
  }

  // ───────────────────────── Unsaved-changes dialog on the item page
  section('Item page: unsaved-changes dialog')
  const itemPath = `/trips/${T}/items/${item.json?.id}`
  const backLink = `() => document.querySelector('[data-back-link] a')`
  const dialog = `document.querySelector('[role="alertdialog"]')`
  try {
    // Pristine form: back leaves without asking.
    await visit(`/trips/${T}`)
    await visit(itemPath)
    await sleep(600) // the form takes its "as opened" snapshot after 400 ms
    await tap(backLink, 'back link')
    await waitFor(async () => (await currentPath()) !== itemPath, 15_000, 'leaving the item page')
    const askedPristine = await evaluate(`Boolean(${dialog})`)
    check('pristine form: back leaves without a dialog', !askedPristine, await currentPath())

    // Edited form: a duration chip changes the end time, back asks first.
    await visit(itemPath)
    await sleep(600)
    const chip = `() => {
      const label = [...document.querySelectorAll('form span')].find((s) => s.textContent.trim() === 'ตั้งระยะเวลา')
      const chips = label
        ? [...label.parentElement.querySelectorAll('button:not([aria-expanded])')]
        : [...document.querySelectorAll('form button')].filter((b) => /^\\d+\\s*นาที$/.test(b.textContent.trim()))
      return chips.find((b) => !b.className.includes('chip-on'))
    }`
    await tap(chip, 'duration chip')
    await sleep(300)
    problems = []
    await tap(backLink, 'back link')
    const shown = await waitFor(
      () => evaluate(`(() => { const d = ${dialog}; return d ? d.textContent : null })()`),
      5_000,
      'the unsaved dialog',
    ).catch(() => null)
    check(
      'edited form: back shows the "ยังไม่ได้บันทึก" dialog',
      Boolean(shown?.includes('ยังไม่ได้บันทึก')),
      shown ?? 'no dialog',
    )
    await sleep(500) // let the sheet finish sliding up before tapping it
    await tap(
      `() => [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === 'กลับไปบันทึก')`,
      'กลับไปบันทึก',
    )
    await sleep(500)
    check(
      '"กลับไปบันทึก" closes the dialog',
      !(await evaluate(`Boolean(${dialog})`)),
      'dialog still open',
    )
    check(
      '"กลับไปบันทึก" keeps you on the item page',
      (await currentPath()) === itemPath,
      await currentPath(),
    )
    check('no console errors during the flow', problems.length === 0, problems.join('\n      '))
  } catch (error) {
    check(
      'unsaved-changes flow ran',
      false,
      `${error.message}\n      screenshot: ${await screenshot('unsaved')}`,
    )
  }

  // ───────────────────────── Plan ↔ Today and the KR | TH switch
  section('Plan ↔ Today and time switch')
  try {
    await visit(`/trips/${T}`)
    // Leave via a fresh page so no unsaved form from the previous flow is around.
    problems = []
    await tap(`() => document.querySelector('a[href="/trips/${T}/today"]')`, 'Today tab')
    await waitFor(async () => (await currentPath()) === `/trips/${T}/today`, 30_000, 'Today view')
    await waitIdle()
    check('Plan → Today switch', true)
    const clockLabel = `(() => {
      const big = document.querySelector('p.text-5xl')
      return big?.parentElement?.querySelector('p')?.textContent ?? ''
    })()`
    const radio = (code) =>
      // The clock switch next to the big clock (the language toggle also has a "TH" radio).
      `() => [...(document.querySelector('p.text-5xl')?.parentElement?.querySelectorAll('[role="radio"]') ?? [])].find((b) => b.textContent.trim().startsWith('${code}'))`
    await tap(radio('TH'), 'TH clock')
    await sleep(300)
    const th = await evaluate(clockLabel)
    check('TH switch: big clock shows Bangkok', th.includes('Bangkok'), th)
    await tap(radio('KR'), 'KR clock')
    await sleep(300)
    const kr = await evaluate(clockLabel)
    check('KR switch: big clock shows Seoul', kr.includes('Seoul'), kr)
    await tap(
      `() => [...document.querySelectorAll('a[href^="/trips/${T}"]')].find((a) => new URL(a.href).pathname === '/trips/${T}')`,
      'Plan tab',
    )
    await waitFor(
      async () => (await currentPath()).split('?')[0] === `/trips/${T}`,
      30_000,
      'Plan view',
    )
    check('Today → Plan switch', true)
    check('no console errors while switching', problems.length === 0, problems.join('\n      '))
  } catch (error) {
    check(
      'plan/today flow ran',
      false,
      `${error.message}\n      screenshot: ${await screenshot('plan-today')}`,
    )
  }
})
