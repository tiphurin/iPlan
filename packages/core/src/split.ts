/**
 * Splitting a bill between members and settling who owes whom.
 * All amounts are minor units (bigint) of a single currency.
 */
export class SplitError extends Error {
  override readonly name = 'SplitError'
}

export type Shares = Readonly<Record<string, bigint>>

/** Equal split; leftover minor units go one each to the first members in order. */
export function splitEqual(total: bigint, memberIds: readonly string[]): Shares {
  assertMembers(memberIds)
  const count = BigInt(memberIds.length)
  const base = total / count
  let remainder = total - base * count
  const step = remainder < 0n ? -1n : 1n
  const shares: Record<string, bigint> = {}
  for (const id of memberIds) {
    shares[id] = base + (remainder !== 0n ? step : 0n)
    if (remainder !== 0n) remainder -= step
  }
  return shares
}

/** Exact amounts per member (e.g. 2,000 meal: A 1,500, B 500); must add up to the total. */
export function splitExact(total: bigint, amounts: Shares): Shares {
  assertMembers(Object.keys(amounts))
  const sum = Object.values(amounts).reduce((a, b) => a + b, 0n)
  if (sum !== total) {
    throw new SplitError(`Shares add up to ${sum}, expected ${total}`)
  }
  return { ...amounts }
}

/**
 * Percentage split in basis points (100% = 10000). Rounding uses the largest
 * remainder method so the shares always add up to the total.
 */
export function splitPercent(total: bigint, basisPoints: Readonly<Record<string, number>>): Shares {
  const ids = Object.keys(basisPoints)
  assertMembers(ids)
  let points = 0
  for (const id of ids) {
    const bp = basisPoints[id] ?? 0
    if (!Number.isInteger(bp) || bp < 0) throw new SplitError(`Invalid percentage for ${id}`)
    points += bp
  }
  if (points !== 10_000)
    throw new SplitError(`Percentages add up to ${points / 100}%, expected 100%`)

  const negative = total < 0n
  const abs = negative ? -total : total
  const rows = ids.map((id, index) => {
    const exact = abs * BigInt(basisPoints[id] ?? 0)
    return { id, index, floor: exact / 10_000n, remainder: exact % 10_000n }
  })
  let leftover = abs - rows.reduce((sum, row) => sum + row.floor, 0n)
  const byRemainder = [...rows].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  )
  for (const row of byRemainder) {
    if (leftover === 0n) break
    row.floor += 1n
    leftover -= 1n
  }
  const shares: Record<string, bigint> = {}
  for (const row of rows) shares[row.id] = negative ? -row.floor : row.floor
  return shares
}

function assertMembers(ids: readonly string[]): void {
  if (ids.length === 0) throw new SplitError('At least one member is required')
  if (new Set(ids).size !== ids.length) throw new SplitError('Duplicate member in split')
}

export interface SplitExpense {
  /** Who paid. May be a member id or a shared-pool id; the pool is just another party. */
  readonly paidBy: string
  readonly amount: bigint
  readonly shares: Shares
}

/** Net balance per party: positive = is owed money, negative = owes money. */
export function computeBalances(expenses: readonly SplitExpense[]): Shares {
  const balances: Record<string, bigint> = {}
  for (const expense of expenses) {
    const owed = Object.values(expense.shares).reduce((a, b) => a + b, 0n)
    if (owed !== expense.amount) {
      throw new SplitError(`Shares add up to ${owed}, expected ${expense.amount}`)
    }
    balances[expense.paidBy] = (balances[expense.paidBy] ?? 0n) + expense.amount
    for (const [id, share] of Object.entries(expense.shares)) {
      balances[id] = (balances[id] ?? 0n) - share
    }
  }
  return balances
}

export interface Transfer {
  readonly from: string
  readonly to: string
  readonly amount: bigint
}

/**
 * Who pays whom to settle up. Greedy largest-debtor → largest-creditor matching,
 * which needs at most n-1 transfers. Ties break by id so the result is stable.
 */
export function settle(balances: Shares): Transfer[] {
  const total = Object.values(balances).reduce((a, b) => a + b, 0n)
  if (total !== 0n) throw new SplitError(`Balances do not net to zero (${total})`)

  const byAmount = (a: [string, bigint], b: [string, bigint]) =>
    a[1] === b[1] ? a[0].localeCompare(b[0]) : a[1] > b[1] ? -1 : 1
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0n)
    .sort(byAmount)
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < 0n)
    .map(([id, amount]): [string, bigint] => [id, -amount])
    .sort(byAmount)

  const transfers: Transfer[] = []
  let c = 0
  let d = 0
  while (c < creditors.length && d < debtors.length) {
    const creditor = creditors[c] as [string, bigint]
    const debtor = debtors[d] as [string, bigint]
    const amount = creditor[1] < debtor[1] ? creditor[1] : debtor[1]
    transfers.push({ from: debtor[0], to: creditor[0], amount })
    creditor[1] -= amount
    debtor[1] -= amount
    if (creditor[1] === 0n) c += 1
    if (debtor[1] === 0n) d += 1
  }
  return transfers
}
