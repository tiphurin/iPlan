'use client'

import { AttachmentDto, type AttachmentEntity } from '@iplan/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  ImagePlus,
  LoaderCircle,
  Share,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type CSSProperties, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { z } from 'zod'
import { Button, buttonVariants } from '@/components/ui/button'
import { SectionTitle } from '@/components/ui/card'
import { Sheet } from '@/components/ui/sheet'
import { apiFetch } from '@/lib/api-client'
import { ApiError, toApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { confirmDialog } from '@/lib/confirm'
import { canShareFile, isStandaloneApp, shareFile } from '@/lib/deliver-file'
import { type UploadKind, prepareUpload } from '@/lib/image'

const key = (entityType: string, entityId: string) => ['attachments', entityType, entityId] as const

async function uploadOne(
  file: File,
  entityType: AttachmentEntity,
  entityId: string,
  kind: UploadKind,
) {
  const prepared = await prepareUpload(file, kind)
  const form = new FormData()
  const ext = (blob: Blob) =>
    blob.type === 'image/webp' ? 'webp' : blob.type === 'application/pdf' ? 'pdf' : 'jpg'
  form.set('file', prepared.file, `upload.${ext(prepared.file)}`)
  if (prepared.thumb) form.set('thumb', prepared.thumb, `thumb.${ext(prepared.thumb)}`)
  form.set('entityType', entityType)
  form.set('entityId', entityId)
  form.set('kind', file.type === 'application/pdf' ? 'file' : kind)
  if (prepared.width) form.set('width', String(prepared.width))
  if (prepared.height) form.set('height', String(prepared.height))
  const response = await fetch('/api/attachments', {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  })
  if (!response.ok) throw await toApiError(response)
  return AttachmentDto.parse(await response.json())
}

/** Real proportions when we know them, so portrait photos stay portrait. */
const ratio = (f: { width: number | null; height: number | null }): CSSProperties =>
  f.width && f.height ? { aspectRatio: `${f.width} / ${f.height}` } : { aspectRatio: '1 / 1' }

interface Pending {
  id: string
  file: File
  preview: string | null
  status: 'waiting' | 'uploading' | 'done' | 'failed'
  error?: string | undefined
}

/**
 * Photos and slips for one expense, plan item or transaction: a grid at the
 * photos' real proportions, a review step before uploading, and a full-screen
 * viewer to swipe through them (pinch to zoom).
 */
export function Attachments({
  entityType,
  entityId,
  canEdit,
  kind,
  variant = 'grid',
}: {
  entityType: AttachmentEntity
  entityId: string
  canEdit: boolean
  kind: UploadKind
  /** "strip": one swipeable row of photos, for the top of a plan item's sheet. */
  variant?: 'grid' | 'strip'
}) {
  const t = useTranslations()
  const client = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [uploading, setUploading] = useState(false)
  const { data: files = [] } = useQuery({
    queryKey: key(entityType, entityId),
    queryFn: () =>
      apiFetch(`/api/attachments?entityType=${entityType}&entityId=${entityId}`, {
        schema: z.array(AttachmentDto),
      }),
  })
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: key(entityType, entityId) }),
      // The 📷 counts on the timeline.
      client.invalidateQueries({ queryKey: ['attachment-counts'] }),
    ])

  function choose(list: File[]) {
    setPending(
      list.map((file, i) => ({
        id: `${Date.now()}-${i}`,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        status: 'waiting',
      })),
    )
  }
  function closeReview() {
    for (const p of pending) if (p.preview) URL.revokeObjectURL(p.preview)
    setPending([])
  }
  async function uploadAll() {
    setUploading(true)
    const set = (id: string, patch: Partial<Pending>) =>
      setPending((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    let failed = false
    // One at a time: phones on hotel Wi-Fi do better than with several at once.
    for (const p of pending) {
      if (p.status === 'done') continue
      set(p.id, { status: 'uploading', error: undefined })
      try {
        await uploadOne(p.file, entityType, entityId, kind)
        set(p.id, { status: 'done' })
      } catch (e) {
        failed = true
        set(p.id, {
          status: 'failed',
          error: t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`),
        })
      }
    }
    await refresh()
    setUploading(false)
    // All in: close by itself. Something failed: stay open to retry or remove it.
    if (!failed) closeReview()
  }

  async function remove(id: string) {
    if (!(await confirmDialog(t('common.confirmDelete'), { danger: true }))) return
    await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' })
    setViewing(null)
    await refresh()
  }

  const left = pending.filter((p) => p.status !== 'done').length

  const tile = (file: AttachmentDto, index: number, className: string, style: CSSProperties) => (
    <button
      key={file.id}
      type="button"
      onClick={() => setViewing(index)}
      aria-label={t('attachments.view', { n: index + 1, count: files.length })}
      className={cn('overflow-hidden rounded-xl border bg-muted', className)}
      style={style}
    >
      {file.contentType === 'application/pdf' ? (
        <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <FileText aria-hidden className="size-8" />
          {t('attachments.pdf')}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- private, permission-checked image
        <img
          src={file.thumbUrl ?? file.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      )}
    </button>
  )

  return (
    <section>
      {variant === 'strip' ? (
        files.length === 0 && !canEdit ? null : (
          // One row at the photos' own proportions; swipe for more.
          <div className="scrollbar-none -mx-4 flex h-28 gap-2 overflow-x-auto px-4">
            {files.map((file, index) =>
              tile(
                file,
                index,
                'h-full shrink-0',
                file.contentType === 'application/pdf' ? { aspectRatio: '3 / 4' } : ratio(file),
              ),
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => input.current?.click()}
                aria-label={t('attachments.add')}
                className="flex h-full w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs text-muted-foreground"
              >
                <ImagePlus aria-hidden className="size-6" />
                {files.length === 0 ? t('attachments.addPhoto') : t('attachments.more')}
              </button>
            )}
          </div>
        )
      ) : (
        <>
          <SectionTitle>{t('attachments.title')}</SectionTitle>
          {/* Columns, not a fixed grid: a portrait photo stays tall, a landscape one wide. */}
          <div className="columns-2 gap-2 sm:columns-3">
            {canEdit && (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="mb-2 flex aspect-[4/3] w-full break-inside-avoid flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs text-muted-foreground"
              >
                <ImagePlus aria-hidden className="size-7" />
                {t('attachments.add')}
              </button>
            )}
            {files.map((file, index) =>
              tile(
                file,
                index,
                'mb-2 block w-full break-inside-avoid',
                file.contentType === 'application/pdf' ? { aspectRatio: '1 / 1' } : ratio(file),
              ),
            )}
          </div>
          {!canEdit && files.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('attachments.empty')}</p>
          )}
        </>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          const list = [...(e.target.files ?? [])]
          e.target.value = ''
          if (list.length > 0) choose(list)
        }}
      />

      {/* Review before uploading: see what was picked, drop any, then send. */}
      <Sheet
        open={pending.length > 0}
        onClose={() => !uploading && closeReview()}
        title={t('attachments.reviewTitle', { count: pending.length })}
      >
        <div className="space-y-4">
          <ul className="grid grid-cols-3 gap-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="relative aspect-square overflow-hidden rounded-xl border bg-muted"
              >
                {p.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file
                  <img src={p.preview} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                    <FileText aria-hidden className="size-8" />
                    {t('attachments.pdf')}
                  </span>
                )}
                {p.status === 'waiting' || p.status === 'failed'
                  ? !uploading && (
                      <button
                        type="button"
                        aria-label={t('attachments.removePicked')}
                        onClick={() => {
                          if (p.preview) URL.revokeObjectURL(p.preview)
                          setPending((list) => list.filter((x) => x.id !== p.id))
                        }}
                        className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    )
                  : null}
                {p.status !== 'waiting' && (
                  <span
                    className={cn(
                      'absolute inset-0 flex items-center justify-center',
                      p.status === 'uploading' && 'bg-black/40 text-white',
                      p.status === 'done' && 'bg-success/40 text-white',
                      p.status === 'failed' && 'bg-danger/50 text-white',
                    )}
                  >
                    {p.status === 'uploading' && (
                      <LoaderCircle aria-hidden className="size-7 animate-spin" />
                    )}
                    {p.status === 'done' && <Check aria-hidden className="size-8" />}
                    {p.status === 'failed' && <TriangleAlert aria-hidden className="size-7" />}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {pending.some((p) => p.status === 'failed') && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {t('attachments.someFailed', {
                count: pending.filter((p) => p.status === 'failed').length,
              })}{' '}
              {pending.find((p) => p.error)?.error}
            </p>
          )}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Button variant="secondary" disabled={uploading} onClick={closeReview}>
              {t('common.cancel')}
            </Button>
            <Button disabled={uploading || left === 0} onClick={uploadAll}>
              {uploading
                ? t('attachments.uploadingCount', {
                    done: pending.filter((p) => p.status === 'done').length,
                    count: pending.length,
                  })
                : t('attachments.upload', { count: left })}
            </Button>
          </div>
        </div>
      </Sheet>

      {viewing !== null && files.length > 0 && (
        <Viewer
          files={files}
          start={Math.min(viewing, files.length - 1)}
          canEdit={canEdit}
          onClose={() => setViewing(null)}
          onDelete={remove}
        />
      )}
    </section>
  )
}

/**
 * Full screen, black, one photo at a time: swipe (or ← →) to the next, pinch to
 * zoom, "2 / 5" on top. PDFs open in place.
 */
export function Viewer({
  files,
  start,
  canEdit,
  onClose,
  onDelete,
  deleteLabel,
}: {
  files: Pick<AttachmentDto, 'id' | 'url' | 'contentType'>[]
  start: number
  canEdit: boolean
  onClose: () => void
  onDelete: (id: string) => void
  /** E.g. "Remove cover photo"; defaults to "Delete file". */
  deleteLabel?: string | undefined
}) {
  const t = useTranslations()
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(start)
  const current = files[index] ?? files[0]
  // A home-screen iPhone app can't open a file in a new tab: it gets stuck on the file with
  // no way back. There the button shares the file instead; it is fetched ahead, because the
  // share sheet only opens straight from a tap.
  const standalone = useSyncExternalStore(
    () => () => undefined,
    isStandaloneApp,
    () => false,
  )
  const [ready, setReady] = useState<{ id: string; file: File } | null>(null)
  const [shareFailed, setShareFailed] = useState(false)
  const currentId = current?.id
  const currentUrl = current?.url
  const currentType = current?.contentType
  useEffect(() => {
    if (!standalone || !currentId || !currentUrl) return
    let alive = true
    void fetch(currentUrl, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!alive || !blob) return
        const ext = currentType === 'application/pdf' ? 'pdf' : (blob.type.split('/')[1] ?? 'jpg')
        const name = `iplan-${index + 1}.${ext === 'jpeg' ? 'jpg' : ext}`
        setReady({ id: currentId, file: new File([blob], name, { type: blob.type }) })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [standalone, currentId, currentUrl, currentType, index])
  const shareable = ready && ready.id === currentId && canShareFile(ready.file) ? ready.file : null

  // Open on the tapped photo, then follow the swipe.
  useEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = start * el.clientWidth
  }, [start])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })
  function go(step: number) {
    const el = track.current
    if (!el) return
    const next = Math.max(0, Math.min(files.length - 1, index + step))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }
  if (!current) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('attachments.title')}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('attachments.close')}
          className="text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X aria-hidden className="size-6" />
        </Button>
        <span className="text-sm tabular-nums" aria-live="polite">
          {index + 1} / {files.length}
        </span>
        <div className="flex gap-1">
          {standalone ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('attachments.share')}
              disabled={!shareable}
              className="text-white hover:bg-white/10 disabled:opacity-40"
              onClick={async () => {
                if (!shareable) return
                setShareFailed(false)
                try {
                  await shareFile(shareable)
                } catch {
                  setShareFailed(true)
                }
              }}
            >
              <Share aria-hidden className="size-5" />
            </Button>
          ) : (
            <a
              href={current.url}
              target="_blank"
              rel="noreferrer"
              aria-label={t('attachments.open')}
              className={buttonVariants({
                variant: 'ghost',
                size: 'icon',
                className: 'text-white hover:bg-white/10',
              })}
            >
              <ExternalLink aria-hidden className="size-5" />
            </a>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={deleteLabel ?? t('attachments.delete')}
              className="text-red-400 hover:bg-white/10"
              onClick={() => onDelete(current.id)}
            >
              <Trash2 aria-hidden className="size-5" />
            </Button>
          )}
        </div>
      </div>

      {shareFailed && (
        <p role="alert" className="mx-4 rounded-xl bg-white/10 px-3 py-2 text-center text-sm">
          {t('attachments.shareFailed')}
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
          }}
          className="scrollbar-none flex size-full snap-x snap-mandatory overflow-x-auto"
        >
          {files.map((file) => (
            <div
              key={file.id}
              className="flex h-full w-full shrink-0 snap-center items-center justify-center overflow-auto [touch-action:pan-x_pan-y_pinch-zoom]"
            >
              {file.contentType === 'application/pdf' ? (
                <iframe src={file.url} title="PDF" className="size-full bg-white" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- private, permission-checked image
                <img
                  src={file.url}
                  alt=""
                  decoding="async"
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>
          ))}
        </div>
        {files.length > 1 && (
          <>
            <button
              type="button"
              aria-label={t('attachments.previous')}
              disabled={index === 0}
              onClick={() => go(-1)}
              className="absolute top-1/2 left-2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 disabled:opacity-0 md:flex"
            >
              <ChevronLeft aria-hidden className="size-6" />
            </button>
            <button
              type="button"
              aria-label={t('attachments.next')}
              disabled={index === files.length - 1}
              onClick={() => go(1)}
              className="absolute top-1/2 right-2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 disabled:opacity-0 md:flex"
            >
              <ChevronRight aria-hidden className="size-6" />
            </button>
          </>
        )}
      </div>

      {/* Dots under the photo; the current one wider. */}
      {files.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {files.map((file, i) => (
            <span
              key={file.id}
              aria-hidden
              className={cn(
                'h-1.5 rounded-full bg-white/40',
                i === index ? 'w-4 bg-white' : 'w-1.5',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
