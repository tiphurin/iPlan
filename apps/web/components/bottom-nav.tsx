'use client'

import type { FeatureKey } from '@iplan/contracts'
import { House, Shield, UserRound } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FEATURES, featureFor } from '@/features'
import { cn } from '@/lib/cn'
import { LanguageToggle } from './language-toggle'
import { LogoMark } from '@/components/logo'

/** Phones fit five tabs; with more, Admin stays reachable from the profile tab. */
const MAX_MOBILE_TABS = 5

function useTabs(features: readonly FeatureKey[], isAdmin: boolean) {
  const pathname = usePathname()
  const t = useTranslations()
  const current = featureFor(pathname)?.key
  const tabs = [
    { key: 'home', href: '/' as Route, icon: House, label: t('nav.home'), color: 'var(--l2)' },
    ...features.map((key) => {
      const f = FEATURES[key]
      return {
        key,
        href: f.href,
        icon: f.icon,
        label: t(`features.${f.label}Short`),
        color: f.color,
      }
    }),
    ...(isAdmin
      ? [
          {
            key: 'admin',
            href: '/admin' as Route,
            icon: Shield,
            label: t('nav.admin'),
            color: 'var(--l1)',
          },
        ]
      : []),
    {
      key: 'profile',
      href: '/profile' as Route,
      icon: UserRound,
      label: t('nav.profile'),
      color: 'var(--l2)',
    },
  ]
  const isActive = (key: string, href: string) =>
    key === current || (!current && (href === '/' ? pathname === '/' : pathname.startsWith(href)))
  return { tabs, isActive, label: t('nav.main') }
}

/**
 * Home, one tab per granted feature, then the profile. A bottom tab bar on
 * phones; a left sidebar from the md breakpoint (tablets and desktop browsers).
 */
export function AppNav({
  features,
  isAdmin,
}: {
  features: readonly FeatureKey[]
  isAdmin: boolean
}) {
  const { tabs, isActive, label } = useTabs(features, isAdmin)
  const mobileTabs =
    tabs.length > MAX_MOBILE_TABS ? tabs.filter((tab) => tab.key !== 'admin') : tabs
  return (
    <>
      <nav
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card px-1.5 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] md:hidden"
      >
        <ul
          className="mx-auto grid max-w-xl"
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0, 1fr))` }}
        >
          {mobileTabs.map(({ key, href, icon: Icon, label: text, color }) => {
            const on = isActive(key, href)
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs',
                    on ? 'font-semibold text-foreground' : 'text-faint',
                  )}
                >
                  <Icon
                    aria-hidden
                    className="size-[25px]"
                    strokeWidth={on ? 2.3 : 1.8}
                    style={on ? { color } : undefined}
                  />
                  {text}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <nav
        aria-label={label}
        className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r bg-card px-2 py-5 md:flex lg:w-60 lg:px-4"
      >
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 font-display text-[22px] font-bold lg:justify-start lg:px-2"
        >
          <LogoMark size={32} />
          <span className="hidden lg:inline">iPlan</span>
        </Link>
        <ul className="space-y-1">
          {tabs.map(({ key, href, icon: Icon, label: text, color }) => {
            const on = isActive(key, href)
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  title={text}
                  className={cn(
                    'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-[15px]',
                    on
                      ? 'bg-muted font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon
                    aria-hidden
                    className="size-6 shrink-0"
                    strokeWidth={on ? 2.3 : 1.8}
                    style={on ? { color } : undefined}
                  />
                  <span className="lg:hidden">{text}</span>
                  <span className="hidden lg:inline">{text}</span>
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="mt-auto flex justify-center lg:justify-start lg:px-2">
          <LanguageToggle className="flex-col lg:flex-row" />
        </div>
      </nav>
    </>
  )
}
