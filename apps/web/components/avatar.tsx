/** Round profile picture, or the first letter on a coloured circle. */
export function Avatar({
  name,
  image,
  size = 40,
}: {
  name: string
  image: string | null
  size?: number
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Google avatar URL, tiny
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="rounded-full border object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full bg-foreground font-display font-bold text-background"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
