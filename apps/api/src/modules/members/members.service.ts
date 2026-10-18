import { randomBytes } from 'node:crypto'
import type {
  AcceptInviteDto,
  CreateInviteInput,
  InviteDto,
  InvitePreviewDto,
  InviteRole,
} from '@iplan/contracts'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { AppError, forbidden, notFound } from '../../shared/errors'
import { RANK, type TripAccess } from '../trips/trips.service'
import { toInviteDto, toInvitePreviewDto } from './members.mapper'
import type { InviteWithTrip, MembersRepository } from './members.repository'

const DAY_MS = 86_400_000
const invalidInvite = () => new AppError('INVITE_INVALID', 410, 'Invite link is invalid or expired')

export class MembersService {
  constructor(
    private readonly members: MembersRepository,
    private readonly trips: TripAccess,
    private readonly audit: AuditLog,
    private readonly newToken: () => string = () => randomBytes(18).toString('base64url'),
  ) {}

  /** Owner changes someone's role. The owner's own role never changes here. */
  async updateRole(actor: SessionUser, tripId: string, userId: string, role: InviteRole) {
    await this.trips.requireAccess(actor, tripId, 'owner')
    const current = await this.members.roleOf(tripId, userId)
    if (!current) throw notFound('Member')
    if (current === 'owner') throw forbidden('The owner role cannot be changed')
    await this.members.setRole(tripId, userId, role)
    await this.audit.record({
      actorId: actor.id,
      action: 'member.role',
      entityType: 'trip',
      entityId: tripId,
      data: { userId, from: current, to: role },
    })
  }

  /** Owner removes a member, or a member leaves. The owner can't leave their own trip. */
  async remove(actor: SessionUser, tripId: string, userId: string) {
    const leaving = userId === actor.id
    const { role } = await this.trips.requireAccess(actor, tripId, leaving ? 'viewer' : 'owner')
    if (leaving && role === 'owner') {
      throw new AppError('OWNER_CANNOT_LEAVE', 409, 'Delete the trip instead of leaving it')
    }
    const target = leaving ? role : await this.members.roleOf(tripId, userId)
    if (!target) throw notFound('Member')
    if (target === 'owner') throw forbidden('The owner cannot be removed')
    await this.members.remove(tripId, userId)
    await this.audit.record({
      actorId: actor.id,
      action: leaving ? 'member.leave' : 'member.remove',
      entityType: 'trip',
      entityId: tripId,
      data: { userId },
    })
  }

  async createInvite(
    actor: SessionUser,
    tripId: string,
    input: CreateInviteInput,
    now = new Date(),
  ): Promise<InviteDto> {
    await this.trips.requireAccess(actor, tripId, 'editor')
    const row = await this.members.createInvite({
      tripId,
      token: this.newToken(),
      role: input.role,
      createdBy: actor.id,
      expiresAt: new Date(now.getTime() + input.expiresInDays * DAY_MS),
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'invite.create',
      entityType: 'trip',
      entityId: tripId,
      data: { role: input.role, expiresAt: row.expiresAt.toISOString() },
    })
    return toInviteDto(row)
  }

  async listInvites(actor: SessionUser, tripId: string, now = new Date()): Promise<InviteDto[]> {
    await this.trips.requireAccess(actor, tripId, 'editor')
    return (await this.members.activeInvites(tripId, now)).map(toInviteDto)
  }

  async revokeInvite(actor: SessionUser, inviteId: string, now = new Date()) {
    const invite = await this.members.findInvite(inviteId)
    if (!invite) throw notFound('Invite')
    await this.trips.requireAccess(actor, invite.tripId, 'editor')
    await this.members.revokeInvite(inviteId, now)
    await this.audit.record({
      actorId: actor.id,
      action: 'invite.revoke',
      entityType: 'trip',
      entityId: invite.tripId,
      data: { inviteId },
    })
  }

  private async valid(token: string, now: Date): Promise<InviteWithTrip> {
    const found = await this.members.findInviteByToken(token)
    if (!found || found.invite.revokedAt || found.invite.expiresAt.getTime() <= now.getTime()) {
      throw invalidInvite()
    }
    return found
  }

  async preview(actor: SessionUser, token: string, now = new Date()): Promise<InvitePreviewDto> {
    const found = await this.valid(token, now)
    return toInvitePreviewDto(found, await this.members.roleOf(found.invite.tripId, actor.id))
  }

  /** Joins the trip; an existing member is upgraded but never downgraded. */
  async accept(actor: SessionUser, token: string, now = new Date()): Promise<AcceptInviteDto> {
    const found = await this.valid(token, now)
    const { tripId, role } = found.invite
    const current = await this.members.roleOf(tripId, actor.id)
    if (current && RANK[current] >= RANK[role]) return { tripId, role: current }
    if (current) await this.members.setRole(tripId, actor.id, role)
    else await this.members.add(tripId, actor.id, role)
    await this.members.countInviteUse(found.invite.id)
    await this.audit.record({
      actorId: actor.id,
      action: 'member.join',
      entityType: 'trip',
      entityId: tripId,
      data: { role, inviteId: found.invite.id },
    })
    return { tripId, role }
  }
}
