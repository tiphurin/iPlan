'use client'

import type { TripItemDto } from '@iplan/contracts'
import { delayMinutes, punctuality, sleepMinutes } from '@iplan/core'
import { Moon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { useFormat } from '@/lib/use-format'

const MAX_NIGHT_MS = 18 * 3_600_000

/**
 * Last night's sleep from the user's own check-ins: the latest "wake" check-in
 * (within 18 hours) and the "sleep" check-in before it. Hidden until both exist.
 */
export function SleepCard({ items, meId, now }: { items: TripItemDto[]; meId: string; now: Date }) {
  const t = useTranslations('sleep')
  const f = useFormat()
  const mine = (item: TripItemDto) => item.checkIns.find((c) => c.userId === meId)
  const wakes = items
    .filter((i) => i.kind === 'wake' && mine(i))
    .map((i) => ({ item: i, at: new Date(mine(i)?.checkedInAt ?? 0) }))
    .filter(({ at }) => at <= now && now.getTime() - at.getTime() < MAX_NIGHT_MS)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
  const wake = wakes[0]
  if (!wake) return null
  const sleep = items
    .filter((i) => i.kind === 'sleep' && mine(i))
    .map((i) => new Date(mine(i)?.checkedInAt ?? 0))
    .filter((at) => at < wake.at && wake.at.getTime() - at.getTime() < MAX_NIGHT_MS)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  if (!sleep) return null

  const delay = delayMinutes(new Date(wake.item.startsAt), wake.at)
  const wakeText = {
    late: t('wakeLate', { min: delay }),
    early: t('wakeEarly', { min: -delay }),
    on_time: t('wakeOnTime'),
  }[punctuality(delay)]

  return (
    <Card className="flex items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
        <Moon aria-hidden className="size-6" />
      </div>
      <div>
        <p className="font-semibold">
          {t('slept', { time: f.duration(sleepMinutes(sleep, wake.at) * 60_000) })}
        </p>
        <p className="text-sm text-muted-foreground">{wakeText}</p>
      </div>
    </Card>
  )
}
