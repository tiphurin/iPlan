'use client'

/**
 * Getting a file to the person. Safari and desktop browsers download it; an app
 * opened from the iPhone home screen ignores downloads (and print), so there the
 * file goes through the share sheet ("Save to Files", LINE, Mail, Print).
 */

/** Opened from the home screen (iOS "Add to Home Screen" or an installed PWA). */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}

/** True when this browser can hand this file to the share sheet. */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

/** A normal download, for browsers that allow it. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before freeing the file.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/**
 * Downloads the file, or returns it when it must be shared instead: the share
 * sheet only opens from a tap, so the caller shows a "Share" button for it.
 */
export function deliverFile(file: File): 'downloaded' | 'share' {
  if (isStandaloneApp() && canShareFile(file)) return 'share'
  downloadFile(file)
  return 'downloaded'
}

/** Opens the share sheet with the file; call it straight from a tap. False if cancelled. */
export async function shareFile(file: File): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title: file.name })
    return true
  } catch (error) {
    // Closing the share sheet is not an error worth showing.
    if (error instanceof DOMException && error.name === 'AbortError') return false
    throw error
  }
}
