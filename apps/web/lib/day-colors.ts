/** Colour per trip day, cycling through the subway line palette like the prototype. */
const DAY_COLORS = ['var(--lc)', 'var(--l2)', 'var(--l3)', 'var(--l1)', 'var(--l5)', 'var(--la)']

export function dayColor(index: number): string {
  return (
    DAY_COLORS[((index % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length] ?? 'var(--l2)'
  )
}
