/**
 * Runs the API on its own (http://localhost:4000/api) for debugging without the
 * web app. Normally the API is served by Next.js at /api.
 */
import { serve } from '@hono/node-server'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getApp } from './index'

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const port = Number(process.env.API_PORT ?? 4000)
serve({ fetch: getApp().fetch, port }, () => {
  console.warn(`iPlan API on http://localhost:${port}/api (docs: /api/docs)`)
})
