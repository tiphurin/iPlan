'use client'

import { useEffect, useState } from 'react'
import { zoneShort } from '@/lib/time-zones'
import { useFormat } from '@/lib/use-format'

/** "TH 16:56 · KR 18:56" pills, ticking every 30 s (as in the prototype). */
export function ZoneClocks({ zones, serverNow }: { zones: string[]; serverNow?: number }) {
  const f = useFormat()
  const [now, setNow] = useState(() => serverNow ?? Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 30_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [])
  return (
    <div className="flex flex-wrap gap-1.5">
      {zones.map((zone) => (
        <span
          key={zone}
          className="rounded-full border bg-card px-2.5 py-0.5 text-[13px] text-muted-foreground"
        >
          {zoneShort(zone)}
          <b className="num ml-1 text-[15px] text-foreground" suppressHydrationWarning>
            {f.time(new Date(now), zone)}
          </b>
        </span>
      ))}
    </div>
  )
}
