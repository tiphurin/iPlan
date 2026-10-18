import { z } from 'zod'

/** Suggested groups; any short key is accepted so trips can add their own. */
export const CHECKLIST_GROUPS = [
  'documents',
  'bookings',
  'money',
  'packing',
  'clothes',
  'airport',
  'daily',
  'return',
] as const

const GroupKey = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9-]+$/)

export const ChecklistTickDto = z.object({
  userId: z.string(),
  name: z.string(),
  tickedAt: z.iso.datetime(),
})

export const ChecklistItemDto = z.object({
  id: z.uuid(),
  groupKey: z.string(),
  title: z.string(),
  sortOrder: z.number().int(),
  ticks: z.array(ChecklistTickDto),
})
export type ChecklistItemDto = z.infer<typeof ChecklistItemDto>

export const CreateChecklistItemInput = z.object({
  groupKey: GroupKey,
  title: z.string().trim().min(1).max(200),
})
export type CreateChecklistItemInput = z.infer<typeof CreateChecklistItemInput>

export const UpdateChecklistItemInput = CreateChecklistItemInput.partial()
export type UpdateChecklistItemInput = z.infer<typeof UpdateChecklistItemInput>

export const InfoCardKind = z.enum([
  'flight',
  'hotel',
  'health',
  'lounge',
  'emergency',
  'tip',
  'other',
])
export type InfoCardKind = z.infer<typeof InfoCardKind>

export const InfoCardDto = z.object({
  id: z.uuid(),
  kind: InfoCardKind,
  title: z.string(),
  body: z.string(),
  sortOrder: z.number().int(),
  updatedAt: z.iso.datetime(),
})
export type InfoCardDto = z.infer<typeof InfoCardDto>

export const CreateInfoCardInput = z.object({
  kind: InfoCardKind,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(4000).default(''),
})
export type CreateInfoCardInput = z.infer<typeof CreateInfoCardInput>

export const UpdateInfoCardInput = CreateInfoCardInput.partial()
export type UpdateInfoCardInput = z.infer<typeof UpdateInfoCardInput>
