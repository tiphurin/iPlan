'use client'

import { ChevronLeft, Printer } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { goBack } from '@/lib/history'

/**
 * Back + "Print / Save as PDF". Back returns to the screen that opened this page
 * (or `back` when opened directly). With `autoPrint`, the print dialog opens by
 * itself once the page has drawn (Export → PDF → Export).
 */
export function PrintBar({ back, autoPrint = false }: { back: string; autoPrint?: boolean }) {
  const t = useTranslations('export')
  const router = useRouter()
  useEffect(() => {
    if (!autoPrint) return
    // Give charts and fonts a moment to settle before the print snapshot.
    const timer = window.setTimeout(() => window.print(), 600)
    return () => window.clearTimeout(timer)
  }, [autoPrint])
  return (
    <>
      {/* Both bars line up with the page's own column (max-w-2xl px-4). */}
      <div className="no-print sticky top-0 z-10 border-b bg-background/95 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur short:static">
        <div className="mx-auto flex max-w-2xl items-center px-2">
          <button
            type="button"
            onClick={() => goBack(router, back)}
            className="inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-[15px] font-medium text-primary active:bg-muted"
          >
            <ChevronLeft aria-hidden className="size-5" />
            {t('back')}
          </button>
        </div>
      </div>
      {/* Print / save sits at the bottom, under the preview, like a "done" button. */}
      <div className="no-print fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-2xl space-y-1.5 px-4">
          <Button size="lg" className="w-full" onClick={() => window.print()}>
            <Printer aria-hidden className="size-4" />
            {t('print')}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t('printHint')}</p>
        </div>
      </div>
    </>
  )
}
