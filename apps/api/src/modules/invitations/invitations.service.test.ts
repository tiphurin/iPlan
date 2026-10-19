import { describe, expect, it } from 'vitest'
import {
  FakeAudit,
  InMemoryAccess,
  InMemoryInvitations,
  InMemoryPeople,
  InMemoryTrips,
  users,
} from '../../testing/fakes'
import { AccessService } from '../access/access.service'
import { TripsService } from '../trips/trips.service'
import { InvitationsService } from './invitations.service'

async function setup() {
  const audit = new FakeAudit()
  const tripRepo = new InMemoryTrips()
  const trips = new TripsService(tripRepo, audit)
  const trip = await trips.create(users.owner, {
    name: 'Seoul',
    startDate: '2026-10-22',
    endDate: '2026-10-27',
    homeTimeZone: 'Asia/Bangkok',
    baseCurrency: 'THB',
  })
  const accessRepo = new InMemoryAccess()
  const service = new InvitationsService(
    new InMemoryInvitations(tripRepo),
    new InMemoryPeople(accessRepo),
    new AccessService(accessRepo, audit),
    audit,
  )
  const target = { kind: 'trip' as const, id: trip.id, name: 'Seoul', memberIds: ['owner'] }
  return { accessRepo, service, target, trips, tripId: trip.id }
}

describe('InvitationsService', () => {
  it('only invites people who share a circle; admins invite anyone', async () => {
    const { accessRepo, service, target } = await setup()
    await expect(service.invite(users.owner, target, 'editor', 'editor')).rejects.toMatchObject({
      code: 'NOT_IN_CIRCLE',
      status: 403,
    })
    const family = await accessRepo.createCircle('Family')
    await accessRepo.setUserCircles('owner', [family])
    await accessRepo.setUserCircles('editor', [family])
    expect(await service.invite(users.owner, target, 'editor', 'editor')).toHaveLength(1)
    // viewer is in no circle with owner
    await expect(service.invite(users.owner, target, 'viewer', 'viewer')).rejects.toMatchObject({
      code: 'NOT_IN_CIRCLE',
    })
    const admin = { ...users.owner, role: 'admin' as const }
    expect(await service.invite(admin, target, 'viewer', 'viewer')).toHaveLength(2)
    // Unknown or pending people still read as not found, before the circle check.
    await expect(service.invite(users.owner, target, 'stranger', 'viewer')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    })
  })

  it('reports an invitation to a deleted trip as gone and drops it', async () => {
    const { service, target, trips, tripId } = await setup()
    const admin = { ...users.owner, role: 'admin' as const }
    await service.invite(admin, target, 'editor', 'editor')
    const [invite] = await service.mine(users.editor)
    if (!invite) throw new Error('no invite')
    await trips.remove(users.owner, tripId)
    await expect(service.accept(users.editor, invite.id)).rejects.toMatchObject({
      code: 'INVITATION_GONE',
      status: 410,
    })
    await expect(service.accept(users.editor, invite.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
