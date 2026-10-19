'use client'

import { CalendarFeedDto } from '@iplan/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Copy, Download, RefreshCw, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { apiFetch } from '@/lib/api-client'
import { isPrivateFeed } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { confirmDialog } from '@/lib/confirm'

/** "Add to calendar": subscribe on iPhone or Google so later plan changes sync by themselves. */
export function CalendarSync({ tripId, className }: { tripId: string; className?: string }) {
  const t = useTranslations('calendarSync')
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const key = ['trips', tripId, 'calendar-feed']
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => apiFetch(`/api/trips/${tripId}/calendar-feed`, { schema: CalendarFeedDto }),
    enabled: open,
  })

  async function rotate() {
    if (!(await confirmDialog(t('confirmRotate'), { danger: true }))) return
    const next = await apiFetch(`/api/trips/${tripId}/calendar-feed/rotate`, {
      method: 'POST',
      schema: CalendarFeedDto,
    })
    client.setQueryData(key, next)
  }

  const big =
    'flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-card px-4 text-left active:bg-muted'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('open')}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), className)}
      >
        <CalendarPlus aria-hidden className="size-5" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('title')}>
        <p className="mb-3 text-sm text-muted-foreground">{t('hint')}</p>
        {data && isPrivateFeed(data.url) && (
          <p className="mb-3 flex gap-2 rounded-xl bg-warning/12 px-3 py-2 text-sm text-warning">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t('localOnly')}
          </p>
        )}
        <div className="space-y-2">
          <a href={data?.webcalUrl} aria-disabled={!data} className={big}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#ff3b30] font-display text-sm font-bold text-white">
              {new Date().getDate()}
            </span>
            <span>
              <span className="block font-semibold">{t('iphone')}</span>
              <span className="block text-xs text-faint">{t('iphoneHint')}</span>
            </span>
          </a>
          <a
            href={data?.googleUrl}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!data}
            className={big}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#4285f4] font-display text-sm font-bold text-white">
              G
            </span>
            <span>
              <span className="block font-semibold">{t('google')}</span>
              <span className="block text-xs text-faint">{t('googleHint')}</span>
            </span>
          </a>
          <button
            type="button"
            disabled={!data}
            className={big}
            onClick={async () => {
              if (!data) return
              await navigator.clipboard.writeText(data.url)
              setCopied(true)
            }}
          >
            <Copy aria-hidden className="size-5 text-muted-foreground" />
            <span className="font-semibold">{copied ? t('copied') : t('copy')}</span>
          </button>
          <p className="px-1 text-xs text-faint">{t('mac')}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`/api/trips/${tripId}/calendar.ics`}
            className={buttonVariants({ variant: 'secondary' })}
          >
            <Download aria-hidden className="size-4" />
            {t('download')}
          </a>
          <Button variant="ghost" className="text-danger" disabled={!data} onClick={rotate}>
            <RefreshCw aria-hidden className="size-4" />
            {t('rotate')}
          </Button>
        </div>
      </Sheet>
    </>
  )
}
