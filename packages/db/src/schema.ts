import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

const createdAt = timestamptz('created_at').notNull().defaultNow()
const updatedAt = timestamptz('updated_at')
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date())

// ---------------------------------------------------------------------------
// Auth (shape required by Better Auth + its admin plugin)
// ---------------------------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt,
  updatedAt,
  // admin plugin
  role: text('role').notNull().default('user'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamptz('ban_expires'),
  // iPlan
  locale: text('locale').notNull().default('th'),
  /** 'pending' until an admin approves the account; see user_group for features. */
  status: text('status').notNull().default('pending'),
  /** Uploaded profile picture (storage key); wins over the Google `image` URL. */
  avatarKey: text('avatar_key'),
  nickname: text('nickname'),
  /** Set on the built-in admin when its password comes from SUPERADMIN_PASSWORD. */
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  /** SHA-256 of the SUPERADMIN_PASSWORD last applied, so a new value resets the password. */
  bootstrapSecretHash: text('bootstrap_secret_hash'),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamptz('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt,
    updatedAt,
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by'),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamptz('access_token_expires_at'),
    refreshTokenExpiresAt: timestamptz('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt,
    updatedAt,
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

// ---------------------------------------------------------------------------
// Access: admins put approved users into groups; a group grants features
// ---------------------------------------------------------------------------

export const userGroup = pgTable('user_group', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt,
})

export const userGroupMember = pgTable(
  'user_group_member',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => userGroup.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('user_group_member_user_idx').on(t.userId),
  ],
)

/** Feature keys come from @iplan/contracts FEATURE_KEYS; unknown keys are ignored. */
export const groupFeature = pgTable(
  'group_feature',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => userGroup.id, { onDelete: 'cascade' }),
    featureKey: text('feature_key').notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.featureKey] })],
)

/** Features an admin gave one person directly (on top of their groups'). */
export const userFeature = pgTable(
  'user_feature',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    featureKey: text('feature_key').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.featureKey] })],
)

/** Circles: people in the same circle can find each other to invite. */
export const circle = pgTable('circle', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt,
})

export const circleMember = pgTable(
  'circle_member',
  {
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circle.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.circleId, t.userId] }),
    index('circle_member_user_idx').on(t.userId),
  ],
)

/**
 * Secret per person and trip for calendar subscriptions (calendar apps can't sign in).
 * Rotating the token cuts off old links.
 */
export const calendarFeed = pgTable(
  'calendar_feed',
  {
    token: text('token').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [uniqueIndex('calendar_feed_user_trip_idx').on(t.userId, t.tripId)],
)

export const invitationKind = pgEnum('invitation_kind', ['trip', 'ledger'])

/** A person invited into a trip or shared wallet; becomes a member only after accepting. */
export const invitation = pgTable(
  'invitation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: invitationKind('kind').notNull(),
    targetId: uuid('target_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    invitedBy: text('invited_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt,
  },
  (t) => [
    uniqueIndex('invitation_target_user_idx').on(t.kind, t.targetId, t.userId),
    index('invitation_user_idx').on(t.userId),
  ],
)

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export const tripRole = pgEnum('trip_role', ['owner', 'editor', 'viewer'])

export const trip = pgTable('trip', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  destination: text('destination'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  /** Zone used for trip-level dates (usually where the travellers live). */
  homeTimeZone: text('home_time_zone').notNull().default('Asia/Bangkok'),
  baseCurrency: text('base_currency').notNull().default('THB'),
  /** Exchange rates into the base currency, as decimal strings: { KRW: "0.0255" }. */
  fxRates: jsonb('fx_rates').$type<Record<string, string>>().notNull().default({}),
  /** Planned spending per day in base-currency minor units. */
  dailyBudgetMinor: bigint('daily_budget_minor', { mode: 'bigint' }),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
})

export const tripMember = pgTable(
  'trip_member',
  {
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: tripRole('role').notNull(),
    joinedAt: timestamptz('joined_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tripId, t.userId] }),
    index('trip_member_user_idx').on(t.userId),
    // Exactly one owner per trip; ownership changes go through the service.
    uniqueIndex('trip_member_single_owner_idx')
      .on(t.tripId)
      .where(sql`${t.role} = 'owner'`),
  ],
)

/** Shareable join link. Reusable until it expires or is revoked. */
export const tripInvite = pgTable(
  'trip_invite',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    role: tripRole('role').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt,
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    useCount: integer('use_count').notNull().default(0),
  },
  (t) => [index('trip_invite_trip_idx').on(t.tripId)],
)

export const tripItemKind = pgEnum('trip_item_kind', [
  'place',
  'move',
  'flight',
  'task',
  'wake',
  'sleep',
])

/** Kind-specific fields (address, phone, map links, flight number...). Validated in the API. */
export type TripItemDetails = Record<string, unknown>

export const tripItem = pgTable(
  'trip_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    /** Trip day the item belongs to (a flight leaving at 02:25 still belongs to the day before). */
    dayDate: date('day_date').notNull(),
    kind: tripItemKind('kind').notNull(),
    title: text('title').notNull(),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at'),
    /** IANA zone the times are shown in, e.g. Asia/Seoul. */
    timeZone: text('time_zone').notNull(),
    notes: text('notes'),
    details: jsonb('details').$type<TripItemDetails>().notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('trip_item_trip_starts_idx').on(t.tripId, t.startsAt),
    index('trip_item_trip_day_idx').on(t.tripId, t.dayDate),
  ],
)

