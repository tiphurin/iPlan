import type { PersonDto } from '@iplan/contracts'
import { type SessionUser, isAdmin } from '../../shared/context'
import type { PeopleRepository } from './people.repository'

/** Finding people to invite: only those who share a circle with you (admins: everyone). */
export class PeopleService {
  constructor(private readonly people: PeopleRepository) {}

  /** An empty query lists everyone you can find, so the picker can show a list right away. */
  async search(actor: SessionUser, query: string): Promise<PersonDto[]> {
    return this.people.search(query.trim(), actor.id, isAdmin(actor) ? null : actor.id)
  }
}
