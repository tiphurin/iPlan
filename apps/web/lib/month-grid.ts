/** Calendar maths on "YYYY-MM" / "YYYY-MM-DD" keys (UTC, no time zones involved). */

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + delta, 1)).toISOString().slice(0, 7)
}

/**
 * Weeks of the month starting on Sunday. Days outside the month are null so
 * the grid keeps its shape without showing other months' numbers.
 */
export function monthGrid(month: string): (string | null)[][] {
  const first = new Date(`${month}-01T00:00:00Z`)
  const lead = first.getUTCDay()
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
