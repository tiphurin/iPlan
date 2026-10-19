import type { FeatureKey } from '@iplan/contracts'
import { HandCoins, type LucideIcon, Map as MapIcon, Wallet } from 'lucide-react'
import type { Route } from 'next'

/**
 * Everything the app shell needs to know about a feature. To add a feature:
 * add its key to FEATURE_KEYS in @iplan/contracts, a manifest here, a dashboard
 * widget in ./widgets.tsx, and its API paths to FEATURE_PATHS in apps/api.
 */
export interface FeatureManifest {
  key: FeatureKey
  href: Route
  icon: LucideIcon
  /** Message key under "features". */
  label: string
  /** Accent colour (CSS) for its tab icon and dashboard tile. */
  color: string
  /** Other path prefixes that belong to this feature's tab. */
  paths: readonly string[]
}

export const FEATURES: Record<FeatureKey, FeatureManifest> = {
  trips: {
    key: 'trips',
    href: '/trips',
    icon: MapIcon,
    label: 'trips',
    color: 'var(--l2)',
    paths: ['/trips', '/today'],
  },
  finance: {
    key: 'finance',
    href: '/money',
    icon: Wallet,
    label: 'finance',
    color: 'var(--l1)',
    paths: ['/money'],
  },
  shared: {
    key: 'shared',
    href: '/shared',
    icon: HandCoins,
    label: 'shared',
    color: 'var(--l5)',
    paths: ['/shared'],
  },
}

export function featureFor(pathname: string): FeatureManifest | undefined {
  return Object.values(FEATURES).find((f) =>
    f.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
  )
}
