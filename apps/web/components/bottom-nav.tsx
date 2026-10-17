'use client'

import { Clock, Map, Settings, Wallet } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'

const TABS = [
  { href: '/', key: 'trips', icon: Map },
  { href: '/today', key: 'today', icon: Clock },
  { href: '/money', key: 'money', icon: Wallet },
  { href: '/settings', key: 'settings', icon: Settings },
] as const satisfies readonly { href: Route; key: string; icon: unknown }[]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/trips')
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('nav')
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                {t(key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
