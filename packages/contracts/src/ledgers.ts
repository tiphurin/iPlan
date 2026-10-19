import { z } from 'zod'
import { SplitInput, SplitMode } from './expenses'
import { PendingInviteDto } from './invitations'

/**
 * Shared money between people outside a trip (e.g. a couple's household costs).
 * A ledger has members; each entry is paid by one member and split between members.
 * A settlement is an entry where one member pays another back.
 */
const Major = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d+)?$/, 'Enter a number')
const Minor = z.string().regex(/^-?\d+$/)

export const LedgerRole = z.enum(['owner', 'member'])
export type LedgerRole = z.infer<typeof LedgerRole>

export const LedgerEntryKind = z.enum(['expense', 'settlement'])
export type LedgerEntryKind = z.infer<typeof LedgerEntryKind>

export const LedgerCategory = z.enum([
  'food',
  'groceries',
  'home',
  'bills',
  'transport',
  'fun',
  'travel',
  'other',
])
export type LedgerCategory = z.infer<typeof LedgerCategory>

export const LedgerMemberDto = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: LedgerRole,
  /** Positive: others owe this member. Negative: this member owes. */
  balanceMinor: Minor,
})
export type LedgerMemberDto = z.infer<typeof LedgerMemberDto>

export const LedgerDto = z.object({
  id: z.uuid(),
  name: z.string(),
  currency: z.string(),
  role: LedgerRole,
  members: z.array(LedgerMemberDto),
  /** The signed-in user's balance in this ledger. */
  myBalanceMinor: Minor,
  entryCount: z.number().int(),
  createdAt: z.iso.datetime(),
})
export type LedgerDto = z.infer<typeof LedgerDto>

export const LedgerInput = z.object({
  name: z.string().trim().min(1).max(80),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .default('THB'),
})
export type LedgerInput = z.infer<typeof LedgerInput>

export const LedgerShareDto = z.object({
  userId: z.string(),
  name: z.string(),
  amountMinor: Minor,
  percentBp: z.number().int().nullable(),
})

export const LedgerEntryDto = z.object({
  id: z.uuid(),
  ledgerId: z.uuid(),
  kind: LedgerEntryKind,
  title: z.string(),
  category: LedgerCategory,
  amountMinor: Minor,
  date: z.iso.date(),
  paidBy: z.string(),
  paidByName: z.string(),
  splitMode: SplitMode,
  shares: z.array(LedgerShareDto),
  note: z.string().nullable(),
  /** Settlement made from a month's status ("YYYY-MM"). */
  settlesMonth: z.string().nullable(),
  /** Settlement paying back one expense. */
  settlesEntryId: z.uuid().nullable(),
  /** Expense whose shares have been paid back to the payer. */
  paidBack: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
})
export type LedgerEntryDto = z.infer<typeof LedgerEntryDto>

export const LedgerEntryInput = z.object({
  title: z.string().trim().min(1).max(120),
  category: LedgerCategory.default('other'),
  amount: Major,
  date: z.iso.date(),
  paidBy: z.string().min(1),
  split: SplitInput,
  note: z.string().trim().max(500).nullable().optional(),
})
export type LedgerEntryInput = z.infer<typeof LedgerEntryInput>

export const SettleInput = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  amount: Major,
  date: z.iso.date(),
  note: z.string().trim().max(500).nullable().optional(),
})
export type SettleInput = z.infer<typeof SettleInput>

export const MonthStatus = z.enum(['none', 'unpaid', 'partial', 'paid'])
export type MonthStatus = z.infer<typeof MonthStatus>

export const LedgerMonthDto = z.object({
  month: z.string(),
  /** Spending (not settlements) that month. */
  totalMinor: Minor,
  myShareMinor: Minor,
  byCategory: z.array(z.object({ category: LedgerCategory, totalMinor: Minor })),
  /** Who should pay whom for that month's spending alone, before any payments. */
  owed: z.array(z.object({ from: z.string(), to: z.string(), amountMinor: Minor })),
  /**
   * Still open after that month's payments. Paying too much shows up here as a
   * transfer the other way.
   */
  transfers: z.array(z.object({ from: z.string(), to: z.string(), amountMinor: Minor })),
  needMinor: Minor,
  /** Paid back so far for that month (month status or per-expense "paid back"). */
  paidMinor: Minor,
  /** none: nothing to settle; unpaid: nothing paid; partial: paid but still open; paid: settled. */
  status: MonthStatus,
})
export type LedgerMonthDto = z.infer<typeof LedgerMonthDto>

export const MonthStatusInput = z.object({
  status: z.enum(['unpaid', 'partial', 'paid']),
  /** For "partial": how much was paid (only when one person owes one other). */
  amount: Major.optional(),
})
export type MonthStatusInput = z.infer<typeof MonthStatusInput>

export const EntryPaidInput = z.object({ paidBack: z.boolean() })

export const LedgerDetailDto = LedgerDto.extend({
  /** Admins looking at someone else's wallet see it read-only. */
  readOnly: z.boolean(),
  pendingInvites: z.array(PendingInviteDto),
  entries: z.array(LedgerEntryDto),
  /** Fewest payments that settle everyone up. */
  transfers: z.array(z.object({ from: z.string(), to: z.string(), amountMinor: Minor })),
  /** One card per month, newest first: what it cost and whether it's been settled. */
  months: z.array(LedgerMonthDto),
})
export type LedgerDetailDto = z.infer<typeof LedgerDetailDto>
