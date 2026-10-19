import { z } from 'zod'
import { ExpenseCategory, MajorAmount, PoolMode, Rate } from './expenses'
import { InfoCardKind } from './checklist'
import { TripItemDetails, TripItemKind } from './trips'

/** Portable trip file ("iplan.trip" v1): download as a backup, import as a new trip. */
export const TripBackup = z.object({
  format: z.literal('iplan.trip'),
  version: z.literal(1),
  exportedAt: z.iso.datetime().optional(),
  trip: z.object({
    name: z.string().trim().min(1).max(80),
    destination: z.string().max(120).nullable().optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    homeTimeZone: z.string().min(1),
    baseCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default('THB'),
    /** Base-currency units per 1 unit of each currency, like the trip's saved rates. */
    fxRates: z.record(z.string().regex(/^[A-Z]{3}$/), Rate).default({}),
    /** Major units of the base currency. */
    dailyBudget: MajorAmount.nullable().optional(),
    /** Cover colour; older files have none, unknown values are dropped on import. */
    color: z.string().max(20).nullable().optional(),
    /** How pool spending is shared; older files have none (actual). */
    poolMode: PoolMode.optional(),
  }),
  items: z
    .array(
      z.object({
        dayDate: z.iso.date(),
        kind: TripItemKind,
        title: z.string().trim().min(1).max(120),
        startsAt: z.iso.datetime({ offset: true }),
        endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
        timeZone: z.string().min(1),
        notes: z.string().max(2000).nullable().optional(),
        details: TripItemDetails.optional(),
      }),
    )
    .max(1000)
    .default([]),
  checklist: z
    .array(
      z.object({
        groupKey: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .max(40),
        title: z.string().min(1).max(200),
      }),
    )
    .max(1000)
    .default([]),
  infoCards: z
    .array(
      z.object({
        kind: InfoCardKind,
        title: z.string().min(1).max(120),
        body: z.string().max(4000),
      }),
    )
    .max(200)
    .default([]),
  /** Kept for the record; not re-created on import because members differ between trips. */
  expenses: z
    .array(
      z.object({
        dayDate: z.iso.date(),
        title: z.string(),
        category: ExpenseCategory,
        amount: MajorAmount,
        currency: z.string(),
        fxRate: z.string(),
        paidBy: z.string(),
        shares: z.record(z.string(), z.string()),
      }),
    )
    .default([]),
  /** Money put into the shared pool; kept for the record like expenses, not re-created. */
  poolContributions: z
    .array(
      z.object({
        date: z.iso.date(),
        member: z.string(),
        amount: MajorAmount,
        currency: z.string(),
        fxRate: z.string(),
        note: z.string().nullable().optional(),
      }),
    )
    .default([]),
})
export type TripBackup = z.infer<typeof TripBackup>
