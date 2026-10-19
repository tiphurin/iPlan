'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

/** Bottom sheet with a scrim; closes on Escape or tapping outside. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const t = useTranslations('common')
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])
  if (!open) return null
  // Portalled to <body> so it never sits inside a <label> or a transformed parent.
  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(10,12,16,0.45)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[90dvh] max-w-xl animate-[sheet-up_0.25s_ease] overflow-y-auto rounded-t-hero bg-card px-[18px] pt-2 pb-[calc(20px+env(safe-area-inset-bottom))] md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[min(560px,90vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:animate-none md:rounded-hero md:pb-6"
      >
        <div aria-hidden className="mx-auto mt-1 mb-3 h-[5px] w-10 rounded-full bg-border" />
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id={id} className="text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="flex size-11 items-center justify-center rounded-full bg-muted"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
