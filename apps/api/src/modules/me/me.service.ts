import type { MeDto, UpdateMeInput } from '@iplan/contracts'
import type { SessionUser } from '../../shared/context'
import { notFound } from '../../shared/errors'
import { toMeDto } from './me.mapper'
import type { MeRepository } from './me.repository'

export class MeService {
  constructor(private readonly users: MeRepository) {}

  async get(actor: SessionUser): Promise<MeDto> {
    const row = await this.users.findById(actor.id)
    if (!row) throw notFound('User')
    return toMeDto(row)
  }

  async update(actor: SessionUser, input: UpdateMeInput): Promise<MeDto> {
    const changes: { name?: string; locale?: string } = {}
    if (input.name !== undefined) changes.name = input.name
    if (input.locale !== undefined) changes.locale = input.locale
    const row =
      Object.keys(changes).length > 0
        ? await this.users.update(actor.id, changes)
        : await this.users.findById(actor.id)
    if (!row) throw notFound('User')
    return toMeDto(row)
  }
}
