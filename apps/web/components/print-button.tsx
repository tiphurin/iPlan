'use client'

import { ChevronLeft, Compass, Printer, Share } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { isStandaloneApp } from '@/lib/deliver-file'
import { goBack } from '@/lib/history'

/**
 * Back + "Print / Save as PDF". Back returns to the screen that opened this page
 * (or `back` when opened directly). With `autoPrint`, the print dialog opens by
 * itself once the page has drawn (Export → PDF → Export).
 */
export function PrintBar({ back, autoPrint = false }: { back: string; autoPrint?: boolean }) {
  const t = useTranslations('export')
  const router = useRouter()
  // An iPhone home-screen app has no print dialog: share the page (Print is in the share
  // sheet) or open it in Safari instead. Known only in the browser, so false on the server.
  const standalone = useSyncExternalStore(
    () => () => undefined,
    isStandaloneApp,
    () => false,
  )
  const [shareFailed, setShareFailed] = useState(false)
  useEffect(() => {
    if (!autoPrint || standalone) return
    // Give charts and fonts a moment to settle before the print snapshot.
    const timer = window.setTimeout(() => window.print(), 600)
    return () => window.clearTimeout(timer)
  }, [autoPrint, standalone])
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
        {standalone ? (
          <div className="mx-auto max-w-2xl space-y-1.5 px-4">
            <div className="grid grid-cols-[2fr_1fr] gap-2">
              <Button
                size="lg"
                onClick={async () => {
                  setShareFailed(false)
                  try {
                    await navigator.share({ title: document.title, url: window.location.href })
                  } catch (error) {
                    if (!(error instanceof DOMException && error.name === 'AbortError')) {
                      setShareFailed(true)
                    }
                  }
                }}
              >
                <Share aria-hidden className="size-4" />
                {t('sharePrint')}
              </Button>
              <a
                href={`x-safari-${window.location.href}`}
                className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-semibold"
              >
                <Compass aria-hidden className="size-4" />
                {t('openSafari')}
              </a>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {shareFailed ? t('shareFailedPrint') : t('sharePrintHint')}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-1.5 px-4">
            <Button size="lg" className="w-full" onClick={() => window.print()}>
              <Printer aria-hidden className="size-4" />
              {t('print')}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t('printHint')}</p>
          </div>
        )}
      </div>
    </>
  )
}
