import { type Executor, schema } from '@iplan/db'
import { and, asc, eq, exists, ilike, ne, or, sql } from 'drizzle-orm'
import { avatarUrl } from '../../shared/avatar'

export interface PersonRow {
  id: string
  name: string
  nickname: string | null
  email: string
  image: string | null
}

export interface ContactRow {
  id: string
  name: string
  email: string
  locale: string
  status: string
  banned: boolean | null
}

export interface PeopleRepository {
  /** Approved people matching name, nickname or email; `circleOf` limits to shared circles. */
  search(query: string, excludeId: string, circleOf: string | null): Promise<PersonRow[]>
  contact(id: string): Promise<ContactRow | null>
  /** Admins and the superadmin with a real mailbox. */
  adminContacts(): Promise<ContactRow[]>
}

const contactColumns = {
  id: schema.user.id,
  name: schema.user.name,
  email: schema.user.email,
  locale: schema.user.locale,
  status: schema.user.status,
  banned: schema.user.banned,
}

export class DrizzlePeopleRepository implements PeopleRepository {
  constructor(private readonly db: Executor) {}

  async search(query: string, excludeId: string, circleOf: string | null) {
    const like = `%${query.replaceAll('%', '').replaceAll('_', '')}%`
    const shared = this.db
      .select({ one: sql`1` })
      .from(schema.circleMember)
      .where(
        and(
          eq(schema.circleMember.userId, schema.user.id),
          sql`${schema.circleMember.circleId} in (select circle_id from circle_member where user_id = ${circleOf ?? ''})`,
        ),
      )
    const rows = await this.db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        nickname: schema.user.nickname,
        email: schema.user.email,
        image: schema.user.image,
        avatarKey: schema.user.avatarKey,
      })
      .from(schema.user)
      .where(
        and(
          ne(schema.user.id, excludeId),
          eq(schema.user.status, 'active'),
          or(eq(schema.user.banned, false), sql`${schema.user.banned} is null`),
          query
            ? or(
                ilike(schema.user.name, like),
                ilike(schema.user.nickname, like),
                ilike(schema.user.email, like),
              )
            : undefined,
          circleOf ? exists(shared) : undefined,
        ),
      )
      .orderBy(asc(schema.user.name))
      .limit(20)
    return rows.map(({ avatarKey, ...r }) => ({ ...r, image: avatarUrl({ ...r, avatarKey }) }))
  }

  async contact(id: string) {
    const [row] = await this.db
      .select(contactColumns)
      .from(schema.user)
      .where(eq(schema.user.id, id))
    return row ?? null
  }

  async adminContacts() {
    const rows = await this.db
      .select(contactColumns)
      .from(schema.user)
      .where(or(eq(schema.user.role, 'admin'), eq(schema.user.role, 'superadmin')))
    return rows.filter((r) => !r.email.endsWith('.local') && !r.banned)
  }
}
