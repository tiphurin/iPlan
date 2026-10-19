import type {
  AcceptInvitationDto,
  FeatureKey,
  InvitationDto,
  PendingInviteDto,
} from '@iplan/contracts'
import type { AuditLog } from '../../shared/audit'
import { type SessionUser, isAdmin } from '../../shared/context'
import { AppError, conflict, forbidden, notFound, validationFailed } from '../../shared/errors'
import type { Notifier } from '../../shared/notifier'
import type { PeopleRepository } from '../people/people.repository'
import type { InvitationKind, InvitationsRepository } from './invitations.repository'

const FEATURE_OF: Record<InvitationKind, FeatureKey> = { trip: 'trips', ledger: 'shared' }

interface FeatureCheck {
  requireFeature(user: SessionUser, feature: FeatureKey): Promise<void>
  requireSharedCircle(actor: SessionUser, userId: string): Promise<void>
}

/**
 * Invite-by-person for trips and shared wallets: the invited person sees it on
 * their home screen (and gets an email) and becomes a member only after accepting.
 * Callers (trips, ledgers) check the inviter's own permission first; this checks
 * that inviter and invited person share a circle.
 */
export class InvitationsService {
  constructor(
    private readonly invitations: InvitationsRepository,
    private readonly people: PeopleRepository,
    private readonly access: FeatureCheck,
    private readonly audit: AuditLog,
    private readonly notifier?: Notifier,
  ) {}

  async invite(
    actor: SessionUser,
    target: { kind: InvitationKind; id: string; name: string; memberIds: string[] },
    userId: string,
    role: string,
  ): Promise<PendingInviteDto[]> {
    if (userId === actor.id || target.memberIds.includes(userId)) {
      throw conflict('Already a member')
    }
    const person = await this.people.contact(userId)
    if (!person || person.status !== 'active' || person.banned) {
      throw new AppError('USER_NOT_FOUND', 404, 'No approved user with that id')
    }
    // Same rule as people search: only people who share a circle (admins: anyone).
    await this.access.requireSharedCircle(actor, userId)
    const id = await this.invitations.create({
      kind: target.kind,
      targetId: target.id,
      userId,
      role,
      invitedBy: actor.id,
    })
    if (!id) throw conflict('Already invited')
    await this.audit.record({
      actorId: actor.id,
      action: 'invitation.create',
      entityType: target.kind,
      entityId: target.id,
      data: { userId, role },
    })
    this.notifier?.invited(
      { email: person.email, name: person.name, locale: person.locale },
      actor.name,
      { kind: target.kind, name: target.name },
    )
    return this.pending(target.kind, target.id)
  }

  pending(kind: InvitationKind, targetId: string): Promise<PendingInviteDto[]> {
    return this.invitations.forTarget(kind, targetId)
  }

  async mine(actor: SessionUser): Promise<InvitationDto[]> {
    return (await this.invitations.forUser(actor.id)).map((r) => ({
      id: r.id,
      kind: r.kind,
      targetId: r.targetId,
      targetName: r.targetName,
      role: r.role,
      invitedByName: r.invitedByName,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  async accept(actor: SessionUser, id: string): Promise<AcceptInvitationDto> {
    const invitation = await this.invitations.find(id)
    if (!invitation || invitation.userId !== actor.id) throw notFound('Invitation')
    // Joining is pointless without the feature; the admin must grant it first.
    await this.access.requireFeature(actor, FEATURE_OF[invitation.kind])
    if (!(await this.invitations.accept(invitation))) {
      // The trip or wallet was deleted meanwhile; the invitation is gone too.
      throw new AppError('INVITATION_GONE', 410, 'The trip or shared wallet no longer exists')
    }
    await this.audit.record({
      actorId: actor.id,
      action: 'invitation.accept',
      entityType: invitation.kind,
      entityId: invitation.targetId,
    })
    return { kind: invitation.kind, targetId: invitation.targetId }
  }

  /** The invited person declines, or the inviter (or an admin) cancels. */
  async remove(actor: SessionUser, id: string, canManage?: (targetId: string) => Promise<boolean>) {
    const invitation = await this.invitations.find(id)
    if (!invitation) throw notFound('Invitation')
    const allowed =
      invitation.userId === actor.id ||
      invitation.invitedBy === actor.id ||
      isAdmin(actor) ||
      (canManage ? await canManage(invitation.targetId) : false)
    if (!allowed) throw forbidden('Not your invitation')
    await this.invitations.delete(id)
    await this.audit.record({
      actorId: actor.id,
      action: invitation.userId === actor.id ? 'invitation.decline' : 'invitation.cancel',
      entityType: invitation.kind,
      entityId: invitation.targetId,
      data: { userId: invitation.userId },
    })
  }

  /** Guards input shape shared by both callers. */
  static checkRole(kind: InvitationKind, role: string): string {
    if (kind === 'ledger') return 'member'
    if (role !== 'editor' && role !== 'viewer') throw validationFailed({ role: 'editor or viewer' })
    return role
  }
}
