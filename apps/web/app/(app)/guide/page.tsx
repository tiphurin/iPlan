import { isAdminRole } from '@iplan/contracts'
import { ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import {
  ApproveMock,
  CalendarMock,
  LateMock,
  MonthStatusMock,
  SpendMock,
  SwitchMock,
  ToggleMock,
  ChartMock,
  CheckInMock,
  GoogleMock,
  GroupsMock,
  InviteMock,
  MailMock,
  RulesMock,
  SettleMock,
  SlipMock,
  SplitMock,
  TilesMock,
  TimelineMock,
  ViewMock,
  WaitMock,
  WalletMock,
} from '@/components/guide/mocks'
import { PageHeader } from '@/components/page-header'
import { getMe } from '@/lib/server-api'

export const metadata: Metadata = { title: 'How to use' }

interface Flow {
  key: string
  color: string
  steps: { key: string; picture: ReactNode }[]
}

const USER_FLOWS: Flow[] = [
  {
    key: 'start',
    color: 'var(--l2)',
    steps: [
      { key: 'google', picture: <GoogleMock /> },
      { key: 'wait', picture: <WaitMock /> },
      { key: 'home', picture: <TilesMock locked /> },
    ],
  },
  {
    key: 'trips',
    color: 'var(--l2)',
    steps: [
      { key: 'plan', picture: <TimelineMock /> },
      { key: 'invite', picture: <InviteMock /> },
      { key: 'checkin', picture: <CheckInMock /> },
    ],
  },
  {
    key: 'tripDay',
    color: 'var(--l3)',
    steps: [
      { key: 'switch', picture: <SwitchMock /> },
      { key: 'late', picture: <LateMock /> },
      { key: 'toggle', picture: <ToggleMock /> },
      { key: 'spend', picture: <SpendMock /> },
    ],
  },
  {
    key: 'calendar',
    color: 'var(--la)',
    steps: [
      { key: 'subscribe', picture: <CalendarMock /> },
      { key: 'item', picture: <CalendarMock /> },
    ],
  },
  {
    key: 'money',
    color: 'var(--l1)',
    steps: [
      { key: 'rules', picture: <RulesMock /> },
      { key: 'spend', picture: <SlipMock /> },
      { key: 'chart', picture: <ChartMock /> },
    ],
  },
  {
    key: 'wallet',
    color: 'var(--l5)',
    steps: [
      { key: 'create', picture: <WalletMock /> },
      { key: 'invite', picture: <InviteMock /> },
      { key: 'split', picture: <SplitMock /> },
      { key: 'settle', picture: <SettleMock /> },
      { key: 'month', picture: <MonthStatusMock /> },
    ],
  },
]

const ADMIN_FLOWS: Flow[] = [
  {
    key: 'approve',
    color: '#14171d',
    steps: [
      { key: 'mail', picture: <MailMock /> },
      { key: 'pick', picture: <ApproveMock /> },
      { key: 'done', picture: <TilesMock /> },
    ],
  },
  {
    key: 'groups',
    color: '#14171d',
    steps: [
      { key: 'groups', picture: <GroupsMock /> },
      { key: 'view', picture: <ViewMock /> },
    ],
  },
]

/** How to use iPlan, as pictures in steps. Admins also get the admin flows. */
export default async function GuidePage() {
  const [t, me] = await Promise.all([getTranslations('guide'), getMe()])
  const admin = me ? isAdminRole(me.role) : false
  const render = (flows: Flow[], scope: 'user' | 'admin') =>
    flows.map((flow) => (
      <section key={flow.key} className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="size-3 rounded-full" style={{ backgroundColor: flow.color }} />
          {t(`${scope}.${flow.key}.title`)}
        </h2>
        <ol className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 xl:grid-cols-5">
          {flow.steps.map((step, i) => (
            <li key={step.key} className="relative w-[46%] shrink-0 snap-start md:w-auto">
              <div className="space-y-2 rounded-2xl border bg-card p-2.5">
                {step.picture}
                <p className="flex items-start gap-1.5 text-sm leading-snug font-medium">
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: flow.color }}
                  >
                    {i + 1}
                  </span>
                  {t(`${scope}.${flow.key}.${step.key}`)}
                </p>
              </div>
              {i < flow.steps.length - 1 && (
                <ChevronRight
                  aria-hidden
                  className="absolute top-[64px] -right-2.5 z-10 hidden size-5 rounded-full bg-background text-faint md:block"
                />
              )}
            </li>
          ))}
        </ol>
      </section>
    ))
  return (
    <>
      <PageHeader title={t('title')} />
      <div className="space-y-7 px-4">
        {render(USER_FLOWS, 'user')}
        {admin && (
          <div className="space-y-7 rounded-hero border-2 border-dashed p-4">
            <p className="inline-flex rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">
              {t('adminOnly')}
            </p>
            {render(ADMIN_FLOWS, 'admin')}
          </div>
        )}
      </div>
    </>
  )
}
