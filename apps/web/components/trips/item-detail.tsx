'use client'

import type { TripItemDto } from '@iplan/contracts'
import { ExternalLink, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { mapLinks } from '@/lib/maps'
import { useFormat } from '@/lib/use-format'

/** Read-only facts plus map links; shown to everyone above the edit form. */
export function ItemDetail({ item }: { item: TripItemDto }) {
  const t = useTranslations()
  const f = useFormat()
  const place = item.details.address ?? (item.kind === 'place' ? item.title : null)
  const links = place ? mapLinks(place) : null
  const hasFacts =
    links || item.details.phone || item.details.url || item.checkIns.length > 0 || item.notes

  if (!hasFacts) return null
  return (
    <Card className="mx-4 mb-4 space-y-3">
      {links && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">{t('item.openIn')}</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['Google', links.google],
                ['Apple', links.apple],
                ['Naver', links.naver],
              ] as const
            ).map(([name, href]) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'secondary' })}
              >
                {name}
              </a>
            ))}
          </div>
        </div>
      )}
      {(item.details.phone || item.details.url) && (
        <div className="flex flex-wrap gap-2">
          {item.details.phone && (
            <a
              href={`tel:${item.details.phone}`}
              className={buttonVariants({ variant: 'outline' })}
            >
              <Phone aria-hidden className="size-4" />
              {item.details.phone}
            </a>
          )}
          {item.details.url && (
            <a
              href={item.details.url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline' })}
            >
              <ExternalLink aria-hidden className="size-4" />
              {new URL(item.details.url).hostname}
            </a>
          )}
        </div>
      )}
      {item.notes && <p className="text-sm whitespace-pre-line">{item.notes}</p>}
      {item.checkIns.length > 0 && (
        <ul className="space-y-1 text-sm">
          {item.checkIns.map((c) => (
            <li key={c.userId} className="text-success">
              ✓ {c.name} · {t('item.checkedIn', { time: f.time(c.checkedInAt, item.timeZone) })}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
