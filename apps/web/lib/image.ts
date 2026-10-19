/**
 * Shrinks photos in the browser before upload: slips stay sharp enough to read
 * (2000 px, quality 0.85), other photos 1600 px at 0.80, plus a 400 px
 * thumbnail. Re-encoding through a canvas also drops EXIF (including GPS).
 */
export type UploadKind = 'slip' | 'photo'

export const PRESETS: Record<UploadKind, { maxEdge: number; quality: number }> = {
  slip: { maxEdge: 2000, quality: 0.85 },
  photo: { maxEdge: 1600, quality: 0.8 },
}
const THUMB = { maxEdge: 400, quality: 0.7 }

/** Target size that fits inside maxEdge without ever enlarging. */
export function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    // Browsers apply EXIF orientation when drawing <img>, so photos come out upright.
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Cannot read this image'))
    }
    img.src = url
  })
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function render(img: HTMLImageElement, preset: { maxEdge: number; quality: number }) {
  const size = fitWithin(img.naturalWidth, img.naturalHeight, preset.maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(img, 0, 0, size.width, size.height)
  // Older Safari can't encode WebP and silently returns PNG; use JPEG then.
  let blob = await encode(canvas, 'image/webp', preset.quality)
  if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', preset.quality)
  if (!blob) throw new Error('Could not compress the image')
  return { blob, ...size }
}

export interface PreparedUpload {
  file: Blob
  thumb?: Blob
  width?: number
  height?: number
}

export async function prepareUpload(file: File, kind: UploadKind): Promise<PreparedUpload> {
  if (file.type === 'application/pdf') return { file }
  const img = await loadImage(file)
  const main = await render(img, PRESETS[kind])
  const thumb = await render(img, THUMB)
  return { file: main.blob, thumb: thumb.blob, width: main.width, height: main.height }
}

/** Square-ish 400 px profile picture, EXIF stripped. */
export async function prepareAvatar(file: File): Promise<Blob> {
  const img = await loadImage(file)
  return (await render(img, { maxEdge: 400, quality: 0.85 })).blob
}
