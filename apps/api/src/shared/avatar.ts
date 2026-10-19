/**
 * Public-in-app URL of a user's picture: the uploaded one (served by the API
 * after a sign-in check, cache-busted by its key) or the Google profile photo.
 */
export function avatarUrl(user: {
  id: string
  image: string | null
  avatarKey?: string | null
}): string | null {
  if (user.avatarKey) {
    const version = user.avatarKey.split('/').pop()?.split('.')[0] ?? ''
    return `/api/users/${encodeURIComponent(user.id)}/avatar?v=${version}`
  }
  return user.image
}

export const AVATAR_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const
/** The browser shrinks to 400 px first, so real uploads are far below this. */
export const AVATAR_MAX_BYTES = 512 * 1024
