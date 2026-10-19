/**
 * Counts failed attempts per key in memory (per server instance). Enough to slow
 * down password guessing against the single built-in admin account.
 */
export class FailureLimiter {
  private readonly failures = new Map<string, number[]>()

  constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 15 * 60_000,
  ) {}

  private recent(key: string, now: number): number[] {
    const kept = (this.failures.get(key) ?? []).filter((at) => now - at < this.windowMs)
    if (kept.length > 0) this.failures.set(key, kept)
    else this.failures.delete(key)
    return kept
  }

  /** Seconds until the next attempt is allowed, or 0 when not blocked. */
  retryAfter(key: string, now = Date.now()): number {
    const kept = this.recent(key, now)
    if (kept.length < this.maxFailures) return 0
    const oldest = kept[kept.length - this.maxFailures] ?? now
    return Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000))
  }

  fail(key: string, now = Date.now()) {
    this.failures.set(key, [...this.recent(key, now), now])
    // Keep memory bounded if someone sprays many keys.
    if (this.failures.size > 10_000) {
      for (const k of [...this.failures.keys()]) this.recent(k, now)
      for (const k of this.failures.keys()) {
        if (this.failures.size <= 10_000) break
        this.failures.delete(k)
      }
    }
  }

  reset(key: string) {
    this.failures.delete(key)
  }
}

/** Client address as seen by the edge (Vercel sets both headers). */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}
