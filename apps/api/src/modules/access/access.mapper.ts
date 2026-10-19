import { type CircleDto, FeatureKey, type UserGroupDto } from '@iplan/contracts'
import type { CircleRow, GroupRow } from './access.repository'

/** Drops keys of features that no longer exist in code. */
export const knownFeatures = (keys: string[]): FeatureKey[] =>
  keys.flatMap((key) => {
    const parsed = FeatureKey.safeParse(key)
    return parsed.success ? [parsed.data] : []
  })

export const toUserGroupDto = (row: GroupRow): UserGroupDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  features: knownFeatures(row.features),
  memberCount: row.memberCount,
  createdAt: row.createdAt.toISOString(),
})

export const toCircleDto = (row: CircleRow): CircleDto => ({
  id: row.id,
  name: row.name,
  memberCount: row.memberCount,
  createdAt: row.createdAt.toISOString(),
})
