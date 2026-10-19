import { type FeatureKey, Locale, type MeDto, type UserStatus } from '@iplan/contracts'
import { avatarUrl } from '../../shared/avatar'
import type { SessionAccount } from '../../shared/context'
import type { UserRow } from './me.repository'

/** Role and status come from the session, which already applies ADMIN_EMAILS. */
export function toMeDto(row: UserRow, account: SessionAccount, features: FeatureKey[]): MeDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: avatarUrl(row),
    role: account.role,
    status: account.status satisfies UserStatus,
    features,
    locale: Locale.catch('th').parse(row.locale),
    createdAt: row.createdAt.toISOString(),
  }
}
