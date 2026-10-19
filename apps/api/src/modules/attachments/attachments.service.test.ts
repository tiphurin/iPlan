import { describe, expect, it } from 'vitest'
import { InMemoryAttachments, MemoryStorage, seededTrip, users } from '../../testing/fakes'
import { AttachmentsService, sniffType } from './attachments.service'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const EXPENSE = '00000000-0000-4000-8000-0000000000ee'
const TRANSACTION = '00000000-0000-4000-8000-0000000000ff'

async function setup() {
  const { tripId, trips, audit } = await seededTrip()
  const repo = new InMemoryAttachments()
  repo.entities.set(EXPENSE, { tripId })
  repo.entities.set(TRANSACTION, { ownerId: 'owner' })
  const storage = new MemoryStorage()
  return { tripId, storage, service: new AttachmentsService(repo, storage, trips, audit) }
}

const upload = (bytes: Uint8Array, contentType = 'image/jpeg') => ({
  entityType: 'expense' as const,
  entityId: EXPENSE,
  kind: 'slip' as const,
  file: { bytes, contentType },
})

describe('sniffType', () => {
  it('recognises files by their bytes, not their name', () => {
    expect(sniffType(JPEG)).toBe('image/jpeg')
    expect(sniffType(PDF)).toBe('application/pdf')
    expect(sniffType(WEBP)).toBe('image/webp')
    expect(sniffType(new TextEncoder().encode('<script>'))).toBeNull()
  })
})

describe('AttachmentsService', () => {
  it('stores files under the trip and serves them only to members', async () => {
    const { tripId, storage, service } = await setup()
    const saved = await service.upload(users.editor, {
      ...upload(JPEG),
      thumb: { bytes: WEBP, contentType: 'image/webp' },
    })
    expect(saved).toMatchObject({
      kind: 'slip',
      contentType: 'image/jpeg',
      url: `/api/attachments/${saved.id}/file`,
    })
    expect([...storage.files.keys()].every((k) => k.startsWith(`trips/${tripId}/`))).toBe(true)
    expect(await service.file(users.viewer, saved.id, true)).toMatchObject({
      contentType: 'image/webp',
    })
    await expect(service.file(users.stranger, saved.id, false)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(await service.list(users.viewer, 'expense', EXPENSE)).toHaveLength(1)
  })

  it('rejects fake or oversized files and viewers', async () => {
    const { service } = await setup()
    await expect(
      service.upload(users.owner, upload(new TextEncoder().encode('<html>'), 'image/jpeg')),
    ).rejects.toMatchObject({ fields: { file: expect.stringContaining('JPEG') } })
    await expect(
      service.upload(users.owner, upload(new Uint8Array(6 * 1024 * 1024))),
    ).rejects.toMatchObject({
      fields: { file: expect.stringContaining('5 MB') },
    })
    await expect(service.upload(users.viewer, upload(JPEG))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('deletes the stored bytes with the record', async () => {
    const { storage, service } = await setup()
    const saved = await service.upload(users.owner, upload(PDF, 'application/pdf'))
    await service.remove(users.editor, saved.id)
    expect(storage.files.size).toBe(0)
    await expect(service.file(users.owner, saved.id, false)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('keeps personal finance slips private to their owner', async () => {
    const { storage, service } = await setup()
    const saved = await service.upload(users.owner, {
      ...upload(JPEG),
      entityType: 'transaction',
      entityId: TRANSACTION,
    })
    expect([...storage.files.keys()][0]).toMatch(/^users\/owner\//)
    expect(await service.file(users.owner, saved.id, false)).toMatchObject({
      contentType: 'image/jpeg',
    })
    await expect(service.file(users.editor, saved.id, false)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      service.upload(users.editor, {
        ...upload(JPEG),
        entityType: 'transaction',
        entityId: TRANSACTION,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
