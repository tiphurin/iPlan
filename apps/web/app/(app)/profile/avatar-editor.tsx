'use client'

import { MeDto } from '@iplan/contracts'
import { Camera, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { apiFetch } from '@/lib/api-client'
import { ApiError, toApiError } from '@/lib/api-error'
import { prepareAvatar } from '@/lib/image'

/** Tap the picture to replace it; shrunk to 400 px in the browser before upload. */
export function AvatarEditor({ name, image }: { name: string; image: string | null }) {
  const t = useTranslations()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uploaded = image?.startsWith('/api/') ?? false

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      router.refresh()
    } catch (e) {
      setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`))
    } finally {
      setBusy(false)
    }
  }

  async function upload(file: File) {
    const blob = await prepareAvatar(file)
    const form = new FormData()
    form.set('file', blob, blob.type === 'image/webp' ? 'avatar.webp' : 'avatar.jpg')
    const response = await fetch('/api/me/avatar', {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    })
    if (!response.ok) throw await toApiError(response)
    MeDto.parse(await response.json())
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        aria-label={t('profile.changePhoto')}
        className="relative rounded-full disabled:opacity-60"
      >
        <Avatar name={name} image={image} size={72} />
        <span className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-card bg-foreground text-background">
          <Camera aria-hidden className="size-4" />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void run(() => upload(file))
        }}
      />
      {uploaded && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await apiFetch('/api/me/avatar', { method: 'DELETE', schema: MeDto })
            })
          }
          className="inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground"
        >
          <Trash2 aria-hidden className="size-3.5" />
          {t('profile.removePhoto')}
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
