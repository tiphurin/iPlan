import type { FeatureKey } from '@iplan/contracts'
import { redirect } from 'next/navigation'
import { getMe } from './server-api'

/** Server-side page guard; the API enforces the same rule on every request. */
export async function requireFeature(feature: FeatureKey): Promise<void> {
  const me = await getMe()
  if (!me) redirect('/login')
  if (!me.features.includes(feature)) redirect('/')
}
