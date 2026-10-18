import { sql } from 'drizzle-orm'
import {
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
