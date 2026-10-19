'use client'

import { PersonDto } from '@iplan/contracts'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Avatar } from '@/components/avatar'
import { Input } from '@/components/ui/field'
import { apiFetch } from '@/lib/api-client'

/**
 * Type a name, nickname or email; shows people from your circles (admins: everyone).
 * Picking someone calls `onPick`; already-included people are hidden.
 */
export function PersonPicker({
  exclude,
  onPick,
  busy,
}: {
  exclude: readonly string[]
  onPick: (person: PersonDto) => void
  busy?: boolean
}) {
  const t = useTranslations('people')
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  // Tapping the box lists everyone you can invite; typing narrows it down.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(text.trim()), 250)
    return () => window.clearTimeout(id)
  }, [text])
  const { data, isFetching } = useQuery({
    queryKey: ['people', query],
    queryFn: () =>
      apiFetch(`/api/people?q=${encodeURIComponent(query)}`, { schema: z.array(PersonDto) }),
    enabled: open,
  })
  const results = (data ?? []).filter((p) => !exclude.includes(p.id))

  return (
    <div className="space-y-2">
      <label className="relative block">
        <Search
          aria-hidden
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          className="pl-9"
          placeholder={t('search')}
          aria-label={t('search')}
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {open && !isFetching && results.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">{t('none')}</p>
      )}
      {open && results.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onPick(p)
                  setText('')
                }}
                className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2 text-left active:bg-muted disabled:opacity-60"
              >
                <Avatar name={p.name} image={p.image} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {p.name}
                    {p.nickname && <span className="text-muted-foreground"> ({p.nickname})</span>}
                  </span>
                  <span className="block truncate text-xs text-faint">{p.email}</span>
                </span>
                <UserPlus aria-hidden className="size-5 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
