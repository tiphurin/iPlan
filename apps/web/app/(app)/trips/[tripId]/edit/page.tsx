import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { BackLink } from '@/components/back-link'
import { PageHeader } from '@/components/page-header'
import { TripForm } from '@/components/trips/trip-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { CalendarPlus, Download, FileText } from 'lucide-react'
import { loadTrip } from '@/lib/load-trip'

export default async function EditTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const [t, { trip }] = await Promise.all([getTranslations(), loadTrip(tripId)])
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackLink href={`/trips/${tripId}` as Route} label={trip.name} />
      </div>
      <PageHeader title={t('trips.editTrip')} />
      <TripForm trip={trip} />
      <section className="mt-8 px-4">
        <SectionTitle>{t('backup.title')}</SectionTitle>
        <Card className="space-y-2">
          <a
            href={`/api/trips/${tripId}/calendar.ics`}
            className={buttonVariants({ variant: 'secondary', size: 'lg' })}
          >
            <CalendarPlus aria-hidden className="size-4" />
            {t('backup.calendar')}
          </a>
          <p className="text-center text-xs text-muted-foreground">{t('backup.calendarHint')}</p>
          <a
            href={`/print/trips/${tripId}`}
            className={buttonVariants({ variant: 'secondary', size: 'lg' })}
          >
            <FileText aria-hidden className="size-4" />
            {t('export.printPlan')}
          </a>
          <a
            href={`/api/trips/${tripId}/backup.json`}
            download
            className={buttonVariants({ variant: 'secondary', size: 'lg' })}
          >
            <Download aria-hidden className="size-4" />
            {t('backup.download')}
          </a>
        </Card>
      </section>
    </>
  )
}
