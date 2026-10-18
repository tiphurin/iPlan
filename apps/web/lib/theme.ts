export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]
export const THEME_COOKIE = 'theme'

export function resolveTheme(value: unknown): Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
    ? (value as Theme)
    : 'system'
}

/** Persists a preference for a year. Client-side only. */
export function setPreferenceCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`
}
