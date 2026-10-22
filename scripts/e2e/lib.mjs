// Shared helpers for the end-to-end suite: sign-in, a tiny API client, a check
// reporter and a cleanup registry. Plain Node 22 (built-in fetch), no dependencies.

import { randomBytes } from 'node:crypto'

export const BASE = (process.env.BASE ?? 'http://localhost:3000').replace(/\/$/, '')

/** Seeded accounts (packages/db seed). */
export const USERS = {
  owner: { email: 'dev@iplan.local', id: 'demo-owner' },
  friend: { email: 'friend@iplan.local', id: 'demo-friend' },
  waiting: { email: 'waiting@iplan.local', id: 'demo-waiting' },
}

/** Short id that makes every run's data unique and easy to spot ("e2e-k3x9a"). */
export const RUN_ID = `e2e-${Date.now().toString(36).slice(-4)}${randomBytes(2).toString('hex')}`
export const uid = (label = '') => `${RUN_ID}${label ? `-${label}` : ''}`

const MAX_DETAIL = 600

function clip(text) {
  const s = typeof text === 'string' ? text : JSON.stringify(text)
  if (s === undefined) return ''
  return s.length > MAX_DETAIL ? `${s.slice(0, MAX_DETAIL)}…` : s
}

/** Formats a response from `api()` so a failure shows the exact request and response. */
export function describe(res) {
  if (!res || typeof res !== 'object' || !res.req) return clip(res)
  const body = res.req.body === undefined ? '' : ` ${clip(res.req.body)}`
  return `${res.req.method} ${res.req.path}${body} → ${res.status} ${clip(res.text)}`
}

