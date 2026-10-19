import type { ReactNode } from 'react'
import { requireFeature } from '@/lib/require-feature'

export default async function FeatureLayout({ children }: { children: ReactNode }) {
  await requireFeature('finance')
  return children
}
