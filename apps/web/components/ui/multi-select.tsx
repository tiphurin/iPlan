'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './button'
import { Sheet } from './sheet'

export interface MultiOption {
  value: string
  label: string
  icon?: ReactNode
}

/** A dropdown where several options can be ticked; changes apply on "Done". */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string
  options: MultiOption[]
  value: readonly string[]
  onChange: (next: string[]) => void
  disabled?: boolean | undefined
  placeholder?: string | undefined
}) {
  const t = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>([...value])
  const chosen = options.filter((o) => value.includes(o.value))
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => {
          setDraft([...value])
          setOpen(true)
        }}
        className="flex min-h-[46px] w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 text-left disabled:opacity-50"
      >
        <span className={cn('min-w-0 truncate', chosen.length === 0 && 'text-muted-foreground')}>
          {chosen.length === 0 ? (placeholder ?? t('none')) : chosen.map((o) => o.label).join(', ')}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <ul className="divide-y overflow-hidden rounded-2xl border">
          {options.map((o) => {
            const on = draft.includes(o.value)
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() =>
                    setDraft((d) => (on ? d.filter((x) => x !== o.value) : [...d, o.value]))
                  }
                  className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left active:bg-muted"
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md border-2',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {on && <Check aria-hidden className="size-4" />}
                  </span>
                  {o.icon}
                  <span className="flex-1">{o.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <Button
          size="lg"
          className="mt-4"
          onClick={() => {
            onChange(draft)
            setOpen(false)
          }}
        >
          {t('done')}
        </Button>
      </Sheet>
    </>
  )
}
