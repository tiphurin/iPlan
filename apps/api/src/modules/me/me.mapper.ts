import { Locale, type MeDto, UserRole } from '@iplan/contracts'
import type { UserRow } from './me.repository'

export function toMeDto(row: UserRow): MeDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: UserRole.catch('user').parse(row.role),
    locale: Locale.catch('th').parse(row.locale),
    createdAt: row.createdAt.toISOString(),
  }
}
