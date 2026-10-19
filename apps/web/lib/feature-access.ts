import type { FeatureKey } from '@iplan/contracts'

interface GroupFeatures {
  id: string
  features: readonly FeatureKey[]
}

/** Everything a person can use: their groups' features plus the ones given directly. */
export function effectiveFeatures(
  groupIds: readonly string[],
  direct: readonly FeatureKey[],
  groups: readonly GroupFeatures[],
): FeatureKey[] {
  const keys = new Set<FeatureKey>(direct)
  for (const g of groups) if (groupIds.includes(g.id)) for (const k of g.features) keys.add(k)
  return [...keys]
}

/**
 * Turn the features an admin ticked into groups + direct grants, so the two
 * controls always agree: a group stays (or is added) when all of its features
 * are ticked and no bigger ticked group covers it; whatever no group covers is
 * granted directly. Ticking everything therefore selects "Full access".
 */
export function planAccess(
  wanted: readonly FeatureKey[],
  groups: readonly GroupFeatures[],
  currentGroupIds: readonly string[],
): { groupIds: string[]; features: FeatureKey[] } {
  const want = new Set(wanted)
  const fits = groups.filter((g) => g.features.length > 0 && g.features.every((k) => want.has(k)))
  const covers = (a: GroupFeatures, b: GroupFeatures) =>
    a.features.length > b.features.length && b.features.every((k) => a.features.includes(k))
  // Keep only the largest groups; among groups with the same features prefer the current one.
  const kept: GroupFeatures[] = []
  for (const g of fits) {
    if (fits.some((other) => covers(other, g))) continue
    const twin = kept.find(
      (k) =>
        k.features.length === g.features.length && g.features.every((x) => k.features.includes(x)),
    )
    if (!twin) kept.push(g)
    else if (currentGroupIds.includes(g.id) && !currentGroupIds.includes(twin.id)) {
      kept[kept.indexOf(twin)] = g
    }
  }
  const covered = new Set(kept.flatMap((g) => g.features))
  return {
    groupIds: kept.map((g) => g.id),
    features: [...want].filter((k) => !covered.has(k)),
  }
}
