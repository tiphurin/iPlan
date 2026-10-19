import { z } from 'zod'
import { SplitInput, SplitMode } from './expenses'

/**
 * Shared money between people outside a trip (e.g. a couple's household costs).
 * A ledger has members; each entry is paid by one member and split between members.
 * A settlement is an entry where one member pays another back.
 */
const Major = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'Enter a number')
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

export const LedgerMemberInput = z.object({ email: z.email().trim().toLowerCase() })

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

export const LedgerDetailDto = LedgerDto.extend({
  entries: z.array(LedgerEntryDto),
  /** Fewest payments that settle everyone up. */
  transfers: z.array(z.object({ from: z.string(), to: z.string(), amountMinor: Minor })),
  /** Spending (not settlements) per month, newest first: what the household cost. */
  months: z.array(z.object({ month: z.string(), totalMinor: Minor, myShareMinor: Minor })),
})
export type LedgerDetailDto = z.infer<typeof LedgerDetailDto>
