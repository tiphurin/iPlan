import { randomBytes } from 'node:crypto'
import { type CalendarFeedDto, UserRole } from '@iplan/contracts'
import type { SessionUser } from '../../shared/context'
import { notFound } from '../../shared/errors'
import type { AccessService } from '../access/access.service'
import type { BackupService } from '../backup/backup.service'
import type { TripAccess } from '../trips/trips.service'
import type { CalendarFeedsRepository } from './calendar.repository'

/**
 * Calendar subscriptions: each member gets a secret link per trip that calendar
 * apps poll, so later plan changes show up on their own.
 */
export class CalendarService {
  constructor(
    private readonly feeds: CalendarFeedsRepository,
    private readonly trips: TripAccess,
    private readonly backup: Pick<BackupService, 'calendar'>,
    private readonly access: Pick<AccessService, 'featuresFor'>,
    private readonly appUrl: string,
    private readonly newToken: () => string = () => randomBytes(24).toString('base64url'),
  ) {}

  /** `origin` is where the app was opened (LAN address in development, https in production). */
  private links(token: string, origin?: string): CalendarFeedDto {
    const url = `${origin ?? this.appUrl}/api/calendar/${token}.ics`
    const webcalUrl = url.replace(/^https?:/, 'webcal:')
    return {
      url,
      webcalUrl,
      googleUrl: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`,
    }
  }

  async link(actor: SessionUser, tripId: string, origin?: string): Promise<CalendarFeedDto> {
    await this.trips.requireAccess(actor, tripId, 'viewer')
    let token = await this.feeds.tokenFor(actor.id, tripId)
    if (!token) {
      token = this.newToken()
      await this.feeds.save(actor.id, tripId, token)
    }
    return this.links(token, origin)
  }

  /** New secret; the old link stops working. */
  async rotate(actor: SessionUser, tripId: string, origin?: string): Promise<CalendarFeedDto> {
    await this.trips.requireAccess(actor, tripId, 'viewer')
    const token = this.newToken()
    await this.feeds.save(actor.id, tripId, token)
    return this.links(token, origin)
  }

  /**
   * What a calendar app downloads. Stops once the person leaves the trip, is suspended,
   * goes back to the waiting list or loses the trips feature.
   */
  async ics(token: string): Promise<{ name: string; ics: string }> {
    const feed = await this.feeds.find(token)
    if (!feed || feed.banned || feed.status !== 'active') throw notFound('Calendar')
    const owner: SessionUser = {
      id: feed.userId,
      name: '',
      email: '',
      role: UserRole.catch('user').parse(feed.role),
    }
    const features = await this.access.featuresFor({ ...owner, status: 'active' })
    if (!features.includes('trips')) throw notFound('Calendar')
    return this.backup.calendar(owner, feed.tripId)
  }
}