export const tripItemCheckIn = pgTable(
  'trip_item_check_in',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => tripItem.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    checkedInAt: timestamptz('checked_in_at').notNull().defaultNow(),
    /** Skipped on purpose (not late, not done). */
    skipped: boolean('skipped').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.userId] })],
)

// ---------------------------------------------------------------------------
// Checklist and info cards
// ---------------------------------------------------------------------------

export const checklistItem = pgTable(
  'checklist_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    /** Free-form group key, e.g. documents, packing, airport, day-2. */
    groupKey: text('group_key').notNull(),
    title: text('title').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index('checklist_item_trip_idx').on(t.tripId, t.groupKey)],
)

/** Who ticked an item; an item counts as done once anyone ticks it. */
export const checklistTick = pgTable(
  'checklist_tick',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => checklistItem.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tickedAt: timestamptz('ticked_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.userId] })],
)

export const infoCardKind = pgEnum('info_card_kind', [
  'flight',
  'hotel',
  'health',
  'lounge',
  'emergency',
  'tip',
  'other',
])

export const infoCard = pgTable(
  'info_card',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    kind: infoCardKind('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index('info_card_trip_idx').on(t.tripId)],
)

// ---------------------------------------------------------------------------
// Trip expenses
// ---------------------------------------------------------------------------

export const expenseCategory = pgEnum('expense_category', [
  'food',
  'transport',
  'shopping',
  'stay',
  'activity',
  'health',
  'other',
])

export const splitMode = pgEnum('split_mode', ['equal', 'exact', 'percent'])

/** Party id used when the shared pool (kitty) paid instead of a member. */
export const POOL = 'pool'

export const expense = pgTable(
  'expense',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    dayDate: date('day_date').notNull(),
    /** Optional link to the plan item (place) the money was spent at. */
    itemId: uuid('item_id').references(() => tripItem.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    category: expenseCategory('category').notNull().default('other'),
    /** Finer kind within the category, e.g. transport: grab, bolt, taxi. */
    subcategory: text('subcategory'),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: text('currency').notNull(),
    /** Base-currency units per 1 unit of `currency` when this was spent. */
    fxRate: text('fx_rate').notNull(),
    baseAmountMinor: bigint('base_amount_minor', { mode: 'bigint' }).notNull(),
    /** A member's user id, or POOL. */
    paidBy: text('paid_by').notNull(),
    splitMode: splitMode('split_mode').notNull(),
    note: text('note'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [index('expense_trip_day_idx').on(t.tripId, t.dayDate)],
)

export const expenseShare = pgTable(
  'expense_share',
  {
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expense.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** In the expense currency. */
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    /** Basis points when split by percentage. */
    percentBp: integer('percent_bp'),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.userId] })],
)

// ---------------------------------------------------------------------------
// Personal monthly finance (private to each user)
// ---------------------------------------------------------------------------

export const financeCategoryKind = pgEnum('finance_category_kind', ['income', 'expense'])

export const financeCategory = pgTable(
  'finance_category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: financeCategoryKind('kind').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#94a3b8'),
    /** Monthly spending limit in minor units (expense categories only). */
    budgetMinor: bigint('budget_minor', { mode: 'bigint' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt,
  },
  (t) => [
    index('finance_category_owner_idx').on(t.ownerId),
    // Built-in categories exist once per person, even when two requests create them at once.
    uniqueIndex('finance_category_default_idx')
      .on(t.ownerId, t.name)
      .where(sql`${t.name} like 'default:%'`),
  ],
)

export const recurringKind = pgEnum('recurring_kind', ['income', 'deduction', 'fixed'])

/** Salary, tax, social security, provident fund, rent, phone, installments... */
export const recurringRule = pgTable(
  'recurring_rule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: recurringKind('kind').notNull(),
    name: text('name').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    /** "YYYY-MM", inclusive. */
    startMonth: text('start_month').notNull(),
    endMonth: text('end_month'),
    categoryId: uuid('category_id').references(() => financeCategory.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index('recurring_rule_owner_idx').on(t.ownerId)],
)

/** One month's fix: a different amount, or skipped (amount null). */
export const recurringOverride = pgTable(
  'recurring_override',
  {
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => recurringRule.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }),
    note: text('note'),
  },
  (t) => [primaryKey({ columns: [t.ruleId, t.month] })],
)

