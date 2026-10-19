import { getApp, setBackgroundRunner } from '@iplan/api'
import { after } from 'next/server'

// The Hono API (apps/api) served at /api on the same origin as the pages.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Emails are sent after the response; `after` keeps the function alive until they finish.
setBackgroundRunner((task) => after(() => task))

const handler = (request: Request) => getApp().fetch(request)

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT }
