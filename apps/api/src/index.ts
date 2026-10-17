import { createDb } from '@iplan/db'
import { type App, createApp } from './app'
import { readEnv } from './env'
import { authGateway, createAuth } from './infra/auth'
import { devLogin } from './infra/dev-login'
import { DrizzleMeRepository } from './modules/me/me.repository'
import { MeService } from './modules/me/me.service'

export { createApp } from './app'
export type { App, AppDeps } from './app'

/** Wires real dependencies from environment variables. */
export function buildApp(env = readEnv()): App {
  const db = createDb(env.databaseUrl)
  const auth = createAuth(db, env)
  return createApp({
    auth: authGateway(auth),
    ...(env.devLoginEnabled && { devLogin: (email) => devLogin(auth, email) }),
    services: {
      me: new MeService(new DrizzleMeRepository(db)),
    },
  })
}

let instance: App | undefined

/** One app (and one DB pool) per server process. */
export function getApp(): App {
  instance ??= buildApp()
  return instance
}
