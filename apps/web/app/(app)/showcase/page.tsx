import { isAdminRole } from '@iplan/contracts'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Image,
  Info,
  type LucideIcon,
  MapPin,
  Palette,
  Receipt,
  Shield,
  Users,
  Wallet,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { getMe } from '@/lib/server-api'

/** The seeded "Seoul (demo)" trip (packages/db/src/demo.ts). */
const DEMO = '/trips/00000000-0000-4000-8000-000000000001'

const FEATURES: { key: string; icon: LucideIcon; href: string; admin?: true }[] = [
  { key: 'today', icon: Clock, href: `${DEMO}/today` },
  { key: 'plan', icon: CalendarDays, href: DEMO },
  { key: 'item', icon: MapPin, href: DEMO },
  { key: 'members', icon: Users, href: `${DEMO}/members` },
  { key: 'checklist', icon: ClipboardList, href: `${DEMO}/checklist` },
  { key: 'info', icon: Info, href: `${DEMO}/info` },
  { key: 'expenses', icon: Receipt, href: `${DEMO}/expenses` },
  { key: 'slips', icon: Image, href: `${DEMO}/expenses` },
  { key: 'money', icon: Wallet, href: '/money' },
  { key: 'trend', icon: BarChart3, href: '/' },
  {
    key: 'exports',
    icon: FileSpreadsheet,
    href: `/print/trips/00000000-0000-4000-8000-000000000001`,
  },
  { key: 'calendar', icon: CalendarDays, href: `${DEMO}/edit` },
  { key: 'admin', icon: Shield, href: '/admin', admin: true },
  { key: 'settings', icon: Palette, href: '/settings' },
  { key: 'api', icon: BookOpen, href: '/api/docs' },
]

/** One page that links to every feature, using the demo data from `yarn db:seed`. */
export default async function ShowcasePage() {
  const [t, me] = await Promise.all([getTranslations('showcase'), getMe()])
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ul className="grid gap-3 px-4 sm:grid-cols-2">
        {FEATURES.filter((f) => !f.admin || (me ? isAdminRole(me.role) : false)).map(
          ({ key, icon: Icon, href }) => (
            <li key={key}>
              <Link href={href as Route} className="block h-full active:opacity-80">
                <Card className="flex h-full gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon aria-hidden className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{t(`items.${key}.title`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`items.${key}.body`)}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ),
        )}
      </ul>
    </>
  )
}
