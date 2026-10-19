import { type FeatureKey, Locale, type MeDto, type UserStatus } from '@iplan/contracts'
import { avatarUrl } from '../../shared/avatar'
import type { SessionAccount } from '../../shared/context'
import type { UserRow } from './me.repository'

/** Role and status come from the session, which already applies ADMIN_EMAILS. */
export function toMeDto(
  row: UserRow,
  account: SessionAccount,
  features: FeatureKey[],
  hasPassword: boolean,
): MeDto {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    email: row.email,
    image: avatarUrl(row),
    role: account.role,
    status: account.status satisfies UserStatus,
    features,
    locale: Locale.catch('th').parse(row.locale),
    hasPassword,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt.toISOString(),
  }
}
