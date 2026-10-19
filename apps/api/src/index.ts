import { createDb } from '@iplan/db'
import { type App, createApp } from './app'
import { readEnv } from './env'
import { authGateway, createAuth } from './infra/auth'
import { devLogin, devUsers } from './infra/dev-login'
import { createStorage } from './infra/storage'
import { PlacesService } from './modules/places/places.service'
import { DrizzleCalendarFeedsRepository } from './modules/calendar/calendar.repository'
import { CalendarService } from './modules/calendar/calendar.service'
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
import { type Background, Notifier } from './shared/notifier'
import { createEmail } from './infra/email'
import { ensureSuperAdmin } from './infra/superadmin'
import { DrizzleInvitationsRepository } from './modules/invitations/invitations.repository'
import { InvitationsService } from './modules/invitations/invitations.service'
import { DrizzlePeopleRepository } from './modules/people/people.repository'
import { PeopleService } from './modules/people/people.service'

export { createApp } from './app'
export type { App, AppDeps } from './app'

let background: Background | undefined

/**
 * Lets the host keep background work (emails) alive after the response is sent,
 * e.g. Next.js `after` on Vercel. Without it the work still runs, unguarded.
 */
export function setBackgroundRunner(runner: Background) {
  background = runner
}

/** Wires real dependencies from environment variables. */
export function buildApp(env = readEnv()): App {
  // Serverless functions each hold their own pool; keep it small against Neon's limits.
  const db = createDb(env.databaseUrl, { max: env.production ? 3 : 5 })
  const notifier = new Notifier(createEmail(env), env.authUrl, (task) => background?.(task))
  const peopleRepo = new DrizzlePeopleRepository(db)
  const auth = createAuth(db, env, {
    onSignup: async (user) => {
      // Admins hear about new people waiting; ADMIN_EMAILS sign-ups are already active.
      if (env.adminEmails.includes(user.email.toLowerCase())) return
      const admins = await peopleRepo.adminContacts()
      const extra = env.adminEmails
        .filter((email) => !admins.some((a) => a.email.toLowerCase() === email))
        .map((email) => ({ email, name: email, locale: 'th' }))
      notifier.signupPending([...admins, ...extra], user)
    },
  })
  const audit = new AuditRepository(db)
  const storage = createStorage(env)
  const tripRepo = new DrizzleTripsRepository(db)
  const trips = new TripsService(tripRepo, audit, storage)
  const accessRepo = new DrizzleAccessRepository(db)
  const access = new AccessService(accessRepo, audit)
  const invitations = new InvitationsService(
    new DrizzleInvitationsRepository(db),
    peopleRepo,
    access,
    audit,
    notifier,
  )
  const ledgerRepo = new DrizzleLedgersRepository(db)
  const backup = new BackupService(
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
  )
  return createApp({
    init: () => ensureSuperAdmin(auth, db, env.superadminPassword, env.authSecret),
    auth: authGateway(auth),
    ...(env.devLoginEnabled && {
      devLogin: { signIn: (email) => devLogin(auth, email), users: () => devUsers(db) },
    }),
    storage,
    adminEmails: env.adminEmails,
    services: {
      access,
      people: new PeopleService(peopleRepo),
      invitations,
      me: new MeService(new DrizzleMeRepository(db), access, storage),
      trips,
      items: new ItemsService(new DrizzleItemsRepository(db), trips, audit),
      members: new MembersService(
        new DrizzleMembersRepository(db),
        trips,
        audit,
        undefined,
        invitations,
        tripRepo,
      ),
      checklist: new ChecklistService(new DrizzleChecklistRepository(db), trips, audit),
      infoCards: new InfoCardsService(new DrizzleInfoCardsRepository(db), trips, audit),
      expenses: new ExpensesService(new DrizzleExpensesRepository(db), trips, tripRepo, audit),
      attachments: new AttachmentsService(
        new DrizzleAttachmentsRepository(db),
        storage,
        trips,
        audit,
        access,
      ),
      finance: new FinanceService(new DrizzleFinanceRepository(db), audit),
      ledgers: new LedgersService(ledgerRepo, audit, invitations),
      admin: new AdminService(
        new DrizzleAdminRepository(db),
        accessRepo,
        audit,
        {
          trips: async (userId) =>
            (await tripRepo.listForUser(userId)).map(({ trip, role }) => ({
              id: trip.id,
              name: trip.name,
              startDate: trip.startDate,
              endDate: trip.endDate,
              role,
            })),
          ledgers: async (userId) =>
            (await ledgerRepo.listForUser(userId)).map(({ ledger, role }) => ({
              id: ledger.id,
              name: ledger.name,
              role,
            })),
        },
        notifier,
        {
          adminEmails: env.adminEmails,
          transaction: (work) =>
            db.transaction((tx) =>
              work({
                admin: new DrizzleAdminRepository(tx),
                access: new DrizzleAccessRepository(tx),
              }),
            ),
        },
      ),
      backup,
      places: new PlacesService(),
      calendar: new CalendarService(
        new DrizzleCalendarFeedsRepository(db),
        trips,
        backup,
        access,
        env.authUrl,
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
