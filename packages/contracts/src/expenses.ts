import { z } from 'zod'

/** Party id for the shared pool (kitty) that can pay instead of a member. */
export const POOL_ID = 'pool'

export const ExpenseCategory = z.enum([
  'food',
  'transport',
  'shopping',
  'stay',
  'activity',
  'health',
  'other',
])
export type ExpenseCategory = z.infer<typeof ExpenseCategory>

/** Ways of getting around, used for transport expenses and "move" plan items. */
export const TRANSPORT_MODES = [
  'taxi',
  'grab',
  'bolt',
  'lineman',
  'kakao_t',
  'go',
  'uber',
  'shinkansen',
  'thsr',
  'drive',
  'train',
  'bus',
  'boat',
  'plane',
  'walk',
] as const
export const TransportMode = z.enum(TRANSPORT_MODES)
export type TransportMode = z.infer<typeof TransportMode>

export const SplitMode = z.enum(['equal', 'exact', 'percent'])
export type SplitMode = z.infer<typeof SplitMode>

/** Amounts travel as strings: inputs in major units ("1500.25"), outputs in minor units ("150025"). */
const Major = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d+)?$/, 'Enter a number')
const Minor = z.string().regex(/^-?\d+$/)
/** Major-unit amount ("1500.25"), capped like every other amount; backups reuse it. */
export const MajorAmount = Major
/** Base-currency units per 1 unit of another currency: positive, bounded so maths stays exact. */
export const Rate = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,10})?$/, 'Enter a rate')
  .refine((v) => Number(v) > 0, 'Rate must be above zero')
const Currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/)

export const SplitInput = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('equal'), participants: z.array(z.string().min(1)).min(1) }),
  /** Exact amounts per member in major units; must add up to the total. */
  z.object({ mode: z.literal('exact'), shares: z.record(z.string(), Major) }),
  /** Percentages per member (two decimals allowed); must add up to 100. */
  z.object({
    mode: z.literal('percent'),
    shares: z.record(z.string(), z.number().min(0).max(100)),
  }),
])
export type SplitInput = z.infer<typeof SplitInput>

export const ExpenseInput = z.object({
  dayDate: z.iso.date(),
  itemId: z.uuid().nullable().optional(),
  title: z.string().trim().min(1).max(120),
  category: ExpenseCategory.default('other'),
  subcategory: z.string().trim().max(30).nullable().optional(),
  amount: Major,
  currency: Currency,
  /** Base-currency units per 1 unit of `currency`; defaults to the trip's saved rate. */
  fxRate: Rate.optional(),
  /** A member's user id or "pool". */
  paidBy: z.string().min(1),
  split: SplitInput,
  note: z.string().trim().max(500).nullable().optional(),
})
export type ExpenseInput = z.infer<typeof ExpenseInput>

export const ExpenseShareDto = z.object({
  userId: z.string(),
  name: z.string(),
  amountMinor: Minor,
  baseAmountMinor: Minor,
  percentBp: z.number().int().nullable(),
})

export const ExpenseDto = z.object({
  id: z.uuid(),
  dayDate: z.iso.date(),
  itemId: z.uuid().nullable(),
  title: z.string(),
  category: ExpenseCategory,
  subcategory: z.string().nullable(),
  amountMinor: Minor,
  currency: z.string(),
  fxRate: z.string(),
  baseAmountMinor: Minor,
  paidBy: z.string(),
  paidByName: z.string(),
  splitMode: SplitMode,
  note: z.string().nullable(),
  shares: z.array(ExpenseShareDto),
  createdAt: z.iso.datetime(),
})
export type ExpenseDto = z.infer<typeof ExpenseDto>

export const ExpenseSummaryDto = z.object({
  baseCurrency: z.string(),
  totalMinor: Minor,
  parties: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      /** Paid out of pocket, in base minor units. */
      paidMinor: Minor,
      /** Their share of the spending. */
      shareMinor: Minor,
      /** Positive: is owed money. Negative: owes money. */
      netMinor: Minor,
    }),
  ),
  transfers: z.array(
    z.object({
      from: z.string(),
      fromName: z.string(),
      to: z.string(),
      toName: z.string(),
      amountMinor: Minor,
    }),
  ),
  byDay: z.array(
    z.object({ dayDate: z.iso.date(), spentMinor: Minor, budgetMinor: Minor.nullable() }),
  ),
  byCategory: z.array(z.object({ category: ExpenseCategory, spentMinor: Minor })),
})
export type ExpenseSummaryDto = z.infer<typeof ExpenseSummaryDto>

export const TripMoneySettingsInput = z.object({
  /** Replaces every saved rate: a currency left out is removed. */
  fxRates: z.record(Currency, Rate).optional(),
  /** Major units of the base currency per day; null removes the budget. */
  dailyBudget: Major.nullable().optional(),
})
export type TripMoneySettingsInput = z.infer<typeof TripMoneySettingsInput>