/** Sign in through the dev-only endpoint; returns an API client bound to that session. */
export async function login(email) {
  const res = await fetch(`${BASE}/api/dev/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email }),
  })
  if (res.status !== 200) {
    throw new Error(`dev login for ${email} failed: ${res.status} ${await res.text()}`)
  }
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0])
  if (cookies.length === 0) throw new Error(`dev login for ${email} set no cookie`)
  return client(cookies.join('; '), email)
}

/** A client without a session (signed out). */
export const anonymous = () => client('', 'anonymous')

function client(cookie, who) {
  /**
   * api('POST', '/api/trips', { name }) → { status, json, text, headers, req }.
   * Paths may omit the /api prefix. A FormData body is sent as multipart.
   */
  async function api(method, path, body, extraHeaders = {}) {
    const url = path.startsWith('http')
      ? path
      : `${BASE}${path.startsWith('/api') ? path : `/api${path}`}`
    const headers = { origin: BASE, ...extraHeaders }
    if (cookie) headers.cookie = cookie
    let payload
    if (body instanceof FormData) payload = body
    else if (body !== undefined) {
      headers['content-type'] = 'application/json'
      payload = typeof body === 'string' ? body : JSON.stringify(body)
    }
    const res = await fetch(url, { method, headers, body: payload, redirect: 'manual' })
    const buffer = Buffer.from(await res.arrayBuffer())
    const type = res.headers.get('content-type') ?? ''
    const text = /json|text|calendar|csv/.test(type) || type === '' ? buffer.toString('utf8') : ''
    let json
    if (type.includes('json')) {
      try {
        json = JSON.parse(text)
      } catch {
        json = undefined
      }
    }
    return {
      status: res.status,
      json,
      text: text || (buffer.length ? `<${buffer.length} bytes ${type}>` : ''),
      bytes: buffer,
      headers: res.headers,
      req: {
        method,
        path: url.replace(BASE, ''),
        body: body instanceof FormData ? '<multipart>' : body,
      },
    }
  }
  api.cookie = cookie
  api.who = who
  return api
}

/**
 * Check reporter. check(name, ok, detail) prints ✓/✗; detail may be an api()
 * response, which is printed as "METHOD path body → status response".
 * Mark a check that fails because of a real app bug with { bug: 'note' }.
 */
export function reporter(file) {
  const state = { file, passed: 0, failed: 0, bugs: [], failures: [], started: Date.now() }
  const quiet = process.env.E2E_QUIET === '1'
  function check(name, ok, detail, opts = {}) {
    if (ok) {
      state.passed += 1
      if (!quiet) console.log(`  \x1b[32m✓\x1b[0m ${name}`)
      return true
    }
    state.failed += 1
    const info = describe(detail)
    const tag = opts.bug ? ` \x1b[35m[APP BUG: ${opts.bug}]\x1b[0m` : ''
    console.log(`  \x1b[31m✗ ${name}\x1b[0m${tag}${info ? `\n      ${info}` : ''}`)
    state.failures.push({ name, detail: info })
    if (opts.bug) state.bugs.push({ name, note: opts.bug, detail: info })
    return false
  }
  /** Status check that prints the request/response on failure. */
  function status(name, res, expected, opts) {
    const list = Array.isArray(expected) ? expected : [expected]
    return check(`${name} (${list.join('/')})`, list.includes(res.status), res, opts)
  }
  /** Status plus the API error code. */
  function error(name, res, expectedStatus, code, opts) {
    return check(
      `${name} (${expectedStatus}${code ? ` ${code}` : ''})`,
      res.status === expectedStatus && (!code || res.json?.error?.code === code),
      res,
      opts,
    )
  }
  function section(title) {
    if (!quiet) console.log(`\n\x1b[1m${title}\x1b[0m`)
  }
  /** Prints a one-line machine-readable result for run.mjs, then exits. */
  function finish() {
    const ms = Date.now() - state.started
    console.log(
      `\n${file}: ${state.passed} passed, ${state.failed} failed (${(ms / 1000).toFixed(1)}s)`,
    )
    console.log(
      `E2E_RESULT ${JSON.stringify({ file, passed: state.passed, failed: state.failed, ms, bugs: state.bugs })}`,
    )
    process.exitCode = state.failed > 0 ? 1 : 0
  }
  return { check, status, error, section, finish, state }
}

/**
 * Things to undo at the end, run newest first even when checks fail or throw.
 * Each task swallows its own errors so one failure doesn't block the rest.
 */
export function cleanupRegistry() {
  const tasks = []
  let ran = false
  const registry = {
    add(label, fn) {
      tasks.push({ label, fn })
    },
    trip(api, id) {
      registry.add(`trip ${id}`, async () => {
        const res = await api('DELETE', `/trips/${id}`)
        if (![204, 404].includes(res.status)) throw new Error(describe(res))
      })
    },
    ledger(api, id) {
      registry.add(`ledger ${id}`, async () => {
        const res = await api('DELETE', `/ledgers/${id}`)
        if (![204, 404].includes(res.status)) throw new Error(describe(res))
      })
    },
    async run() {
      if (ran) return
      ran = true
      for (const task of tasks.reverse()) {
        try {
          await task.fn()
        } catch (error) {
          console.log(`  \x1b[33m! cleanup ${task.label} failed: ${error.message}\x1b[0m`)
          process.exitCode = 1
        }
      }
    },
  }
  return registry
}

/**
 * Runs a test file body with cleanup guaranteed: unexpected exceptions count as
 * a failed check, cleanup always runs, then the result line is printed.
 */
export async function runSuite(file, body) {
  const report = reporter(file)
  const cleanup = cleanupRegistry()
  const stop = async () => {
    await cleanup.run()
    process.exit(130)
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  try {
    await body({ ...report, cleanup })
  } catch (error) {
    report.check(`no unexpected exception`, false, error?.stack ?? String(error))
  } finally {
    report.section('Cleanup')
    await cleanup.run()
    report.finish()
  }
}

/** Fails fast with a clear message when the dev server isn't up. */
export async function requireServer() {
  try {
    const res = await fetch(`${BASE}/api/health`)
    if (res.ok) return
    throw new Error(`status ${res.status}`)
  } catch (error) {
    console.error(`No iPlan dev server at ${BASE} (${error.message}). Start it with \`yarn dev\`.`)
    process.exit(2)
  }
}

/** Date key n days after a YYYY-MM-DD key. */
export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Today's date key in Bangkok (the app's default home zone). */
export function todayKey(timeZone = 'Asia/Bangkok') {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

/** A valid 1×1 PNG built in code (signature, IHDR, IDAT, IEND with CRCs). */
export async function tinyPng() {
  const { deflateSync } = await import('node:zlib')
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc32 = (buf) => {
    let c = 0xffffffff
    for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0) // width
  ihdr.writeUInt32BE(1, 4) // height
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // One scanline: filter byte 0 + one RGBA pixel.
  const raw = Buffer.from([0, 0x00, 0xa8, 0x4d, 0xff])
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export const sum = (values) => values.reduce((a, b) => a + BigInt(b), 0n)
