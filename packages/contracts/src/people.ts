import { z } from 'zod'

/** Someone you can invite: shares a circle with you (admins can find everyone). */
export const PersonDto = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string().nullable(),
  email: z.string(),
  image: z.string().nullable(),
})
export type PersonDto = z.infer<typeof PersonDto>

/** Empty `q` lists everyone you can find (your circles), up to 20. */
export const PeopleQuery = z.object({ q: z.string().trim().max(80).default('') })