export const transactionKind = pgEnum('transaction_kind', ['income', 'expense'])

/** One-off income or spending. */
export const financeTransaction = pgTable(
  'finance_transaction',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: transactionKind('kind').notNull(),
    title: text('title').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    date: date('date').notNull(),
    categoryId: uuid('category_id').references(() => financeCategory.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt,
    updatedAt,
  },
  (t) => [index('finance_transaction_owner_date_idx').on(t.ownerId, t.date)],
)

// ---------------------------------------------------------------------------
// Attachments (slips, photos, PDFs)
// ---------------------------------------------------------------------------

export const attachmentKind = pgEnum('attachment_kind', ['slip', 'photo', 'file'])

/** File metadata; bytes live in object storage under `storage_key` (never a public URL). */
export const attachment = pgTable(
  'attachment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').references(() => user.id, { onDelete: 'set null' }),
    /** Trip the file belongs to, for permission checks; null for personal finance files (owner only). */
    tripId: uuid('trip_id').references(() => trip.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    kind: attachmentKind('kind').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    thumbKey: text('thumb_key'),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt,
  },
  (t) => [
    index('attachment_entity_idx').on(t.entityType, t.entityId),
    index('attachment_trip_idx').on(t.tripId),
  ],
)

// ---------------------------------------------------------------------------
// Shared money (ledgers): costs shared between people outside a trip
// ---------------------------------------------------------------------------

export const ledgerRole = pgEnum('ledger_role', ['owner', 'member'])
export const ledgerEntryKind = pgEnum('ledger_entry_kind', ['expense', 'settlement'])

export const ledger = pgTable('ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('THB'),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
})

export const ledgerMember = pgTable(
  'ledger_member',
  {
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => ledger.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: ledgerRole('role').notNull(),
    joinedAt: timestamptz('joined_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.ledgerId, t.userId] }),
    index('ledger_member_user_idx').on(t.userId),
  ],
)

export const ledgerEntry = pgTable(
  'ledger_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ledgerId: uuid('ledger_id')
      .notNull()
      .references(() => ledger.id, { onDelete: 'cascade' }),
    kind: ledgerEntryKind('kind').notNull().default('expense'),
    title: text('title').notNull(),
    category: text('category').notNull().default('other'),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    date: date('date').notNull(),
    /** Member user id. Kept as text so a member who leaves stays on old entries. */
    paidBy: text('paid_by').notNull(),
    splitMode: splitMode('split_mode').notNull(),
    note: text('note'),
    /** Settlement for one month's balance ("YYYY-MM"), set from the month status. */
    settlesMonth: text('settles_month'),
    /** Settlement paying back one expense, set by "paid back" on that expense. */
    settlesEntryId: uuid('settles_entry_id').references((): AnyPgColumn => ledgerEntry.id, {
      onDelete: 'cascade',
    }),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('ledger_entry_ledger_date_idx').on(t.ledgerId, t.date),
    index('ledger_entry_settles_entry_idx').on(t.settlesEntryId),
  ],
)

export const ledgerShare = pgTable(
  'ledger_share',
  {
    entryId: uuid('entry_id')
      .notNull()
      .references(() => ledgerEntry.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    percentBp: integer('percent_bp'),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.userId] })],
)

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    data: jsonb('data').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => [
    index('audit_log_created_idx').on(t.createdAt.desc()),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
  ],
)
