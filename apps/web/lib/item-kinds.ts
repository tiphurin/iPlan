import type { TripItemKind } from '@iplan/contracts'
import {
  CheckSquare,
  type LucideIcon,
  MapPin,
  Moon,
  Plane,
  Sunrise,
  TrainFront,
} from 'lucide-react'

export const ITEM_KINDS: readonly TripItemKind[] = [
  'place',
  'move',
  'flight',
  'task',
  'wake',
  'sleep',
]

export const KIND_STYLE: Record<TripItemKind, { icon: LucideIcon; tone: string }> = {
  place: { icon: MapPin, tone: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' },
  move: { icon: TrainFront, tone: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  flight: { icon: Plane, tone: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400' },
  task: { icon: CheckSquare, tone: 'bg-amber-500/14 text-amber-700 dark:text-amber-400' },
  wake: { icon: Sunrise, tone: 'bg-orange-500/12 text-orange-600 dark:text-orange-400' },
  sleep: { icon: Moon, tone: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
}
