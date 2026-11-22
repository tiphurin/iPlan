'use client'

import { FileCheck2, Share } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { shareFile } from '@/lib/deliver-file'

/**
 * "Your file is ready": on an iPhone home-screen app the file can only leave
 * through the share sheet, and iOS opens that only from a tap, so the file is
 * built first and this button shares it.
 */
export function FileReady({ file, onClose }: { file: File | null; onClose: () => void }) {
  const t = useTranslations('export')
  const [error, setError] = useState(false)
  return (
    <Sheet open={file !== null} onClose={onClose} title={t('readyTitle')}>
      {file && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
            <FileCheck2 aria-hidden className="size-8 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{file.name}</p>
              <p className="text-sm text-muted-foreground">{t('readyHint')}</p>
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {t('shareFailed')}
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={async () => {
              setError(false)
              try {
                if (await shareFile(file)) onClose()
              } catch {
                setError(true)
              }
            }}
          >
            <Share aria-hidden className="size-4" />
            {t('share')}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
