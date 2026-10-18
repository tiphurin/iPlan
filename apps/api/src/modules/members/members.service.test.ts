import { beforeEach, describe, expect, it } from 'vitest'
import { FakeAudit, InMemoryMembers, InMemoryTrips, users } from '../../testing/fakes'
import { TripsService } from '../trips/trips.service'
import { MembersService } from './members.service'

describe('MembersService', () => {
  let trips: InMemoryTrips
  let tripService: TripsService
  let service: MembersService
  let tripId: string
  let tokens = 0
  const now = new Date('2026-10-18T00:00:00Z')

  beforeEach(async () => {
    trips = new InMemoryTrips()
    const audit = new FakeAudit()
    tripService = new TripsService(trips, audit)
    tripId = (
      await tripService.create(users.owner, {
        name: 'Seoul',
        startDate: '2026-10-22',
        endDate: '2026-10-27',
        homeTimeZone: 'Asia/Bangkok',
        baseCurrency: 'THB',
      })
    ).id
    trips.addMember(tripId, 'editor', 'editor')
    trips.addMember(tripId, 'viewer', 'viewer')
    service = new MembersService(
      new InMemoryMembers(trips),
      tripService,
      audit,
      () => `token-${++tokens}-abcdefgh`,
    )
  })

  it('lets a stranger join with a link and lands them with the link role', async () => {
    const invite = await service.createInvite(
      users.editor,
      tripId,
      { role: 'viewer', expiresInDays: 7 },
      now,
    )
    const preview = await service.preview(users.stranger, invite.token, now)
    expect(preview).toMatchObject({
      tripName: 'Seoul',
      role: 'viewer',
      currentRole: null,
      invitedBy: 'Editor',
    })
    expect(await service.accept(users.stranger, invite.token, now)).toEqual({
      tripId,
      role: 'viewer',
    })
    expect((await tripService.get(users.stranger, tripId)).role).toBe('viewer')
    expect((await service.listInvites(users.owner, tripId, now))[0]?.useCount).toBe(1)
  })

  it('upgrades but never downgrades an existing member', async () => {
    const editorLink = await service.createInvite(
      users.owner,
      tripId,
      { role: 'editor', expiresInDays: 7 },
      now,
    )
    const viewerLink = await service.createInvite(
      users.owner,
      tripId,
      { role: 'viewer', expiresInDays: 7 },
      now,
    )
    expect(await service.accept(users.viewer, editorLink.token, now)).toMatchObject({
      role: 'editor',
    })
    expect(await service.accept(users.editor, viewerLink.token, now)).toMatchObject({
      role: 'editor',
    })
    expect(await service.accept(users.owner, editorLink.token, now)).toMatchObject({
      role: 'owner',
    })
  })

  it('refuses expired and revoked links', async () => {
    const invite = await service.createInvite(
      users.owner,
      tripId,
      { role: 'editor', expiresInDays: 1 },
      now,
    )
    const later = new Date(now.getTime() + 2 * 86_400_000)
    await expect(service.accept(users.stranger, invite.token, later)).rejects.toMatchObject({
      code: 'INVITE_INVALID',
      status: 410,
    })
    await service.revokeInvite(users.editor, invite.id, now)
    await expect(service.preview(users.stranger, invite.token, now)).rejects.toMatchObject({
      code: 'INVITE_INVALID',
    })
    await expect(service.preview(users.stranger, 'no-such-token', now)).rejects.toMatchObject({
      code: 'INVITE_INVALID',
    })
  })

  it('only lets editors and owners manage links', async () => {
    await expect(
      service.createInvite(users.viewer, tripId, { role: 'viewer', expiresInDays: 7 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.listInvites(users.stranger, tripId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('lets only the owner change roles or remove people', async () => {
    await service.updateRole(users.owner, tripId, 'viewer', 'editor')
    expect((await tripService.get(users.viewer, tripId)).role).toBe('editor')
    await expect(
      service.updateRole(users.editor, tripId, 'viewer', 'viewer'),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(service.updateRole(users.owner, tripId, 'owner', 'viewer')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(service.remove(users.editor, tripId, 'viewer')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await service.remove(users.owner, tripId, 'viewer')
    await expect(tripService.get(users.viewer, tripId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('lets members leave but not the owner', async () => {
    await service.remove(users.editor, tripId, 'editor')
    await expect(tripService.get(users.editor, tripId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.remove(users.owner, tripId, 'owner')).rejects.toMatchObject({
      code: 'OWNER_CANNOT_LEAVE',
    })
  })
})
