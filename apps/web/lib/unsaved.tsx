'use client'

import { useTranslations } from 'next-intl'
import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { confirmDialog } from './confirm'

/**
 * "You have unsaved changes": forms register a check that compares what is in
 * them now with what they opened with. Leaving through an in-app link or the
 * back link asks first (our dialog); closing or reloading the tab gets the
 * browser's own warning, the only one browsers allow there.
 */
const checks = new Map<symbol, () => boolean>()
let texts = { title: '', message: '', stay: '', leave: '' }

export function hasUnsavedChanges(): boolean {
  for (const check of checks.values()) if (check()) return true
  return false
}

/** Resolves true when there is nothing unsaved or the person chose to leave anyway. */
export async function confirmLeave(): Promise<boolean> {
  if (!hasUnsavedChanges()) return true
  const leave = await confirmDialog({
    title: texts.title,
    message: texts.message,
    confirmLabel: texts.leave,
    cancelLabel: texts.stay,
    danger: true,
  })
  if (leave) checks.clear()
  return leave
}

function snapshot(form: HTMLFormElement): string {
  const pairs: [string, string][] = []
  for (const [key, value] of new FormData(form)) {
    pairs.push([key, typeof value === 'string' ? value : `${value.name}:${value.size}`])
  }
  return JSON.stringify(pairs)
}

/**
 * Watch a form for unsaved edits. Call `markSaved()` right before navigating
 * away after a successful save or delete so that exit isn't questioned.
 */
export function useUnsavedChanges(formRef: RefObject<HTMLFormElement | null>) {
  const key = useRef(Symbol('form'))
  const initial = useRef<string | null>(null)
  useEffect(() => {
    const id = key.current
    // Take the "as opened" picture once pickers have filled their hidden inputs.
    const timer = window.setTimeout(() => {
      if (formRef.current) initial.current = snapshot(formRef.current)
    }, 400)
    checks.set(id, () =>
      Boolean(
        formRef.current &&
        initial.current !== null &&
        snapshot(formRef.current) !== initial.current,
      ),
    )
    return () => {
      window.clearTimeout(timer)
      checks.delete(id)
    }
  }, [formRef])
  const markSaved = useCallback(() => {
    checks.delete(key.current)
  }, [])
  return { markSaved }
}

/**
 * Mount once in the app layout: supplies the dialog's words, asks before
 * in-app links leave an edited form, and lets the browser warn on tab close.
 */
export function UnsavedGuard() {
  const t = useTranslations('common')
  useEffect(() => {
    texts = {
      title: t('unsavedTitle'),
      message: t('unsavedBody'),
      stay: t('unsavedStay'),
      leave: t('unsavedLeave'),
    }
  }, [t])
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element | null)?.closest?.('a[href]')
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank') return
      if (link.origin !== window.location.origin || link.hasAttribute('download')) return
      if (!hasUnsavedChanges()) return
      // Stop the navigation, ask, then replay the same tap with nothing left to guard.
      event.preventDefault()
      event.stopPropagation()
      void confirmLeave().then((leave) => leave && link.click())
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return
      event.preventDefault()
      event.returnValue = ''
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])
  return null
}
