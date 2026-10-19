/* eslint-disable @next/next/no-img-element -- tiny static SVGs need no image optimisation */

/**
 * The iPlan mark (a lowercase "i" drawn as a route): the gradient version in
 * the light theme, the dark version in the dark theme.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  const box = { width: size, height: size }
  return (
    <>
      <img
        src="/icons/iplan-gradient.svg"
        alt=""
        {...box}
        className="shrink-0 dark:hidden"
        style={box}
      />
      <img
        src="/icons/iplan.svg"
        alt=""
        {...box}
        className="hidden shrink-0 dark:block"
        style={box}
      />
    </>
  )
}

/** Mark and name, as in the app header. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={className ?? 'inline-flex items-center gap-2 font-display text-[22px] font-bold'}
    >
      <LogoMark />
      <span>iPlan</span>
    </span>
  )
}
