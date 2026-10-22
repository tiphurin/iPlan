// Runs the whole end-to-end suite against a running dev server (BASE, default
// http://localhost:3000) and prints a summary. Exits non-zero if anything failed.
//   yarn e2e                     every file
//   yarn e2e api-trips browser   only some files

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { BASE, requireServer } from './lib.mjs'

const FILES = ['api-trips', 'api-money', 'browser']
const picked = process.argv.slice(2).filter((a) => FILES.includes(a))
const files = picked.length > 0 ? picked : FILES

await requireServer()
console.log(`iPlan end-to-end tests against ${BASE}`)

function runFile(name) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL(`./${name}.mjs`, import.meta.url))],
      {
        stdio: ['ignore', 'pipe', 'inherit'],
        env: process.env,
      },
    )
    let result = null
    let buffer = ''
    child.stdout.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('E2E_RESULT ')) result = JSON.parse(line.slice(11))
        else process.stdout.write(`${line}\n`)
      }
    })
    child.on('close', (code) => {
      if (buffer.startsWith('E2E_RESULT ')) result = JSON.parse(buffer.slice(11))
      resolve(
        result ?? {
          file: name,
          passed: 0,
          failed: 1,
          ms: Date.now() - started,
          bugs: [],
          crashed: `exit code ${code}`,
        },
      )
    })
  })
}

const results = []
for (const name of files) {
  console.log(`\n\x1b[1m━━ ${name} ━━\x1b[0m`)
  results.push(await runFile(name))
}

const pad = (s, n) => String(s).padEnd(n)
const padL = (s, n) => String(s).padStart(n)
console.log('\n\x1b[1mSummary\x1b[0m')
console.log(`${pad('file', 12)}${padL('passed', 8)}${padL('failed', 8)}${padL('time', 9)}`)
for (const r of results) {
  const line = `${pad(r.file, 12)}${padL(r.passed, 8)}${padL(r.failed, 8)}${padL(`${(r.ms / 1000).toFixed(1)}s`, 9)}`
  console.log(r.failed > 0 ? `\x1b[31m${line}\x1b[0m${r.crashed ? ` (${r.crashed})` : ''}` : line)
}
const total = results.reduce(
  (t, r) => ({ passed: t.passed + r.passed, failed: t.failed + r.failed, ms: t.ms + r.ms }),
  { passed: 0, failed: 0, ms: 0 },
)
console.log(
  `${pad('total', 12)}${padL(total.passed, 8)}${padL(total.failed, 8)}${padL(`${(total.ms / 1000).toFixed(1)}s`, 9)}`,
)
const bugs = results.flatMap((r) => r.bugs.map((b) => ({ ...b, file: r.file })))
if (bugs.length > 0) {
  console.log('\n\x1b[35mKnown app bugs (failing on purpose until fixed):\x1b[0m')
  for (const b of bugs) console.log(`  ${b.file}: ${b.name} — ${b.note}`)
}
process.exitCode = total.failed > 0 ? 1 : 0
