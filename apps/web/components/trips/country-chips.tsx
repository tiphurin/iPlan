'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { COUNTRIES, COUNTRY_FLAG, type Country } from '@/lib/lines'

/** Pick the country whose ride apps and rail lines to show. */
export function CountryChips({
  value,
  onChange,
}: {
  value: Country
  onChange: (country: Country) => void
}) {
  const t = useTranslations('lines')
  return (
    <div role="radiogroup" aria-label={t('country')} className="flex flex-wrap gap-2">
      {COUNTRIES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm',
            value === c ? 'border-primary bg-primary/10 font-semibold text-primary' : 'bg-card',
          )}
        >
          <span aria-hidden>{COUNTRY_FLAG[c]}</span>
          {t(`countries.${c}`)}
        </button>
      ))}
    </div>
  )
}
