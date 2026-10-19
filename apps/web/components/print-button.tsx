'use client'

import { Printer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export function PrintBar({ back }: { back: string }) {
  const t = useTranslations('export')
  return (
    <div className="no-print sticky top-0 z-10 space-y-2 border-b bg-background/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
      <div className="flex gap-2">
        <a
          href={back}
          className="inline-flex min-h-11 items-center px-2 text-[15px] font-medium text-primary"
        >
          ‹
        </a>
        <Button className="flex-1" onClick={() => window.print()}>
          <Printer aria-hidden className="size-4" />
          {t('print')}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t('printHint')}</p>
    </div>
  )
}
