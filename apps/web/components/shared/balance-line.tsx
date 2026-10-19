'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { fmt } from '@/lib/expenses'

/** "They owe you ฿500" / "You owe ฿200" / "All settled", coloured by direction. */
export function BalanceLine({
  minor,
  currency,
  className,
}: {
  minor: string
  currency: string
  className?: string
}) {
  const t = useTranslations('shared')
  const value = BigInt(minor)
  if (value === 0n) {
    return <span className={cn('text-muted-foreground', className)}>{t('settled')}</span>
  }
  return value > 0n ? (
    <span className={cn('font-semibold text-success', className)}>
      {t('owedToYou', { amount: fmt(value, currency) })}
    </span>
  ) : (
    <span className={cn('font-semibold text-warning', className)}>
      {t('youOwe', { amount: fmt(-value, currency) })}
    </span>
  )
}
