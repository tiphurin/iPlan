import {
  Check,
  Clock,
  Eye,
  Lock,
  Mail,
  Map as MapIcon,
  Receipt,
  Shield,
  UserPlus,
  UsersRound,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'

/** Tiny drawings of real screens, used as the pictures in the how-to guide. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex h-[118px] w-full flex-col justify-center gap-1.5 overflow-hidden rounded-xl border bg-background p-2.5"
    >
      {children}
    </div>
  )
}

const bar = (w: string, c = 'var(--border)') => (
  <span className="block h-2 rounded-full" style={{ width: w, backgroundColor: c }} />
)

export function GoogleMock() {
  return (
    <Frame>
      <div className="mx-auto size-7 rounded-lg bg-[#14171d]" />
      <div className="flex items-center justify-center gap-1.5 rounded-full bg-[#00a84d] py-1.5 text-[10px] font-bold text-white">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-white text-[8px] text-[#4285f4]">
          G
        </span>
        Google
      </div>
    </Frame>
  )
}

export function WaitMock() {
  return (
    <Frame>
      <div className="flex flex-col items-center gap-1 rounded-lg bg-[#1f2a37] py-3 text-white">
        <Clock className="size-6" />
        {bar('50%', 'rgba(255,255,255,.5)')}
      </div>
    </Frame>
  )
}

export function TilesMock({ locked = false }: { locked?: boolean }) {
  const tiles = ['var(--l2)', 'var(--l1)', 'var(--l5)', locked ? 'var(--lw)' : '#14171d']
  return (
    <Frame>
      <div className="grid grid-cols-2 gap-1.5">
        {tiles.map((c, i) => (
          <div key={i} className="flex items-center gap-1 rounded-md border bg-card p-1.5">
            <span className="relative size-4 shrink-0 rounded" style={{ backgroundColor: c }}>
              {locked && i === 3 && <Lock className="absolute -right-1 -bottom-1 size-2.5" />}
            </span>
            {bar('60%')}
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function TimelineMock() {
  return (
    <Frame>
      {['var(--l2)', 'var(--l3)', 'var(--l1)'].map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[9px] text-faint tabular-nums">{9 + i * 2}:00</span>
          <span className="size-3 rounded-full border-[3px] bg-card" style={{ borderColor: c }} />
          <span className="flex-1 rounded-md border bg-card p-1">{bar('70%')}</span>
        </div>
      ))}
    </Frame>
  )
}

export function CheckInMock() {
  return (
    <Frame>
      <div className="rounded-lg bg-[#00a84d] p-2 text-white">
        {bar('60%', 'rgba(255,255,255,.6)')}
        <div className="mt-1.5 h-1.5 rounded-full bg-white/30">
          <div className="h-full w-2/3 rounded-full bg-white" />
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-1 rounded-md bg-white py-1 text-[9px] font-bold text-[#00873e]">
          <Check className="size-3" /> Check-in
        </div>
      </div>
    </Frame>
  )
}

export function RulesMock() {
  return (
    <Frame>
      {(
        [
          ['+', 'var(--success)'],
          ['−', 'var(--warning)'],
          ['−', 'var(--danger)'],
        ] as const
      ).map(([sign, c], i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-md border bg-card px-1.5 py-1"
        >
          {bar('45%')}
          <span className="text-[10px] font-bold" style={{ color: c }}>
            {sign}฿
          </span>
        </div>
      ))}
    </Frame>
  )
}

export function SlipMock() {
  return (
    <Frame>
      <div className="flex items-center gap-2">
        <Receipt className="size-8 text-l1" />
        <div className="flex-1 space-y-1">
          {bar('80%')}
          {bar('50%')}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="h-2.5 rounded-sm"
            style={{ backgroundColor: i === 9 ? '#14171d' : 'var(--muted)' }}
          />
        ))}
      </div>
    </Frame>
  )
}

export function ChartMock() {
  return (
    <Frame>
      <div className="flex h-full items-end justify-around gap-1">
        {[40, 65, 50, 80, 55, 90].map((h, i) => (
          <span key={i} className="flex h-full flex-1 items-end gap-0.5">
            <span className="w-1/2 rounded-sm bg-[#00a84d]" style={{ height: `${h}%` }} />
            <span className="w-1/2 rounded-sm bg-[#ef7c1c]" style={{ height: `${h * 0.7}%` }} />
          </span>
        ))}
      </div>
    </Frame>
  )
}

export function WalletMock() {
  return (
    <Frame>
      <div className="flex items-center gap-1.5 rounded-lg bg-[#996cac] p-2 text-white">
        <Wallet className="size-5" />
        {bar('55%', 'rgba(255,255,255,.6)')}
      </div>
      <div className="flex justify-center -space-x-1.5">
        {['#14171d', '#996cac'].map((c) => (
          <span
            key={c}
            className="size-5 rounded-full border-2 border-card"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </Frame>
  )
}

export function InviteMock() {
  return (
    <Frame>
      <div className="flex items-center gap-1.5 rounded-md border bg-card p-1.5">
        <span className="size-4 rounded-full bg-l5" />
        {bar('45%')}
        <UserPlus className="ml-auto size-3.5 text-primary" />
      </div>
      <div className="flex items-center gap-1 rounded-md border-2 border-[#996cac]/50 bg-card p-1.5">
        {bar('40%')}
        <span className="ml-auto rounded bg-[#00a84d] px-1.5 py-0.5 text-[8px] font-bold text-white">
          ✓
        </span>
      </div>
    </Frame>
  )
}

export function SplitMock() {
  return (
    <Frame>
      <p className="text-center font-display text-base leading-none font-bold">฿2,000</p>
      <div className="flex h-3 overflow-hidden rounded-full">
        <span className="w-3/4 bg-[#14171d]" />
        <span className="w-1/4 bg-[#996cac]" />
      </div>
      <div className="flex justify-between text-[9px] font-semibold">
        <span>1,500</span>
        <span className="text-[#996cac]">500</span>
      </div>
    </Frame>
  )
}

export function SettleMock() {
  return (
    <Frame>
      <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold">
        <span className="size-5 rounded-full bg-[#996cac]" />→
        <span className="size-5 rounded-full bg-[#14171d]" />
        ฿500
      </div>
      <div className="mx-auto flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold">
        <Check className="size-3 text-success" /> Paid
      </div>
    </Frame>
  )
}

export function MailMock() {
  return (
    <Frame>
      <div className="flex items-center gap-2 rounded-md border bg-card p-2">
        <Mail className="size-6 text-l1" />
        <div className="flex-1 space-y-1">
          {bar('70%')}
          {bar('40%')}
        </div>
        <span className="size-2 rounded-full bg-danger" />
      </div>
    </Frame>
  )
}

export function ApproveMock() {
  return (
    <Frame>
      <div className="flex gap-1">
        <span className="flex-1 rounded-full border bg-[#14171d] py-0.5 text-center text-[8px] text-white">
          ✓ Group
        </span>
        <span className="flex-1 rounded-full border bg-card py-0.5 text-center text-[8px]">
          Group
        </span>
      </div>
      <div className="rounded-full bg-[#00a84d] py-1 text-center text-[9px] font-bold text-white">
        ✓
      </div>
    </Frame>
  )
}

export function GroupsMock() {
  return (
    <Frame>
      <div className="flex items-center gap-1.5 rounded-md border bg-card p-1.5">
        <Shield className="size-3.5" />
        <span className="size-3 rounded bg-l2" />
        <span className="size-3 rounded bg-l1" />
        <span className="size-3 rounded bg-lw" />
      </div>
      <div className="flex items-center gap-1.5 rounded-md border bg-card p-1.5">
        <UsersRound className="size-3.5 text-l5" />
        <span className="flex -space-x-1">
          {[1, 2, 3].map((i) => (
            <span key={i} className="size-3.5 rounded-full border border-card bg-l5" />
          ))}
        </span>
      </div>
    </Frame>
  )
}

export function ViewMock() {
  return (
    <Frame>
      <div className="flex items-center gap-1.5">
        <span className="size-6 rounded-full bg-foreground" />
        {bar('45%')}
        <Eye className="ml-auto size-4 text-l1" />
      </div>
      <div className="flex gap-1">
        <span className="flex flex-1 items-center gap-1 rounded-md border bg-card p-1">
          <MapIcon className="size-3 text-l2" />
          {bar('60%')}
        </span>
        <span className="flex flex-1 items-center gap-1 rounded-md border bg-card p-1">
          <Wallet className="size-3 text-l5" />
          {bar('60%')}
        </span>
      </div>
    </Frame>
  )
}

export function SwitchMock() {
  return (
    <Frame>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        <span className="rounded-full bg-foreground py-1 text-center text-[9px] font-bold text-background">
          Plan
        </span>
        <span className="py-1 text-center text-[9px] font-semibold text-muted-foreground">
          Today
        </span>
      </div>
      <div className="flex gap-1">
        {['D1', 'D2', 'D3'].map((d, i) => (
          <span
            key={d}
            className="flex-1 rounded-md border py-1 text-center text-[9px] font-bold"
            style={i === 1 ? { backgroundColor: 'var(--l2)', color: '#fff' } : undefined}
          >
            {d}
          </span>
        ))}
      </div>
    </Frame>
  )
}

export function LateMock() {
  return (
    <Frame>
      <div className="rounded-md border-2 border-[#ef7c1c] bg-[#ef7c1c]/10 px-2 py-1 text-[9px] font-bold text-[#ef7c1c]">
        ⏰ 12:00
      </div>
      <div className="rounded-md bg-[#d6453d] p-1.5 text-white">
        <p className="text-[9px] font-bold">Late 8 min</p>
        <div className="mt-1 grid grid-cols-[1fr_auto] gap-1">
          <span className="rounded bg-white py-0.5 text-center text-[8px] font-bold text-[#d6453d]">
            ✓
          </span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[8px] font-bold">⏭</span>
        </div>
      </div>
    </Frame>
  )
}

export function ToggleMock() {
  return (
    <Frame>
      {[
        ['🕒 KR', '🕒 TH'],
        ['KRW', 'THB'],
      ].map(([a, b]) => (
        <div
          key={a}
          className="mx-auto inline-flex rounded-full border bg-card p-0.5 text-[9px] font-bold"
        >
          <span className="rounded-full bg-foreground px-2 py-0.5 text-background">{a}</span>
          <span className="px-2 py-0.5 text-muted-foreground">{b}</span>
        </div>
      ))}
      <p className="text-center text-[9px] text-faint">₩30,000 (≈ ฿765)</p>
    </Frame>
  )
}

export function CalendarMock() {
  return (
    <Frame>
      <div className="flex items-center gap-1.5 rounded-md border bg-card p-1.5">
        <span className="flex size-5 items-center justify-center rounded bg-[#ff3b30] text-[8px] font-bold text-white">
          19
        </span>
        {bar('50%')}
      </div>
      <div className="flex items-center gap-1.5 rounded-md border bg-card p-1.5">
        <span className="flex size-5 items-center justify-center rounded bg-[#4285f4] text-[8px] font-bold text-white">
          G
        </span>
        {bar('50%')}
      </div>
    </Frame>
  )
}

export function SpendMock() {
  return (
    <Frame>
      <div className="rounded-md border bg-card p-1.5">
        {bar('60%')}
        <div className="mt-1.5 flex justify-between border-t pt-1 text-[8px]">
          <span className="text-faint">Budget</span>
          <span className="font-semibold">₩40,000</span>
        </div>
        <div className="flex justify-between text-[8px]">
          <span className="text-faint">Spent</span>
          <span className="font-semibold">฿736</span>
        </div>
      </div>
    </Frame>
  )
}

export function MonthStatusMock() {
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold">Oct</span>
        <span className="rounded-full bg-la/15 px-1.5 py-0.5 text-[8px] font-bold text-la">½</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 bg-success" />
      </div>
      <p className="rounded bg-warning/12 px-1 py-0.5 text-[8px] font-semibold text-warning">
        → ฿300
      </p>
    </Frame>
  )
}

const badge = (text: string, color: string) => (
  <span
    className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold text-white"
    style={{ backgroundColor: color }}
  >
    {text}
  </span>
)

/** Country → mode → lines (Purple then Blue) → start and end station. */
export function RouteMock() {
  return (
    <Frame>
      <div className="flex gap-1 text-[8px]">
        <span className="rounded-full border border-[#00a84d] bg-[#00a84d]/10 px-1.5 py-0.5 font-bold text-[#00a84d]">
          🇹🇭 ไทย
        </span>
        <span className="rounded-full border px-1.5 py-0.5">🇰🇷</span>
        <span className="rounded-full border px-1.5 py-0.5">🇯🇵</span>
      </div>
      <div className="flex items-center gap-1">
        {badge('PP', '#6c2c8d')}
        <span className="text-[8px] text-faint">›</span>
        {badge('BL', '#1d4f9c')}
      </div>
      <div className="grid grid-cols-2 gap-1 text-[8px]">
        <span className="truncate rounded-md border px-1 py-0.5">คลองบางไผ่</span>
        <span className="truncate rounded-md border px-1 py-0.5">สามย่าน</span>
      </div>
    </Frame>
  )
}

/** "The end moved +30 min · move the next 2 too?" */
export function ShiftMock() {
  return (
    <Frame>
      <div className="space-y-1 rounded-lg border bg-card p-1.5">
        <p className="text-[8px] font-bold">+30 นาที · เลื่อนรายการที่ตามมา?</p>
        {bar('80%')}
        <div className="grid grid-cols-2 gap-1">
          <span className="rounded-md border py-0.5 text-center text-[8px]">ไม่เลื่อน</span>
          <span className="rounded-md bg-[#00a84d] py-0.5 text-center text-[8px] font-bold text-white">
            เลื่อน 2
          </span>
        </div>
      </div>
      <p className="flex items-center gap-1 text-[8px] text-[#ef7c1c]">
        <Lock className="size-2.5" /> เวลาตายตัว ไม่ขยับ
      </p>
    </Frame>
  )
}

/** Who put what into the pool, and who pays in or gets back. */
export function PoolMock() {
  return (
    <Frame>
      <p className="text-[8px] font-bold">กองกลาง · เหลือ ฿2,000</p>
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-[8px]">
          <span className="w-6">A</span>
          {bar('58%', 'var(--l2)')}
          <span>58%</span>
        </div>
        <div className="flex items-center gap-1 text-[8px]">
          <span className="w-6">B</span>
          {bar('42%', 'var(--la)')}
          <span>42%</span>
        </div>
      </div>
      {/* Settling: what each person pays into or gets back from the pool. */}
      <div className="space-y-0.5 text-[7px]">
        <div className="flex justify-between rounded bg-danger/10 px-1 py-0.5">
          <span>C · เข้ากองกลาง</span>
          <span className="font-bold">฿600</span>
        </div>
        <div className="flex justify-between rounded bg-success/10 px-1 py-0.5">
          <span>A · คืนจากกองกลาง</span>
          <span className="font-bold">฿2,400</span>
        </div>
      </div>
    </Frame>
  )
}

/** Equal / amount / % / no split. */
export function NoSplitMock() {
  return (
    <Frame>
      <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-muted p-0.5 text-center text-[7px]">
        <span className="py-1">เท่ากัน</span>
        <span className="py-1">จำนวน</span>
        <span className="py-1">%</span>
        <span className="rounded-md bg-card py-1 font-bold">ไม่หาร</span>
      </div>
      <p className="text-[8px] text-muted-foreground">คนจ่ายรับไปทั้งหมด ไม่มีใครติดเงิน</p>
    </Frame>
  )
}

/** A photo (or colour) as the trip cover. */
export function CoverMock() {
  return (
    <Frame>
      <div className="relative flex h-14 flex-col justify-end overflow-hidden rounded-lg bg-[linear-gradient(135deg,#22c46a,#0090d2)] p-1.5 text-white">
        <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/50" />
        <span className="relative text-[9px] font-bold">Seoul 2026</span>
      </div>
      <div className="flex gap-1">
        {['#00a84d', '#0090d2', '#996cac', '#d6453d'].map((c) => (
          <span key={c} className="size-3 rounded-full" style={{ backgroundColor: c }} />
        ))}
        <span className="size-3 rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
      </div>
    </Frame>
  )
}

/** Excel / CSV / PDF buttons. */
export function ExportMock() {
  return (
    <Frame>
      <div className="flex flex-wrap gap-1 text-[8px] font-bold">
        {['Excel', 'CSV', 'PDF'].map((x) => (
          <span key={x} className="rounded-full border px-2 py-1">
            {x}
          </span>
        ))}
      </div>
      {/* Language and currency choices: the same symbols in both UI languages. */}
      <div className="flex gap-1 text-[8px] font-semibold text-muted-foreground">
        {['TH | EN', '฿ | ₩'].map((x) => (
          <span key={x} className="rounded-full bg-muted px-2 py-1">
            {x}
          </span>
        ))}
      </div>
    </Frame>
  )
}
