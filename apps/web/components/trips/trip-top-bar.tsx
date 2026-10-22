'use client'

import type { TripDetailDto } from '@iplan/contracts'
import {
  Download,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Clock,
  Info,
  Pencil,
  Users,
  Wallet,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { LanguageToggle } from '@/components/language-toggle'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { CalendarSync } from './calendar-sync'
import { ExportSheet } from './export-sheet'

/**
 * Stays on top while scrolling: back, title, calendar/edit, the Plan | Today
 * switch, time and money display switches, and links to the other trip pages.
 */
export function TripTopBar({
  trip,
  view,
  day,
  below,
}: {
  trip: TripDetailDto
  view: 'plan' | 'today'
  day?: string | undefined
  below?: ReactNode
}) {
  const t = useTranslations()
  const [exporting, setExporting] = useState(false)
  const tabs = [
    { key: 'plan', href: `/trips/${trip.id}${day ? `?day=${day}` : ''}`, icon: CalendarDays },
    { key: 'today', href: `/trips/${trip.id}/today`, icon: Clock },
  ] as const
  const more = [
    { path: 'expenses', icon: Wallet, label: t('trips.expenses'), color: 'text-l1' },
    { path: 'checklist', icon: ClipboardList, label: t('trips.checklist'), color: 'text-l3' },
    { path: 'info', icon: Info, label: t('trips.info'), color: 'text-la' },
    {
      path: 'members',
      icon: Users,
      label: t('trips.members', { count: trip.members.length }),
      color: 'text-l5',
    },
  ] as const

  return (
    <>
      <div className="sticky top-0 z-20 bg-background/95 short:static pt-[env(safe-area-inset-top)] backdrop-blur-xl md:pt-2">
        <div className="flex items-center gap-1 px-2 pt-1">
          <Link
            href="/trips"
            aria-label={t('nav.trips')}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary active:bg-muted"
          >
            <ChevronLeft aria-hidden className="size-6" />
          </Link>
          <p className="min-w-0 flex-1 truncate font-display text-lg font-bold">{trip.name}</p>
          <LanguageToggle className="md:hidden" />
          <CalendarSync tripId={trip.id} />
          {trip.role !== 'viewer' && (
            <Link
              href={`/trips/${trip.id}/edit` as Route}
              aria-label={t('trips.editTrip')}
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            >
              <Pencil aria-hidden className="size-5" />
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-4 py-2">
          <nav
            aria-label={t('tripView.switch')}
            className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-full bg-muted p-1 md:max-w-md"
          >
            {tabs.map(({ key, href, icon: Icon }) => (
              <Link
                key={key}
                href={href as Route}
                aria-current={view === key ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold',
                  view === key ? 'seg-on' : 'text-muted-foreground',
                )}
              >
                <Icon aria-hidden className="size-4" />
                {t(`tripView.${key}`)}
              </Link>
            ))}
          </nav>
        </div>

        {below}
        <div className="h-px bg-border" />
      </div>
      <nav className="flex flex-wrap gap-2 px-4 pt-3">
        {more.map(({ path, icon: Icon, label, color }) => (
          <Link
            key={path}
            href={`/trips/${trip.id}/${path}` as Route}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-sm"
          >
            <Icon aria-hidden className={cn('size-4', color)} />
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setExporting(true)}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-sm"
        >
          <Download aria-hidden className="size-4 text-l2" />
          {t('export.open')}
        </button>
      </nav>
      <ExportSheet trip={trip} open={exporting} onClose={() => setExporting(false)} />
    </>
  )
}
