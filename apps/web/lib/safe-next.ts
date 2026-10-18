/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(value: unknown, fallback = '/'): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return fallback
  }
  return value
}
