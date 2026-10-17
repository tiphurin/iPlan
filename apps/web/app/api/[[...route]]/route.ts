import { getApp } from '@iplan/api'

// The Hono API (apps/api) served at /api on the same origin as the pages.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = (request: Request) => getApp().fetch(request)

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT }
