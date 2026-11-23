'use client'

import type { TripDetailDto } from '@iplan/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, ImagePlus, LoaderCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { Viewer } from '@/components/attachments'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { confirmDialog } from '@/lib/confirm'
import { prepareCover } from '@/lib/image'
import { removeTripCover, tripKeys, uploadTripCover } from '@/lib/trips'

/**
 * The trip's cover at the top of its plan: tap to see it whole (zoom, share,
 * remove), "Change cover" to pick a new one and check it before saving.
 * Without a cover, editors get a small "Add a cover photo" button.
 */
export function CoverBanner({ trip }: { trip: TripDetailDto }) {
  const t = useTranslations('cover')
  const client = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const canEdit = trip.role !== 'viewer'
  const [viewing, setViewing] = useState(false)
  const [picked, setPicked] = useState<{ full: Blob; small: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => client.invalidateQueries({ queryKey: tripKeys.all })

  async function pick(file: File) {
    setError(null)
    try {
      const { full, small } = await prepareCover(file)
      setPicked({ full, small, url: URL.createObjectURL(full) })
    } catch {
      setError(t('unreadable'))
    }
  }
  function closePicked() {
    if (picked) URL.revokeObjectURL(picked.url)
    setPicked(null)
  }
  async function save() {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      await uploadTripCover(trip.id, picked.full, picked.small)
      await refresh()
      closePicked()
    } catch {
      setError(t('failed'))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!(await confirmDialog(t('removeConfirm'), { danger: true }))) return
    await removeTripCover(trip.id)
    setViewing(false)
    await refresh()
  }

  if (!trip.coverUrl && !canEdit) return null

  return (
    <>
      {trip.coverUrl ? (
        <div className="relative h-36 overflow-hidden rounded-2xl bg-muted md:h-48">
          <button
            type="button"
            onClick={() => setViewing(true)}
            aria-label={t('view')}
            className="block size-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- permission-checked API image */}
            <img src={trip.coverUrl} alt="" decoding="async" className="size-full object-cover" />
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="absolute right-2 bottom-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-black/55 px-3 text-sm font-medium text-white backdrop-blur"
            >
              <Camera aria-hidden className="size-4" />
              {t('change')}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm text-muted-foreground"
        >
          <ImagePlus aria-hidden className="size-4" />
          {t('add')}
        </button>
      )}
      {error && !picked && (
        <p role="alert" className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void pick(file)
        }}
      />

      {/* Check the new cover before it replaces the old one. */}
      <Sheet
        open={picked !== null}
        onClose={() => !busy && closePicked()}
        title={t('confirmTitle')}
      >
        {picked && (
          <div className="space-y-4">
            <div className="h-40 overflow-hidden rounded-2xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={picked.url} alt="" className="size-full object-cover" />
            </div>
            {error && (
              <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <Button variant="secondary" disabled={busy} onClick={closePicked}>
                {t('cancel')}
              </Button>
              <Button disabled={busy} onClick={save}>
                {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                {t('save')}
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {viewing && trip.coverUrl && (
        <Viewer
          files={[{ id: 'cover', url: trip.coverUrl, contentType: 'image/webp' }]}
          start={0}
          canEdit={canEdit}
          onClose={() => setViewing(false)}
          onDelete={remove}
          deleteLabel={t('remove')}
        />
      )}
    </>
  )
}
