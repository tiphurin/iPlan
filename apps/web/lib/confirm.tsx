'use client'

import { TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

export interface ConfirmOptions {
  /** Bold first line; defaults to "Are you sure?". */
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for deleting or losing something. */
  danger?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

// One dialog at a time, shared by the whole app (like window.confirm, but ours).
let pending: Pending | null = null
const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}

/**
 * The app's own confirm dialog: `if (!(await confirmDialog('Delete?'))) return`.
 * Resolves true when confirmed, false when cancelled or dismissed.
 */
export function confirmDialog(
  message: string | ConfirmOptions,
  extra?: Omit<ConfirmOptions, 'message'>,
): Promise<boolean> {
  const options = typeof message === 'string' ? { message, ...extra } : { ...message, ...extra }
  // A dialog still open (double tap) is answered "no" so callers never hang.
  pending?.resolve(false)
  return new Promise((resolve) => {
    pending = { ...options, resolve }
    emit()
  })
}

function answer(ok: boolean) {
  const current = pending
  pending = null
  emit()
  current?.resolve(ok)
}

/** Renders the open confirm dialog; mount once in the app layout. */
export function ConfirmHost() {
  const t = useTranslations('common')
  const id = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const open = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => pending,
    () => null,
  )
  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && answer(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={t('cancel')}
        onClick={() => answer(false)}
        className="absolute inset-0 bg-[rgba(10,12,16,0.5)]"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        className="relative w-full max-w-sm animate-[sheet-up_0.2s_ease] rounded-hero border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:animate-none sm:pb-5"
      >
        <div className="flex gap-3">
          {open.danger && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger">
              <TriangleAlert aria-hidden className="size-5" />
            </span>
          )}
          <div className="min-w-0 space-y-1">
            <h2 id={`${id}-title`} className="text-lg font-bold">
              {open.title ?? t('confirmTitle')}
            </h2>
            <p id={`${id}-body`} className="text-[15px] text-muted-foreground">
              {open.message}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => answer(false)}>
            {open.cancelLabel ?? t('cancel')}
          </Button>
          <Button
            ref={confirmRef}
            variant={open.danger ? 'danger' : 'primary'}
            onClick={() => answer(true)}
          >
            {open.confirmLabel ?? t('confirm')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
