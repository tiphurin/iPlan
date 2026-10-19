import { createDb } from '@iplan/db'
import { type App, createApp } from './app'
import { readEnv } from './env'
import { authGateway, createAuth } from './infra/auth'
import { devLogin, devUsers } from './infra/dev-login'
import { createStorage } from './infra/storage'
import { DrizzleAccessRepository } from './modules/access/access.repository'
import { AccessService } from './modules/access/access.service'
import { DrizzleAdminRepository } from './modules/admin/admin.repository'
import { AdminService } from './modules/admin/admin.service'
import { DrizzleBackupRepository } from './modules/backup/backup.repository'
import { BackupService } from './modules/backup/backup.service'
import { DrizzleAttachmentsRepository } from './modules/attachments/attachments.repository'
import { AttachmentsService } from './modules/attachments/attachments.service'
import { DrizzleChecklistRepository } from './modules/checklist/checklist.repository'
import { ChecklistService } from './modules/checklist/checklist.service'
import { DrizzleExpensesRepository } from './modules/expenses/expenses.repository'
import { ExpensesService } from './modules/expenses/expenses.service'
import { DrizzleFinanceRepository } from './modules/finance/finance.repository'
import { FinanceService } from './modules/finance/finance.service'
import { DrizzleInfoCardsRepository } from './modules/info-cards/info-cards.repository'
import { InfoCardsService } from './modules/info-cards/info-cards.service'
import { DrizzleItemsRepository } from './modules/items/items.repository'
import { ItemsService } from './modules/items/items.service'
import { DrizzleLedgersRepository } from './modules/ledgers/ledgers.repository'
import { LedgersService } from './modules/ledgers/ledgers.service'
import { DrizzleMeRepository } from './modules/me/me.repository'
import { MeService } from './modules/me/me.service'
import { DrizzleMembersRepository } from './modules/members/members.repository'
import { MembersService } from './modules/members/members.service'
import { DrizzleTripsRepository } from './modules/trips/trips.repository'
import { TripsService } from './modules/trips/trips.service'
import { AuditRepository } from './shared/audit'

export { createApp } from './app'
export type { App, AppDeps } from './app'

/** Wires real dependencies from environment variables. */
export function buildApp(env = readEnv()): App {
  // Serverless functions each hold their own pool; keep it small against Neon's limits.
  const db = createDb(env.databaseUrl, { max: env.production ? 3 : 5 })
  const auth = createAuth(db, env)
  const audit = new AuditRepository(db)
  const storage = createStorage(env)
  const tripRepo = new DrizzleTripsRepository(db)
  const trips = new TripsService(tripRepo, audit)
  const accessRepo = new DrizzleAccessRepository(db)
  const access = new AccessService(accessRepo, audit)
  return createApp({
    auth: authGateway(auth),
    ...(env.devLoginEnabled && {
      devLogin: { signIn: (email) => devLogin(auth, email), users: () => devUsers(db) },
    }),
    storage,
    adminEmails: env.adminEmails,
    services: {
      access,
      me: new MeService(new DrizzleMeRepository(db), access, storage),
      trips,
      items: new ItemsService(new DrizzleItemsRepository(db), trips, audit),
      members: new MembersService(new DrizzleMembersRepository(db), trips, audit),
      checklist: new ChecklistService(new DrizzleChecklistRepository(db), trips, audit),
      infoCards: new InfoCardsService(new DrizzleInfoCardsRepository(db), trips, audit),
      expenses: new ExpensesService(new DrizzleExpensesRepository(db), trips, tripRepo, audit),
      attachments: new AttachmentsService(
        new DrizzleAttachmentsRepository(db),
        storage,
        trips,
        audit,
      ),
      finance: new FinanceService(new DrizzleFinanceRepository(db), audit),
      ledgers: new LedgersService(new DrizzleLedgersRepository(db), audit),
      admin: new AdminService(new DrizzleAdminRepository(db), accessRepo, audit),
      backup: new BackupService(
        {
          trips: tripRepo,
          items: new DrizzleItemsRepository(db),
          checklist: new DrizzleChecklistRepository(db),
          infoCards: new DrizzleInfoCardsRepository(db),
          expenses: new DrizzleExpensesRepository(db),
        },
        new DrizzleBackupRepository(db),
        trips,
        audit,
      ),
    },
  })
}

let instance: App | undefined

/** One app (and one DB pool) per server process. */
export function getApp(): App {
  instance ??= buildApp()
  return instance
}
