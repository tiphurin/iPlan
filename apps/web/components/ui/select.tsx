'use client'

import { Check, ChevronDown, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Children,
  type ChangeEvent,
  type OptionHTMLAttributes,
  type ReactElement,
  type ReactNode,
  isValidElement,
  useMemo,
  useState,
} from 'react'
import { cn } from '@/lib/cn'
import { Sheet } from './sheet'

interface Option {
  value: string
  label: ReactNode
  text: string
  disabled: boolean
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

/**
 * Drop-in replacement for <select>: same `<option>` children, `name`, `value` /
 * `defaultValue` and `onChange(e.target.value)`, but opens a tidy list (bottom sheet
 * on phones, a dialog on wide screens) instead of the browser's own picker.
 */
export function Select({
  name,
  value,
  defaultValue,
  onChange,
  children,
  className,
  disabled,
  'aria-label': ariaLabel,
}: {
  name?: string | undefined
  value?: string | number | undefined
  defaultValue?: string | number | undefined
  onChange?: ((event: ChangeEvent<HTMLSelectElement>) => void) | undefined
  children: ReactNode
  className?: string | undefined
  disabled?: boolean | undefined
  'aria-label'?: string | undefined
}) {
  const t = useTranslations('common')
  const options = useMemo<Option[]>(
    () =>
      Children.toArray(children)
        .filter(
          (child): child is ReactElement<OptionHTMLAttributes<HTMLOptionElement>> =>
            isValidElement(child) && child.type === 'option',
        )
        .map((child) => {
          const text = textOf(child.props.children)
          // Like <select>: an <option> without a value uses its text.
          return {
            value: child.props.value === undefined ? text : String(child.props.value),
            label: child.props.children,
            text,
            disabled: Boolean(child.props.disabled),
          }
        }),
    [children],
  )
  const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ''))
  const current = value !== undefined ? String(value) : inner
  const selected = options.find((o) => o.value === current)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const searchable = options.length > 12
  const shown = filter
    ? options.filter((o) => o.text.toLowerCase().includes(filter.toLowerCase()))
    : options

  function choose(next: string) {
    setOpen(false)
    setFilter('')
    if (next === current) return
    if (value === undefined) setInner(next)
    onChange?.({ target: { value: next } } as ChangeEvent<HTMLSelectElement>)
  }

  return (
    <>
      {name !== undefined && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-h-[46px] w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 text-left text-base outline-none focus-visible:border-primary disabled:opacity-50',
          className,
        )}
      >
        <span className="min-w-0 truncate">{selected?.label ?? '—'}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={ariaLabel ?? t('choose')}>
        {searchable && (
          <label className="relative mb-2 block">
            <Search
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              autoFocus
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('search')}
              className="min-h-11 w-full rounded-xl border bg-background pr-3 pl-9 text-base outline-none focus:border-primary"
            />
          </label>
        )}
        <ul role="listbox" className="divide-y overflow-hidden rounded-2xl border">
          {shown.map((o) => {
            const on = o.value === current
            return (
              <li key={o.value} role="option" aria-selected={on}>
                <button
                  type="button"
                  disabled={o.disabled}
                  onClick={() => choose(o.value)}
                  className={cn(
                    'flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left active:bg-muted disabled:opacity-40',
                    on && 'font-semibold',
                  )}
                >
                  <span className="min-w-0">{o.label}</span>
                  {on && <Check aria-hidden className="size-5 shrink-0 text-primary" />}
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>
    </>
  )
}
