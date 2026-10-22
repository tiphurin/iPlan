import { Landmark } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { SettleCard, SettleLine } from '@/lib/expense-charts'

type Translate = (key: string, values?: Record<string, string | number>) => string

/** Up to three expenses behind a payment: "Hotel ฿1,000 − Dinner ฿500 and 2 more". */
function reason(line: SettleLine, t: Translate, fmt: (minor: string) => string): string {
  if (line.kind === 'pool') {
    const put = BigInt(line.contributedMinor)
    return put === 0n
      ? t('expenses.settleCards.poolInNone', { used: fmt(line.usedMinor) })
      : t('expenses.settleCards.poolWhy', {
          put: fmt(line.contributedMinor),
          used: fmt(line.usedMinor),
        })
  }
  const [only] = line.items
  if (line.items.length === 1 && only) return only.title
  // Biggest additions first, the ones taken off last: "Hotel ฿1,000 − Dinner ฿500".
  const sorted = [...line.items].sort((a, b) => {
    const diff = BigInt(b.amountMinor) - BigInt(a.amountMinor)
    return diff === 0n ? 0 : diff > 0n ? 1 : -1
  })
  const shown = sorted.slice(0, 3).map((item, i) => {
    const minor = BigInt(item.amountMinor)
    const text = `${item.title} ${fmt((minor < 0n ? -minor : minor).toString())}`
    return i === 0 ? (minor < 0n ? `− ${text}` : text) : `${minor < 0n ? '−' : '+'} ${text}`
  })
  const rest = line.items.length - shown.length
  return rest > 0
    ? `${shown.join(' ')} ${t('expenses.settleCards.more', { count: rest })}`
    : shown.join(' ')
}

/**
 * One card per person: what they pay (red) and receive (green), each with a
 * one-line reason. Plain markup so the app and the print page share it.
 */
export function SettleCards({
  cards,
  meId,
  t,
  fmt,
  icon,
}: {
  cards: SettleCard[]
  meId: string | null
  t: Translate
  /** Formats base-currency minor units. */
  fmt: (minor: string) => string
  /** Avatar for a member id (the pool gets its own icon). */
  icon?: (id: string, name: string) => ReactNode
}) {
  const lineLabel = (line: SettleLine, pay: boolean) =>
    line.kind === 'pool'
      ? t(pay ? 'expenses.settleCards.poolIn' : 'expenses.settleCards.poolBack')
      : t(pay ? 'expenses.settleCards.to' : 'expenses.settleCards.from', { name: line.name })
  const block = (lines: SettleLine[], pay: boolean) =>
    lines.length > 0 && (
      <div className="space-y-1.5">
        <p className={cn('text-xs font-semibold', pay ? 'text-danger' : 'text-success')}>
          {t(pay ? 'expenses.settleCards.pay' : 'expenses.settleCards.get')}
        </p>
        {lines.map((line) => (
          <div
            key={`${line.kind}-${line.id}`}
            className={cn('rounded-xl px-3 py-2', pay ? 'bg-danger/10' : 'bg-success/10')}
          >
            <div className="flex items-center gap-2">
              {line.kind === 'pool' ? (
                <Landmark aria-hidden className="size-4 shrink-0 text-primary" />
              ) : (
                icon?.(line.id, line.name)
              )}
              <span className="min-w-0 flex-1 font-medium">{lineLabel(line, pay)}</span>
              <span className="num shrink-0 font-semibold">{fmt(line.amountMinor)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{reason(line, t, fmt)}</p>
          </div>
        ))}
      </div>
    )

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {cards.map((c) => {
        const net = BigInt(c.netMinor)
        return (
          <section
            key={c.id}
            className="break-inside-avoid space-y-3 rounded-2xl border bg-card p-4"
            aria-label={c.name}
          >
            <div className="flex items-center gap-3">
              {icon?.(c.id, c.name)}
              <p className="min-w-0 flex-1 text-lg font-semibold">
                {c.name}
                {c.id === meId && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}
                    {t('expenses.settleCards.you')}
                  </span>
                )}
              </p>
              <span
                className={cn(
                  'num shrink-0 font-semibold',
                  net < 0n ? 'text-danger' : net > 0n ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {net < 0n
                  ? t('expenses.settleCards.payTotal', { amount: fmt((-net).toString()) })
                  : net > 0n
                    ? t('expenses.settleCards.getTotal', { amount: fmt(net.toString()) })
                    : c.pay.length + c.get.length > 0
                      ? t('expenses.settleCards.even')
                      : t('expenses.settleCards.nothing')}
              </span>
            </div>
            {block(c.pay, true)}
            {block(c.get, false)}
          </section>
        )
      })}
    </div>
  )
}
