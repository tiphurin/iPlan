'use client'

import { AttachmentDto, type AttachmentEntity } from '@iplan/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FileText, ImagePlus, Trash2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { z } from 'zod'
import { Button, buttonVariants } from '@/components/ui/button'
import { SectionTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api-client'
import { ApiError, toApiError } from '@/lib/api-error'
import { type UploadKind, prepareUpload } from '@/lib/image'
import { confirmDialog } from '@/lib/confirm'

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

/** Thumbnails, upload button and a full-screen viewer (pinch to zoom) for one expense or plan item. */
export function Attachments({
  entityType,
  entityId,
  canEdit,
  kind,
}: {
  entityType: AttachmentEntity
  entityId: string
  canEdit: boolean
  kind: UploadKind
}) {
  const t = useTranslations()
  const client = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState<AttachmentDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { data: files = [] } = useQuery({
    queryKey: key(entityType, entityId),
    queryFn: () =>
      apiFetch(`/api/attachments?entityType=${entityType}&entityId=${entityId}`, {
        schema: z.array(AttachmentDto),
      }),
  })
  const refresh = () => client.invalidateQueries({ queryKey: key(entityType, entityId) })
  const upload = useMutation({
    mutationFn: async (list: File[]) => {
      for (const file of list) await uploadOne(file, entityType, entityId, kind)
    },
    onSuccess: refresh,
    onError: (e) => setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/attachments/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setOpen(null)
      await refresh()
    },
  })

  return (
    <section>
      <SectionTitle>{t('attachments.title')}</SectionTitle>
      {error && (
        <p role="alert" className="mb-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {files.map((file) => (
          <button
            key={file.id}
            type="button"
            onClick={() => setOpen(file)}
            className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-muted"
          >
            {file.contentType === 'application/pdf' ? (
              <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                <FileText aria-hidden className="size-8" />
                {t('attachments.pdf')}
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- private, permission-checked image
              <img
                src={file.thumbUrl ?? file.url}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            )}
          </button>
        ))}
        {canEdit && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={upload.isPending}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs text-muted-foreground disabled:opacity-60"
          >
            <ImagePlus aria-hidden className="size-7" />
            {upload.isPending ? t('attachments.uploading') : t('attachments.add')}
          </button>
        )}
      </div>
      {!canEdit && files.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('attachments.empty')}</p>
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
          setError(null)
          if (list.length > 0) upload.mutate(list)
        }}
      />

      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('attachments.close')}
              className="text-white hover:bg-white/10"
              onClick={() => setOpen(null)}
            >
              <X aria-hidden className="size-6" />
            </Button>
            <div className="flex gap-1">
              <a
                href={open.url}
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
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('attachments.delete')}
                  className="text-red-400 hover:bg-white/10"
                  onClick={async () =>
                    (await confirmDialog(t('common.confirmDelete'), { danger: true })) &&
                    remove.mutate(open.id)
                  }
                >
                  <Trash2 aria-hidden className="size-5" />
                </Button>
              )}
            </div>
          </div>
          {/* Native pinch-zoom inside the scroll area, good for reading small text on slips. */}
          <div className="flex flex-1 items-center justify-center overflow-auto [touch-action:pan-x_pan-y_pinch-zoom]">
            {open.contentType === 'application/pdf' ? (
              <iframe src={open.url} title="PDF" className="size-full bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- private, permission-checked image
              <img src={open.url} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
