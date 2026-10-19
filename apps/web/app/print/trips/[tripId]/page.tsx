import { ExpenseSummaryDto } from '@iplan/contracts'
import { type Locale, formatDateRange, formatDayLabel, formatTime } from '@iplan/i18n'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { PrintBar } from '@/components/print-button'
import { loadTrip } from '@/lib/load-trip'
import { fmtServer } from '@/lib/money-format'
import { CATEGORY_COLORS, Donut } from '@/components/charts/donut'
import { getMe, serverApi } from '@/lib/server-api'
import { tripDays } from '@/lib/trip-dates'
import { zoneCity } from '@/lib/time-zones'

export const metadata: Metadata = { title: 'Print' }

/** Print-friendly trip plan and expense summary; the browser saves it as PDF with correct Thai. */
export default async function PrintTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  if (!(await getMe())) redirect(`/login?next=${encodeURIComponent(`/print/trips/${tripId}`)}`)
  const [t, raw, { trip, items }, summary] = await Promise.all([
    getTranslations(),
    getLocale(),
    loadTrip(tripId),
    serverApi(`/api/trips/${tripId}/expenses/summary`, ExpenseSummaryDto),
  ])
  const locale = raw as Locale
  const base = summary.baseCurrency
  const c = (k: string) => t(`export.col.${k}`)
  return (
    <>
      {/* Viewers can't open the edit page, so they go back to the trip. */}
      <PrintBar back={trip.role === 'viewer' ? `/trips/${tripId}` : `/trips/${tripId}/edit`} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 text-[13px] leading-snug">
        <header>
          <h1 className="text-2xl font-bold">{trip.name}</h1>
          <p>
            {formatDateRange(trip.startDate, trip.endDate, { locale })}
            {trip.destination && ` · ${trip.destination}`}
          </p>
        </header>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('export.plan')}</h2>
          {tripDays(trip.startDate, trip.endDate).map((day, index) => {
            const list = items.filter((i) => i.dayDate === day)
            if (list.length === 0) return null
            return (
              <div key={day}>
                <h3 className="mb-1 font-semibold">
                  {t('trips.dayN', { n: index + 1 })} · {formatDayLabel(day, { locale })}
                </h3>
                <table className="w-full border-collapse">
                  <tbody>
                    {list.map((item) => (
                      <tr key={item.id} className="border-b align-top">
                        <td className="w-24 py-1 pr-2 tabular-nums">
                          {formatTime(new Date(item.startsAt), item.timeZone)}
                          {item.endsAt &&
                            `–${formatTime(new Date(item.endsAt), item.details.arrivalTimeZone ?? item.timeZone)}`}
                          <div className="text-[10px] text-muted-foreground">
                            {zoneCity(item.timeZone)}
                          </div>
                        </td>
                        <td className="py-1">
                          <strong>{item.title}</strong>
                          <span className="text-muted-foreground">
                            {' '}
                            · {t(`kinds.${item.kind}`)}
                          </span>
                          {item.details.address && <div>{item.details.address}</div>}
                          {item.notes && (
                            <div className="whitespace-pre-line text-muted-foreground">
                              {item.notes}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {t('expenses.title')} · {fmtServer(summary.totalMinor, base)}
          </h2>
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">{c('name')}</th>
                <th className="py-1 text-right">{c('paid')}</th>
                <th className="py-1 text-right">{c('share')}</th>
                <th className="py-1 text-right">{c('net')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.parties.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-1">{p.id === 'pool' ? t('expenses.form.pool') : p.name}</td>
                  <td className="py-1 text-right">{fmtServer(p.paidMinor, base)}</td>
                  <td className="py-1 text-right">{fmtServer(p.shareMinor, base)}</td>
                  <td className="py-1 text-right">{fmtServer(p.netMinor, base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-6 break-inside-avoid pt-2">
            {summary.byCategory.length > 0 && (
              <Donut
                center={t('expenses.byCategory')}
                slices={summary.byCategory.map((x) => ({
                  key: x.category,
                  label: `${t(`expenses.categories.${x.category}`)} · ${fmtServer(x.spentMinor, base)}`,
                  value: Number(x.spentMinor),
                  color: CATEGORY_COLORS[x.category] ?? '#94a3b8',
                }))}
              />
            )}
            <div className="space-y-1.5">
              <p className="font-semibold">{t('expenses.byDay')}</p>
              {summary.byDay.map((d) => {
                const peak = Math.max(
                  1,
                  ...summary.byDay.map((x) =>
                    Math.max(Number(x.spentMinor), Number(x.budgetMinor ?? 0)),
                  ),
                )
                const over = d.budgetMinor !== null && BigInt(d.spentMinor) > BigInt(d.budgetMinor)
                return (
                  <div key={d.dayDate}>
                    <div className="flex justify-between text-[11px]">
                      <span>{d.dayDate.slice(5)}</span>
                      <span>
                        {fmtServer(d.spentMinor, base)}
                        {d.budgetMinor !== null && ` / ${fmtServer(d.budgetMinor, base)}`}
                      </span>
                    </div>
                    <div className="h-2 rounded bg-[#eee]">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${(Number(d.spentMinor) / peak) * 100}%`,
                          backgroundColor: over ? '#d6453d' : '#00a84d',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {summary.transfers.map((tr) => (
            <p key={`${tr.from}-${tr.to}`}>
              {tr.from === 'pool' ? t('expenses.form.pool') : tr.fromName} →{' '}
              {tr.to === 'pool' ? t('expenses.form.pool') : tr.toName}:{' '}
              <strong>{fmtServer(tr.amountMinor, base)}</strong>
            </p>
          ))}
        </section>
      </main>
    </>
  )
}
